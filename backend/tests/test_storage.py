# groei/backend/tests/test_storage.py
import io
import os
import pytest
from services.storage import R2Storage, build_storage_from_env


def test_build_from_env_returns_storage(monkeypatch):
    monkeypatch.setenv("R2_ACCOUNT_ID", "x")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "y")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "z")
    monkeypatch.setenv("R2_BUCKET", "b")
    monkeypatch.setenv("R2_PUBLIC_BASE_URL", "https://cdn.example.com")
    s = build_storage_from_env()
    assert isinstance(s, R2Storage)
    assert s.public_base_url == "https://cdn.example.com"


def test_public_url_combines_base_and_key():
    s = R2Storage(client=None, bucket="b", public_base_url="https://cdn.example.com")
    assert s.public_url("photos/1.png") == "https://cdn.example.com/photos/1.png"


def test_public_url_strips_trailing_slash_from_base():
    s = R2Storage(client=None, bucket="b", public_base_url="https://cdn.example.com/")
    assert s.public_url("photos/1.png") == "https://cdn.example.com/photos/1.png"


def test_delete_calls_delete_object():
    class FakeClient:
        def __init__(self):
            self.deleted = []
        def delete_object(self, Bucket, Key):
            self.deleted.append((Bucket, Key))

    client = FakeClient()
    storage = R2Storage(client=client, bucket="b", public_base_url="https://cdn.x")
    storage.delete("photos/1/2/3.jpg")
    assert client.deleted == [("b", "photos/1/2/3.jpg")]


# --- Storage.get() graceful degradation (#617) ---
import io
from botocore.exceptions import ClientError


def _client_error(code: str) -> ClientError:
    """A real botocore ClientError carrying the given AWS/R2 error Code."""
    return ClientError(
        error_response={
            "Error": {"Code": code, "Message": "boom"},
            "ResponseMetadata": {"HTTPStatusCode": 503},
        },
        operation_name="GetObject",
    )


class _RaisingClient:
    def __init__(self, error):
        self.error = error

    def get_object(self, Bucket, Key):
        raise self.error


def test_get_returns_bytes_on_success():
    class FakeClient:
        def get_object(self, Bucket, Key):
            return {"Body": io.BytesIO(b"photo-bytes")}

    storage = R2Storage(client=FakeClient(), bucket="b", public_base_url="https://cdn.x")
    assert storage.get("photos/1.jpg") == b"photo-bytes"


def test_get_returns_none_on_no_such_key():
    storage = R2Storage(
        client=_RaisingClient(_client_error("NoSuchKey")),
        bucket="b",
        public_base_url="https://cdn.x",
    )
    assert storage.get("photos/1.jpg") is None


def test_get_returns_none_on_service_unavailable():
    """Transient R2 outage must degrade to 'no image', not raise (#617)."""
    storage = R2Storage(
        client=_RaisingClient(_client_error("ServiceUnavailable")),
        bucket="b",
        public_base_url="https://cdn.x",
    )
    assert storage.get("photos/1.jpg") is None


def test_get_returns_none_on_slow_down():
    storage = R2Storage(
        client=_RaisingClient(_client_error("SlowDown")),
        bucket="b",
        public_base_url="https://cdn.x",
    )
    assert storage.get("photos/1.jpg") is None


def test_get_returns_none_on_throttling():
    storage = R2Storage(
        client=_RaisingClient(_client_error("Throttling")),
        bucket="b",
        public_base_url="https://cdn.x",
    )
    assert storage.get("photos/1.jpg") is None


def test_get_re_raises_other_client_errors():
    """Non-transient errors (e.g. AccessDenied) must still propagate."""
    storage = R2Storage(
        client=_RaisingClient(_client_error("AccessDenied")),
        bucket="b",
        public_base_url="https://cdn.x",
    )
    with pytest.raises(ClientError):
        storage.get("photos/1.jpg")


# --- Backend selection (STORAGE_BACKEND) ---
from services.storage import storage_class


def test_backend_defaults_to_r2_when_unset(monkeypatch):
    """Existing deployments set only R2_* — they must keep getting R2."""
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    assert storage_class() is R2Storage


def test_unknown_backend_is_rejected(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "s4")
    with pytest.raises(ValueError, match="STORAGE_BACKEND"):
        build_storage_from_env()


# --- R2Storage.check_health ---


