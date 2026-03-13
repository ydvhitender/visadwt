import { useState, useEffect, useCallback } from "react";
import { Phone, RefreshCw, Radio, Users } from "lucide-react";
import ChatSidebar from "@/components/ChatSidebar";
import ChatPanel from "@/components/ChatPanel";
import EmptyChatPanel from "@/components/EmptyChatPanel";
import ContactProfilePanel from "@/components/ContactProfilePanel";
import SettingsPanel from "@/components/SettingsPanel";
import IconSidebar, { type IconTab } from "@/components/IconSidebar";
import ResizeHandle from "@/components/ResizeHandle";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { useConversations, useConversationUpdaters } from "@/hooks/useConversations";
import { useMessageUpdaters } from "@/hooks/useMessages";
import { getConversation } from "@/api/conversations";
import type { Conversation, Message } from "@/types";

const tabPlaceholders: Record<Exclude<IconTab, "chats" | "settings">, { icon: typeof Phone; title: string; description: string }> = {
  calls: { icon: Phone, title: "Calls", description: "Start making calls to your contacts" },
  status: { icon: RefreshCw, title: "Status", description: "View and share status updates" },
  channels: { icon: Radio, title: "Channels", description: "Find channels to follow" },
  communities: { icon: Users, title: "Communities", description: "Connect with your communities" },
};

const Index = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [activeTab, setActiveTab] = useState<IconTab>("chats");
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(380); // px, default ~30%
  const [profileWidth, setProfileWidth] = useState(340); // px

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.min(600, Math.max(280, w + delta)));
  }, []);

  const handleProfileResize = useCallback((delta: number) => {
    setProfileWidth((w) => Math.min(600, Math.max(280, w + delta)));
  }, []);
  const { socket } = useSocket();
  const { user } = useAuth();
  const { updateConversationInCache } = useConversationUpdaters();
  const { appendMessage, updateMessageStatus } = useMessageUpdaters(selectedId);

  // Conversations query for total unread count (React Query deduplicates)
  const { data: convsData } = useConversations({});
  const totalUnread = convsData?.conversations?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;

  // ─── Fetch full conversation when selection changes ────────────────────────
  useEffect(() => {
    if (!selectedId) {
      setSelectedConversation(null);
      return;
    }
    getConversation(selectedId)
      .then(setSelectedConversation)
      .catch(() => setSelectedConversation(null));
  }, [selectedId]);

  // ─── Socket.IO: join / leave conversation rooms ────────────────────────────
  useEffect(() => {
    if (!socket || !selectedId) return;
    socket.emit("join_conversation", selectedId);
    return () => {
      socket.emit("leave_conversation", selectedId);
    };
  }, [socket, selectedId]);

  // ─── Socket.IO: new_message ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ conversation, message }: { conversation: Conversation; message: Message }) => {
      updateConversationInCache(conversation);
      if (message.conversation === selectedId) {
        appendMessage(message);
      }
    };

    socket.on("new_message", handleNewMessage);
    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [socket, selectedId, updateConversationInCache, appendMessage]);

  // ─── Socket.IO: conversation_assigned ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleAssigned = ({ conversation }: { conversation: Conversation }) => {
      updateConversationInCache(conversation);
      if (conversation._id === selectedId) {
        setSelectedConversation(conversation);
      }
    };

    socket.on("conversation_assigned", handleAssigned);
    return () => {
      socket.off("conversation_assigned", handleAssigned);
    };
  }, [socket, selectedId, updateConversationInCache]);

  // ─── Socket.IO: message_status ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleStatus = ({ messageId, status }: { messageId: string; status: Message["status"] }) => {
      updateMessageStatus(messageId, status);
    };

    socket.on("message_status", handleStatus);
    return () => {
      socket.off("message_status", handleStatus);
    };
  }, [socket, updateMessageStatus]);

  const handleSelectConversation = useCallback((id: string) => {
    setSelectedId(id);
    setProfileOpen(false);
  }, []);

  return (
    <div className="flex h-screen w-screen min-w-[900px] bg-background">
      {/* Left icon sidebar */}
      <IconSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadCount={totalUnread}
        userName={user?.name ?? ""}
      />

      {/* Side panel — switches based on active tab */}
      <div className="shrink-0 border-r border-border" style={{ width: sidebarWidth }}>
        {activeTab === "chats" ? (
          <ChatSidebar
            selectedConversationId={selectedId}
            onSelectConversation={handleSelectConversation}
          />
        ) : activeTab === "settings" ? (
          <SettingsPanel />
        ) : (
          (() => {
            const info = tabPlaceholders[activeTab];
            const Icon = info.icon;
            return (
              <div className="flex h-full flex-col bg-card">
                <div className="flex h-[60px] items-center px-5">
                  <h1 className="text-[22px] font-bold text-foreground">{info.title}</h1>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                    <Icon size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-center text-sm text-muted-foreground">{info.description}</p>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Resize handle for sidebar */}
      <ResizeHandle onResize={handleSidebarResize} direction="left" />

      {/* Main panel */}
      <div className="flex min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {activeTab === "chats" && selectedConversation ? (
            <ChatPanel
              conversation={selectedConversation}
              onToggleProfile={() => setProfileOpen((v) => !v)}
              isProfileOpen={profileOpen}
            />
          ) : (
            <EmptyChatPanel />
          )}
        </div>

        {/* Contact profile panel */}
        {profileOpen && selectedConversation && (
          <>
            {/* Resize handle for profile panel */}
            <ResizeHandle onResize={handleProfileResize} direction="right" />
            <div className="shrink-0" style={{ width: profileWidth }}>
              <ContactProfilePanel
                conversation={selectedConversation}
                onClose={() => setProfileOpen(false)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
