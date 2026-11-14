import pytest
from fastapi.testclient import TestClient

from app.api.routes import spec_import
from app.integrations.openrouter import OpenRouterError
from app.spec_import.schemas import ExtractedMilestone, ExtractedPlan

FAKE_PLAN = ExtractedPlan(
    name="Campus Cart",
    summary="A campus marketplace.",
    features=["Accounts"],
    milestones=[ExtractedMilestone(title="Core", date="2030-10-10", deliverables=["Login"])],
)


@pytest.fixture(autouse=True)
def fake_llm(monkeypatch):
    """Replace the real LLM call in every test in this file."""
    monkeypatch.setattr(spec_import, "extract_plan", lambda text: FAKE_PLAN)


def test_upload_returns_extracted_text(
    client: TestClient,
) -> None:
    res = client.post(
        "/api/spec-import",
        files={"file": ("spec.md", b"# Campus Cart", "text/markdown")},
    )

    body = res.json()
    assert res.status_code == 200
    assert body["filename"] == "spec.md"
    assert body["plan"]["name"] == "Campus Cart"
    assert body["plan"]["milestones"][0]["deliverables"] == ["Login"]
    assert isinstance(body["warnings"], list)


def test_user_not_signed_in(
    anon_client: TestClient,
) -> None:
    res = anon_client.post(
        "/api/spec-import",
        files={"file": ("spec.md", b"# Campus Cart", "text/markdown")},
    )
    assert res.status_code == 401


def _upload(client: TestClient, filename: str, data: bytes, content_type: str):
    return client.post(
        "/api/spec-import",
        files={"file": (filename, data, content_type)},
    )


def test_rejects_files_over_10_mb(client: TestClient) -> None:
    res = _upload(client, "big.txt", b"a" * (10 * 1024 * 1024 + 1), "text/plain")
    assert res.status_code == 413
    assert "10 MB" in res.json()["detail"]


def test_rejects_unsupported_file_types(client: TestClient) -> None:
    res = _upload(client, "spec.exe", b"hi", "application/octet-stream")
    assert res.status_code == 415


def test_rejects_files_without_text(client: TestClient) -> None:
    res = _upload(client, "spec.txt", b"   ", "text/plain")
    assert res.status_code == 422
    assert "No text" in res.json()["detail"]


def test_rejects_files_that_cannot_be_read(client: TestClient) -> None:
    res = _upload(client, "spec.pdf", b"not really a pdf", "application/pdf")
    assert res.status_code == 422
    assert "couldn't be read" in res.json()["detail"]


def test_returns_502_when_the_llm_fails(client: TestClient, monkeypatch) -> None:
    def failing_llm(text: str):
        raise OpenRouterError("boom", code="openrouter_unavailable")

    monkeypatch.setattr(spec_import, "extract_plan", failing_llm)
    res = _upload(client, "spec.md", b"# Campus Cart", "text/markdown")
    assert res.status_code == 502
