import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import ConfigInvalid
from .models import (
    BackupType,
    ConfigStatus,
    Device,
    Item,
    ItemCheck,
    ItemView,
    Listing,
    LogLine,
    Plan,
    Result,
    RunDetail,
    RunSummary,
    Settings,
    Status,
    Target,
    TargetIn,
    TargetTest,
    TargetView,
)
from .store import BadPath, Conflict, InUse, Store


class RunPage(BaseModel):
    runs: list[RunSummary]
    total: int
    counts: dict[str, int]


class RunWithLog(BaseModel):
    run: RunDetail
    log: list[LogLine]


def build_api(store: Store) -> APIRouter:
    api = APIRouter(prefix="/api/v1")

    def item_or_404(item_id: str) -> Item:
        if item := store.items.get(item_id):
            return item
        raise HTTPException(404, "Item not found")

    # --- status and items ----------------------------------------------------------------
    @api.get("/status")
    def status() -> Status:
        return store.status()

    @api.get("/items")
    def items() -> list[ItemView]:
        return store.item_views()

    @api.get("/items/{item_id}")
    def item(item_id: str) -> Item:
        return item_or_404(item_id)

    @api.post("/items", status_code=201)
    def create_item(item: Item) -> Item:
        try:
            return store.save_item(item)
        except KeyError:
            raise HTTPException(422, "Unknown target")

    @api.put("/items/{item_id}")
    def update_item(item_id: str, item: Item) -> Item:
        item_or_404(item_id)
        try:
            return store.save_item(item, item_id)
        except KeyError:
            raise HTTPException(422, "Unknown target")

    @api.delete("/items/{item_id}", status_code=204)
    def delete_item(item_id: str):
        item_or_404(item_id)
        try:
            store.delete_item(item_id)
        except InUse:
            raise HTTPException(409, "Item is running")
        return Response(status_code=204)

    @api.post("/items/check")
    def check_item(item: Item) -> ItemCheck:
        """Checks for unsaved editor values: nothing is stored."""
        return store.check_item(item)

    @api.post("/plans")
    def plan_unsaved(item: Item, dry_run: bool = False) -> Plan:
        if item.target_id not in store.targets:
            raise HTTPException(422, "Unknown target")
        return store.plan_for(item, dry_run)

    @api.get("/items/{item_id}/plan")
    def plan(item_id: str, dry_run: bool = False) -> Plan:
        return store.plan_for(item_or_404(item_id), dry_run)

    @api.post("/items/{item_id}/run")
    def run_now(item_id: str, dry_run: bool = False) -> Status:
        try:
            store.runner.request(item_id, "dry_run" if dry_run else "manual")
        except KeyError:
            raise HTTPException(404, "Item not found")
        except Conflict:
            raise HTTPException(409, "Item is already running or queued")
        return store.status()

    # --- runs ------------------------------------------------------------------------------
    @api.get("/runs")
    def runs(item_id: str | None = None, status: Result | None = None,
             limit: int = Query(12, ge=1, le=200), offset: int = Query(0, ge=0)) -> RunPage:
        rows, total, counts = store.history.query(item_id, status, limit, offset)
        return RunPage(runs=rows, total=total, counts=counts)

    @api.get("/runs/{run_id}")
    def run(run_id: str) -> RunWithLog:
        r = store.runner.current if store.runner.current and store.runner.current.id == run_id else store.history.get(run_id)
        if r is None:
            raise HTTPException(404, "Run not found")
        return RunWithLog(run=r, log=store.history.read_log(run_id)[-5000:])

    @api.post("/runs/{run_id}/cancel", status_code=202)
    def cancel(run_id: str) -> Status:
        try:
            store.runner.cancel(run_id)
        except Conflict:
            raise HTTPException(409, "Run is not running")
        return store.status()

    # --- targets ---------------------------------------------------------------------------
    @api.get("/targets")
    async def targets() -> list[TargetView]:
        return await store.target_views()

    @api.post("/targets", status_code=201)
    def create_target(t: TargetIn) -> Target:
        return store.save_target(t)

    @api.put("/targets/{target_id}")
    def update_target(target_id: str, t: TargetIn) -> Target:
        if target_id not in store.targets:
            raise HTTPException(404, "Target not found")
        return store.save_target(t, target_id)

    @api.delete("/targets/{target_id}", status_code=204)
    def delete_target(target_id: str):
        if target_id not in store.targets:
            raise HTTPException(404, "Target not found")
        try:
            store.delete_target(target_id)
        except InUse:
            raise HTTPException(409, "Target is used by an item")
        return Response(status_code=204)

    @api.post("/targets/test")
    async def test_target(t: TargetIn) -> TargetTest:
        return await store.test_target(t)

    @api.get("/browse")
    def browse(path: str | None = None) -> Listing:
        try:
            return store.browse(path)
        except BadPath:
            raise HTTPException(400, "Only the mapped source folders can be browsed")
        except KeyError:
            raise HTTPException(404, "Folder not found")

    @api.get("/devices")
    async def devices() -> list[Device]:
        return await store.devices()

    # --- settings, config, types, scripts ----------------------------------------------------
    @api.get("/settings")
    def settings() -> Settings:
        return store.settings

    @api.put("/settings")
    def save_settings(s: Settings) -> Settings:
        return store.save_settings(s)

    @api.get("/config")
    def config_status() -> ConfigStatus:
        return store.config_status()

    @api.post("/config/check")
    def config_check() -> ConfigStatus:
        return store.reload_config()

    @api.get("/types")
    def types() -> list[BackupType]:
        return store.backup_types()

    @api.post("/types/refresh")
    def refresh_types() -> list[BackupType]:
        return store.refresh_types()

    @api.get("/scripts")
    def scripts() -> list[str]:
        return store.scripts()

    @api.get("/events", response_class=StreamingResponse)
    async def events(request: Request):
        async def stream():
            while not await request.is_disconnected():
                for p in store.status().running:
                    yield f"event: progress\ndata: {p.model_dump_json()}\n\n"
                yield ": ping\n\n"  # heartbeat keeps proxies from closing an idle stream
                await asyncio.sleep(2)

        # X-Accel-Buffering keeps HA's ingress proxy from holding events back
        return StreamingResponse(stream(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    return api


INGRESS_PROXY = "172.30.32.2"


def create_app(static_dir: Path | None = None, store: Store | None = None,
               extra_clients: tuple[str, ...] = ()) -> FastAPI:
    store = store or Store.from_env()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        worker = asyncio.create_task(store.runner.worker())
        yield
        worker.cancel()

    # No /docs: Swagger UI loads from a CDN and the add-on makes no outside requests.
    app = FastAPI(title="HomeBackup", version="0.3.0", openapi_url="/api/v1/openapi.json",
                  docs_url=None, redoc_url=None, lifespan=lifespan)
    app.state.store = store
    allowed = {INGRESS_PROXY, "127.0.0.1", "::1", *extra_clients}

    @app.middleware("http")
    async def ingress_only(request: Request, call_next):
        # No auth of our own: only HA's Ingress proxy (and localhost for dev) may talk to us.
        if request.client is None or request.client.host not in allowed:
            return PlainTextResponse("Forbidden", status_code=403)
        response = await call_next(request)
        if request.url.path in ("/", "/index.html"):
            response.headers["Cache-Control"] = "no-cache"  # assets are hashed; the page must pick up add-on updates
        return response

    @app.exception_handler(ConfigInvalid)
    async def config_invalid(_: Request, e: ConfigInvalid):
        return JSONResponse({"detail": {"code": "config_invalid", "error": str(e)}}, status_code=409)

    app.include_router(build_api(store))
    if static_dir:
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="ui")
    return app


def app_factory() -> FastAPI:
    """Entry point: `uvicorn homebackup.main:app_factory --factory`."""
    static = os.environ.get("HOMEBACKUP_STATIC")
    return create_app(Path(static) if static else None)
