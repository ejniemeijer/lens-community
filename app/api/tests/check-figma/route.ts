import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/server/owner";
import { rateLimit } from "@/lib/server/tests";
import { parseFigmaUrl } from "@/lib/tests-figma";

/**
 * Share check for the Figma-prototype block.
 *
 * The researcher is logged into Figma, so a *private* prototype embeds fine in
 * their own builder preview and then shows a permission wall to participants —
 * the one failure the builder must catch before publish. Figma's public oEmbed
 * endpoint answers exactly that question without credentials: 200 + metadata
 * when the link is viewable by anyone, 4xx when it isn't.
 *
 * Only ever fetches figma.com: the URL is rebuilt from a key parsed by
 * `parseFigmaUrl`, so this can't be used as a general-purpose proxy.
 */

const FETCH_TIMEOUT_MS = 8000;

export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!rateLimit(`figma-check:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many checks — try again in a minute." }, { status: 429 });
  }

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const ref = parseFigmaUrl(String(body.url ?? ""));
  if (!ref) return NextResponse.json({ error: "That isn't a Figma prototype link." }, { status: 400 });

  const target = new URL("https://www.figma.com/api/oembed");
  target.searchParams.set("url", `https://www.figma.com/proto/${ref.fileKey}`);
  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Lens-figma-check" },
    });
    if (!res.ok) return NextResponse.json({ shared: false, status: res.status });
    const j = (await res.json()) as { title?: unknown };
    const title = typeof j.title === "string" ? j.title.slice(0, 200) : undefined;
    return NextResponse.json({ shared: true, ...(title ? { title } : {}) });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Figma — try again." }, { status: 502 });
  }
}
