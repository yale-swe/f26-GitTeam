import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthRedirect } from "@/lib/authRedirect";

// Refreshes the Supabase session cookies and enforces route access.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase; getSession() would trust
  // the cookie as-is and must not be used for access decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const target = resolveAuthRedirect(pathname, Boolean(user));
  if (!target) return response;

  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";
  if (!user) url.searchParams.set("next", pathname + request.nextUrl.search);

  const redirect = NextResponse.redirect(url);
  // Keep any refreshed auth cookies on the redirect response.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
