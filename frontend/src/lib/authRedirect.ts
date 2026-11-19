// Route access rules shared by the proxy and tests. Everything is gated unless
// it is listed here, so new pages are protected by default.
export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/login" || pathname.startsWith("/auth/");
}

export const DEFAULT_AFTER_LOGIN = "/projects";

/** Where a request should be redirected, or null to let it through. */
export function resolveAuthRedirect(pathname: string, isAuthenticated: boolean): string | null {
  if (!isAuthenticated) {
    return isPublicPath(pathname) ? null : "/login";
  }
  // Signed-in visitors skip the landing and login pages.
  return pathname === "/" || pathname === "/login" ? DEFAULT_AFTER_LOGIN : null;
}

/** Only same-origin relative paths are allowed as post-login destinations. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  return next;
}
