import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/owner";
import { sanitizeBlocks, testByToken } from "@/lib/server/tests";

/**
 * Public participant API: the test definition behind a share link.
 * Unauthenticated by design — the share token IS the credential; everything
 * tenant-scoped (account, project, creator, success patterns) is stripped.
 * 404 for unknown tokens, 410 for tests that exist but aren't running.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  const test = await testByToken(svc, token);
  if (!test) return NextResponse.json({ error: "Unknown test link." }, { status: 404 });
  if (test.status !== "active") {
    return NextResponse.json({ error: "This test is no longer accepting responses." }, { status: 410 });
  }

  return NextResponse.json({ name: test.name, blocks: sanitizeBlocks(test.blocks ?? []) });
}
