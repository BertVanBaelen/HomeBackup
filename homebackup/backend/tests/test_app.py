from fastapi.testclient import TestClient

from homebackup.main import create_app


def test_spa_and_assets_served_relative(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>hb</html>")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    client = TestClient(create_app(static_dir=tmp_path, extra_clients=("testclient",)))
    assert client.get("/").text == "<html>hb</html>"
    assert client.get("/assets/app.js").status_code == 200


def test_openapi_published():
    client = TestClient(create_app(static_dir=None, extra_clients=("testclient",)))
    paths = client.get("/api/v1/openapi.json").json()["paths"]
    assert "/api/v1/status" in paths


def test_only_ingress_proxy_allowed():
    other = TestClient(create_app(), client=("172.30.33.5", 50000))
    assert other.get("/api/v1/status").status_code == 403
    ingress = TestClient(create_app(), client=("172.30.32.2", 50000))
    assert ingress.get("/api/v1/status").status_code == 200
