import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import settings

SECRET = "test-secret-with-enough-length-for-hs256!"
SUPABASE_URL = "https://abc.supabase.co"
ISSUER = f"{SUPABASE_URL}/auth/v1"


@pytest.fixture(autouse=True)
def _auth_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "supabase_url", SUPABASE_URL)
    monkeypatch.setattr(settings, "supabase_jwt_secret", SECRET)


def _token(**overrides: object) -> str:
    claims: dict[str, object] = {
        "sub": "user-1",
        "email": "a@example.com",
        "aud": "authenticated",
        "iss": ISSUER,
        "exp": int(time.time()) + 300,
    }
    claims.update(overrides)
    return jwt.encode(claims, SECRET, algorithm="HS256")


def _get(client: TestClient, token: str | None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get("/api/projects", headers=headers)


def test_public_health_needs_no_token(anon_client: TestClient) -> None:
    assert anon_client.get("/api/health").status_code == 200


def test_missing_token_is_401(anon_client: TestClient) -> None:
    resp = _get(anon_client, None)
    assert resp.status_code == 401
    assert resp.headers["www-authenticate"] == "Bearer"


def test_valid_token_is_accepted(anon_client: TestClient) -> None:
    assert _get(anon_client, _token()).status_code == 200


def test_health_score_is_protected(anon_client: TestClient) -> None:
    assert anon_client.post("/api/health/score", json={}).status_code == 401


@pytest.mark.parametrize(
    "overrides",
    [
        {"exp": int(time.time()) - 10},
        {"aud": "anon"},
        {"iss": "https://evil.example/auth/v1"},
    ],
    ids=["expired", "wrong-audience", "wrong-issuer"],
)
def test_bad_claims_are_401(anon_client: TestClient, overrides: dict) -> None:
    assert _get(anon_client, _token(**overrides)).status_code == 401


def test_wrong_signature_is_401(anon_client: TestClient) -> None:
    bad = jwt.encode(
        {"sub": "u", "aud": "authenticated", "iss": ISSUER, "exp": int(time.time()) + 60},
        "another-secret-with-enough-length-for-hs256",
        algorithm="HS256",
    )
    assert _get(anon_client, bad).status_code == 401


def test_unconfigured_auth_is_503(anon_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "supabase_url", "")
    assert _get(anon_client, _token()).status_code == 503
