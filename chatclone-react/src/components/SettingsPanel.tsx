import { useState, useCallback } from "react";
import {
  Bell,
  ChevronRight,
  Zap,
  LayoutTemplate,
  Tag,
  Users,
  LogOut,
  HardDrive,
  Workflow,
} from "lucide-react";
import ShortcutsManager from "./ShortcutsManager";
import TemplateManager from "./TemplateManager";
import TagsManager from "./TagsManager";
import AgentsManager from "./AgentsManager";
import BackupManager from "./BackupManager";
import FlowsManager from "./FlowsManager";
import { useAuth } from "@/context/AuthContext";

interface SettingItem {
  icon: typeof Bell;
  label: string;
  description?: string;
}

const settingSections: { title?: string; items: SettingItem[] }[] = [
  {
    items: [
      { icon: Bell, label: "Notifications", description: "Sound & browser notifications for new messages" },
    ],
  },
  {
    title: "Messaging",
    items: [
      { icon: Zap, label: "Shortcuts", description: "Create and manage canned responses" },
      { icon: LayoutTemplate, label: "Templates", description: "Create, edit and manage message templates" },
      { icon: Workflow, label: "Flows", description: "Auto-reply flows with interactive buttons" },
    ],
  },
  {
    title: "Management",
    items: [
      { icon: Tag, label: "Tags", description: "Create, edit and manage conversation tags" },
      { icon: Users, label: "Agents", description: "Manage agents and team members" },
      { icon: HardDrive, label: "Backup", description: "Create full backup for server migration" },
    ],
  },
];

type View = "main" | "shortcuts" | "templates" | "tags" | "agents" | "backup" | "flows";

export default function SettingsPanel() {
  const { logout } = useAuth();
  const [view, setView] = useState<View>("main");
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem("wab_notifications") !== "false";
  });

  const toggleNotifications = useCallback(() => {
    const next = !notificationsEnabled;
    if (next && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          setNotificationsEnabled(true);
          localStorage.setItem("wab_notifications", "true");
        }
      });
    } else {
      setNotificationsEnabled(next);
      localStorage.setItem("wab_notifications", String(next));
    }
  }, [notificationsEnabled]);

  if (view === "shortcuts") return <ShortcutsManager onBack={() => setView("main")} />;
  if (view === "templates") return <TemplateManager onBack={() => setView("main")} />;
  if (view === "tags") return <TagsManager onBack={() => setView("main")} />;
  if (view === "agents") return <AgentsManager onBack={() => setView("main")} />;
  if (view === "backup") return <BackupManager onBack={() => setView("main")} />;
  if (view === "flows") return <FlowsManager onBack={() => setView("main")} />;

  const viewMap: Record<string, View> = {
    Shortcuts: "shortcuts",
    Templates: "templates",
    Tags: "tags",
    Agents: "agents",
    Backup: "backup",
    Flows: "flows",
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-[60px] items-center gap-4 px-5">
        <h1 className="text-[22px] font-bold text-foreground">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto wa-scrollbar">
        {settingSections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <div className="px-5 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-primary">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-wa-hover"
                  onClick={() => {
                    if (item.label === "Notifications") { toggleNotifications(); return; }
                    const v = viewMap[item.label];
                    if (v) setView(v);
                  }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Icon size={18} className="text-wa-icon" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] text-foreground">{item.label}</span>
                    {item.description && (
                      <span className="truncate text-[12px] text-muted-foreground">{item.description}</span>
                    )}
                  </div>
                  {item.label === "Notifications" ? (
                    <div
                      role="switch"
                      aria-checked={notificationsEnabled}
                      onClick={(e) => { e.stopPropagation(); toggleNotifications(); }}
                      className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        notificationsEnabled ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        notificationsEnabled ? "translate-x-4" : "translate-x-0.5"
                      }`} />
                    </div>
                  ) : (
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* Logout */}
        <div className="px-5 py-6">
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
