import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Workflow } from "lucide-react";
import api from "@/api/axios";
import FlowEditor, { FlowData } from "./FlowEditor";

export default function FlowsManager({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<FlowData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: async () => {
      const { data } = await api.get("/flows");
      return data as FlowData[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["flows"] });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/flows/${id}`)).data,
    onSuccess: () => { invalidate(); setDeleteId(null); },
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      (await api.put(`/flows/${id}`, { enabled })).data,
    onSuccess: () => invalidate(),
  });

  const openCreate = () => {
    setEditingFlow(null);
    setEditorOpen(true);
  };

  const openEdit = (f: FlowData) => {
    setEditingFlow(f);
    setEditorOpen(true);
  };

  return (
    <>
      <div className="flex h-full flex-col bg-card">
        <div className="flex h-[60px] shrink-0 items-center gap-3 px-4 border-b border-border">
          <button onClick={onBack} className="rounded-full p-1.5 hover:bg-wa-hover">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h2 className="flex-1 text-[17px] font-semibold text-foreground">Auto-reply Flows</h2>
          <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            <Plus size={14} /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto wa-scrollbar px-4 py-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>
          ) : flows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <Workflow size={22} className="text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">No flows yet. Create one to start auto-replying!</span>
              <button onClick={openCreate} className="mt-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90">
                Create your first flow
              </button>
            </div>
          ) : flows.map(f => (
            <div key={f._id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openEdit(f)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{f.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${f.enabled ? "bg-green-500/10 text-green-600" : "bg-gray-500/10 text-gray-500"}`}>
                      {f.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {f.priority > 0 && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">P{f.priority}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {f.triggers.map(t => (
                      <span key={t} className="rounded-full bg-primary/10 px-1.5 py-[1px] text-[10px] text-primary">{t}</span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{f.message.text}</p>
                  {f.buttons.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {f.buttons.map((b, i) => (
                        <span key={i} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-foreground">{b.title}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div
                    role="switch"
                    aria-checked={f.enabled}
                    onClick={() => f._id && toggleMut.mutate({ id: f._id, enabled: !f.enabled })}
                    className={`relative h-4 w-8 shrink-0 cursor-pointer rounded-full transition-colors ${f.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${f.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <button onClick={() => openEdit(f)} className="rounded p-1.5 hover:bg-wa-hover">
                    <Pencil size={13} className="text-muted-foreground" />
                  </button>
                  <button onClick={() => f._id && setDeleteId(f._id)} className="rounded p-1.5 hover:bg-destructive/10">
                    <Trash2 size={13} className="text-destructive" />
                  </button>
                </div>
              </div>
              {deleteId === f._id && (
                <div className="flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2">
                  <span className="text-xs text-destructive">Delete this flow?</span>
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                    <button onClick={() => f._id && deleteMut.mutate(f._id)} disabled={deleteMut.isPending} className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline disabled:opacity-60">
                      {deleteMut.isPending && <Loader2 size={10} className="animate-spin" />} Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {editorOpen && (
        <FlowEditor
          flow={editingFlow}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            invalidate();
          }}
        />
      )}
    </>
  );
}
