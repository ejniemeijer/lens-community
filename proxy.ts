import { NextResponse, type NextRequest } from "next/server";
import { isSelfHosted } from "@/lib/edition";

/**
 * Edition routing, in Next's `proxy` convention (what used to be
 * `middleware.ts` — same request hook, renamed in Next 16; the file and the
 * exported function both have to be called "proxy").
 *
 * Cloud is untouched. In the self-hosted edition:
 *
 *  - The platform-owner surface (/admin, cross-tenant account APIs) 404s — it
 *    doesn't exist for the customer. The tenant-scoped /api/admin/create-user
 *    is deliberately left alone (needed to add members to your own workspace).
 *  - The SaaS marketing surface (the landing page at "/", plus /welcome,
 *    /use-cases, /alternatives, /compare, /blog, /pricing) is redirected into
 *    the app, so the login screen — or the first-run setup wizard — is the
 *    starting page, not our marketing site. /privacy and /terms redirect too:
 *    they describe the cloud service (our sub-processors, EU hosting), which
 *    doesn't apply to a customer-operated box.
 */
const OPERATOR = [/^\/admin(\/|$)/, /^\/api\/admin\/accounts(\/|$)/];
const MARKETING = [
  /^\/$/,
  /^\/welcome(\/|$)/,
  /^\/use-cases(\/|$)/,
  /^\/alternatives(\/|$)/,
  /^\/compare(\/|$)/,
  /^\/blog(\/|$)/,
  /^\/pricing(\/|$)/,
  /^\/privacy(\/|$)/,
  /^\/terms(\/|$)/,
];

export function proxy(req: NextRequest) {
  if (!isSelfHosted) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (OPERATOR.some((re) => re.test(pathname))) {
    return new NextResponse(null, { status: 404 });
  }
  if (MARKETING.some((re) => re.test(pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard"; // signed-out → login / first-run setup; signed-in → workspace
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Run on everything except Next internals and static files (paths with a dot).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
