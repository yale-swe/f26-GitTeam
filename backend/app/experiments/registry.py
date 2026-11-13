"""The experiments DevSync is running and their versions."""

LANDING_SIGNIN_COLOR = "landing-signin-color"

EXPERIMENTS: dict[str, tuple[str, ...]] = {
    # Color of the "Sign in with Google" button on the landing page.
    LANDING_SIGNIN_COLOR: ("blue", "green", "dark"),
}
