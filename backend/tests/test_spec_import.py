from fastapi.testclient import TestClient


def test_upload_returns_filename_and_size(
    client: TestClient,
) -> None:
    res = client.post(
        "/api/spec-import",
        files={"file": ("spec.md", b"# Campus Cart", "text/markdown")},
    )

    body = res.json()
    assert res.status_code == 200
    assert body["filename"] == "spec.md"
    assert body["size"] == 13


def test_user_not_signed_in(
    anon_client: TestClient,
) -> None:
    res = anon_client.post(
        "/api/spec-import",
        files={"file": ("spec.md", b"# Campus Cart", "text/markdown")},
    )
    assert res.status_code == 401
