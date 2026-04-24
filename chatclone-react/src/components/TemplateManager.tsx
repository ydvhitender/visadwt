import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, Loader2, Search, LayoutTemplate } from "lucide-react";
import api from "@/api/axios";

interface Template {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: Array<{ type: string; text?: string; format?: string; [key: string]: unknown }>;
}

interface Props {
  onBack: () => void;
}

const CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"];
const LANGUAGES = [
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt_BR", label: "Portuguese (BR)" },
  { code: "ar", label: "Arabic" },
  { code: "ja", label: "Japanese" },
  { code: "zh_CN", label: "Chinese (CN)" },
];

const EMPTY_FORM = { name: "", language: "en_US", category: "MARKETING", headerText: "", bodyText: "", footerText: "" };

async function fetchTemplates(): Promise<Template[]> {
  const { data } = await api.get("/templates");
  return data.data || [];
}

export default function TemplateManager({ onBack }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["templates"] });

  const createMut = useMutation({
    mutationFn: async (f: typeof EMPTY_FORM) => {
      const components: Array<Record<string, unknown>> = [];
      if (f.headerText) {
        components.push({ type: "HEADER", format: "TEXT", text: f.headerText });
      }
      components.push({ type: "BODY", text: f.bodyText });
      if (f.footerText) {
        components.push({ type: "FOOTER", text: f.footerText });
      }
      const { data } = await api.post("/templates", {
        name: f.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        language: f.language,
        category: f.category,
        components,
      });
      return data;
    },
    onSuccess: () => { invalidate(); setCreating(false); setForm(EMPTY_FORM); setError(""); },
    onError: (e: any) => setError(e.response?.data?.error || "Failed to create template"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: typeof EMPTY_FORM }) => {
      const components: Array<Record<string, unknown>> = [];
      if (f.headerText) {
        components.push({ type: "HEADER", format: "TEXT", text: f.headerText });
      }
      components.push({ type: "BODY", text: f.bodyText });
      if (f.footerText) {
        components.push({ type: "FOOTER", text: f.footerText });
      }
      const { data } = await api.put(`/templates/${id}`, { components });
      return data;
    },
    onSuccess: () => { invalidate(); setEditing(null); setForm(EMPTY_FORM); setError(""); },
    onError: (e: any) => setError(e.response?.data?.error || "Failed to update template"),
  });

  const deleteMut = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.delete(`/templates/${name}`);
      return data;
    },
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
    onError: (e: any) => setError(e.response?.data?.error || "Failed to delete template"),
  });

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase()) ||
      t.status?.toLowerCase().includes(search.toLowerCase())
  );

  const getComponentText = (template: Template, type: string) => {
    const comp = template.components?.find((c) => c.type === type);
    return comp?.text || "";
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setCreating(true);
  };

  const openEdit = (t: Template) => {
    setCreating(false);
    setForm({
      name: t.name,
      language: t.language,
      category: t.category,
      headerText: getComponentText(t, "HEADER"),
      bodyText: getComponentText(t, "BODY"),
      footerText: getComponentText(t, "FOOTER"),
    });
    setError("");
    setEditing(t);
  };

  const closeForm = () => { setCreating(false); setEditing(null); setForm(EMPTY_FORM); setError(""); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bodyText.trim()) {
      setError("Body text is required");
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, f: form });
    } else {
      if (!form.name.trim()) {
        setError("Template name is required");
        return;
      }
      createMut.mutate(form);
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  const statusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-green-500/10 text-green-600";
      case "PENDING": return "bg-yellow-500/10 text-yellow-600";
      case "REJECTED": return "bg-red-500/10 text-red-600";
      default: return "bg-secondary text-muted-foreground";
    }
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-[60px] shrink-0 items-center gap-3 px-4 border-b border-border">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-wa-hover transition-colors">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <h2 className="flex-1 text-[17px] font-semibold text-foreground">Message Templates</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          New
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
          <Search size={15} className="text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={13} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Create / Edit form */}
      {(creating || editing) && (
        <form
          onSubmit={handleSubmit}
          className="mx-4 mb-3 shrink-0 rounded-lg border border-border bg-background p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {editing ? "Edit Template" : "New Template"}
            </span>
            <button type="button" onClick={closeForm}>
              <X size={15} className="text-muted-foreground" />
            </button>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <div className="space-y-3">
            {/* Name - only for create */}
            {!editing && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Template Name <span className="text-muted-foreground/60">(lowercase, underscores only)</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. order_confirmation"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            )}

            {/* Category & Language - only for create */}
            {!editing && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Language</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Header */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Header (optional)</label>
              <input
                value={form.headerText}
                onChange={(e) => setForm((f) => ({ ...f, headerText: e.target.value }))}
                placeholder="e.g. Order Update"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {/* Body */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Body <span className="text-muted-foreground/60">(use {"{{1}}"}, {"{{2}}"} for variables)</span>
              </label>
              <textarea
                required
                rows={4}
                value={form.bodyText}
                onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
                placeholder="Hello {{1}}, your order {{2}} has been shipped."
                className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {/* Footer */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Footer (optional)</label>
              <input
                value={form.footerText}
                onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
                placeholder="e.g. Thank you for your business"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Preview</p>
            <div className="rounded-lg bg-wa-outgoing p-3 max-w-[280px]">
              {form.headerText && (
                <p className="text-sm font-semibold text-foreground mb-1">{form.headerText}</p>
              )}
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {form.bodyText || "Template body text..."}
              </p>
              {form.footerText && (
                <p className="text-xs text-muted-foreground mt-1">{form.footerText}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-wa-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {editing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto wa-scrollbar px-4 pb-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <LayoutTemplate size={24} className="text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">
              {search ? "No templates match your search." : "No templates yet. Create one!"}
            </span>
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border bg-background p-3 transition-colors ${
                editing?.id === t.id ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{t.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor(t.status)}`}>
                      {t.status}
                    </span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {t.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{t.language}</span>
                  </div>
                  {/* Show body text */}
                  {getComponentText(t, "BODY") && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                      {getComponentText(t, "BODY")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(t)}
                    className="rounded p-1.5 hover:bg-wa-hover transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t.name)}
                    className="rounded p-1.5 hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-destructive" />
                  </button>
                </div>
              </div>

              {/* Inline delete confirm */}
              {deleteTarget === t.name && (
                <div className="mt-2 flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2">
                  <span className="text-xs text-destructive">Delete this template?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(t.name)}
                      disabled={deleteMut.isPending}
                      className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline disabled:opacity-60"
                    >
                      {deleteMut.isPending && <Loader2 size={10} className="animate-spin" />}
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
