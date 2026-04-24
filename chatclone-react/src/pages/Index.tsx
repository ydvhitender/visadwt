import { useState, useEffect, useCallback } from "react";
import ChatSidebar from "@/components/ChatSidebar";
import ChatPanel from "@/components/ChatPanel";
import EmptyChatPanel from "@/components/EmptyChatPanel";
import ContactProfilePanel from "@/components/ContactProfilePanel";
import SettingsPanel from "@/components/SettingsPanel";
import Analytics from "@/pages/Analytics";
import IconSidebar, { type IconTab } from "@/components/IconSidebar";
import ResizeHandle from "@/components/ResizeHandle";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useConversations, useConversationUpdaters } from "@/hooks/useConversations";
import { useMessageUpdaters } from "@/hooks/useMessages";
import { getConversation } from "@/api/conversations";
import { useNotification } from "@/hooks/useNotification";
import type { Conversation, Message } from "@/types";

const Index = () => {
  useNotification();
  const { user: authUser, updateUser } = useAuth();
  const qc = useQueryClient();
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
  const { updateConversationInCache } = useConversationUpdaters();
  const { appendMessage, updateMessageStatus, updateMessageReactions } = useMessageUpdaters(selectedId);

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

  // ─── Socket.IO: message_reaction ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleReaction = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      updateMessageReactions(messageId, reactions);
    };

    socket.on("message_reaction", handleReaction);
    return () => {
      socket.off("message_reaction", handleReaction);
    };
  }, [socket, updateMessageReactions]);

  const handleSelectConversation = useCallback((id: string) => {
    setSelectedId(id);
    setProfileOpen(false);
  }, []);

  const handleConversationUpdate = useCallback((updated: Conversation) => {
    setSelectedConversation(updated);
    updateConversationInCache(updated);
  }, [updateConversationInCache]);

  return (
    <div className="flex h-screen w-screen min-w-[900px] bg-background">
      {/* Left icon sidebar */}
      <IconSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadCount={totalUnread}
        userName={authUser?.name ?? ''}
        user={authUser}
        onAvatarUpdate={(url) => updateUser({ avatar: url })}
      />

      {/* Analytics takes the full area after icon sidebar */}
      {activeTab === "analytics" ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <Analytics />
        </div>
      ) : (
        <>
          {/* Side panel — switches based on active tab */}
          <div className="shrink-0 border-r border-border" style={{ width: sidebarWidth }}>
            {activeTab === "chats" ? (
              <ChatSidebar
                selectedConversationId={selectedId}
                onSelectConversation={handleSelectConversation}
              />
            ) : activeTab === "settings" ? (
              <SettingsPanel />
            ) : null}
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
                  onConversationUpdate={handleConversationUpdate}
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
                    onDeleteChat={() => {
                      setSelectedId(null);
                      setSelectedConversation(null);
                      setProfileOpen(false);
                      updateConversationInCache({ ...selectedConversation, _id: "__deleted__" } as any);
                      qc.invalidateQueries({ queryKey: ["conversations"] });
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Index;
