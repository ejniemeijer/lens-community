import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/server/owner";
import { beaconCheckSeen, rateLimit } from "@/lib/server/tests";

/**
 * Beacon-check support for the test builder.
 *
 *  POST — static scan: fetch the researcher's app URL server-side and look
 *         for the Lens snippet in its HTML, incl. whether the embedded
 *         share token matches this test. Requires a signed-in user (the
 *         response is booleans only — never the fetched content — so this
 *         can't be used as a proxy).
 *  GET  — live-check poll: ?checkId=… returns whether the events route has
 *         received a ping for that id. The id is a client-generated random
 *         secret, so knowing it proves you initiated the check.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 2_000_000;

export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!rateLimit(`snippet-check:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many checks — try again in a minute." }, { status: 429 });
  }

  let body: { url?: unknown; shareToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const shareToken = typeof body.shareToken === "string" ? body.shareToken.slice(0, 200) : "";
  let target: URL;
  try {
    target = new URL(String(body.url ?? ""));
    if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("scheme");
  } catch {
    return NextResponse.json({ error: "Enter a valid http(s) app URL first." }, { status: 400 });
  }

  const grab = async (url: URL) => {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Lens-snippet-check" },
      redirect: "follow",
    });
    return res.ok ? (await res.text()).slice(0, MAX_HTML_BYTES) : null;
  };
  const verdict = (text: string) => {
    const found = text.includes("lens-beacon.js") || text.includes("LENS_ENDPOINT");
    if (!found) return null;
    // The snippet embeds its events endpoint; compare the token in it.
    const embedded = text.match(/\/api\/t\/([A-Za-z0-9_-]{8,})\/events/)?.[1] ?? null;
    return { found: true, tokenMatches: embedded ? embedded === shareToken : null };
  };

  try {
    const html = await grab(target);
    if (html === null) return NextResponse.json({ reachable: false, found: false, tokenMatches: null });

    const inHtml = verdict(html);
    if (inHtml) return NextResponse.json({ reachable: true, ...inHtml, via: "html" });

    // Not in the HTML — AI builders often inject the snippet via JavaScript
    // (Figma Make puts it in a components bundle referenced by preload
    // links), so grep the page's same-origin script/fetch assets too.
    const assetPaths = [
      ...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g),
      ...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*as=["'](?:script|fetch)["']/g),
    ]
      .map((m) => m[1])
      .slice(0, 6);
    for (const path of assetPaths) {
      let asset: URL;
      try {
        asset = new URL(path, target);
      } catch {
        continue;
      }
      if (asset.origin !== target.origin) continue; // same-origin only
      const text = await grab(asset).catch(() => null);
      const inAsset = text ? verdict(text) : null;
      if (inAsset) return NextResponse.json({ reachable: true, ...inAsset, via: "assets" });
    }
    return NextResponse.json({ reachable: true, found: false, tokenMatches: null });
  } catch {
    return NextResponse.json({ reachable: false, found: false, tokenMatches: null });
  }
}

export async function GET(req: Request) {
  const checkId = new URL(req.url).searchParams.get("checkId") ?? "";
  if (!checkId || checkId.length > 100) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!rateLimit(`snippet-poll:${checkId}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  return NextResponse.json({ received: beaconCheckSeen(checkId) });
}
