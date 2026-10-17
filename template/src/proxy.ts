import { NextResponse, type NextRequest } from "next/server";

/**
 * Preview protection (Next 16 renamed `middleware.ts` to `proxy.ts`).
 *
 * Only active when the SITE_PREVIEW env var is set:
 * - Requires HTTP Basic Auth with SITE_PREVIEW_USER / SITE_PREVIEW_PASSWORD.
 *   If no password is configured, auth is skipped (open preview).
 * - Adds an X-Robots-Tag "noindex, nofollow" response header (next.config.ts
 *   headers() adds it as well; this covers proxied responses).
 */
export function proxy(request: NextRequest) {
  if (!process.env.SITE_PREVIEW) {
    return NextResponse.next();
  }

  const expectedUser = process.env.SITE_PREVIEW_USER ?? "";
  const expectedPassword = process.env.SITE_PREVIEW_PASSWORD ?? "";

  if (expectedPassword !== "" && !isAuthorized(request, expectedUser, expectedPassword)) {
    return new NextResponse("Kimlik doğrulama gerekli.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Önizleme", charset="UTF-8"',
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function isAuthorized(
  request: NextRequest,
  expectedUser: string,
  expectedPassword: string,
): boolean {
  const authorization = request.headers.get("authorization");
  if (authorization === null || !authorization.startsWith("Basic ")) {
    return false;
  }

  let decoded: string;
  try {
    decoded = atob(authorization.slice("Basic ".length));
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return false;
  }

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  return user === expectedUser && password === expectedPassword;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
