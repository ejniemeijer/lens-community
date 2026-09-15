"use client";

import * as React from "react";
import { Upload, FileText } from "lucide-react";
import type { Participant } from "@/lib/types";
import { companies } from "@/lib/db";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/field";
import { uid, accentFor } from "@/lib/utils";

/** Tiny CSV parser that handles quoted cells. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ["firstname", "first name", "first", "voornaam"],
  lastName: ["lastname", "last name", "last", "achternaam"],
  name: ["name", "full name", "naam"],
  email: ["email", "e-mail", "mail"],
  jobTitle: ["jobtitle", "job title", "title", "role", "functie"],
  company: ["company", "organisation", "organization", "bedrijf"],
  country: ["country", "land"],
  language: ["language", "taal"],
};

function matchHeader(h: string): string | null {
  const norm = h.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(norm)) return key;
  }
  return null;
}

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addParticipant = useApp((s) => s.addParticipant);
  const addCompany = useApp((s) => s.addCompany);
  const toast = useApp((s) => s.toast);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setText("");
      setError("");
    }
  }, [open]);

  const parsed = React.useMemo(() => {
    if (!text.trim()) return null;
    const rows = parseCsv(text.trim());
    if (rows.length < 2) return null;
    const headers = rows[0].map(matchHeader);
    if (!headers.includes("email") || !(headers.includes("name") || headers.includes("firstName")))
      return null;
    const records = rows.slice(1).map((cells) => {
      const rec: Record<string, string> = {};
      headers.forEach((key, i) => {
        if (key) rec[key] = (cells[i] ?? "").trim();
      });
      return rec;
    });
    return records.filter((r) => r.email);
  }, [text]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const runImport = () => {
    if (!parsed || parsed.length === 0) {
      setError("Couldn't find rows with at least a name and email. Check the headers.");
      return;
    }
    let imported = 0;
    for (const rec of parsed) {
      const first = rec.firstName || rec.name?.split(/\s+/)[0] || "";
      const last = rec.lastName || rec.name?.split(/\s+/).slice(1).join(" ") || "";
      if (!first || !rec.email) continue;

      // A row with no company still needs one: companyId is required. Falling
      // back to companies[0] used to be safe only because the library could
      // never be empty — it can now (companies are deletable), so name the
      // gap instead of indexing into nothing.
      const companyName = (rec.company ?? "").trim() || "Unknown";
      let company = companies.find((c) => c.name.toLowerCase() === companyName.toLowerCase());
      if (!company) {
        company = {
          id: uid("co"),
          name: companyName,
          industry: "—",
          // Size is left unknown rather than guessed — nothing in a CSV row
          // says how big the company is.
          country: rec.country || "—",
          logoAccent: accentFor(companyName),
        };
        addCompany(company);
      }

      const p: Participant = {
        id: uid("pt"),
        firstName: first,
        lastName: last || "—",
        email: rec.email,
        avatarColor: accentFor(first + last),
        companyId: company.id,
        department: "—",
        jobTitle: rec.jobTitle || "—",
        country: rec.country || company.country || "—",
        language: rec.language || "English",
        timezone: "CET",
        industry: company.industry,
        companySize: company.size ?? null,
        yearsExperience: 0,
        seniority: "mid",
        responsibilities: [],
        dailyTasks: [],
        decisionInfluence: "medium",
        technicalProficiency: "intermediate",
        digitalMaturity: "intermediate",
        productsUsed: [],
        modulesUsed: [],
        frequency: "weekly",
        device: "desktop",
        usageLevel: "intermediate",
        personaIds: [],
        behaviourTagIds: [],
        painPointTagIds: [],
        consentStatus: "pending",
        ndaSigned: false,
        recordingPermission: false,
        preferredLanguage: rec.language || "English",
        interviewCount: 0,
        availability: "Unknown",
        recruitmentStatus: "available",
        notes: "Imported via CSV.",
      };
      addParticipant(p);
      imported++;
    }
    toast(`Imported ${imported} participant${imported === 1 ? "" : "s"}`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import participants"
      description="Upload or paste a CSV. Recognized columns: name (or first/last name), email, job title, company, country, language."
      className="max-w-xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          {parsed && !error && (
            <p className="mr-auto text-xs text-success">{parsed.length} rows ready to import</p>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={runImport} disabled={!parsed}>
            <Upload className="h-4 w-4" /> Import
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-[13px] text-muted hover:border-border-strong hover:text-foreground"
        >
          <FileText className="h-4 w-4" /> Choose a .csv file…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex flex-col gap-1">
          <Label>…or paste CSV</Label>
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`name,email,job title,company,country\nJan Smit,j.smit@example.com,Planner,ValTech Manufacturing,Netherlands`}
            className="font-mono text-xs"
          />
        </div>
      </div>
    </Modal>
  );
}
