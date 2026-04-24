import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Search, MoreVertical, Phone, Video, Smile, Paperclip, Mic, Send, Lock,
  ChevronDown, Check, CheckCheck, Loader2, FileText, AlertCircle,
  Download, Play, MapPin, User as UserIcon, Zap, Tag, X,
  LayoutTemplate, Reply, Pin, Copy, Trash2, Clock,
} from "lucide-react";
import { useMessages, useMessageUpdaters } from "@/hooks/useMessages";
import { sendMessage, uploadMedia, sendReaction, getTemplates, getMediaUrl, togglePinMessage, deleteMessageForMe, deleteMessageForEveryone } from "@/api/messages";
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
  onConversationUpdate?: (conversation: Conversation) => void;
}

function isDifferentDay(a: string, b: string) {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

// Quick emoji reaction options
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function ChatPanel({ conversation, onToggleProfile, isProfileOpen, onConversationUpdate }: ChatPanelProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [docViewer, setDocViewer] = useState<{ url: string; filename: string; mimeType: string } | null>(null);
  const [showMsgMenu, setShowMsgMenu] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ msgId: string; type: "me" | "everyone" } | null>(null);
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
  const [mediaPreview, setMediaPreview] = useState<{
    file: File;
    previewUrl: string;
    type: "image" | "video" | "audio" | "document";
  } | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaSending, setMediaSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"idle" | "uploading" | "sending">("idle");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchIndex, setChatSearchIndex] = useState(0);
  const chatSearchRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assignRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useMessages(conversation._id);
  const { appendMessage, updateMessagePin, removeMessage, invalidateMessages } = useMessageUpdaters(conversation._id);
  const { user } = useAuth();

  const messages = data?.messages ?? [];

  const contactName = contactDisplayName(conversation.contact);
  const avatar = initials(contactName);
  const color = avatarColor(conversation.contact._id);

  const prevMsgCount = useRef(0);
  useEffect(() => {
    const isNewMessage = prevMsgCount.current > 0 && messages.length > prevMsgCount.current;
    messagesEndRef.current?.scrollIntoView({ behavior: isNewMessage ? "smooth" : "instant" });
    prevMsgCount.current = messages.length;
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
      markConversationRead(conversation._id).then(() => {
        onConversationUpdate?.({ ...conversation, unreadCount: 0 });
      }).catch(() => {});
    }
  }, [conversation._id, conversation.unreadCount]);

  // Close assign/tag/msg dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showAssignDropdown && assignRef.current && !assignRef.current.contains(e.target as Node)) {
        setShowAssignDropdown(false);
      }
      if (showTagManager && tagRef.current && !tagRef.current.contains(e.target as Node)) {
        setShowTagManager(false);
      }
      if (showMsgMenu) {
        setShowMsgMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAssignDropdown, showTagManager]);

  // Scroll to search match
  const searchMatches = useMemo(() => {
    if (!chatSearch) return [];
    const term = chatSearch.toLowerCase();
    return messages.filter(m =>
      m.text?.body?.toLowerCase().includes(term) ||
      m.media?.caption?.toLowerCase().includes(term)
    );
  }, [chatSearch, messages]);

  useEffect(() => {
    if (searchMatches.length > 0 && chatSearchIndex < searchMatches.length) {
      const msgId = searchMatches[chatSearchIndex]._id;
      const el = document.getElementById(`msg-${msgId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [chatSearchIndex, searchMatches]);

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
        replyToMessageId: replyTo?._id,
      });
      appendMessage(result.message || result);
      setText("");
      setReplyTo(null);
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

  // ─── File select → show preview ──────────────────────────────────────
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const type = file.type.startsWith("image/") ? "image" as const
        : file.type.startsWith("video/") ? "video" as const
        : file.type.startsWith("audio/") ? "audio" as const
        : "document" as const;
      const previewUrl = type === "image" || type === "video" ? URL.createObjectURL(file) : "";
      setMediaPreview({ file, previewUrl, type });
      setMediaCaption("");
      e.target.value = "";
    },
    [],
  );

  // ─── Send media after preview ──────────────────────────────────────
  const handleMediaSend = useCallback(async () => {
    if (!mediaPreview || mediaSending) return;
    setMediaSending(true);
    setUploadProgress(0);
    setUploadStage("uploading");
    try {
      const { mediaId, mimeType, filename } = await uploadMedia(
        mediaPreview.file,
        (percent) => setUploadProgress(percent)
      );
      setUploadStage("sending");
      setUploadProgress(100);
      const result = await sendMessage({
        conversationId: conversation._id,
        type: mediaPreview.type,
        mediaId, mimeType, filename,
        caption: mediaCaption.trim() || undefined,
        replyToMessageId: replyTo?._id,
      });
      appendMessage(result.message || result);
      if (mediaPreview.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl);
      setMediaPreview(null);
      setMediaCaption("");
      setReplyTo(null);
    } catch (err: any) {
      console.error('File upload error:', err.response?.data || err.message);
    } finally {
      setMediaSending(false);
      setUploadStage("idle");
      setUploadProgress(0);
    }
  }, [mediaPreview, mediaSending, mediaCaption, conversation._id, appendMessage]);

  const cancelMediaPreview = useCallback(() => {
    if (mediaPreview?.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl);
    setMediaPreview(null);
    setMediaCaption("");
  }, [mediaPreview]);

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
    } catch (err: any) {
      console.error("Failed to load templates:", err.response?.data || err.message);
    }
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
    } catch (err: any) {
      console.error("Template send error:", err.response?.data || err.message);
    }
  }, [conversation._id, appendMessage]);

  // ─── Tag/Status management (SQL statuses) ──────────────────────────────────────
  const [sqlStatuses, setSqlStatuses] = useState<{ status: string; count: number }[]>([]);

  const openTagManager = useCallback(async () => {
    if (showTagManager) {
      setShowTagManager(false);
      return;
    }
    setShowAssignDropdown(false);
    try {
      // Load SQL statuses + MongoDB tags
      const [tagsRes, statusRes] = await Promise.all([
        getTags(),
        import("@/api/axios").then(m => m.default.get("/sql/statuses")).then(r => r.data),
      ]);
      setAllTags(tagsRes);
      setSqlStatuses(statusRes);
      setShowTagManager(true);
    } catch {}
  }, [showTagManager]);

  const toggleTag = useCallback(async (tagName: string) => {
    const has = conversation.tags.includes(tagName);
    try {
      const updated = await updateConversationTags(
        conversation._id,
        has ? undefined : [tagName],
        has ? [tagName] : undefined
      );
      onConversationUpdate?.(updated);
    } catch {}
  }, [conversation._id, conversation.tags, onConversationUpdate]);

  // ─── Agent assignment ──────────────────────────────────────
  const openAssignDropdown = useCallback(async () => {
    if (showAssignDropdown) {
      setShowAssignDropdown(false);
      return;
    }
    setShowTagManager(false);
    try {
      const data = await getUsers();
      setAgents(data);
      setShowAssignDropdown(true);
    } catch {}
  }, [showAssignDropdown]);

  const handleAssign = useCallback(async (agentId: string | null) => {
    try {
      const updated = await assignConversation(conversation._id, agentId);
      onConversationUpdate?.(updated);
      setShowAssignDropdown(false);
    } catch {}
  }, [conversation._id, onConversationUpdate]);

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
              <p className="whitespace-pre-wrap text-[14.2px] leading-[19px] text-foreground">
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
              <p className="whitespace-pre-wrap text-[14.2px] leading-[19px] text-foreground">{msg.media.caption}</p>
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

      case "document": {
        const docUrl = getMediaUrl(msg.media);
        const mime = msg.media?.mimeType || "";
        const canPreview = mime.includes("pdf") || mime.includes("image");
        return (
          <div
            className="mb-1 flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50 cursor-pointer"
            onClick={() => {
              if (docUrl) {
                setDocViewer({
                  url: docUrl,
                  filename: msg.media?.filename || "Document",
                  mimeType: mime,
                });
              }
            }}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {msg.media?.filename || "Document"}
              </p>
              <p className="text-xs text-muted-foreground">
                {mime || "file"}
              </p>
            </div>
            <Download size={18} className="shrink-0 text-muted-foreground" />
          </div>
        );
      }

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
              <p className="whitespace-pre-wrap text-[14.2px] leading-[19px] text-foreground">{msg.text.body}</p>
            )}
          </div>
        );

      default: {
        // Plain text
        const body = msg.text?.body || msg.media?.caption || "";
        return body ? (
          <p className="whitespace-pre-wrap text-[14.2px] leading-[19px] text-foreground">{body}</p>
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
          <div className="relative" ref={assignRef}>
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
          <div className="relative" ref={tagRef}>
            <button className="rounded-full p-2 hover:bg-wa-hover" onClick={openTagManager} title="Tags">
              <Tag size={20} className="text-wa-icon" />
            </button>
            {showTagManager && (
              <div className="absolute right-0 top-full z-50 mt-1 w-64 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                <div className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Status / Tags</p>
                    <button onClick={() => setShowTagManager(false)}>
                      <X size={16} className="text-muted-foreground" />
                    </button>
                  </div>
                  {/* SQL Statuses */}
                  {sqlStatuses.length > 0 && (
                    <>
                      <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Status</p>
                      <div className="space-y-0.5 mb-2">
                        {sqlStatuses.map((s) => (
                          <button
                            key={s.status}
                            onClick={() => toggleTag(s.status)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-wa-hover"
                          >
                            <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                            <span className="flex-1 text-left">{s.status}</span>
                            {conversation.tags.includes(s.status) && (
                              <Check size={14} className="text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {/* MongoDB Tags */}
                  {allTags.length > 0 && (
                    <>
                      <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Tags</p>
                      <div className="space-y-0.5">
                        {allTags.map((tag) => (
                          <button
                            key={tag._id}
                            onClick={() => toggleTag(tag.name)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-wa-hover"
                          >
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                            <span className="flex-1 text-left">{tag.name}</span>
                            {conversation.tags.includes(tag.name) && (
                              <Check size={14} className="text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {sqlStatuses.length === 0 && allTags.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No statuses or tags available</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="rounded-full p-2 hover:bg-wa-hover" onClick={() => { setShowChatSearch(v => !v); setChatSearch(""); setChatSearchIndex(0); }} title="Search in chat">
            <Search size={20} className="text-wa-icon" />
          </button>
          <button className="rounded-full p-2 hover:bg-wa-hover" onClick={onToggleProfile} title="Contact info">
            <MoreVertical size={20} className="text-wa-icon" />
          </button>
        </div>
      </div>

      {/* Chat search bar */}
      {showChatSearch && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-wa-header px-4 py-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-wa-compose px-3 py-1.5">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <input
              ref={chatSearchRef}
              type="text"
              placeholder="Search messages..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              value={chatSearch}
              onChange={(e) => { setChatSearch(e.target.value); setChatSearchIndex(0); }}
              autoFocus
            />
            {chatSearch && (() => {
              const matches = messages.filter(m =>
                m.text?.body?.toLowerCase().includes(chatSearch.toLowerCase()) ||
                m.media?.caption?.toLowerCase().includes(chatSearch.toLowerCase())
              );
              return matches.length > 0 ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {chatSearchIndex + 1}/{matches.length}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">0 results</span>
              );
            })()}
          </div>
          {chatSearch && (() => {
            const matches = messages.filter(m =>
              m.text?.body?.toLowerCase().includes(chatSearch.toLowerCase()) ||
              m.media?.caption?.toLowerCase().includes(chatSearch.toLowerCase())
            );
            return (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setChatSearchIndex(i => i > 0 ? i - 1 : matches.length - 1)}
                  className="rounded-full p-1 hover:bg-wa-hover"
                  disabled={matches.length === 0}
                >
                  <ChevronDown size={18} className="rotate-180 text-wa-icon" />
                </button>
                <button
                  onClick={() => setChatSearchIndex(i => i < matches.length - 1 ? i + 1 : 0)}
                  className="rounded-full p-1 hover:bg-wa-hover"
                  disabled={matches.length === 0}
                >
                  <ChevronDown size={18} className="text-wa-icon" />
                </button>
              </div>
            );
          })()}
          <button onClick={() => { setShowChatSearch(false); setChatSearch(""); }} className="rounded-full p-1 hover:bg-wa-hover">
            <X size={18} className="text-wa-icon" />
          </button>
        </div>
      )}

      {/* Pinned messages bar */}
      {messages.some(m => m.pinned) && (
        <div className="shrink-0 border-b border-border bg-wa-header px-4 py-2">
          <div className="flex items-center gap-2">
            <Pin size={14} className="text-primary shrink-0" />
            <div className="flex-1 overflow-x-auto flex gap-2 wa-scrollbar">
              {messages.filter(m => m.pinned).map(m => (
                <button
                  key={m._id}
                  onClick={() => {
                    document.getElementById(`msg-${m._id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="shrink-0 max-w-[200px] truncate rounded bg-background px-2 py-1 text-[11px] text-foreground hover:bg-wa-hover"
                >
                  {m.text?.body || m.media?.caption || m.type}
                </button>
              ))}
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
            <div key={msg._id} id={`msg-${msg._id}`}>
              {showDateSep && (
                <div className="mb-4 mt-2 flex justify-center">
                  <span className="rounded-lg bg-wa-date-chip px-3 py-1 text-[12px] text-muted-foreground shadow-sm">
                    {formatDateSeparator(msg.timestamp)}
                  </span>
                </div>
              )}

              <div className={`mb-1 flex ${isInbound ? "justify-start" : "justify-end"}`}>
                <div
                  className={`group relative max-w-[65%] rounded-lg shadow-sm transition-colors duration-300 ${
                    searchMatches.length > 0 && searchMatches[chatSearchIndex]?._id === msg._id
                      ? "ring-2 ring-primary ring-offset-1"
                      : ""
                  } ${
                    stickerMsg
                      ? "bg-transparent shadow-none"
                      : `px-2.5 pb-1 pt-1.5 ${
                          isInbound
                            ? `bg-wa-incoming ${showTail ? "bubble-tail-in ml-2" : ""}`
                            : `bg-wa-outgoing ${showTail ? "bubble-tail-out mr-2" : ""}`
                        }`
                  }`}
                >
                  {/* Context menu */}
                  <div className="absolute -top-1 right-1 hidden gap-1 group-hover:flex">
                    <button
                      onClick={() => setShowReactionPicker(showReactionPicker === msg._id ? null : msg._id)}
                      className="rounded-full bg-card/90 p-1 shadow-sm hover:bg-card"
                    >
                      <Smile size={14} className="text-muted-foreground" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowMsgMenu(showMsgMenu === msg._id ? null : msg._id)}
                        className="rounded-full bg-card/90 p-1 shadow-sm hover:bg-card"
                      >
                        <ChevronDown size={14} className="text-muted-foreground" />
                      </button>
                      {showMsgMenu === msg._id && (
                        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-card shadow-lg py-1">
                          <button
                            onClick={() => {
                              setReplyTo(msg);
                              textInputRef.current?.focus();
                              setShowMsgMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-wa-hover"
                          >
                            <Reply size={14} className="text-muted-foreground" />
                            Reply
                          </button>
                          <button
                            onClick={async () => {
                              const res = await togglePinMessage(msg._id);
                              updateMessagePin(msg._id, res.pinned);
                              setShowMsgMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-wa-hover"
                          >
                            <Pin size={14} className={msg.pinned ? "text-primary" : "text-muted-foreground"} />
                            {msg.pinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            onClick={() => {
                              const text = msg.text?.body || msg.media?.caption || "";
                              if (text) navigator.clipboard.writeText(text);
                              setShowMsgMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-wa-hover"
                          >
                            <Copy size={14} className="text-muted-foreground" />
                            Copy
                          </button>
                          <div className="my-0.5 border-t border-border" />
                          <button
                            onClick={() => {
                              setDeleteConfirm({ msgId: msg._id, type: "me" });
                              setShowMsgMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-wa-hover text-destructive"
                          >
                            <Trash2 size={14} />
                            Delete for me
                          </button>
                          {msg.direction === "outbound" && (
                            <button
                              onClick={() => {
                                setDeleteConfirm({ msgId: msg._id, type: "everyone" });
                                setShowMsgMenu(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-wa-hover text-destructive"
                            >
                              <Trash2 size={14} />
                              Delete for everyone
                            </button>
                          )}
                        </div>
                      )}
                    </div>
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

                  {/* Quoted reply */}
                  {msg.context?.messageId && (() => {
                    const quoted = messages.find((m) => m._id === msg.context!.messageId || m.waMessageId === msg.context!.messageId);
                    if (!quoted) return null;
                    const quotedIsInbound = quoted.direction === "inbound";
                    const quotedText = quoted.text?.body || quoted.media?.caption || quoted.type || "";
                    return (
                      <div className={`mb-1 rounded-md px-2.5 py-1.5 border-l-4 cursor-pointer ${
                        quotedIsInbound
                          ? "bg-black/5 border-l-primary dark:bg-white/5"
                          : "bg-black/5 border-l-green-500 dark:bg-white/5"
                      }`}>
                        <p className={`text-[11px] font-semibold ${quotedIsInbound ? "text-primary" : "text-green-600"}`}>
                          {quotedIsInbound ? contactName : "You"}
                        </p>
                        <p className="text-[12px] text-muted-foreground line-clamp-2">{quotedText}</p>
                      </div>
                    );
                  })()}

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
                <span className="text-xs font-mono text-primary">{cr.shortcut.startsWith("/") ? cr.shortcut : `/${cr.shortcut}`}</span>
                <span className="text-sm font-medium text-foreground">{cr.title}</span>
              </div>
              <span className="truncate text-xs text-muted-foreground">{cr.body}</span>
            </button>
          ))}
        </div>
      )}

      {/* Template picker modal */}
      {showTemplatePicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowTemplatePicker(false)}>
          <div className="w-full max-w-md max-h-[70vh] rounded-lg bg-card shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Message Templates</p>
                <p className="text-[11px] text-muted-foreground">{templates.length} templates available</p>
              </div>
              <button onClick={() => setShowTemplatePicker(false)} className="rounded-full p-1.5 hover:bg-wa-hover">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
              {templates.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No templates available</p>
              )}
              {templates.map((tmpl: any, idx: number) => {
                const bodyComp = tmpl.components?.find((c: any) => c.type === "BODY");
                const headerComp = tmpl.components?.find((c: any) => c.type === "HEADER");
                const footerComp = tmpl.components?.find((c: any) => c.type === "FOOTER");
                const isApproved = tmpl.status === "APPROVED";
                return (
                  <button
                    key={idx}
                    onClick={() => { if (isApproved) sendTemplateMessage(tmpl); }}
                    disabled={!isApproved}
                    className={`flex w-full flex-col gap-1.5 border-b border-border/50 px-4 py-3 text-left last:border-0 ${
                      isApproved ? "hover:bg-wa-hover cursor-pointer" : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <LayoutTemplate size={14} className="text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground">{tmpl.name}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        isApproved ? "bg-green-500/10 text-green-600" : tmpl.status === "REJECTED" ? "bg-red-500/10 text-red-600" : "bg-yellow-500/10 text-yellow-600"
                      }`}>
                        {tmpl.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{tmpl.language} · {tmpl.category}</span>
                    </div>
                    {headerComp?.text && (
                      <p className="text-xs font-semibold text-foreground ml-5">{headerComp.text}</p>
                    )}
                    {bodyComp?.text && (
                      <p className="text-xs text-muted-foreground ml-5">{bodyComp.text}</p>
                    )}
                    {footerComp?.text && (
                      <p className="text-[10px] text-muted-foreground/70 ml-5">{footerComp.text}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Media preview overlay */}
      {mediaPreview && (
        <div className="relative flex shrink-0 flex-col bg-wa-panel-bg border-t border-border">
          {/* Header with close */}
          <div className="flex items-center justify-between px-4 py-2 bg-wa-header">
            <button onClick={cancelMediaPreview} className="rounded-full p-1.5 hover:bg-wa-hover">
              <X size={20} className="text-wa-icon" />
            </button>
            <span className="text-sm font-medium text-foreground">
              {mediaPreview.file.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {(mediaPreview.file.size / 1024).toFixed(0)} KB
            </span>
          </div>

          {/* Preview content */}
          <div className="flex items-center justify-center p-6 min-h-[200px] max-h-[350px]">
            {mediaPreview.type === "image" && (
              <img
                src={mediaPreview.previewUrl}
                alt="Preview"
                className="max-h-[300px] max-w-full rounded-lg object-contain"
              />
            )}
            {mediaPreview.type === "video" && (
              <video
                src={mediaPreview.previewUrl}
                controls
                className="max-h-[300px] max-w-full rounded-lg"
              />
            )}
            {mediaPreview.type === "audio" && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Mic size={32} className="text-primary" />
                </div>
                <audio src={mediaPreview.previewUrl} controls />
                <span className="text-sm text-muted-foreground">{mediaPreview.file.name}</span>
              </div>
            )}
            {mediaPreview.type === "document" && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <FileText size={32} className="text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{mediaPreview.file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(mediaPreview.file.size / 1024).toFixed(0)} KB
                </span>
              </div>
            )}
          </div>

          {/* Upload progress */}
          {mediaSending && (
            <div className="px-4 py-2 bg-wa-header border-t border-border">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {uploadStage === "uploading" ? `Uploading ${uploadProgress}%` : "Sending..."}
                </span>
              </div>
            </div>
          )}

          {/* Caption input + send */}
          <div className="flex items-center gap-2 px-4 py-3 bg-wa-header">
            <div className="flex flex-1 items-center rounded-lg bg-wa-compose px-3 py-2">
              <input
                type="text"
                placeholder="Add a caption..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleMediaSend()}
                autoFocus
                disabled={mediaSending}
              />
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary hover:bg-primary/90"
              onClick={handleMediaSend}
              disabled={mediaSending}
            >
              {mediaSending ? (
                <Loader2 size={20} className="animate-spin text-white" />
              ) : (
                <Send size={20} className="text-white" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Window status banner */}
      {!mediaPreview && (
        <div className={`flex shrink-0 items-center gap-2 px-4 py-1.5 text-[11px] border-t border-border ${
          conversation.isWithinWindow
            ? "bg-green-500/10 text-green-700 dark:text-green-400"
            : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
        }`}>
          {conversation.isWithinWindow ? (
            <>
              <Clock size={12} />
              <span>Chat window active{conversation.windowExpiresAt ? (() => {
                const exp = new Date(conversation.windowExpiresAt);
                const now = new Date();
                const diffMs = exp.getTime() - now.getTime();
                if (diffMs <= 0) return "";
                const hours = Math.floor(diffMs / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                return ` — ${hours}h ${mins}m remaining`;
              })() : ""}</span>
            </>
          ) : (
            <>
              <Lock size={12} />
              <span>24h window expired — send a template to re-open conversation</span>
            </>
          )}
        </div>
      )}

      {/* Reply banner */}
      {replyTo && !mediaPreview && conversation.isWithinWindow && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border bg-wa-header px-4 py-2">
          <div className="flex-1 rounded-md bg-background border-l-4 border-l-primary px-3 py-2">
            <p className="text-[11px] font-semibold text-primary">
              {replyTo.direction === "inbound" ? contactName : "You"}
            </p>
            <p className="text-[12px] text-muted-foreground line-clamp-1">
              {replyTo.text?.body || replyTo.media?.caption || replyTo.type || ""}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="rounded-full p-1.5 hover:bg-wa-hover">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Compose area — only when window is active */}
      {conversation.isWithinWindow ? (
        <div className={`flex shrink-0 items-center gap-2 bg-wa-header px-4 py-2 ${mediaPreview ? "hidden" : ""}`}>
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
            <textarea
              ref={textInputRef}
              rows={1}
              placeholder="Type a message (/ for quick replies)"
              className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground max-h-[120px]"
              value={text}
              onChange={(e) => {
                handleTextChange(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
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
      ) : (
        /* Locked compose — template only */
        !mediaPreview && (
          <div className="flex shrink-0 items-center gap-3 bg-wa-header px-4 py-3">
            <Lock size={18} className="shrink-0 text-muted-foreground" />
            <p className="flex-1 text-xs text-muted-foreground">
              You can only send a template message to start the conversation
            </p>
            <button
              onClick={openTemplatePicker}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <LayoutTemplate size={14} />
              Send Template
            </button>
          </div>
        )
      )}

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

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="rounded-lg bg-card p-5 shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-foreground mb-1">
              {deleteConfirm.type === "everyone" ? "Delete for everyone?" : "Delete for you?"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {deleteConfirm.type === "everyone"
                ? "This message will be replaced with \"This message was deleted\" for all participants."
                : "This message will be removed from this chat. Other participants will still see it."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-wa-hover"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    if (deleteConfirm.type === "me") {
                      await deleteMessageForMe(deleteConfirm.msgId);
                      removeMessage(deleteConfirm.msgId);
                    } else {
                      await deleteMessageForEveryone(deleteConfirm.msgId);
                      invalidateMessages();
                    }
                  } catch {}
                  setDeleteConfirm(null);
                }}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document viewer popup */}
      {docViewer && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
          onClick={() => setDocViewer(null)}
        >
          <div
            className="relative flex flex-col bg-card rounded-lg shadow-2xl overflow-hidden"
            style={{ width: "90vw", height: "90vh", maxWidth: "1000px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-wa-header border-b border-border shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={20} className="text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{docViewer.filename}</span>
                <span className="text-xs text-muted-foreground shrink-0">{docViewer.mimeType}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={docViewer.url}
                  download={docViewer.filename}
                  className="rounded-full p-1.5 hover:bg-wa-hover"
                  title="Download"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={18} className="text-wa-icon" />
                </a>
                <button
                  onClick={() => setDocViewer(null)}
                  className="rounded-full p-1.5 hover:bg-wa-hover"
                >
                  <X size={18} className="text-wa-icon" />
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-hidden bg-background">
              {docViewer.mimeType.includes("pdf") ? (
                <iframe
                  src={docViewer.url}
                  className="w-full h-full border-0"
                  title={docViewer.filename}
                />
              ) : docViewer.mimeType.includes("image") ? (
                <div className="flex items-center justify-center h-full p-4">
                  <img
                    src={docViewer.url}
                    alt={docViewer.filename}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <FileText size={64} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{docViewer.filename}</p>
                  <p className="text-xs text-muted-foreground">Preview not available for this file type</p>
                  <a
                    href={docViewer.url}
                    download={docViewer.filename}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download size={16} />
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
