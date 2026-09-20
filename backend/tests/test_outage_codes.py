"""Name the outage, so nobody goes looking for a bug that isn't there.

A database outage used to reach the app as an indistinguishable failure: an
empty 503 from Fly's edge, which the browser reported as a CORS error. That
cost an afternoon of hunting through the app twice in September. The API now
says which kind of outage it is, as a stable code the client turns into words
in the reader's language.
"""
import asyncpg
import pytest

from main import _database_outage_code


def test_a_spent_quota_is_named_specifically():
    """The one worth spotting: not a bug, and no amount of retrying fixes it.
    It needs a plan change or a wait, which is a different message."""
    exc = asyncpg.exceptions.InsufficientResourcesError(
        "Your account or project has exceeded the quota."
    )

    assert _database_outage_code(exc) == "database_quota_exceeded"


@pytest.mark.parametrize("exc", [
    ConnectionRefusedError("no route"),
    OSError("network unreachable"),
])
def test_an_unreachable_database_is_named_too(exc):
    assert _database_outage_code(exc) == "database_unavailable"


def test_a_real_query_error_still_looks_like_the_bug_it_is():
    """The failure mode this must not create: dressing a genuine bug up as
    "come back later" would hide it behind a friendly banner forever."""
    exc = asyncpg.exceptions.UndefinedColumnError("column does not exist")

    assert _database_outage_code(exc) is None


def test_an_ordinary_exception_is_not_an_outage():
    assert _database_outage_code(ValueError("nope")) is None


@pytest.mark.asyncio
async def test_the_handler_answers_503_with_the_code_and_cors_headers():
    """503, not 500 — and with CORS headers, because a response the browser
    refuses to read is exactly how this became invisible last time."""
    import main

    resp = await main.global_exception_handler(
        None,
        asyncpg.exceptions.InsufficientResourcesError("quota"),
    )

    assert resp.status_code == 503
    assert resp.headers["Access-Control-Allow-Origin"] == "*"
    import json
    assert json.loads(resp.body)["detail"] == "database_quota_exceeded"


@pytest.mark.asyncio
async def test_anything_else_is_still_a_500():
    import main

    resp = await main.global_exception_handler(None, ValueError("boom"))

    assert resp.status_code == 500
