import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/* Build stamp — inlined into the client at build time so every deploy shows
   which commit it runs. Resolution order: common CI env vars (Coolify's
   SOURCE_COMMIT first), the git binary, then parsing .git/HEAD directly
   (works when .git is present but git isn't installed). Empty when nothing
   resolves — the UI then shows only the build timestamp, which changes every
   build regardless. */
const buildCommit = (() => {
  const fromEnv = [
    "NEXT_PUBLIC_BUILD_COMMIT", // explicit override (set this in Coolify build vars if auto-detect fails)
    "SOURCE_COMMIT",
    "GIT_COMMIT",
    "COMMIT_SHA",
    "CI_COMMIT_SHA",
    "GITHUB_SHA",
    "COOLIFY_GIT_COMMIT_SHA",
  ]
    .map((k) => process.env[k])
    .find((v) => v && v.trim());
  if (fromEnv) return fromEnv.trim().slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {}
  try {
    const head = readFileSync(".git/HEAD", "utf8").trim();
    if (!head.startsWith("ref:")) return head.slice(0, 7);
    const ref = head.slice(5).trim();
    try {
      return readFileSync(`.git/${ref}`, "utf8").trim().slice(0, 7);
    } catch {
      const packed = readFileSync(".git/packed-refs", "utf8");
      const line = packed.split("\n").find((l) => !l.startsWith("#") && l.endsWith(` ${ref}`));
      if (line) return line.split(" ")[0].slice(0, 7);
    }
  } catch {}
  return "";
})();
const buildTime = new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) so the self-hosted
  // Docker image ships without node_modules or source. Harmless for the cloud
  // deploy, which continues to use `next start`.
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  images: {
    // No sharp / remote optimization needed for this prototype.
    unoptimized: true,
  },
  // The landing page now lives at the root ("/"). Consolidate the old
  // /welcome URL into it so there's a single canonical marketing page.
  async redirects() {
    return [
      { source: "/welcome", destination: "/", permanent: true },
      // /use-cases was four short blurbs on their own URL; the content moved
      // into a section on the landing page, so send its inbound links there.
      { source: "/use-cases", destination: "/#use-cases", permanent: true },
    ];
  },
};

export default nextConfig;
