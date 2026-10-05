"""Object storage abstraction.

Callers only see ``Storage``: ``put`` / ``get`` / ``delete`` / ``public_url``
for objects, ``check_health`` for the admin panel, and ``mount`` for backends
the app has to serve itself. ``STORAGE_BACKEND`` names the implementation
(default ``r2``); ``build_storage_from_env`` builds it from its own variables.
"""

import os
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from typing import ClassVar
from urllib.parse import urlparse

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles


class Storage(ABC):
    # Environment variables from_env() reads; the admin health check reports
    # the backend as "unconfigured" while any of them is missing.
    required_env: ClassVar[tuple[str, ...]] = ()

    def __init__(self, public_base_url: str) -> None:
        self.public_base_url = public_base_url.rstrip("/")

    @classmethod
    @abstractmethod
    def from_env(cls) -> "Storage":
        """Build the backend from its environment variables."""

    @classmethod
    def mount(cls, app: FastAPI) -> None:
        """Serve stored objects from the app itself, for backends whose
        public URLs point back at it. Called once at startup; no-op here."""

    def public_url(self, key: str) -> str:
        return f"{self.public_base_url}/{key.lstrip('/')}"

    @abstractmethod
    def put(self, key: str, data: bytes, content_type: str) -> str:
        """Store ``data`` under ``key`` and return its public URL."""

    @abstractmethod
    def get(self, key: str) -> bytes | None:
        """Return an object's bytes, or None if it doesn't exist or the
        storage backend is transiently unavailable (callers treat that like
        a missing image instead of failing the whole request)."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove ``key``; a missing key is not an error."""

    @abstractmethod
    def check_health(self) -> tuple[str, str]:
        """Probe the backend (blocking; run it in a thread) and return
        ``(status, detail)``, status being ``ok``, ``degraded`` or ``down``."""


class R2Storage(Storage):
    """Cloudflare R2 via S3-compatible boto3."""

    required_env = (
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "R2_PUBLIC_BASE_URL",
    )

    def __init__(self, client, bucket: str, public_base_url: str,
                 healthcheck_key: str | None = None) -> None:
        super().__init__(public_base_url)
        self._client = client
        self.bucket = bucket
        self.healthcheck_key = (healthcheck_key or "").strip().lstrip("/")

    @classmethod
    def from_env(cls) -> "R2Storage":
        account_id = os.environ["R2_ACCOUNT_ID"]
        access_key = os.environ["R2_ACCESS_KEY_ID"]
        secret_key = os.environ["R2_SECRET_ACCESS_KEY"]
        bucket = os.environ["R2_BUCKET"]
        public_base = os.environ["R2_PUBLIC_BASE_URL"]

        endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
        return cls(client=client, bucket=bucket, public_base_url=public_base,
                   healthcheck_key=os.environ.get("R2_HEALTHCHECK_KEY"))

    def put(self, key: str, data: bytes, content_type: str) -> str:
        self._client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return self.public_url(key)

    def get(self, key: str) -> bytes | None:
        try:
            resp = self._client.get_object(Bucket=self.bucket, Key=key.lstrip("/"))
            return resp["Body"].read()
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code")
            if code in ("NoSuchKey", "NotFound", "404"):
                return None
            if code in ("ServiceUnavailable", "SlowDown", "Throttling"):
                # Transient R2/S3 outage — degrade gracefully to "no image".
                return None
            raise

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=key.lstrip("/"))

    def check_health(self) -> tuple[str, str]:
        if self.healthcheck_key:
            response = self._client.head_object(Bucket=self.bucket, Key=self.healthcheck_key)
            code = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            status = "ok" if code is None or 200 <= int(code) < 300 else "degraded"
            return status, f"head_object ok for {self.healthcheck_key}"

        response = self._client.list_objects_v2(Bucket=self.bucket, MaxKeys=1)
        code = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        status = "ok" if code is None or 200 <= int(code) < 300 else "degraded"
        count = response.get("KeyCount", 0)
        return status, f"bucket {self.bucket} reachable; sampled {count} object(s)"


class _SandboxedStaticFiles(StaticFiles):
    """Uploads served from the app's own origin (R2 serves them from a
    separate one): the sandbox CSP keeps an SVG opened directly from running
    script there."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response


class LocalStorage(Storage):
    """Files on the server's disk, for self-hosting on a single box.

    Keys map to paths under ``root``; the app serves them at the path of
    ``public_base_url`` (``https://host/media`` → ``/media``). The content
    type is not stored: the static file server infers it from the key's
    extension, which every key the app writes carries.
    """

    required_env = ("LOCAL_STORAGE_DIR", "LOCAL_STORAGE_PUBLIC_BASE_URL")

    def __init__(self, root: str | Path, public_base_url: str) -> None:
        super().__init__(public_base_url)
        self.root = Path(root).resolve()
        self.mount_path = urlparse(self.public_base_url).path
        if not self.mount_path:
            raise ValueError(
                "LOCAL_STORAGE_PUBLIC_BASE_URL needs a path (e.g. https://example.com/media) "
                "so stored files don't shadow the app's own routes"
            )

    @classmethod
    def from_env(cls) -> "LocalStorage":
        return cls(root=os.environ["LOCAL_STORAGE_DIR"],
                   public_base_url=os.environ["LOCAL_STORAGE_PUBLIC_BASE_URL"])

    @classmethod
    def mount(cls, app: FastAPI) -> None:
        storage = cls.from_env()
        storage.root.mkdir(parents=True, exist_ok=True)
        app.mount(storage.mount_path, _SandboxedStaticFiles(directory=storage.root),
                  name="stored-files")

    def _path(self, key: str) -> Path:
        path = (self.root / key.lstrip("/")).resolve()
        if not path.is_relative_to(self.root) or path == self.root:
            raise ValueError(f"Storage key escapes the storage root: {key!r}")
        return path

    def put(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Write-then-rename so a reader never sees a half-written file (some
        # keys, like map SVGs and the watchdog state, are overwritten in place).
        fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            os.chmod(tmp, 0o644)
            os.replace(tmp, path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
        return self.public_url(key)

    def get(self, key: str) -> bytes | None:
        try:
            return self._path(key).read_bytes()
        except (FileNotFoundError, IsADirectoryError):
            return None

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def check_health(self) -> tuple[str, str]:
        if not self.root.is_dir():
            return "down", f"local storage {self.root} does not exist"
        if not os.access(self.root, os.W_OK):
            return "down", f"local storage {self.root} is not writable"
        return "ok", f"local storage {self.root} writable"


_BACKENDS: dict[str, type[Storage]] = {
    "r2": R2Storage,
    "local": LocalStorage,
}


def storage_class() -> type[Storage]:
    """The backend ``STORAGE_BACKEND`` names (``r2`` when unset)."""
    name = (os.environ.get("STORAGE_BACKEND") or "r2").strip().lower()
    try:
        return _BACKENDS[name]
    except KeyError:
        raise ValueError(
            f"Unknown STORAGE_BACKEND {name!r} (expected one of: {', '.join(_BACKENDS)})"
        ) from None


def build_storage_from_env() -> Storage:
    return storage_class().from_env()