def test_r2_health_heads_the_healthcheck_key_when_set():
    class FakeClient:
        def head_object(self, Bucket, Key):
            assert (Bucket, Key) == ("b", "health/ping.txt")
            return {"ResponseMetadata": {"HTTPStatusCode": 200}}

    storage = R2Storage(client=FakeClient(), bucket="b", public_base_url="https://cdn.x",
                        healthcheck_key="/health/ping.txt")
    assert storage.check_health() == ("ok", "head_object ok for health/ping.txt")


def test_r2_health_is_degraded_on_non_2xx():
    class FakeClient:
        def list_objects_v2(self, Bucket, MaxKeys):
            return {"KeyCount": 0, "ResponseMetadata": {"HTTPStatusCode": 503}}

    storage = R2Storage(client=FakeClient(), bucket="b", public_base_url="https://cdn.x")
    assert storage.check_health()[0] == "degraded"


# --- LocalStorage ---
from services.storage import LocalStorage


def test_local_backend_from_env(monkeypatch, tmp_path):
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("LOCAL_STORAGE_DIR", str(tmp_path))
    monkeypatch.setenv("LOCAL_STORAGE_PUBLIC_BASE_URL", "https://jardin.example/media/")
    s = build_storage_from_env()
    assert isinstance(s, LocalStorage)
    assert s.mount_path == "/media"
    assert s.public_url("photos/1.jpg") == "https://jardin.example/media/photos/1.jpg"


def test_local_public_base_url_must_have_a_path(tmp_path):
    with pytest.raises(ValueError, match="needs a path"):
        LocalStorage(root=tmp_path, public_base_url="https://jardin.example/")


def test_local_put_get_delete_round_trip(tmp_path):
    s = LocalStorage(root=tmp_path, public_base_url="https://jardin.example/media")
    url = s.put("photos/1/2/3.jpg", b"jpeg-bytes", content_type="image/jpeg")
    assert url == "https://jardin.example/media/photos/1/2/3.jpg"
    assert (tmp_path / "photos/1/2/3.jpg").read_bytes() == b"jpeg-bytes"
    assert s.get("photos/1/2/3.jpg") == b"jpeg-bytes"

    s.delete("photos/1/2/3.jpg")
    assert s.get("photos/1/2/3.jpg") is None


def test_local_put_overwrites_without_leaving_temp_files(tmp_path):
    s = LocalStorage(root=tmp_path, public_base_url="https://x/media")
    s.put("maps/garden.svg", b"<svg>v1</svg>", content_type="image/svg+xml")
    s.put("maps/garden.svg", b"<svg>v2</svg>", content_type="image/svg+xml")
    assert s.get("maps/garden.svg") == b"<svg>v2</svg>"
    assert [p.name for p in (tmp_path / "maps").iterdir()] == ["garden.svg"]


def test_local_missing_key_reads_as_none_and_deletes_quietly(tmp_path):
    s = LocalStorage(root=tmp_path, public_base_url="https://x/media")
    assert s.get("watchdog/state.json") is None
    s.delete("watchdog/state.json")  # no error, like S3 delete_object


@pytest.mark.parametrize("key", ["../outside.jpg", "photos/../../outside.jpg", "", "/"])
def test_local_rejects_keys_outside_the_root(tmp_path, key):
    s = LocalStorage(root=tmp_path / "store", public_base_url="https://x/media")
    with pytest.raises(ValueError):
        s.put(key, b"x", content_type="image/jpeg")


def test_local_health(tmp_path):
    assert LocalStorage(root=tmp_path, public_base_url="https://x/media").check_health()[0] == "ok"
    missing = LocalStorage(root=tmp_path / "missing", public_base_url="https://x/media")
    assert missing.check_health()[0] == "down"


def test_local_mount_serves_files_sandboxed(monkeypatch, tmp_path):
    from fastapi import FastAPI
    from starlette.testclient import TestClient

    monkeypatch.setenv("LOCAL_STORAGE_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("LOCAL_STORAGE_PUBLIC_BASE_URL", "https://jardin.example/media")
    app = FastAPI()
    LocalStorage.mount(app)
    LocalStorage.from_env().put("maps/garden.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>",
                                content_type="image/svg+xml")

    client = TestClient(app)
    res = client.get("/media/maps/garden.svg")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/svg+xml"
    assert "sandbox" in res.headers["content-security-policy"]
    assert res.headers["x-content-type-options"] == "nosniff"
    assert client.get("/media/missing.jpg").status_code == 404
