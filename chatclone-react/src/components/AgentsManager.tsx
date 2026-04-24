import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import api from "@/api/axios";

interface Agent {
  _id: string;
  name: string;
  email: string;
  role: string;
  isOnline: boolean;
}

const EMPTY_FORM = { name: "", email: "", password: "", role: "agent" };

export default function AgentsManager({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await api.get("/users");
      return data as Agent[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["agents"] });

  const createMut = useMutation({
    mutationFn: async (f: typeof EMPTY_FORM) => {
      const { data } = await api.post("/users", f);
      return data;
    },
    onSuccess: () => { invalidate(); setCreating(false); setForm(EMPTY_FORM); setError(""); },
    onError: (e: any) => setError(e.response?.data?.error || "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: typeof EMPTY_FORM }) => {
      const { data } = await api.put(`/users/${id}`, { name: f.name, email: f.email, role: f.role });
      return data;
    },
    onSuccess: () => { invalidate(); setEditing(null); setForm(EMPTY_FORM); setError(""); },
    onError: (e: any) => setError(e.response?.data?.error || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/users/${id}`);
      return data;
    },
    onSuccess: () => { invalidate(); setDeleteId(null); },
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(""); setCreating(true); };
  const openEdit = (a: Agent) => {
    setCreating(false);
    setForm({ name: a.name, email: a.email, password: "", role: a.role });
    setError(""); setEditing(a);
  };
  const closeForm = () => { setCreating(false); setEditing(null); setForm(EMPTY_FORM); setError(""); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required"); return; }
    if (editing) {
      updateMut.mutate({ id: editing._id, f: form });
    } else {
      if (!form.password.trim()) { setError("Password is required for new agents"); return; }
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
        <h2 className="flex-1 text-[17px] font-semibold text-foreground">Agents</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus size={14} /> New
        </button>
      </div>

      {(creating || editing) && (
        <form onSubmit={handleSubmit} className="mx-4 mt-3 mb-3 shrink-0 rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{editing ? "Edit Agent" : "New Agent"}</span>
            <button type="button" onClick={closeForm}><X size={15} className="text-muted-foreground" /></button>
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. John Doe"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
              <input required type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="john@example.com"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
              <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {!editing && (
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
                <input required type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </div>
            )}
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
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-sm text-muted-foreground">No agents yet. Create one!</span>
          </div>
        ) : agents.map(a => (
          <div key={a._id} className={`rounded-lg border bg-background p-3 transition-colors ${editing?._id === a._id ? "border-primary" : "border-border"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${a.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground block truncate">{a.name}</span>
                  <span className="text-[11px] text-muted-foreground block truncate">{a.email}</span>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  a.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                }`}>{a.role}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(a)} className="rounded p-1.5 hover:bg-wa-hover transition-colors" title="Edit">
                  <Pencil size={14} className="text-muted-foreground" />
                </button>
                <button onClick={() => setDeleteId(a._id)} className="rounded p-1.5 hover:bg-destructive/10 transition-colors" title="Delete">
                  <Trash2 size={14} className="text-destructive" />
                </button>
              </div>
            </div>
            {deleteId === a._id && (
              <div className="mt-2 flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2">
                <span className="text-xs text-destructive">Delete this agent?</span>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  <button onClick={() => deleteMut.mutate(a._id)} disabled={deleteMut.isPending} className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline disabled:opacity-60">
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
