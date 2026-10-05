import asyncio

import pytest


@pytest.mark.asyncio
async def test_admin_health_requires_admin(client, seeded_db, auth_header):
    res = await client.get("/api/admin-panel/health", headers=auth_header)

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_health_reports_each_service_without_live_llm_call(
    client, seeded_db, auth_header, monkeypatch
):
    import llm_config
    import routers.admin_panel as admin_panel
    from services.storage import R2Storage

    class FakeR2Client:
        def list_objects_v2(self, Bucket, MaxKeys):
            assert Bucket == "floreren-assets"
            assert MaxKeys == 1
            return {"KeyCount": 1, "ResponseMetadata": {"HTTPStatusCode": 200}}


    async def failing_bioclip_worker():
        raise RuntimeError("connection refused")

    await seeded_db.execute("UPDATE accounts SET is_admin = 1 WHERE id = 1")
    await seeded_db.commit()
    monkeypatch.setenv("BIOCLIP_WORKER_URL", "https://bioclip.example")
    monkeypatch.setenv("R2_ACCOUNT_ID", "account")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "access")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "secret")
    monkeypatch.setenv("R2_BUCKET", "floreren-assets")
    monkeypatch.setenv("R2_PUBLIC_BASE_URL", "https://cdn.example.com")
    monkeypatch.setenv("RESEND_API_KEY", "resend-token")
    monkeypatch.setattr(llm_config, "LLM_API_KEY", "nous-token")
    monkeypatch.setattr(llm_config, "LLM_MODEL", "deepseek/deepseek-v4-flash")
    monkeypatch.setattr(admin_panel, "_check_bioclip_worker", failing_bioclip_worker)
    monkeypatch.setattr(
        admin_panel, "build_storage_from_env",
        lambda: R2Storage(client=FakeR2Client(), bucket="floreren-assets",
                          public_base_url="https://cdn.example.com"),
    )

    res = await client.get("/api/admin-panel/health", headers=auth_header)

    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {"database", "bioclip", "r2", "llm", "email"}
    assert body["database"]["status"] == "ok"
    assert body["bioclip"]["status"] == "down"
    assert "connection refused" in body["bioclip"]["detail"]
    assert body["r2"]["status"] == "ok"
    assert body["llm"]["status"] == "ok"
    assert "no live call" in body["llm"]["detail"]
    assert body["email"]["status"] == "ok"
    for service in body.values():
        assert service["status"] in {"ok", "degraded", "down", "unconfigured"}
        assert isinstance(service["latency_ms"], int)
        assert service["detail"]


@pytest.mark.asyncio
async def test_admin_health_times_out_slow_checks_without_blocking_others(
    client, seeded_db, auth_header, monkeypatch
):
    import routers.admin_panel as admin_panel

    async def slow_bioclip_worker():
        await asyncio.sleep(1)
        return {"status": "ok", "latency_ms": None, "detail": "too slow"}

    await seeded_db.execute("UPDATE accounts SET is_admin = 1 WHERE id = 1")
    await seeded_db.commit()
    for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(admin_panel, "HEALTH_CHECK_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(admin_panel, "_check_bioclip_worker", slow_bioclip_worker)

    res = await client.get("/api/admin-panel/health", headers=auth_header)

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["database"]["status"] == "ok"
    assert body["bioclip"]["status"] == "down"
    assert "Timed out" in body["bioclip"]["detail"]


@pytest.mark.asyncio
async def test_admin_health_reports_local_storage_under_r2_key(
    client, seeded_db, auth_header, monkeypatch, tmp_path
):
    await seeded_db.execute("UPDATE accounts SET is_admin = 1 WHERE id = 1")
    await seeded_db.commit()
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("LOCAL_STORAGE_DIR", str(tmp_path))
    monkeypatch.setenv("LOCAL_STORAGE_PUBLIC_BASE_URL", "https://jardin.example/media")

    body = (await client.get("/api/admin-panel/health", headers=auth_header)).json()
    assert body["r2"]["status"] == "ok"
    assert "local storage" in body["r2"]["detail"]

    monkeypatch.delenv("LOCAL_STORAGE_DIR")
    body = (await client.get("/api/admin-panel/health", headers=auth_header)).json()
    assert body["r2"]["status"] == "unconfigured"
    assert "LOCAL_STORAGE_DIR" in body["r2"]["detail"]
