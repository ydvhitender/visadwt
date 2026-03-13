import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, MessageCircle, Clock, Users, ArrowUpRight, ArrowDownRight,
  TrendingUp,
} from "lucide-react";
import {
  getMessageStats, getConversationStats, getResponseTimeStats, getAgentPerformance,
  type MessageStats, type ConversationStats, type ResponseTimeStats, type AgentPerformance,
} from "@/api/analytics";

function StatCard({ title, value, icon: Icon, trend, trendValue, color }: {
  title: string;
  value: string | number;
  icon: typeof MessageCircle;
  trend?: "up" | "down";
  trendValue?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {trendValue && (
        <div className="mt-1 flex items-center gap-1">
          {trend === "up" ? (
            <ArrowUpRight size={14} className="text-green-500" />
          ) : (
            <ArrowDownRight size={14} className="text-red-500" />
          )}
          <span className={`text-xs ${trend === "up" ? "text-green-500" : "text-red-500"}`}>
            {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState("7d");

  const dateFrom = useMemo(() => {
    const d = new Date();
    switch (dateRange) {
      case "24h": d.setDate(d.getDate() - 1); break;
      case "7d": d.setDate(d.getDate() - 7); break;
      case "30d": d.setDate(d.getDate() - 30); break;
      case "90d": d.setDate(d.getDate() - 90); break;
    }
    return d.toISOString();
  }, [dateRange]);

  const { data: msgStats } = useQuery({
    queryKey: ["analytics", "messages", dateRange],
    queryFn: () => getMessageStats(dateFrom),
  });

  const { data: convStats } = useQuery({
    queryKey: ["analytics", "conversations"],
    queryFn: () => getConversationStats(),
  });

  const { data: respStats } = useQuery({
    queryKey: ["analytics", "response-times", dateRange],
    queryFn: () => getResponseTimeStats(dateFrom),
  });

  const { data: agentStats } = useQuery({
    queryKey: ["analytics", "agents", dateRange],
    queryFn: () => getAgentPerformance(dateFrom),
  });

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-[60px] items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2">
          <BarChart3 size={22} className="text-primary" />
          <h1 className="text-[22px] font-bold text-foreground">Analytics</h1>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-wa-header p-1">
          {[
            { key: "24h", label: "24h" },
            { key: "7d", label: "7 days" },
            { key: "30d", label: "30 days" },
            { key: "90d", label: "90 days" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDateRange(opt.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                dateRange === opt.key
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 wa-scrollbar">
        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <StatCard
            title="Total Messages"
            value={msgStats?.total ?? 0}
            icon={MessageCircle}
            color="bg-blue-500/10 text-blue-500"
          />
          <StatCard
            title="Inbound"
            value={msgStats?.inbound ?? 0}
            icon={ArrowDownRight}
            color="bg-green-500/10 text-green-500"
          />
          <StatCard
            title="Outbound"
            value={msgStats?.outbound ?? 0}
            icon={ArrowUpRight}
            color="bg-purple-500/10 text-purple-500"
          />
          <StatCard
            title="Avg Response Time"
            value={respStats ? `${respStats.avgResponseTimeMins}m` : "—"}
            icon={Clock}
            color="bg-orange-500/10 text-orange-500"
          />
        </div>

        {/* Conversation stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <StatCard
            title="Open Conversations"
            value={convStats?.byStatus?.open ?? 0}
            icon={MessageCircle}
            color="bg-green-500/10 text-green-500"
          />
          <StatCard
            title="Pending"
            value={convStats?.byStatus?.pending ?? 0}
            icon={Clock}
            color="bg-yellow-500/10 text-yellow-500"
          />
          <StatCard
            title="Closed"
            value={convStats?.byStatus?.closed ?? 0}
            icon={TrendingUp}
            color="bg-gray-500/10 text-gray-500"
          />
        </div>

        {/* Daily message chart (simple bar visualization) */}
        {msgStats?.daily && msgStats.daily.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground">Messages Over Time</h3>
            <div className="flex items-end gap-1 h-40">
              {msgStats.daily.slice(-14).map((day) => {
                const max = Math.max(...msgStats.daily.map((d) => d.inbound + d.outbound), 1);
                const total = day.inbound + day.outbound;
                const height = (total / max) * 100;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-col items-center">
                      <div
                        className="w-full max-w-[24px] rounded-t bg-primary/70 transition-all"
                        style={{ height: `${(day.outbound / max) * 140}px` }}
                        title={`Outbound: ${day.outbound}`}
                      />
                      <div
                        className="w-full max-w-[24px] rounded-b bg-primary/30"
                        style={{ height: `${(day.inbound / max) * 140}px` }}
                        title={`Inbound: ${day.inbound}`}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(day.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-primary/70" /> Outbound
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-primary/30" /> Inbound
              </div>
            </div>
          </div>
        )}

        {/* Agent performance table */}
        {agentStats && agentStats.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground">Agent Performance</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Messages Sent</th>
                  <th className="pb-2 font-medium text-right">Active</th>
                  <th className="pb-2 font-medium text-right">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((a) => (
                  <tr key={a.agent._id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {a.agent.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{a.agent.name}</p>
                          <p className="text-[11px] text-muted-foreground">{a.agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${a.agent.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                        <span className="text-xs text-muted-foreground">
                          {a.agent.isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-sm text-foreground">{a.messagesSent}</td>
                    <td className="py-2.5 text-right text-sm text-foreground">{a.activeConversations}</td>
                    <td className="py-2.5 text-right text-sm text-foreground">{a.resolvedConversations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
