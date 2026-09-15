"use client";

/**
 * Client-side export engine. Everything here produces REAL files:
 * - JSON: full relational graph
 * - CSV: flattened entity tables (RFC-4180-ish quoting)
 * - Excel: SpreadsheetML 2003 workbook (multi-sheet, opens in Excel/Numbers)
 * - ZIP: genuine ZIP archive (store method + CRC-32), no dependencies
 * - PDF: print-optimized report window (browser's Save as PDF)
 */

import type { Insight, Interview, Participant, ResearchProject } from "@/lib/types";
import {
  participants,
  companies,
  projects,
  interviews,
  insights,
  themes,
  tags,
  personas,
  users,
  getCompany,
  getParticipant,
  getInterview,
  getUser,
  getThemes,
  getTags,
  fullName,
} from "@/lib/db";

/* ---------------- download plumbing ---------------- */

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }));
}

const today = () => new Date().toISOString().slice(0, 10);
export const stamp = (base: string, ext: string) => `${base}-${today()}.${ext}`;

/* ---------------- CSV ---------------- */

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvCell).join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ].join("\n");
}

/** Stable, non-identifying pseudonym number derived from an id. */
function pseudoNum(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 9000) + 1000;
}
/** A copy of a participant with direct identifiers redacted — for anonymized
    exports. The id is pseudonymized too: seed ids embed names ("pt-lukas"). */
function redactPii(p: Participant): Participant {
  const n = pseudoNum(p.id);
  return {
    ...p,
    id: `participant-${n}`,
    firstName: "Participant",
    lastName: `#${n}`,
    email: `participant-${n}@redacted.invalid`,
    phone: undefined,
    notes: undefined,
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pseudonymize participants everywhere in an export: id references (arrays
    and scalar fields alike) map to the same "participant-<n>" pseudonym the
    redacted records carry, and participant names are scrubbed from free text
    (interview notes and transcripts contain them as speaker labels). */
function anonymizeDeep<T>(value: T): T {
  const idMap = new Map<string, string>();
  const namePatterns: [RegExp, string][] = [];
  for (const p of participants) {
    const pseudo = `Participant #${pseudoNum(p.id)}`;
    idMap.set(p.id, `participant-${pseudoNum(p.id)}`);
    for (const name of [fullName(p), p.firstName, p.lastName]) {
      if (name && name.trim().length >= 3) namePatterns.push([new RegExp(`\\b${escapeRe(name)}\\b`, "gi"), pseudo]);
    }
  }
  // Interview and transcript ids can embed participant names too ("iv-lukas-1").
  for (const iv of interviews) {
    idMap.set(iv.id, `interview-${pseudoNum(iv.id)}`);
    if (iv.transcriptId) idMap.set(iv.transcriptId, `transcript-${pseudoNum(iv.transcriptId)}`);
  }
  const visit = (v: unknown): unknown => {
    if (typeof v === "string") {
      const mapped = idMap.get(v);
      if (mapped) return mapped;
      let s = v;
      for (const [re, sub] of namePatterns) s = s.replace(re, sub);
      return s;
    }
    if (Array.isArray(v)) return v.map(visit);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, visit(val)]));
    }
    return v;
  };
  return visit(value) as T;
}

export function participantRows(list: Participant[], anonymize = false) {
  return (anonymize ? list.map(redactPii) : list).map((p) => ({
    id: p.id,
    name: fullName(p),
    email: p.email,
    jobTitle: p.jobTitle,
    company: getCompany(p.companyId)?.name ?? "",
    country: p.country,
    seniority: p.seniority,
    personas: p.personaIds.join("; "),
    interviews: p.interviewCount,
    consent: p.consentStatus,
    recruitment: p.recruitmentStatus,
  }));
}

export function interviewRows(list: Interview[], anonymize = false) {
  return list.map((iv) => {
    const p = getParticipant(iv.participantId);
    return {
    id: iv.id,
    title: iv.title,
    date: iv.date,
    participant: p ? fullName(anonymize ? redactPii(p) : p) : "",
    researcher: getUser(iv.researcherId)?.name ?? "",
    durationMinutes: iv.durationMinutes,
    sentiment: iv.sentiment,
    projects: iv.projectIds.join("; "),
    insights: iv.insightIds.length,
    };
  });
}

