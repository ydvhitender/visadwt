// ─── Domain types aligned with the WAB backend ──────────────────────────────

export interface User {
  id: string;
  _id?: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  isOnline?: boolean;
  avatar?: string;
  activeConversations?: number;
  waPhoneNumberId?: string;
}

export interface Contact {
  _id: string;
  waId: string;
  phoneNumber: string;
  profileName?: string;
  name?: string;
  email?: string;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  contact: Contact;
  assignedTo?: User | null;
  status: 'open' | 'closed' | 'pending';
  lastMessage?: {
    text: string;
    timestamp: string;
    direction: 'inbound' | 'outbound';
  };
  unreadCount: number;
  lastInboundAt?: string;
  windowExpiresAt?: string;
  isWithinWindow: boolean;
  pinned?: boolean;
  muted?: boolean;
  tags: string[];
  travelCountry?: string;
  visaCenter?: string;
  travelPackage?: string;
  visaType?: string;
  dependentCount?: number;
  travelerId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageReaction {
  emoji: string;
  waId?: string;
  reactedBy?: { _id: string; name: string };
  reactedAt: string;
}

export interface ContactCard {
  name?: { formatted_name?: string; first_name?: string; last_name?: string };
  phones?: Array<{ phone: string; type?: string }>;
  emails?: Array<{ email: string; type?: string }>;
}

export interface Message {
  _id: string;
  conversation: string;
  contact: Contact | string;
  waMessageId?: string;
  direction: 'inbound' | 'outbound';
  type: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  text?: { body: string; previewUrl?: boolean };
  media?: {
    mediaId?: string;
    url?: string;
    mimeType?: string;
    filename?: string;
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  interactive?: {
    type: string;
    body?: { text: string };
    header?: { type?: string; text?: string };
    footer?: { text?: string };
    action?: {
      buttons?: Array<{ id: string; title: string }>;
      button?: string;
      sections?: Array<{
        title: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
    };
    buttonReply?: { id: string; title: string };
    listReply?: { id: string; title: string; description?: string };
  };
  template?: {
    name: string;
    language: string;
    components?: Array<Record<string, unknown>>;
  };
  reactions?: MessageReaction[];
  contacts?: ContactCard[];
  context?: { messageId: string };
  sentBy?: { _id: string; name: string; avatar?: string };
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedReason?: string;
  pinned?: boolean;
  timestamp: string;
  createdAt: string;
}

export interface Template {
  name: string;
  language: string;
  status: string;
  category: string;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{ type: string; text: string; url?: string }>;
  }>;
}

export interface CannedResponse {
  _id: string;
  title: string;
  shortcut: string;
  body: string;
  category?: string;
  isGlobal: boolean;
  createdAt: string;
}

export interface Tag {
  _id: string;
  name: string;
  color: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
