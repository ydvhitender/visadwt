import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, Loader2, Search } from "lucide-react";
import {
  getCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
} from "@/api/cannedResponses";
import type { CannedResponse } from "@/types";

interface Props {
  onBack: () => void;
}

const EMPTY_FORM = { title: "", shortcut: "", body: "", category: "General" };

export default function ShortcutsManager({ onBack }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["cannedResponses"],
    queryFn: () => getCannedResponses(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cannedResponses"] });

  const createMut = useMutation({
    mutationFn: createCannedResponse,
    onSuccess: () => { invalidate(); setCreating(false); setForm(EMPTY_FORM); setError(""); },
    onError: (e: any) => setError(e.response?.data?.message || "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CannedResponse> }) =>
      updateCannedResponse(id, data),
    onSuccess: () => { invalidate(); setEditing(null); setForm(EMPTY_FORM); setError(""); },
    onError: (e: any) => setError(e.response?.data?.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCannedResponse,
    onSuccess: () => { invalidate(); setDeleteId(null); },
  });

  const filtered = responses.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.shortcut.toLowerCase().includes(search.toLowerCase()) ||
      r.body.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setCreating(true);
  };

  const openEdit = (r: CannedResponse) => {
    setCreating(false);
    setForm({ title: r.title, shortcut: r.shortcut, body: r.body, category: r.category || "General" });
    setError("");
    setEditing(r);
  };

  const closeForm = () => { setCreating(false); setEditing(null); setForm(EMPTY_FORM); setError(""); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shortcut.startsWith("/")) {
      setError("Shortcut must start with /");
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing._id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-[60px] shrink-0 items-center gap-3 px-4 border-b border-border">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-wa-hover transition-colors">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <h2 className="flex-1 text-[17px] font-semibold text-foreground">Shortcuts</h2>
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
            placeholder="Search shortcuts…"
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
              {editing ? "Edit Shortcut" : "New Shortcut"}
            </span>
            <button type="button" onClick={closeForm}>
              <X size={15} className="text-muted-foreground" />
            </button>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Greeting"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Shortcut</label>
              <input
                required
                value={form.shortcut}
                onChange={(e) => setForm((f) => ({ ...f, shortcut: e.target.value }))}
                placeholder="/hello"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="General"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Message</label>
              <textarea
                required
                rows={3}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Type the message text…"
                className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
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
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-sm text-muted-foreground">
              {search ? "No shortcuts match your search." : "No shortcuts yet. Create one!"}
            </span>
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r._id}
              className={`rounded-lg border bg-background p-3 transition-colors ${
                editing?._id === r._id ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono font-semibold text-primary">
                      {r.shortcut}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate">{r.title}</span>
                    {r.category && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {r.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{r.body}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(r)}
                    className="rounded p-1.5 hover:bg-wa-hover transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setDeleteId(r._id)}
                    className="rounded p-1.5 hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-destructive" />
                  </button>
                </div>
              </div>

              {/* Inline delete confirm */}
              {deleteId === r._id && (
                <div className="mt-2 flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2">
                  <span className="text-xs text-destructive">Delete this shortcut?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(r._id)}
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
