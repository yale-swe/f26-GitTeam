import pytest

pytestmark = pytest.mark.skip(reason="Project specification import has not been implemented")


def test_imports_supported_specification_into_a_structured_draft():
    """Extract the summary, features, milestones, deliverables, and dates."""
    pass


def test_marks_missing_or_uncertain_extracted_fields_for_review():
    """Require review when the source does not clearly support an extracted value."""
    pass


def test_does_not_invent_details_absent_from_the_specification():
    """Keep unsupported owners, deadlines, and deliverables empty."""
    pass


def test_preserves_user_corrections_when_import_is_approved():
    """Use reviewed values rather than overwriting them with the original extraction."""
    pass


def test_import_failure_does_not_corrupt_the_existing_draft():
    """Return a useful error while leaving previously saved setup data intact."""
    pass
