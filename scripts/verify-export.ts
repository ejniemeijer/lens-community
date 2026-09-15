/**
 * Verifies the platform-owner account export — platform-owner tool. Uses the
 * service-role key from .env.local, like the other scripts here.
 *
 * Two modes:
 *
 *   Database checks only (no sign-in needed):
 *     npx tsx scripts/verify-export.ts
 *
 *   Also exercise the real HTTP route, comparing what it returns against an
 *   independent recount. Needs an owner access token — in the app, DevTools →
 *   Application → Local Storage → the `sb-…-auth-token` entry → access_token:
 *     LENS_TOKEN=eyJ… npx tsx scripts/verify-export.ts
 *     LENS_TOKEN=eyJ… LENS_URL=https://lensresearch.app npx tsx scripts/verify-export.ts
 *
 * What it proves, in order of how much it would hurt to get wrong:
 *   1. No cross-tenant leakage — no id from one account's export appears in
 *      another's. This is the only failure here that is a security incident.
 *   2. The export is complete — meta.counts matches a recount done straight
 *      against the database, table by table, including test_sessions.
 *   3. The column maps cover every exported table. A table in LOAD_ORDER with
 *      no map in M yields objects full of undefined — a download that looks
 *      successful and contains nothing.
 *   4. No orphaned or unscoped rows — every tenant row has an account_id that
 *      resolves to a real account, so nothing is invisible to the export.
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LOAD_ORDER, M } from "../lib/tenant-schema";

function env(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const TABLES = [...LOAD_ORDER.map(([table, key]) => ({ table, key })), { table: "test_sessions", key: "testSessions" }];

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const pass = (msg: string) => console.log(`  ok    ${msg}`);

async function main() {
  const e = env();
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  const key = e.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const svc: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

  /* ---- 3. maps cover every exported table ---- */
  console.log("\nColumn maps");
  for (const [table] of LOAD_ORDER) {
    const map = M[table as keyof typeof M];
    if (!map || Object.keys(map).length === 0) fail(`no column map for "${table}" — it would export as empty objects`);
  }
  if (LOAD_ORDER.length !== Object.keys(M).length) {
    fail(`LOAD_ORDER has ${LOAD_ORDER.length} tables but M has ${Object.keys(M).length} maps`);
  }
  if (failures === 0) pass(`${LOAD_ORDER.length} tables mapped, LOAD_ORDER and M agree`);

  /* ---- accounts ---- */
  const { data: accounts, error: accErr } = await svc.from("accounts").select("id, name").order("created_at");
  if (accErr) {
    console.error("Could not read accounts:", accErr.message);
    process.exit(1);
  }
  const accountIds = new Set((accounts ?? []).map((a) => a.id as string));
  console.log(`\nAccounts: ${accountIds.size}`);
  for (const a of accounts ?? []) console.log(`  ${a.id}  ${a.name}`);

  /* ---- 4. every row is scoped to a real account ---- */
  console.log("\nRow scoping");
  const expected: Record<string, Record<string, number>> = {};
  for (const { table, key } of TABLES) {
    const { data: rows, error } = await svc.from(table).select("account_id");
    if (error) {
      fail(`${table}: ${error.message}`);
      continue;
    }
    for (const r of (rows ?? []) as { account_id: string | null }[]) {
      if (!r.account_id) {
        fail(`${table} has a row with no account_id — it can never be exported`);
        continue;
      }
      if (!accountIds.has(r.account_id)) {
        fail(`${table} has a row for unknown account "${r.account_id}"`);
        continue;
      }
      expected[r.account_id] ??= {};
      expected[r.account_id][key] = (expected[r.account_id][key] ?? 0) + 1;
    }
  }
  pass("every tenant row resolves to a real account");

  /* ---- 2 + 1. the HTTP route, if a token was supplied ---- */
  const token = process.env.LENS_TOKEN;
  if (!token) {
    console.log("\nHTTP route: skipped (set LENS_TOKEN to include it — see the header of this file)");
    console.log("\nExpected counts per account, for comparison with meta.counts in a manual download:");
    for (const id of accountIds) {
      const c = expected[id] ?? {};
      const summary = Object.entries(c)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k}=${n}`)
        .join(" ");
      console.log(`  ${id}  ${summary || "(empty)"}`);
    }
  } else {
    const base = process.env.LENS_URL ?? "http://localhost:3000";
    const idsSeen: { account: string; ids: Set<string> }[] = [];

    for (const id of accountIds) {
      console.log(`\nExport ${id}`);
      const res = await fetch(`${base}/api/admin/accounts/${id}/export`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        fail(`HTTP ${res.status} — ${(await res.text()).slice(0, 160)}`);
        continue;
      }
      const body = (await res.json()) as Record<string, unknown> & {
        meta?: { account?: { id?: string }; counts?: Record<string, number> };
      };

      if (body.meta?.account?.id !== id) fail(`meta.account.id is "${body.meta?.account?.id}", expected "${id}"`);
      else pass("meta names the requested account");

      // Counts must match an independent recount, table by table.
      let mismatch = false;
      for (const { key } of TABLES) {
        const got = body.meta?.counts?.[key] ?? 0;
        const want = expected[id]?.[key] ?? 0;
        if (got !== want) {
          fail(`${key}: export says ${got}, database has ${want}`);
          mismatch = true;
        }
        const arr = body[key];
        if (!Array.isArray(arr)) fail(`${key} is missing from the payload`);
        else if (arr.length !== got) fail(`${key}: meta.counts says ${got} but the array has ${arr.length}`);
      }
      if (!mismatch) pass("meta.counts matches a direct database recount, including testSessions");

      // Guard the silent-empty failure: entities that are all-undefined.
      for (const { key } of TABLES) {
        const arr = body[key];
        if (Array.isArray(arr) && arr.length > 0) {
          const empty = arr.filter((o) => o && typeof o === "object" && Object.values(o).every((v) => v === undefined));
          if (empty.length) fail(`${key} contains ${empty.length} objects with no values — column map problem`);
        }
      }

      // Collect ids for the isolation check.
      const ids = new Set<string>();
      const walk = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          if (typeof o.id === "string") ids.add(o.id);
          Object.values(o).forEach(walk);
        }
      };
      for (const { key } of TABLES) walk(body[key]);
      idsSeen.push({ account: id, ids });
    }

    /* ---- 1. cross-tenant isolation — the one that matters ---- */
    console.log("\nTenant isolation");
    let leaked = false;
    for (let i = 0; i < idsSeen.length; i++) {
      for (let j = i + 1; j < idsSeen.length; j++) {
        const shared = [...idsSeen[i].ids].filter((x) => idsSeen[j].ids.has(x));
        if (shared.length) {
          leaked = true;
          fail(`${idsSeen[i].account} and ${idsSeen[j].account} share ${shared.length} id(s): ${shared.slice(0, 5).join(", ")}`);
        }
      }
    }
    if (!leaked) pass(`no id appears in more than one account's export (${idsSeen.length} accounts compared)`);
  }

  console.log(failures === 0 ? "\nPASS — all checks clean\n" : `\nFAIL — ${failures} problem(s)\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
