import asyncio
import os
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .models import ItemView, Result, RunSummary, Settings, Status, TargetView
from .store import Conflict, Store


class RunPage(BaseModel):
    runs: list[RunSummary]
    total: int
    counts: dict[str, int]


def build_api(store: Store) -> APIRouter:
    api = APIRouter(prefix="/api/v1")

    @api.get("/status")
    def status() -> Status:
        return store.status()

    @api.get("/items")
    def items() -> list[ItemView]:
        return store.item_views()

    @api.get("/runs")
    def runs(item_id: str | None = None, status: Result | None = None,
             limit: int = Query(12, ge=1, le=200), offset: int = Query(0, ge=0)) -> RunPage:
        rows, total, counts = store.query_runs(item_id, status, limit, offset)
        return RunPage(runs=rows, total=total, counts=counts)

    @api.get("/runs/{run_id}")
    def run(run_id: str) -> RunSummary:
        if r := store.run(run_id):
            return r
        raise HTTPException(404, "Run not found")

    @api.post("/items/{item_id}/run")
    def run_now(item_id: str) -> Status:
        try:
            store.run_now(item_id)
        except KeyError:
            raise HTTPException(404, "Item not found")
        except Conflict:
            raise HTTPException(409, "Item is already running or queued")
        return store.status()

    @api.post("/runs/{run_id}/cancel")
    def cancel(run_id: str) -> RunSummary:
        try:
            return store.cancel(run_id)
        except KeyError:
            raise HTTPException(404, "Run not found")
        except Conflict:
            raise HTTPException(409, "Run is not running")

    @api.get("/targets")
    def targets() -> list[TargetView]:
        return store.target_views()

    @api.get("/settings")
    def settings() -> Settings:
        return store.settings

    @api.get("/events", response_class=StreamingResponse)
    async def events(request: Request):
        async def stream():
            while not await request.is_disconnected():
                for p in store.progress():
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
    # No /docs: Swagger UI loads from a CDN and the add-on makes no outside requests.
    app = FastAPI(title="HomeBackup", version="0.1.0", openapi_url="/api/v1/openapi.json",
                  docs_url=None, redoc_url=None)
    allowed = {INGRESS_PROXY, "127.0.0.1", "::1", *extra_clients}

    @app.middleware("http")
    async def ingress_only(request: Request, call_next):
        # No auth of our own: only HA's Ingress proxy (and localhost for dev) may talk to us.
        if request.client is None or request.client.host not in allowed:
            return PlainTextResponse("Forbidden", status_code=403)
        return await call_next(request)

    app.include_router(build_api(store or Store()))
    if static_dir:
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="ui")
    return app


app = create_app(Path(os.environ["HOMEBACKUP_STATIC"]) if os.environ.get("HOMEBACKUP_STATIC") else None)
