import { NextResponse } from "next/server";

// Read the build/commit identity from the *running* container's environment,
// at request time. Build-time inlining (next.config.mjs) misses it on hosts
// that expose neither a commit env var nor .git during build — but the
// running container usually still has the platform's predefined vars
// (Coolify sets SOURCE_COMMIT). This route is the runtime fallback the About
// page uses when the build-time commit came out empty.
export const dynamic = "force-dynamic";

const COMMIT_ENV_KEYS = [
  "NEXT_PUBLIC_BUILD_COMMIT",
  "SOURCE_COMMIT",
  "GIT_COMMIT",
  "COMMIT_SHA",
  "CI_COMMIT_SHA",
  "GITHUB_SHA",
  "COOLIFY_GIT_COMMIT_SHA",
];

export async function GET() {
  const raw = COMMIT_ENV_KEYS.map((k) => process.env[k]).find((v) => v && v.trim());
  return NextResponse.json({
    commit: raw ? raw.trim().slice(0, 7) : "",
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
  });
}
