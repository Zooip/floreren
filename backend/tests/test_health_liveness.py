"""Liveness must not depend on the database.

A spent Neon quota took the whole API down and, worse, made it unreadable:
`/health` ran `SELECT 1`, the check failed, Fly pulled the machine out of
rotation, and the edge answered every request with an empty 503 — no body and
no CORS headers, so the browser reported a CORS error and the real cause was
invisible from the app.

A restart cannot fix an unreachable database, so liveness answers one question
only: is this process still serving?
"""
import pytest


@pytest.mark.asyncio
async def test_liveness_does_not_touch_the_database(client, monkeypatch):
    """Fly polls this every 30 seconds. If it queried the database it would
    both hide the real error behind an empty 503 AND, on its own, stop Neon's
    compute ever auto-suspending."""
    import database

    def explode():
        raise AssertionError("liveness must never open a database connection")

    monkeypatch.setattr(database, "get_db", explode)

    resp = await client.get("/health")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_readiness_reports_a_dead_database_in_a_readable_body(
    client, monkeypatch
):
    """The half that still checks: a 503 a human and a monitor can both read,
    rather than an empty one from the edge."""
    import main

    class Boom:
        async def __aenter__(self):
            raise RuntimeError("Your account or project has exceeded the quota.")

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(main, "get_db", lambda: Boom())

    resp = await main.health_ready()

    assert resp.status_code == 503
    import json
    assert json.loads(resp.body)["database"] == "unavailable"


@pytest.mark.asyncio
async def test_readiness_really_does_open_a_connection():
    """The complement of the liveness test, and the reason there is no
    happy-path test here: readiness checks the REAL pool on purpose, not the
    one the test client injects, so a green answer cannot be faked from a
    fixture. What can be pinned is that it tries at all — a readiness check
    that quietly stopped touching the database would leave nothing watching it.
    """
    import main

    opened = []

    class Probe:
        async def __aenter__(self):
            opened.append(True)
            raise RuntimeError("no database in tests")

        async def __aexit__(self, *args):
            return False

    main.get_db = Probe  # restored below; module-level for a single assertion
    try:
        await main.health_ready()
    finally:
        from database import get_db as real_get_db
        main.get_db = real_get_db

    assert opened == [True]
