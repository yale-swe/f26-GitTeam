"""Unit tests for grounded OpenRouter summary generation; no real network calls."""

import json
from collections.abc import Callable, Iterator

import httpx
import pytest

from app.config import settings
from app.integrations.openrouter import (
    InvalidSummaryResponse,
    OpenRouterConfigError,
    OpenRouterError,
    generate_project_summary,
)
from app.schemas.summary import ProjectSummaryContext

API = "https://openrouter.test/api/v1"
Handler = Callable[[httpx.Request], httpx.Response]


@pytest.fixture(autouse=True)
def openrouter_config(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "openrouter_api_key", "test-openrouter-key")
    monkeypatch.setattr(settings, "openrouter_model", "test/provider-model")
    monkeypatch.setattr(settings, "openrouter_base_url", API)
    monkeypatch.setattr(settings, "openrouter_timeout_seconds", 5.0)
    monkeypatch.setattr(settings, "openrouter_max_completion_tokens", 1000)
    yield


def _context() -> ProjectSummaryContext:
    return ProjectSummaryContext.model_validate(
        {
            "project": {
                "evidenceId": "project:project-1",
                "name": "DevSync",
                "description": "Project-health coordination for small teams.",
                "features": ["Health dashboard"],
            },
            "health": {"score": 76, "status": "at_risk"},
            "milestones": [
                {
                    "evidenceId": "milestone:milestone-1",
                    "title": "Summary MVP",
                    "dueAt": "2026-11-10T12:00:00Z",
                    "status": "in_progress",
                    "deliverables": [
                        {
                            "evidenceId": "deliverable:deliverable-1",
                            "title": "Generate an evidence-based summary",
                            "status": "in_progress",
                        }
                    ],
                }
            ],
            "activity": [
                {
                    "evidenceId": "activity:activity-1",
                    "source": "github",
                    "kind": "commit",
                    "occurredAt": "2026-11-02T12:00:00Z",
                    "title": "Build grounded summary context",
                    "url": "https://github.com/team/repo/commit/1",
                }
            ],
            "integrations": [
                {
                    "evidenceId": "integration:github-1",
                    "provider": "github",
                    "status": "healthy",
                    "lastSuccessfulSyncAt": "2026-11-02T12:00:00Z",
                },
                {
                    "evidenceId": "integration:discord-1",
                    "provider": "discord",
                    "status": "stale",
                    "lastSuccessfulSyncAt": "2026-10-30T12:00:00Z",
                },
            ],
            "limitations": [
                "Discord integration is stale; its activity is not treated as current."
            ],
        }
    )


def _summary(**overrides) -> dict:
    payload = {
        "recentProgress": [
            {
                "text": "The grounded summary context was implemented.",
                "evidenceIds": ["activity:activity-1"],
            }
        ],
        "upcomingMilestones": [
            {
                "text": "The Summary MVP milestone is upcoming.",
                "evidenceIds": ["milestone:milestone-1"],
            }
        ],
        "notableActivity": [],
        "blockers": [],
        "nextSteps": [
            {
                "text": "Complete the summary generator.",
                "evidenceIds": ["deliverable:deliverable-1"],
            }
        ],
        "limitations": ["Discord integration is stale; its activity is not treated as current."],
    }
    payload.update(overrides)
    return payload


def _client(handler: Handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def _success_response(payload: dict, *, finish_reason: str = "stop") -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "choices": [
                {
                    "finish_reason": finish_reason,
                    "message": {"role": "assistant", "content": json.dumps(payload)},
                }
            ]
        },
    )


def test_generates_structured_summary_with_grounded_prompt() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["authorization"] = request.headers["Authorization"]
        captured["body"] = json.loads(request.content)
        return _success_response(_summary())

    summary = generate_project_summary(_context(), client=_client(handler))

    assert summary.recent_progress[0].evidence_ids == ["activity:activity-1"]
    assert captured["url"] == f"{API}/chat/completions"
    assert captured["authorization"] == "Bearer test-openrouter-key"
    body = captured["body"]
    assert body["model"] == "test/provider-model"
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["strict"] is True
    response_schema = body["response_format"]["json_schema"]["schema"]
    assert response_schema["additionalProperties"] is False
    assert response_schema["$defs"]["SummaryClaim"]["additionalProperties"] is False
    assert body["provider"] == {
        "require_parameters": True,
        "data_collection": "deny",
    }
    system_prompt = body["messages"][0]["content"]
    assert "untrusted data" in system_prompt
    assert "current, unresolved conditions" in system_prompt
    assert "later activity clearly" in system_prompt
    assert "resolves a blocker, omit it" in system_prompt
    assert "limitations rather than project blockers" in system_prompt
    assert "Do not repeat a blocker description as a next step" in system_prompt
    assert "preliminary and exclude" in system_prompt
    assert "do not calculate or emit a replacement score" in system_prompt
    assert {"blockers", "nextSteps"} <= set(response_schema["required"])
    assert "activity:activity-1" in body["messages"][1]["content"]
    assert "test-openrouter-key" not in json.dumps(body)


def test_rejects_summary_with_unknown_evidence_id() -> None:
    payload = _summary(
        recentProgress=[
            {
                "text": "Unsupported claim.",
                "evidenceIds": ["activity:not-in-context"],
            }
        ]
    )

    with pytest.raises(InvalidSummaryResponse, match="outside the project context"):
        generate_project_summary(
            _context(),
            client=_client(lambda request: _success_response(payload)),
        )


def test_rejects_summary_that_changes_integration_limitations() -> None:
    payload = _summary(limitations=[])

    with pytest.raises(InvalidSummaryResponse, match="changed the project context limitations"):
        generate_project_summary(
            _context(),
            client=_client(lambda request: _success_response(payload)),
        )


@pytest.mark.parametrize(
    "content, finish_reason",
    [
        ("not-json", "stop"),
        (json.dumps({"recentProgress": []}), "stop"),
        (json.dumps(_summary()), "length"),
    ],
)
def test_rejects_malformed_or_truncated_output(content: str, finish_reason: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "finish_reason": finish_reason,
                        "message": {"role": "assistant", "content": content},
                    }
                ]
            },
        )

    with pytest.raises(InvalidSummaryResponse):
        generate_project_summary(_context(), client=_client(handler))


@pytest.mark.parametrize(
    "status_code, expected_code",
    [
        (401, "openrouter_authentication_failed"),
        (402, "openrouter_payment_required"),
        (429, "openrouter_rate_limited"),
        (500, "openrouter_unavailable"),
    ],
)
def test_maps_provider_failures_to_safe_errors(status_code: int, expected_code: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, text="provider response must not leak")

    with pytest.raises(OpenRouterError) as caught:
        generate_project_summary(_context(), client=_client(handler))

    assert caught.value.code == expected_code
    assert "provider response must not leak" not in caught.value.message


def test_maps_network_timeout_to_recoverable_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    with pytest.raises(OpenRouterError) as caught:
        generate_project_summary(_context(), client=_client(handler))

    assert caught.value.code == "openrouter_timeout"


def test_requires_server_side_openrouter_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "openrouter_api_key", "")

    with pytest.raises(OpenRouterConfigError, match="OPENROUTER_API_KEY"):
        generate_project_summary(_context(), client=_client(lambda request: _success_response({})))
