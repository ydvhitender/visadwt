import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, MoreVertical, Phone, Video, Smile, Paperclip, Mic, Send, Lock,
  ChevronDown, Check, CheckCheck, Loader2, FileText, AlertCircle,
  Download, Play, MapPin, User as UserIcon, Zap, Tag, X,
  LayoutTemplate,
} from "lucide-react";
import { useMessages, useMessageUpdaters } from "@/hooks/useMessages";
import { sendMessage, uploadMedia, sendReaction, getTemplates, getMediaUrl } from "@/api/messages";
import { getCannedResponses } from "@/api/cannedResponses";
import { markConversationRead, assignConversation } from "@/api/conversations";
import { getTags, updateConversationTags } from "@/api/tags";
import { getUsers } from "@/api/messages";
import { useAuth } from "@/context/AuthContext";
import { contactDisplayName, initials, avatarColor, formatMessageTime, formatDateSeparator } from "@/lib/format";
import type { Conversation, Message, CannedResponse, Tag as TagType, Template } from "@/types";

interface ChatPanelProps {
  conversation: Conversation;
  onToggleProfile?: () => void;
  isProfileOpen?: boolean;
}

function isDifferentDay(a: string, b: string) {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

// Quick emoji reaction options
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function ChatPanel({ conversation, onToggleProfile, isProfileOpen }: ChatPanelProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [quickReplyFilter, setQuickReplyFilter] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useMessages(conversation._id);
  const { appendMessage } = useMessageUpdaters(conversation._id);
  const { user } = useAuth();

  const messages = data?.messages ?? [];

  const contactName = contactDisplayName(conversation.contact);
  const avatar = initials(contactName);
  const color = avatarColor(conversation.contact._id);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    setText("");
    setShowQuickReplies(false);
    setShowTemplatePicker(false);
    setShowTagManager(false);
    setShowAssignDropdown(false);
  }, [conversation._id]);

  useEffect(() => {
    if (conversation.unreadCount > 0) {
      markConversationRead(conversation._id).catch(() => {});
    }
  }, [conversation._id, conversation.unreadCount]);

  // Fetch media URLs for messages with mediaId
  useEffect(() => {
    const fetchMediaUrls = async () => {
      const messagesNeedingUrls = messages.filter(
        msg => msg.media?.mediaId && !msg.media?.url && !mediaUrls[msg.media.mediaId]
      );

      if (messagesNeedingUrls.length === 0) return;

      const newUrls: Record<string, string> = { ...mediaUrls };
      for (const msg of messagesNeedingUrls) {
        if (!msg.media?.mediaId) continue;
        try {
          const result = await getMediaUrl(msg.media.mediaId);
          newUrls[msg.media.mediaId] = result.url;
        } catch {
          // Silently fail
        }
      }
      setMediaUrls(newUrls);
    };

    fetchMediaUrls();
  }, [messages]);

  // ─── Send text message ──────────────────────────────────────
  const handleSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const result = await sendMessage({
        conversationId: conversation._id,
        type: "text",
        text: body,
      });
      appendMessage(result.message || result);
      setText("");
      setShowQuickReplies(false);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error ||
                       err.response?.data?.message ||
                       err.response?.data?.details ||
                       JSON.stringify(err.response?.data) ||
                       err.message ||
                       'Failed to send message';
      console.error('Failed to send message - Status:', err.response?.status);
      console.error('Response data:', err.response?.data);
      console.error('Error:', errorMsg);
    } finally {
      setSending(false);
    }
  }, [text, sending, conversation._id, appendMessage]);

  // ─── File upload ──────────────────────────────────────
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const { mediaId, mimeType, filename } = await uploadMedia(file);
        const type = mimeType.startsWith("image/") ? "image"
          : mimeType.startsWith("video/") ? "video"
          : mimeType.startsWith("audio/") ? "audio"
          : "document";
        const result = await sendMessage({
          conversationId: conversation._id,
          type, mediaId, mimeType, filename,
        });
        appendMessage(result.message || result);
      } catch (err: any) {
        console.error('File upload error:', err.response?.data || err.message);
      }
      e.target.value = "";
    },
    [conversation._id, appendMessage],
  );

  // ─── Handle reaction ──────────────────────────────────────
  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await sendReaction(messageId, emoji);
      setShowReactionPicker(null);
    } catch {}
  }, []);

  // ─── Quick reply / canned response ──────────────────────────────────────
  const handleTextChange = useCallback((value: string) => {
    setText(value);
    if (value.startsWith("/")) {
      setQuickReplyFilter(value.slice(1));
      setShowQuickReplies(true);
      getCannedResponses(value.slice(1)).then(setCannedResponses).catch(() => {});
    } else {
      setShowQuickReplies(false);
    }
  }, []);

  const selectCannedResponse = useCallback((cr: CannedResponse) => {
    setText(cr.body);
    setShowQuickReplies(false);
  }, []);

  // ─── Template picker ──────────────────────────────────────
  const openTemplatePicker = useCallback(async () => {
    try {
      const data = await getTemplates();
      setTemplates(data.data || []);
      setShowTemplatePicker(true);
    } catch {}
  }, []);

  const sendTemplateMessage = useCallback(async (tmpl: any) => {
    try {
      const result = await sendMessage({
        conversationId: conversation._id,
        type: "template",
        templateName: tmpl.name,
        templateLanguage: tmpl.language,
      });
      appendMessage(result.message || result);
      setShowTemplatePicker(false);
    } catch {}
  }, [conversation._id, appendMessage]);

  // ─── Tag management ──────────────────────────────────────
  const openTagManager = useCallback(async () => {
    try {
      const tags = await getTags();
      setAllTags(tags);
      setShowTagManager(true);
    } catch {}
  }, []);

  const toggleTag = useCallback(async (tagName: string) => {
    const has = conversation.tags.includes(tagName);
    try {
      await updateConversationTags(
        conversation._id,
        has ? undefined : [tagName],
        has ? [tagName] : undefined
      );
    } catch {}
  }, [conversation._id, conversation.tags]);

  // ─── Agent assignment ──────────────────────────────────────
  const openAssignDropdown = useCallback(async () => {
    try {
      const data = await getUsers();
      setAgents(data);
      setShowAssignDropdown(true);
    } catch {}
  }, []);

  const handleAssign = useCallback(async (agentId: string | null) => {
    try {
      await assignConversation(conversation._id, agentId);
      setShowAssignDropdown(false);
    } catch {}
  }, [conversation._id]);

  // ─── Status icon ──────────────────────────────────────
  const StatusIcon = useCallback(({ status }: { status: Message["status"] }) => {
    switch (status) {
      case "read":
        return <CheckCheck size={16} className="text-wa-read-check" />;
      case "delivered":
        return <CheckCheck size={16} className="text-muted-foreground/50" />;
      case "sent":
        return <Check size={16} className="text-muted-foreground/50" />;
      case "failed":
        return <AlertCircle size={14} className="text-destructive" />;
      default:
        return <Loader2 size={14} className="animate-spin text-muted-foreground/40" />;
    }
  }, []);

  // ─── Render message content based on type ──────────────────────────────────────
  const renderMessageContent = useCallback((msg: Message) => {
    const getMediaUrl = (media: Message["media"]) => {
      if (!media) return null;
      return media.url || mediaUrls[media.mediaId ?? ""] || null;
    };

    switch (msg.type) {
      case "image":
        return (
          <div>
            {msg.media && (
              <img
                src={getMediaUrl(msg.media) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23e5e7eb' width='200' height='200'/%3E%3Ctext x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='14' fill='%236b7280'%3ELoading...%3C/text%3E%3C/svg%3E"}
                alt={msg.media.filename || "image"}
                className="mb-1 max-h-72 w-full cursor-pointer rounded object-cover"
                onClick={() => {
                  const url = getMediaUrl(msg.media);
                  if (url) setLightboxUrl(url);
                }}
              />
            )}
            {(msg.media?.caption || msg.text?.body) && (
              <p className="text-[14.2px] leading-[19px] text-foreground">
                {msg.media?.caption || msg.text?.body}
              </p>
            )}
          </div>
        );

      case "video":
        return (
          <div>
            {msg.media?.url || mediaUrls[msg.media?.mediaId ?? ""] ? (
              <video
                controls
                className="mb-1 max-h-72 w-full rounded"
                preload="metadata"
              >
                <source src={getMediaUrl(msg.media) || ""} type={msg.media.mimeType || "video/mp4"} />
              </video>
            ) : (
              <div className="mb-1 flex items-center gap-2 rounded bg-muted/50 px-3 py-2">
                <Play size={20} className="text-primary" />
                <span className="text-sm text-muted-foreground">Video</span>
              </div>
            )}
            {msg.media?.caption && (
              <p className="text-[14.2px] leading-[19px] text-foreground">{msg.media.caption}</p>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="min-w-[240px]">
            {msg.media?.url || mediaUrls[msg.media?.mediaId ?? ""] ? (
              <audio controls className="w-full" preload="metadata">
                <source src={getMediaUrl(msg.media) || ""} type={msg.media.mimeType || "audio/ogg"} />
              </audio>
            ) : (
              <div className="flex items-center gap-2 rounded bg-muted/50 px-3 py-2">
                <Play size={16} />
                <span className="text-sm text-muted-foreground">Audio message</span>
              </div>
            )}
          </div>
        );

      case "document":
        return (
          <a
            href={getMediaUrl(msg.media) || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {msg.media?.filename || "Document"}
              </p>
              <p className="text-xs text-muted-foreground">
                {msg.media?.mimeType || "file"}
              </p>
            </div>
            <Download size={18} className="shrink-0 text-muted-foreground" />
          </a>
        );

      case "sticker":
        return (
          <div className="p-1">
            {msg.media?.url || mediaUrls[msg.media?.mediaId ?? ""] ? (
              <img
                src={getMediaUrl(msg.media) || ""}
                alt="sticker"
                className="h-32 w-32 object-contain"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center text-4xl">🏷️</div>
            )}
          </div>
        );

      case "location":
        return (
          <div>
            <a
              href={`https://www.google.com/maps?q=${msg.location?.latitude},${msg.location?.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="mb-1 flex h-36 w-full items-center justify-center rounded bg-muted/30">
                <div className="flex flex-col items-center gap-1 text-primary">
                  <MapPin size={32} />
                  <span className="text-xs">View on Maps</span>
                </div>
              </div>
            </a>
            {msg.location?.name && (
              <p className="text-sm font-medium text-foreground">{msg.location.name}</p>
            )}
            {msg.location?.address && (
              <p className="text-xs text-muted-foreground">{msg.location.address}</p>
            )}
          </div>
        );

      case "contacts":
        return (
          <div className="space-y-1">
            {msg.contacts?.map((contact, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <UserIcon size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {contact.name?.formatted_name || contact.name?.first_name || "Contact"}
                  </p>
                  {contact.phones?.map((p, pi) => (
                    <p key={pi} className="text-xs text-muted-foreground">{p.phone}</p>
                  ))}
                  {contact.emails?.map((e, ei) => (
                    <p key={ei} className="text-xs text-muted-foreground">{e.email}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      case "interactive":
        return (
          <div>
            {msg.interactive?.body?.text && (
              <p className="text-[14.2px] leading-[19px] text-foreground mb-2">
                {msg.interactive.body.text}
              </p>
            )}
            {/* Button replies from user */}
            {msg.interactive?.buttonReply && (
              <div className="rounded bg-primary/10 px-3 py-1.5 text-sm text-primary">
                {msg.interactive.buttonReply.title}
              </div>
            )}
            {/* List replies from user */}
            {msg.interactive?.listReply && (
              <div className="rounded bg-primary/10 px-3 py-1.5">
                <p className="text-sm font-medium text-primary">{msg.interactive.listReply.title}</p>
                {msg.interactive.listReply.description && (
                  <p className="text-xs text-muted-foreground">{msg.interactive.listReply.description}</p>
                )}
              </div>
            )}
            {/* Outbound buttons */}
            {msg.interactive?.action?.buttons && msg.direction === "outbound" && (
              <div className="mt-1 space-y-1 border-t border-border/50 pt-1">
                {(msg.interactive.action.buttons as any[]).map((btn: any, idx: number) => (
                  <div key={idx} className="rounded border border-border/50 px-3 py-1.5 text-center text-sm text-primary">
                    {btn.title || btn.reply?.title}
                  </div>
                ))}
              </div>
            )}
            {/* Outbound list sections */}
            {msg.interactive?.action?.sections && msg.direction === "outbound" && (
              <div className="mt-1 border-t border-border/50 pt-1">
                <div className="rounded border border-border/50 px-3 py-1.5 text-center text-sm text-primary">
                  {msg.interactive.action.button || "View options"}
                </div>
              </div>
            )}
          </div>
        );

      case "template":
        return (
          <div>
            <div className="mb-1 rounded bg-muted/20 px-2 py-1">
              <p className="text-xs font-medium text-muted-foreground">
                📋 Template: {msg.template?.name}
              </p>
            </div>
            {msg.text?.body && (
              <p className="text-[14.2px] leading-[19px] text-foreground">{msg.text.body}</p>
            )}
          </div>
        );

      default: {
        // Plain text
        const body = msg.text?.body || msg.media?.caption || "";
        return body ? (
          <p className="text-[14.2px] leading-[19px] text-foreground">{body}</p>
        ) : null;
      }
    }
  }, [mediaUrls]);

  const isSticker = (msg: Message) => msg.type === "sticker";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-wa-header px-4">
        <button className="flex items-center gap-3 rounded-lg px-1 -ml-1 hover:bg-wa-hover transition-colors" onClick={onToggleProfile}>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: color, color: "white" }}
          >
            {avatar}
          </div>
          <div className="text-left">
            <p className="text-base font-normal text-foreground">{contactName}</p>
            <p className="text-xs text-muted-foreground">{conversation.contact.phoneNumber}</p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          {/* Tags */}
          {conversation.tags.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              {conversation.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* Assigned agent */}
          <div className="relative">
            <button
              className="rounded-full p-2 hover:bg-wa-hover"
              title={conversation.assignedTo ? `Assigned: ${conversation.assignedTo.name}` : "Unassigned"}
              onClick={openAssignDropdown}
            >
              <UserIcon size={20} className={conversation.assignedTo ? "text-primary" : "text-wa-icon"} />
            </button>
            {showAssignDropdown && (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card shadow-lg">
                <div className="p-2">
                  <p className="mb-2 text-xs font-medium text-muted-foreground px-2">Assign to</p>
                  <button
                    onClick={() => handleAssign(user?.id || null)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-wa-hover"
                  >
                    <Zap size={14} className="text-primary" /> Assign to me
                  </button>
                  <button
                    onClick={() => handleAssign(null)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-wa-hover text-muted-foreground"
                  >
                    <X size={14} /> Unassign
                  </button>
                  <div className="my-1 border-t border-border" />
                  {agents.map((a: any) => (
                    <button
                      key={a._id || a.id}
                      onClick={() => handleAssign(a._id || a.id)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-wa-hover"
                    >
                      <div className={`h-2 w-2 rounded-full ${a.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                      {a.name}
                      {(a._id || a.id) === (conversation.assignedTo?.id || conversation.assignedTo?._id) && (
                        <Check size={14} className="ml-auto text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="rounded-full p-2 hover:bg-wa-hover" onClick={openTagManager} title="Tags">
            <Tag size={20} className="text-wa-icon" />
          </button>
          <button className="rounded-full p-2 hover:bg-wa-hover"><Video size={20} className="text-wa-icon" /></button>
          <button className="rounded-full p-2 hover:bg-wa-hover"><Phone size={20} className="text-wa-icon" /></button>
          <button className="rounded-full p-2 hover:bg-wa-hover"><Search size={20} className="text-wa-icon" /></button>
          <button className="rounded-full p-2 hover:bg-wa-hover"><MoreVertical size={20} className="text-wa-icon" /></button>
        </div>
      </div>

      {/* Tag manager dropdown */}
      {showTagManager && (
        <div className="absolute right-20 top-16 z-50 w-64 rounded-lg border border-border bg-card shadow-lg">
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Tags</p>
              <button onClick={() => setShowTagManager(false)}>
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-1">
              {allTags.map((tag) => (
                <button
                  key={tag._id}
                  onClick={() => toggleTag(tag.name)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-wa-hover"
                >
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-left">{tag.name}</span>
                  {conversation.tags.includes(tag.name) && (
                    <Check size={14} className="text-primary" />
                  )}
                </button>
              ))}
              {allTags.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No tags created yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="wa-wallpaper wa-scrollbar flex-1 overflow-y-auto px-[5%] py-4 lg:px-[10%]">
        <div className="mx-auto mb-4 flex max-w-md items-center justify-center gap-1 rounded-lg bg-wa-date-chip px-3 py-2 text-center">
          <Lock size={12} className="shrink-0 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
          </span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        )}

        {messages.map((msg, i) => {
          const isInbound = msg.direction === "inbound";
          const showTail = i === 0 || messages[i - 1].direction !== msg.direction;
          const showDateSep = i === 0 || isDifferentDay(messages[i - 1].timestamp, msg.timestamp);
          const stickerMsg = isSticker(msg);

          return (
            <div key={msg._id}>
              {showDateSep && (
                <div className="mb-4 mt-2 flex justify-center">
                  <span className="rounded-lg bg-wa-date-chip px-3 py-1 text-[12px] text-muted-foreground shadow-sm">
                    {formatDateSeparator(msg.timestamp)}
                  </span>
                </div>
              )}

              <div className={`mb-1 flex ${isInbound ? "justify-start" : "justify-end"}`}>
                <div
                  className={`group relative max-w-[65%] rounded-lg shadow-sm ${
                    stickerMsg
                      ? "bg-transparent shadow-none"
                      : `px-2.5 pb-1 pt-1.5 ${
                          isInbound
                            ? `bg-wa-incoming ${showTail ? "bubble-tail-in ml-2" : ""}`
                            : `bg-wa-outgoing ${showTail ? "bubble-tail-out mr-2" : ""}`
                        }`
                  }`}
                >
                  {/* Context menu + reaction trigger */}
                  <div className="absolute -top-1 right-1 hidden gap-1 group-hover:flex">
                    <button
                      onClick={() => setShowReactionPicker(showReactionPicker === msg._id ? null : msg._id)}
                      className="rounded-full bg-card/90 p-1 shadow-sm hover:bg-card"
                    >
                      <Smile size={14} className="text-muted-foreground" />
                    </button>
                    <button className="rounded-full bg-card/90 p-1 shadow-sm hover:bg-card">
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </button>
                  </div>

                  {/* Reaction picker */}
                  {showReactionPicker === msg._id && (
                    <div className="absolute -top-10 left-0 z-50 flex gap-1 rounded-full bg-card px-2 py-1 shadow-lg border border-border">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg._id, emoji)}
                          className="text-lg hover:scale-125 transition-transform p-0.5"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Message content */}
                  {renderMessageContent(msg)}

                  {/* Timestamp + status */}
                  {!stickerMsg && (
                    <div className="flex items-center justify-end gap-1 -mb-0.5">
                      <span className="text-[11px] text-muted-foreground/70">
                        {formatMessageTime(msg.timestamp)}
                      </span>
                      {!isInbound && <StatusIcon status={msg.status} />}
                    </div>
                  )}

                  {/* Reactions display */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="absolute -bottom-3 left-1 flex gap-0.5">
                      <div className="flex items-center gap-0.5 rounded-full bg-card border border-border px-1.5 py-0.5 shadow-sm">
                        {/* Group by emoji */}
                        {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((emoji) => {
                          const count = msg.reactions!.filter((r) => r.emoji === emoji).length;
                          return (
                            <span key={emoji} className="text-xs">
                              {emoji}{count > 1 && <span className="text-[10px] text-muted-foreground ml-0.5">{count}</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Extra margin if message has reactions */}
              {msg.reactions && msg.reactions.length > 0 && <div className="h-3" />}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies dropdown */}
      {showQuickReplies && cannedResponses.length > 0 && (
        <div className="mx-4 mb-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {cannedResponses.map((cr) => (
            <button
              key={cr._id}
              onClick={() => selectCannedResponse(cr)}
              className="flex w-full flex-col gap-0.5 border-b border-border/50 px-3 py-2 text-left hover:bg-wa-hover last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-primary">/{cr.shortcut}</span>
                <span className="text-sm font-medium text-foreground">{cr.title}</span>
              </div>
              <span className="truncate text-xs text-muted-foreground">{cr.body}</span>
            </button>
          ))}
        </div>
      )}

      {/* Template picker modal */}
      {showTemplatePicker && (
        <div className="mx-4 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-medium text-foreground">Message Templates</p>
            <button onClick={() => setShowTemplatePicker(false)}>
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
          {templates.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">No templates available</p>
          )}
          {templates.map((tmpl: any, idx: number) => (
            <button
              key={idx}
              onClick={() => sendTemplateMessage(tmpl)}
              className="flex w-full flex-col gap-1 border-b border-border/50 px-3 py-2.5 text-left hover:bg-wa-hover last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{tmpl.name}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  tmpl.status === "APPROVED" ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
                }`}>
                  {tmpl.status}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{tmpl.language} · {tmpl.category}</span>
            </button>
          ))}
        </div>
      )}

      {/* Compose area */}
      <div className="flex shrink-0 items-center gap-2 bg-wa-header px-4 py-2">
        <button className="rounded-full p-2 hover:bg-wa-hover">
          <Smile size={24} className="text-wa-icon" />
        </button>
        <button className="rounded-full p-2 hover:bg-wa-hover" onClick={() => fileInputRef.current?.click()}>
          <Paperclip size={24} className="text-wa-icon" />
        </button>
        <button className="rounded-full p-2 hover:bg-wa-hover" onClick={openTemplatePicker} title="Templates">
          <LayoutTemplate size={24} className="text-wa-icon" />
        </button>
        <button
          className="rounded-full p-2 hover:bg-wa-hover"
          onClick={() => {
            getCannedResponses().then(setCannedResponses).catch(() => {});
            setShowQuickReplies(!showQuickReplies);
          }}
          title="Quick replies"
        >
          <Zap size={24} className="text-wa-icon" />
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
        <div className="flex flex-1 items-center rounded-lg bg-wa-compose px-3 py-2">
          <input
            type="text"
            placeholder="Type a message (/ for quick replies)"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={sending}
          />
        </div>
        <button
          className="rounded-full p-2 hover:bg-wa-hover"
          onClick={text.trim() ? handleSend : undefined}
          disabled={sending}
        >
          {text.trim() ? (
            sending ? <Loader2 size={24} className="animate-spin text-wa-icon" /> : <Send size={24} className="text-wa-icon" />
          ) : (
            <Mic size={24} className="text-wa-icon" />
          )}
        </button>
      </div>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={24} className="text-white" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
