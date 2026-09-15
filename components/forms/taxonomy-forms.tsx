"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import type { Persona, Tag, TagKind, Theme } from "@/lib/types";
import { tags as existingTags } from "@/lib/db";
import { TAG_CATALOG } from "@/lib/data/tags";
import { useApp, useDb } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { AccentPill } from "@/components/ui/accent";
import { DynamicIcon, ICON_NAMES } from "@/components/ui/icon";
import { cn, uid } from "@/lib/utils";

const PALETTE = [
  "blue", "indigo", "violet", "purple", "pink", "rose", "red",
  "orange", "amber", "lime", "green", "teal", "cyan", "slate",
];

export function AccentPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (accent: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          title={a}
          className={cn(
            `accent-${a}`,
            "h-7 w-7 rounded-full bg-[hsl(var(--a-solid))] ring-2 ring-offset-2 ring-offset-surface transition-transform",
            value === a ? "ring-[hsl(var(--a-solid))] scale-110" : "ring-transparent hover:scale-105",
          )}
          aria-label={`Color ${a}`}
          aria-pressed={value === a}
        />
      ))}
    </div>
  );
}

/* ---------------- Persona ---------------- */

export function PersonaFormModal({
  open,
  onClose,
  persona,
}: {
  open: boolean;
  onClose: () => void;
  persona?: Persona;
}) {
  const addPersona = useApp((s) => s.addPersona);
  const updatePersona = useApp((s) => s.updatePersona);
  const toast = useApp((s) => s.toast);
  const [name, setName] = React.useState("");
  const [accent, setAccent] = React.useState("blue");
  const [icon, setIcon] = React.useState("User");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setError("");
    setName(persona?.name ?? "");
    setAccent(persona?.accent ?? "blue");
    setIcon(persona?.icon ?? "User");
  }, [open, persona]);

  const save = () => {
    if (!name.trim()) return setError("Name is required.");
    if (persona) {
      // Header fields only — the description is edited inline on the persona page.
      updatePersona(persona.id, { name: name.trim(), accent, icon });
      toast(`Persona “${name.trim()}” updated`);
    } else {
      addPersona({ id: uid("pe"), name: name.trim(), description: "", accent, icon });
      toast(`Persona “${name.trim()}” created`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={persona ? "Edit persona" : "New persona"}
      description="Personas classify participants and connect insights to archetypes."
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{persona ? "Save changes" : "Create persona"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className={cn(`accent-${accent}`, "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))]")}>
            <DynamicIcon name={icon} className="h-6 w-6" />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maintenance Planner" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Icon</Label>
          <div className="flex flex-wrap gap-1.5">
            {ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIcon(n)}
                title={n}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                  icon === n
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border text-muted hover:border-border-strong hover:text-foreground",
                )}
                aria-pressed={icon === n}
              >
                <DynamicIcon name={n} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Color</Label>
          <AccentPicker value={accent} onChange={setAccent} />
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Theme ---------------- */

export function ThemeFormModal({
  open,
  onClose,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  theme?: Theme;
}) {
  const addTheme = useApp((s) => s.addTheme);
  const updateTheme = useApp((s) => s.updateTheme);
  const toast = useApp((s) => s.toast);
  const [name, setName] = React.useState("");
  const [accent, setAccent] = React.useState("blue");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setError("");
    setName(theme?.name ?? "");
    setAccent(theme?.accent ?? "blue");
  }, [open, theme]);

  const save = () => {
    if (!name.trim()) return setError("Name is required.");
    if (theme) {
      // Header fields only — the description is edited inline on the theme page.
      updateTheme(theme.id, { name: name.trim(), accent });
      toast(`Theme “${name.trim()}” updated`);
    } else {
      addTheme({ id: uid("th"), name: name.trim(), description: "", accent });
      toast(`Theme “${name.trim()}” created`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={theme ? "Edit theme" : "New theme"}
      description="Themes are cross-cutting patterns that connect insights across projects."
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{theme ? "Save changes" : "Create theme"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label>Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile & Field Work" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Color</Label>
          <AccentPicker value={accent} onChange={setAccent} />
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Tag ---------------- */

const TAG_KINDS: { value: TagKind; label: string }[] = [
  { value: "pain-point", label: "Pain point" },
  { value: "behaviour", label: "Behaviour" },
  { value: "general", label: "General" },
];

export function TagFormModal({
  open,
  onClose,
  tag,
}: {
  open: boolean;
  onClose: () => void;
  tag?: Tag;
}) {
  useDb();
  const addTagToLibrary = useApp((s) => s.addTagToLibrary);
  const updateTag = useApp((s) => s.updateTag);
  const toast = useApp((s) => s.toast);
  const [label, setLabel] = React.useState("");
  const [kind, setKind] = React.useState<TagKind>("pain-point");
  const [accent, setAccent] = React.useState("blue");
  const [error, setError] = React.useState("");

  // Only for a brand-new tag — editing an existing one isn't the moment for
  // "here are some ideas". Excludes labels already in the library so a chip
  // disappears (rather than duplicating) the moment it's used.
  const suggestions = tag
    ? []
    : TAG_CATALOG.filter(
        (c) => !existingTags.some((t) => t.label.toLowerCase() === c.label.toLowerCase()),
      );

  React.useEffect(() => {
    if (!open) return;
    setError("");
    setLabel(tag?.label ?? "");
    setKind(tag?.kind ?? "pain-point");
    setAccent(tag?.accent ?? "blue");
  }, [open, tag]);

  const save = () => {
    if (!label.trim()) return setError("Label is required.");
    if (tag) {
      updateTag(tag.id, { label: label.trim(), kind, accent });
      toast(`Tag “${label.trim()}” updated`);
    } else {
      const created = addTagToLibrary(label.trim(), kind, accent);
      // addTagToLibrary de-duplicates by label; sync kind/accent either way.
      updateTag(created.id, { kind, accent });
      toast(`Tag “${label.trim()}” created`);
    }
    onClose();
  };

  // A suggestion is added immediately rather than just filling the form —
  // the point is picking several quickly, which a fill-then-submit flow
  // would force back through the dialog for each one.
  const addSuggestion = (c: (typeof TAG_CATALOG)[number]) => {
    addTagToLibrary(c.label, c.kind, c.accent);
    toast(`Tag “${c.label}” added`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tag ? "Edit tag" : "New tag"}
      description="Tags are the shared vocabulary for coding participants and insights."
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{tag ? "Save changes" : "Create tag"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Need inspiration?
            </p>
            <p className="text-xs text-muted">Click to add one straight to your library — no need to fill in the form below.</p>
            <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {suggestions.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => addSuggestion(c)}
                  title={`Add “${c.label}”`}
                  className="transition-transform hover:scale-105"
                >
                  <AccentPill accent={c.accent} dot={false} size="sm">+ {c.label}</AccentPill>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label>Label *</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Workaround" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Type</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value as TagKind)}>
              {TAG_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Color</Label>
          <AccentPicker value={accent} onChange={setAccent} />
        </div>
      </div>
    </Modal>
  );
}