export function insightRows(list: Insight[]) {
  return list.map((i) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    severity: i.severity,
    impact: i.impact,
    confidence: i.confidence,
    productArea: i.productArea,
    themes: getThemes(i.themeIds).map((t) => t.name).join("; "),
    tags: getTags(i.tagIds).map((t) => t.label).join("; "),
    participants: i.participantIds.length,
    interviews: i.interviewIds.length,
    created: i.createdDate,
  }));
}

/* ---------------- JSON graph ---------------- */

export function fullExport(scope?: { project?: ResearchProject }, anonymize = false) {
  const pr = scope?.project;
  const scopedInterviews = pr ? interviews.filter((iv) => iv.projectIds.includes(pr.id)) : interviews;
  const scopedInsights = pr ? insights.filter((i) => i.projectIds.includes(pr.id)) : insights;
  const scopedParticipants = pr
    ? participants.filter((p) => pr.participantIds.includes(p.id))
    : participants;

  const data = {
    meta: {
      application: "Lens — UX Research Repository",
      exportedAt: new Date().toISOString(),
      scope: pr ? { projectId: pr.id, projectName: pr.name } : "full-repository",
      note: anonymize
        ? "All entity relationships are preserved via id references. Participant data is anonymized: fields redacted, ids pseudonymized, and names scrubbed from free text."
        : "All entity relationships are preserved via id references.",
    },
    projects: pr ? [pr] : projects,
    participants: anonymize ? scopedParticipants.map(redactPii) : scopedParticipants,
    companies,
    personas,
    interviews: scopedInterviews,
    insights: scopedInsights,
    themes,
    tags,
    users,
  };
  // Deep pass: remaps every participant id reference (memberIds, participantIds,
  // researcher links…) to the pseudonym and scrubs names from notes/transcripts.
  // The already-redacted participants pass through untouched (their new ids
  // aren't in the map), so pseudonyms stay consistent across the graph.
  return anonymize ? anonymizeDeep(data) : data;
}

/* ---------------- Excel (SpreadsheetML 2003) ---------------- */

