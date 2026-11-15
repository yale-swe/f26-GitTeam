import json

import httpx
import pytest

from app.spec_import import llm_extract
from app.spec_import.llm_extract import InvalidPlanResponse, extract_plan

PLAN = {
    "name": "Campus Cart",
    "summary": "A marketplace.",
    "features": ["Accounts"],
    "milestones": [{"title": "Core", "date": "2030-10-10", "deliverables": ["Login"]}],
}


def _fake_openrouter(monkeypatch, content, finish_reason="stop"):
    """Make extract_plan receive this response instead of calling OpenRouter."""
    response = httpx.Response(
        200,
        json={"choices": [{"finish_reason": finish_reason, "message": {"content": content}}]},
        request=httpx.Request("POST", "https://openrouter.test"),
    )
    monkeypatch.setattr(llm_extract, "_validate_config", lambda: None)
    monkeypatch.setattr(llm_extract.httpx, "post", lambda *args, **kwargs: response)


def test_returns_a_validated_plan(monkeypatch):
    _fake_openrouter(monkeypatch, json.dumps(PLAN))
    assert extract_plan("doc").name == "Campus Cart"


def test_rejects_a_truncated_completion(monkeypatch):
    _fake_openrouter(monkeypatch, None, finish_reason="length")
    with pytest.raises(InvalidPlanResponse, match="ran out of tokens"):
        extract_plan("doc")


def test_rejects_invalid_json(monkeypatch):
    _fake_openrouter(monkeypatch, "not json")
    with pytest.raises(InvalidPlanResponse):
        extract_plan("doc")
