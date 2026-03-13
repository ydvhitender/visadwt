import { useState, useMemo, useEffect } from "react";
import { Search, MoreVertical, MessageSquarePlus, Loader2, Pin, BellOff, Plus, User } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/context/AuthContext";
import { contactDisplayName, initials, avatarColor, formatSidebarTime, lastMessagePreview } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatSidebarProps {
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

export default function ChatSidebar({ selectedConversationId, onSelectConversation }: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const { logout } = useAuth();

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryParams = useMemo(() => {
    const p: Record<string, string | number> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (activeFilter === "Unread") p.status = "open";
    return p;
  }, [debouncedSearch, activeFilter]);

  const { data, isLoading } = useConversations(queryParams);

  // Compute filter counts from data
  const { unreadCount, filteredConversations } = useMemo(() => {
    if (!data?.conversations) return { unreadCount: 0, filteredConversations: [] };
    const convs = data.conversations;
    const unread = convs.filter((c) => c.unreadCount > 0).length;

    let list = convs;
    if (activeFilter === "Unread") {
      list = list.filter((c) => c.unreadCount > 0);
    }
    return { unreadCount: unread, filteredConversations: list };
  }, [data, activeFilter]);

  const filters = [
    { key: "All", label: "All" },
    { key: "Unread", label: "Unread", count: unreadCount || undefined },
    { key: "Favorites", label: "Favourites" },
    { key: "Groups", label: "Groups" },
  ];

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header — "Chats" title + action icons */}
      <div className="flex h-[60px] items-center justify-between px-5">
        <h1 className="text-[22px] font-bold text-foreground">Chats</h1>
        <div className="flex items-center gap-1">
          <button
            title="New chat"
            className="flex h-9 w-9 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-wa-hover"
          >
            <MessageSquarePlus size={20} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Menu"
                className="flex h-9 w-9 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-wa-hover"
              >
                <MoreVertical size={20} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem>New group</DropdownMenuItem>
              <DropdownMenuItem>Starred messages</DropdownMenuItem>
              <DropdownMenuItem>Select chats</DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-1.5">
        <div className="flex items-center gap-3 rounded-lg bg-wa-header px-3 py-1.5">
          <Search size={16} className="shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search or start a new chat"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="shrink-0 text-muted-foreground hover:text-foreground">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter pills with counts */}
      <div className="flex items-center gap-2 px-3 pb-1 pt-0.5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeFilter === f.key
                ? "bg-wa-filter-active text-primary"
                : "bg-wa-header text-muted-foreground hover:bg-wa-hover"
            }`}
          >
            {f.label}
            {f.count != null && f.count > 0 && (
              <span className="text-[10px] opacity-80">{f.count}</span>
            )}
          </button>
        ))}
        <button className="flex h-6 w-6 items-center justify-center rounded-full bg-wa-header text-muted-foreground transition-colors hover:bg-wa-hover">
          <Plus size={14} />
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto wa-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        )}

        {!isLoading && filteredConversations.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {debouncedSearch ? "No chats match your search" : "No conversations yet"}
          </div>
        )}

        {filteredConversations.map((conv) => {
          const name = contactDisplayName(conv.contact);
          const avatarText = initials(name);
          const color = avatarColor(conv.contact._id);
          const time = conv.lastMessage?.timestamp ? formatSidebarTime(conv.lastMessage.timestamp) : "";
          const preview = lastMessagePreview(conv);
          const isSelected = selectedConversationId === conv._id;
          const hasUnread = conv.unreadCount > 0;

          return (
            <button
              key={conv._id}
              onClick={() => onSelectConversation(conv._id)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-wa-hover ${
                isSelected ? "bg-wa-active" : ""
              }`}
            >
              {/* Avatar */}
              <div
                className="flex h-[49px] w-[49px] shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: color }}
              >
                {avatarText ? (
                  <span className="text-sm font-semibold text-white">{avatarText}</span>
                ) : (
                  <User size={24} className="text-white/70" />
                )}
              </div>

              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col border-b border-border py-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-[15px] font-medium text-foreground">{name}</span>
                  <span className={`shrink-0 text-xs ${hasUnread ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {time}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[13px] text-muted-foreground">{preview}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {conv.muted && (
                      <BellOff size={14} className="text-muted-foreground" />
                    )}
                    {conv.pinned && (
                      <Pin size={14} className="text-muted-foreground" />
                    )}
                    {hasUnread && (
                      <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                {/* Tag chips */}
                {conv.tags && conv.tags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {conv.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-1.5 py-[1px] text-[10px] font-medium text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                    {conv.tags.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{conv.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
