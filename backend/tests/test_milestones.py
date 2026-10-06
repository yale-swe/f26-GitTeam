"""Core test skeleton for milestones and deliverables."""

import pytest

pytestmark = pytest.mark.skip(reason="Milestones and deliverables have not been implemented")


def test_creates_and_updates_milestone_with_deliverables():
    """Persist a milestone's name, deadline, description, and planned deliverables."""
    pass


def test_rejects_milestone_with_invalid_project_dates():
    """Reject a milestone deadline that conflicts with the surrounding project plan."""
    pass


def test_calculates_progress_from_completed_deliverables():
    """Derive bounded milestone progress from completed versus total deliverables."""
    pass


def test_reopening_deliverable_reduces_milestone_progress():
    """Recalculate progress when previously completed work becomes incomplete."""
    pass


def test_identifies_upcoming_and_overdue_milestones():
    """Use timezone-aware deadlines to derive the milestone's schedule status."""
    pass


def test_assigns_owners_and_tracks_blocker_resolution():
    """Persist responsibility and remove active risk when a blocker is resolved."""
    pass


def test_links_github_and_discord_evidence_to_the_correct_milestone():
    """Associate relevant activity without leaking evidence across milestones."""
    pass


def test_milestone_changes_trigger_project_health_recalculation():
    """Refresh project health after progress, deadline, or blocker changes."""
    pass