const xml = (s: unknown) =>
  String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export function excelWorkbook(sheets: { name: string; rows: Record<string, unknown>[] }[]): string {
  const ws = sheets
    .map((sheet) => {
      const headers = sheet.rows[0] ? Object.keys(sheet.rows[0]) : [];
      const headRow = `<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${xml(h)}</Data></Cell>`).join("")}</Row>`;
      const rows = sheet.rows
        .map(
          (r) =>
            `<Row>${headers
              .map((h) => {
                const v = r[h];
                const isNum = typeof v === "number" && Number.isFinite(v);
                return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${xml(v)}</Data></Cell>`;
              })
              .join("")}</Row>`,
        )
        .join("");
      return `<Worksheet ss:Name="${xml(sheet.name.slice(0, 31))}"><Table>${headRow}${rows}</Table></Worksheet>`;
    })
    .join("");
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${ws}</Workbook>`;
}

/* ---------------- ZIP (store method) ---------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(files: { name: string; text: string }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], {
    type: "application/zip",
  });
}

/* ---------------- PDF (print window) ---------------- */

export function printReport(title: string, bodyHtml: string): boolean {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${xml(title)}</title>
<style>
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:-apple-system,'Segoe UI',sans-serif;color:#1a1a2e;margin:40px;line-height:1.5}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  .meta{color:#777;font-size:12px;margin-bottom:24px}
  table{border-collapse:collapse;width:100%;font-size:12px} th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f4f5f7}
  @media print { body{margin:16px} }
</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

export function projectReportHtml(project: ResearchProject, anonymize = false): string {
  const html = buildProjectReportHtml(project, anonymize);
  // Names can hide in interview/insight titles and descriptions too.
  return anonymize ? anonymizeDeep(html) : html;
}

function buildProjectReportHtml(project: ResearchProject, anonymize: boolean): string {
  const sevRank = (s: string | undefined) => (s ? ({ critical: 4, high: 3, medium: 2, low: 1 })[s] ?? 0 : 0);
  const ins = insights
    .filter((i) => i.projectIds.includes(project.id))
    .sort((a, b) => sevRank(b.severity) - sevRank(a.severity));
  const ivs = interviews.filter((iv) => iv.projectIds.includes(project.id));

  return `
<h1>${xml(project.name)}</h1>
<p class="meta">Research report · exported ${today()} · ${project.productArea} · ${project.methodology}</p>
<p>${xml(project.objective)}</p>
<h2>Insights (${ins.length})</h2>
<table><tr><th>Insight</th><th>Type</th><th>Severity</th><th>Impact</th><th>Confidence</th><th>Evidence</th></tr>
${ins.map((i) => `<tr><td><strong>${xml(i.title)}</strong><br>${xml(i.description)}</td><td>${i.type}</td><td>${i.severity}</td><td>${i.impact}</td><td>${i.confidence}</td><td>${i.participantIds.length} participants, ${i.interviewIds.length} interviews</td></tr>`).join("")}
</table>
<h2>Interviews (${ivs.length})</h2>
<table><tr><th>Session</th><th>Date</th><th>Participant</th><th>Sentiment</th></tr>
${ivs.map((iv) => { const p = getParticipant(iv.participantId); const nm = p ? fullName(anonymize ? redactPii(p) : p) : ""; return `<tr><td>${xml(iv.title)}</td><td>${iv.date}</td><td>${xml(nm)}</td><td>${iv.sentiment}</td></tr>`; }).join("")}
</table>
`;
}

export function insightReportHtml(insight: Insight): string {
  return `
<h1>${xml(insight.title)}</h1>
<p class="meta">Insight · ${insight.type} · severity ${insight.severity} · impact ${insight.impact} · confidence ${insight.confidence} · exported ${today()}</p>
<p>${xml(insight.description)}</p>
<h2>Evidence</h2><p>${xml(insight.evidence)}</p>
`;
}

/* ---------------- packaged flows ---------------- */

export type ExportFormat = "csv" | "json" | "excel" | "pdf" | "zip";

/** Run an export for a project scope (or whole repo). Returns a human label, or null if blocked (popup). */
export function runExport(format: ExportFormat, project?: ResearchProject, anonymize = false): string | null {
  const base = project ? project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "lens-repository";
  const scopedInsights = project ? insights.filter((i) => i.projectIds.includes(project.id)) : insights;
  const scopedParticipants = project
    ? participants.filter((p) => project.participantIds.includes(p.id))
    : participants;
  const scopedInterviews = project
    ? interviews.filter((iv) => iv.projectIds.includes(project.id))
    : interviews;

  // Flattened row sets share the same deep anonymization as the JSON graph, so
  // ids and any names inside titles are pseudonymized consistently everywhere.
  const maybeAnon = <T,>(v: T): T => (anonymize ? anonymizeDeep(v) : v);
  const insightRowsData = maybeAnon(insightRows(scopedInsights));
  const participantRowsData = maybeAnon(participantRows(scopedParticipants, anonymize));
  const interviewRowsData = maybeAnon(interviewRows(scopedInterviews, anonymize));

  switch (format) {
    case "json":
      downloadText(stamp(base, "json"), JSON.stringify(fullExport({ project }, anonymize), null, 2), "application/json");
      return "JSON export";
    case "csv":
      downloadText(stamp(`${base}-insights`, "csv"), toCsv(insightRowsData), "text/csv");
      return "CSV export";
    case "excel":
      downloadText(
        stamp(base, "xls"),
        excelWorkbook([
          { name: "Insights", rows: insightRowsData },
          { name: "Participants", rows: participantRowsData },
          { name: "Interviews", rows: interviewRowsData },
        ]),
        "application/vnd.ms-excel",
      );
      return "Excel workbook";
    case "zip":
      downloadBlob(
        stamp(base, "zip"),
        zipStore([
          { name: "data.json", text: JSON.stringify(fullExport({ project }, anonymize), null, 2) },
          { name: "insights.csv", text: toCsv(insightRowsData) },
          { name: "participants.csv", text: toCsv(participantRowsData) },
          { name: "interviews.csv", text: toCsv(interviewRowsData) },
          {
            name: "README.txt",
            text: `Lens research export\nScope: ${project ? project.name : "Full repository"}\nExported: ${new Date().toISOString()}${anonymize ? "\nParticipant personal data: ANONYMIZED — fields redacted, participant/interview ids pseudonymized, and names scrubbed from notes and titles. Team member (researcher) names are not participant data and remain." : ""}\n\ndata.json contains the complete relational graph; the CSVs are flattened views.\nUploaded media files are not included in this export.`,
          },
        ]),
      );
      return "ZIP archive";
    case "pdf": {
      const ok = project
        ? printReport(project.name, projectReportHtml(project, anonymize))
        : printReport(
            "Lens — Research repository report",
            projects.map((p) => projectReportHtml(p, anonymize)).join('<div style="page-break-after:always"></div>'),
          );
      return ok ? "PDF report" : null;
    }
  }
}
