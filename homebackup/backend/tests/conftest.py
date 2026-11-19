import pytest
from fastapi.testclient import TestClient

from homebackup.main import create_app
from homebackup.store import Store


@pytest.fixture
def store(tmp_path):
    """The design's sample data, simulated commands, instant rsync, nothing running."""
    return Store.demo(tmp_path, rsync_seconds=0, start_running=False)


@pytest.fixture
def client(store):
    with TestClient(create_app(store=store, extra_clients=("testclient",))) as c:
        yield c
