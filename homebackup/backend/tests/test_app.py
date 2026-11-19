from fastapi.testclient import TestClient

from homebackup.main import create_app


def test_spa_and_assets_served_relative(tmp_path, store):
    (tmp_path / "ui" / "assets").mkdir(parents=True)
    (tmp_path / "ui" / "index.html").write_text("<html>hb</html>")
    (tmp_path / "ui" / "assets" / "app.js").write_text("console.log(1)")
    client = TestClient(create_app(static_dir=tmp_path / "ui", store=store, extra_clients=("testclient",)))
    page = client.get("/")
    assert page.text == "<html>hb</html>" and page.headers["cache-control"] == "no-cache"
    assert client.get("/assets/app.js").status_code == 200


def test_openapi_published(client):
    paths = client.get("/api/v1/openapi.json").json()["paths"]
    assert {"/api/v1/status", "/api/v1/items/check", "/api/v1/targets/test", "/api/v1/types/refresh"} <= set(paths)


def test_only_ingress_proxy_allowed(store):
    other = TestClient(create_app(store=store), client=("172.30.33.5", 50000))
    assert other.get("/api/v1/status").status_code == 403
    ingress = TestClient(create_app(store=store), client=("172.30.32.2", 50000))
    assert ingress.get("/api/v1/status").status_code == 200


def test_app_factory_serves_the_ui(tmp_path, monkeypatch):
    from homebackup.main import app_factory
    (tmp_path / "ui").mkdir()
    (tmp_path / "ui" / "index.html").write_text("<html>hb</html>")
    monkeypatch.setenv("HOMEBACKUP_DEMO", "1")
    monkeypatch.setenv("HOMEBACKUP_DATA", str(tmp_path / "data"))
    monkeypatch.setenv("HOMEBACKUP_STATIC", str(tmp_path / "ui"))
    assert TestClient(app_factory(), client=("172.30.32.2", 1)).get("/").text == "<html>hb</html>"
