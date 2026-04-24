import { useState, useEffect } from "react";
import { X, Check, Loader2, Plus, Trash2, MessageSquare, CornerDownRight, Save, Type, List, ChevronDown, ChevronRight } from "lucide-react";
import api from "@/api/axios";

export interface FlowButton {
  id: string;
  title: string;
  response?: {
    text?: string;
    headerText?: string;
    footerText?: string;
    buttons?: FlowButton[];
  };
}

export interface FlowData {
  _id?: string;
  name: string;
  enabled: boolean;
  triggers: string[];
  matchType: "exact" | "contains" | "starts_with";
  message: { text: string; headerText?: string; footerText?: string };
  buttons: FlowButton[];
  priority: number;
}

interface Props {
  flow?: FlowData | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_FLOW: FlowData = {
  name: "",
  enabled: true,
  triggers: [],
  matchType: "contains",
  message: { text: "", headerText: "", footerText: "" },
  buttons: [],
  priority: 0,
};

// Node path: [] = root, [0] = root.buttons[0], [0, 1] = root.buttons[0].response.buttons[1]
type NodePath = number[];

export default function FlowEditor({ flow, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FlowData>(flow || EMPTY_FLOW);
  const [selectedPath, setSelectedPath] = useState<NodePath>([]); // [] = root message
  const [triggerInput, setTriggerInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(flow || EMPTY_FLOW);
    setSelectedPath([]);
  }, [flow]);

  // Get the node at a given path (returns root if path is [])
  const getNodeAt = (path: NodePath): { text: string; headerText?: string; footerText?: string; buttons: FlowButton[] } => {
    if (path.length === 0) {
      return { ...form.message, buttons: form.buttons };
    }
    let current: any = form.buttons[path[0]];
    for (let i = 1; i < path.length; i++) {
      current = current.response?.buttons?.[path[i]];
    }
    return {
      text: current?.response?.text || "",
      headerText: current?.response?.headerText || "",
      footerText: current?.response?.footerText || "",
      buttons: current?.response?.buttons || [],
    };
  };

  // Update the node at a given path
  const updateNodeAt = (path: NodePath, updates: Partial<{ text: string; headerText: string; footerText: string }>) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as FlowData;
      if (path.length === 0) {
        next.message = { ...next.message, ...updates };
      } else {
        let current: any = next.buttons[path[0]];
        for (let i = 1; i < path.length; i++) {
          current = current.response.buttons[path[i]];
        }
        if (!current.response) current.response = {};
        Object.assign(current.response, updates);
      }
      return next;
    });
  };

  // Add a button at a given path
  const addButtonAt = (path: NodePath) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as FlowData;
      const newBtn: FlowButton = { id: `btn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title: "New Button", response: { text: "" } };
      if (path.length === 0) {
        if (next.buttons.length >= 3) { setError("Max 3 buttons per message"); return prev; }
        next.buttons.push(newBtn);
      } else {
        let current: any = next.buttons[path[0]];
        for (let i = 1; i < path.length; i++) current = current.response.buttons[path[i]];
        if (!current.response) current.response = { text: "", buttons: [] };
        if (!current.response.buttons) current.response.buttons = [];
        if (current.response.buttons.length >= 3) { setError("Max 3 buttons per message"); return prev; }
        current.response.buttons.push(newBtn);
      }
      return next;
    });
    setError("");
  };

  const removeButtonAt = (path: NodePath) => {
    if (path.length === 0) return;
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as FlowData;
      const parentPath = path.slice(0, -1);
      const idx = path[path.length - 1];
      if (parentPath.length === 0) {
        next.buttons.splice(idx, 1);
      } else {
        let current: any = next.buttons[parentPath[0]];
        for (let i = 1; i < parentPath.length; i++) current = current.response.buttons[parentPath[i]];
        current.response.buttons.splice(idx, 1);
      }
      return next;
    });
    setSelectedPath([]);
  };

  // Update button title
  const updateButtonTitle = (path: NodePath, title: string) => {
    if (path.length === 0) return;
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as FlowData;
      let current: any = next.buttons[path[0]];
      for (let i = 1; i < path.length; i++) current = current.response.buttons[path[i]];
      current.title = title;
      return next;
    });
  };

  const addTrigger = () => {
    const t = triggerInput.trim();
    if (t && !form.triggers.includes(t)) {
      setForm(f => ({ ...f, triggers: [...f.triggers, t] }));
      setTriggerInput("");
    }
  };
  const removeTrigger = (t: string) => {
    setForm(f => ({ ...f, triggers: f.triggers.filter(x => x !== t) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Flow name is required"); return; }
    if (form.triggers.length === 0) { setError("At least one trigger is required"); return; }
    if (!form.message.text.trim()) { setError("Root message text is required"); return; }

    // Validate all buttons have titles
    const validateButtons = (btns: FlowButton[]): string | null => {
      for (const b of btns) {
        if (!b.title.trim()) return "All buttons must have a title";
        if (b.response?.buttons && b.response.buttons.length > 0) {
          if (!b.response.text?.trim()) return "Button responses with sub-buttons need response text";
          const err = validateButtons(b.response.buttons);
          if (err) return err;
        }
      }
      return null;
    };
    const btnErr = validateButtons(form.buttons);
    if (btnErr) { setError(btnErr); return; }

    setSaving(true);
    setError("");
    try {
      if (form._id) {
        await api.put(`/flows/${form._id}`, form);
      } else {
        await api.post("/flows", form);
      }
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const currentNode = getNodeAt(selectedPath);

  // Get label for selected path
  const pathLabel = () => {
    if (selectedPath.length === 0) return "Root Message";
    let label = "";
    let current: any = form.buttons[selectedPath[0]];
    label = current?.title || "Button";
    for (let i = 1; i < selectedPath.length; i++) {
      current = current?.response?.buttons?.[selectedPath[i]];
      label += ` → ${current?.title || "Button"}`;
    }
    return label;
  };

  // Recursive flow tree renderer
  const renderFlowNode = (text: string, buttons: FlowButton[], path: NodePath, depth: number = 0) => {
    const isSelected = path.length === selectedPath.length && path.every((v, i) => v === selectedPath[i]);
    return (
      <div className="relative">
        {/* Message bubble */}
        <div
          onClick={() => setSelectedPath(path)}
          className={`relative ml-${depth * 4} rounded-lg border-2 p-3 cursor-pointer transition-all ${
            isSelected
              ? "border-primary bg-primary/5 shadow-lg"
              : "border-border bg-card hover:border-primary/50"
          }`}
          style={{ marginLeft: depth * 24 }}
        >
          <div className="flex items-start gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              <MessageSquare size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">
                {path.length === 0 ? "Start Message" : "Response"}
              </p>
              <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-3">
                {text || <span className="italic text-muted-foreground">No text set</span>}
              </p>
            </div>
            {path.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); removeButtonAt(path); }}
                className="rounded p-1 hover:bg-destructive/10"
                title="Delete"
              >
                <Trash2 size={12} className="text-destructive" />
              </button>
            )}
          </div>
        </div>

        {/* Buttons */}
        {buttons.length > 0 && (
          <div className="relative mt-2" style={{ marginLeft: depth * 24 + 24 }}>
            <div className="space-y-2">
              {buttons.map((btn, idx) => {
                const btnPath = [...path, idx];
                const btnNode = getNodeAt(btnPath);
                return (
                  <div key={btn.id} className="relative">
                    {/* Line from parent */}
                    <div className="absolute -left-3 top-3 h-px w-3 bg-border" />
                    {/* Button pill */}
                    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border-2 ${
                      selectedPath.length === btnPath.length && btnPath.every((v, i) => v === selectedPath[i])
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background"
                    }`}>
                      <CornerDownRight size={11} className="text-primary" />
                      <input
                        value={btn.title}
                        onChange={(e) => updateButtonTitle(btnPath, e.target.value.slice(0, 20))}
                        onClick={(e) => e.stopPropagation()}
                        maxLength={20}
                        placeholder="Button label"
                        className="bg-transparent outline-none text-foreground font-medium min-w-[100px] max-w-[180px]"
                      />
                      <span className="text-[9px] text-muted-foreground">{btn.title.length}/20</span>
                    </div>
                    {/* Recursive response */}
                    <div className="mt-2">
                      {renderFlowNode(btnNode.text, btnNode.buttons, btnPath, depth + 1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add button button */}
        {buttons.length < 3 && (
          <div style={{ marginLeft: depth * 24 + 24 }}>
            <button
              onClick={() => addButtonAt(path)}
              className="mt-2 flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus size={11} /> Add button
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex h-[56px] shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <button onClick={onClose} className="rounded-full p-2 hover:bg-wa-hover">
          <X size={20} className="text-foreground" />
        </button>
        <div className="flex-1">
          <input
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Flow name..."
            className="w-full bg-transparent text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <div
            role="switch"
            aria-checked={form.enabled}
            onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
            className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${form.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <span className="text-xs text-muted-foreground">{form.enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Flow
        </button>
      </div>

      {error && (
        <div className="shrink-0 bg-destructive/10 px-4 py-2 text-xs text-destructive text-center">{error}</div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — Config */}
        <div className="w-[340px] shrink-0 overflow-y-auto wa-scrollbar border-r border-border bg-card">
          <div className="p-4 space-y-5">
            <div>
              <p className="mb-2 text-[10px] uppercase font-semibold text-muted-foreground">Triggers</p>
              <div className="flex gap-2 mb-2">
                <input
                  value={triggerInput}
                  onChange={(e) => setTriggerInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTrigger(); } }}
                  placeholder="e.g. hi, hello"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                />
                <button onClick={addTrigger} className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90">Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.triggers.map(t => (
                  <span key={t} className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    {t}
                    <button onClick={() => removeTrigger(t)}><X size={10} /></button>
                  </span>
                ))}
                {form.triggers.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">No triggers yet</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase font-semibold text-muted-foreground">Match Type</p>
              <select
                value={form.matchType}
                onChange={(e) => setForm(f => ({ ...f, matchType: e.target.value as any }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="contains">Contains</option>
                <option value="exact">Exact match</option>
                <option value="starts_with">Starts with</option>
              </select>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase font-semibold text-muted-foreground">Priority</p>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Higher priority flows are checked first</p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-[10px] uppercase font-semibold text-muted-foreground">
                Editing: <span className="text-primary">{pathLabel()}</span>
              </p>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Header (optional)</label>
                  <input
                    value={currentNode.headerText || ""}
                    onChange={(e) => updateNodeAt(selectedPath, { headerText: e.target.value })}
                    placeholder="Optional header"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Message text</label>
                  <textarea
                    value={currentNode.text}
                    onChange={(e) => updateNodeAt(selectedPath, { text: e.target.value })}
                    placeholder="Message to send..."
                    rows={6}
                    className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Footer (optional)</label>
                  <input
                    value={currentNode.footerText || ""}
                    onChange={(e) => updateNodeAt(selectedPath, { footerText: e.target.value })}
                    placeholder="Optional footer"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={() => addButtonAt(selectedPath)}
                  disabled={currentNode.buttons.length >= 3}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
                >
                  <Plus size={12} /> Add button ({currentNode.buttons.length}/3)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right canvas — Flow tree */}
        <div className="flex-1 overflow-auto wa-scrollbar bg-background/50">
          <div className="p-8 min-h-full">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground">Flow Structure</h3>
              <p className="text-xs text-muted-foreground">Click any message or button to edit it. Nested buttons create multi-step flows.</p>
            </div>
            <div className="max-w-3xl">
              {renderFlowNode(form.message.text, form.buttons, [], 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
