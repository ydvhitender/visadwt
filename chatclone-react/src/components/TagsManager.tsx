import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import api from "@/api/axios";

interface Tag {
  _id: string;
  name: string;
  color: string;
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

const EMPTY_FORM = { name: "", color: "#6366f1" };

export default function TagsManager({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tag | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data } = await api.get("/tags");
      return data as Tag[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tags"] });

  const createMut = useMutation({
    mutationFn: async (f: typeof EMPTY_FORM) => {
      const { data } = await api.post("/tags", f);
      return data;
    },
    onSuccess: () => { invalidate(); setCreating(false); setForm(EMPTY_FORM); setError(""); },
    onError: (e: any) => setError(e.response?.data?.error || "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: typeof EMPTY_FORM }) => {
      const { data } = await api.put(`/tags/${id}`, f);
      return data;
    },
    onSuccess: () => { invalidate(); setEditing(null); setForm(EMPTY_FORM); setError(""); },
    onError: (e: any) => setError(e.response?.data?.error || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/tags/${id}`);
      return data;
    },
    onSuccess: () => { invalidate(); setDeleteId(null); },
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(""); setCreating(true); };
  const openEdit = (t: Tag) => { setCreating(false); setForm({ name: t.name, color: t.color }); setError(""); setEditing(t); };
  const closeForm = () => { setCreating(false); setEditing(null); setForm(EMPTY_FORM); setError(""); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Tag name is required"); return; }
    if (editing) {
      updateMut.mutate({ id: editing._id, f: form });
    } else {
      createMut.mutate(form);
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-[60px] shrink-0 items-center gap-3 px-4 border-b border-border">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-wa-hover transition-colors">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <h2 className="flex-1 text-[17px] font-semibold text-foreground">Tags</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus size={14} /> New
        </button>
      </div>

      {(creating || editing) && (
        <form onSubmit={handleSubmit} className="mx-4 mt-3 mb-3 shrink-0 rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{editing ? "Edit Tag" : "New Tag"}</span>
            <button type="button" onClick={closeForm}><X size={15} className="text-muted-foreground" /></button>
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <input
              required value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. VIP"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`h-7 w-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-wa-hover">Cancel</button>
            <button type="submit" disabled={isPending} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {editing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto wa-scrollbar px-4 pb-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-sm text-muted-foreground">No tags yet. Create one!</span>
          </div>
        ) : tags.map(t => (
          <div key={t._id} className={`rounded-lg border bg-background p-3 transition-colors ${editing?._id === t._id ? "border-primary" : "border-border"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className="text-sm font-medium text-foreground">{t.name}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(t)} className="rounded p-1.5 hover:bg-wa-hover transition-colors" title="Edit">
                  <Pencil size={14} className="text-muted-foreground" />
                </button>
                <button onClick={() => setDeleteId(t._id)} className="rounded p-1.5 hover:bg-destructive/10 transition-colors" title="Delete">
                  <Trash2 size={14} className="text-destructive" />
                </button>
              </div>
            </div>
            {deleteId === t._id && (
              <div className="mt-2 flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2">
                <span className="text-xs text-destructive">Delete this tag?</span>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  <button onClick={() => deleteMut.mutate(t._id)} disabled={deleteMut.isPending} className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline disabled:opacity-60">
                    {deleteMut.isPending && <Loader2 size={10} className="animate-spin" />} Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
