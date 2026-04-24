import { useState, useEffect } from "react";
import { X, Trash2, Loader2, ChevronDown, ChevronRight, Users, Phone, Mail, MapPin, FileText, CreditCard, StickyNote, Briefcase, Plane, Shield } from "lucide-react";
import { contactDisplayName, initials, avatarColor } from "@/lib/format";
import { deleteConversation } from "@/api/conversations";
import api from "@/api/axios";
import type { Conversation } from "@/types";

interface ContactProfilePanelProps {
  conversation: Conversation;
  onClose: () => void;
  onDeleteChat?: () => void;
}

interface TravelerData {
  id: number; title?: string; first_name?: string; last_name?: string; name?: string;
  gender?: string; dob?: string; place_of_birth?: string; country_of_birth?: string;
  nationality?: string; passport_no?: string; passport_issue?: string; passport_expire?: string;
  travel_country?: string; visa_center?: string; visa_type?: string; package?: string;
  status?: string; doc_date?: string; planned_travel_date?: string; whatsapp_contact?: string;
  contact_number?: string; email?: string; address_line_1?: string; address_line_2?: string;
  city?: string; state_province?: string; zip_code?: string; country?: string;
  payment_status?: string; price?: number; total_amount?: number; invoice_number?: string;
  priority?: string; note?: string; notes?: string; notes2?: string; appointment_remarks?: string;
  relationship_to_main?: string; application_form_link?: string; application_form_username?: string;
  application_form_password?: string; visa_link?: string; logins?: string; created_at?: string;
  created_by_username?: string; last_updated_by_username?: string; last_updated_at?: string;
}

function formatDate(d?: string | null): string {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return ""; }
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs text-foreground break-all">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    Completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "Visa Approved": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Doc: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "Wait App": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Hold: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    Cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Refunded: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    "Refund Request": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[status] || "bg-secondary text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function TravelerCard({ t, label, defaultOpen = false }: { t: TravelerData; label: string; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const displayName = t.name && t.name !== "New Traveler" && t.name !== "New Co-Traveler"
    ? t.name
    : `${t.first_name || ""} ${t.last_name || ""}`.trim() || "Unknown";

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-wa-hover transition-colors"
      >
        <ChevronRight size={14} className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">{displayName}</span>
            <StatusBadge status={t.status} />
            {t.relationship_to_main && (
              <span className="text-[10px] text-muted-foreground">({t.relationship_to_main})</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
            {t.travel_country && <span>{t.travel_country}</span>}
            {t.visa_center && <><span>/</span><span>{t.visa_center}</span></>}
            {t.package && <span className="rounded bg-primary/10 px-1 py-[1px] text-primary font-medium">{t.package}</span>}
            {t.visa_type && <span className="rounded bg-secondary px-1 py-[1px]">{t.visa_type}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {t.doc_date && <p className="text-[10px] text-muted-foreground">{formatDate(t.doc_date)}</p>}
          {t.whatsapp_contact && <p className="text-[10px] text-muted-foreground">{t.whatsapp_contact}</p>}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 py-3 space-y-4 bg-background/50">
          {/* Passport & Personal */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            <Field label="Passport No" value={t.passport_no} />
            <Field label="Title" value={t.title} />
            <Field label="Logins" value={t.logins} />
            <Field label="P-Issue" value={formatDate(t.passport_issue)} />
            <Field label="First Name" value={t.first_name} />
            <Field label="Payment Status" value={t.payment_status} />
            <Field label="P-Expire" value={formatDate(t.passport_expire)} />
            <Field label="Last Name" value={t.last_name} />
            <Field label="Notes" value={t.notes} />
            <Field label="Phone" value={t.whatsapp_contact || t.contact_number} />
            <Field label="Gender" value={t.gender} />
            <Field label="Priority" value={t.priority} />
            <Field label="Email" value={t.email} />
            <Field label="DOB" value={formatDate(t.dob)} />
            <Field label="Nationality" value={t.nationality} />
          </div>

          {/* Travel & Visa */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            <Field label="Travel Country" value={t.travel_country} />
            <Field label="Visa Center" value={t.visa_center} />
            <Field label="Status" value={t.status} />
            <Field label="Visa Type" value={t.visa_type} />
            <Field label="Package" value={t.package} />
            <Field label="Doc Date" value={formatDate(t.doc_date)} />
            <Field label="Travel Date" value={formatDate(t.planned_travel_date)} />
            <Field label="Place of Birth" value={t.place_of_birth} />
            <Field label="Country of Birth" value={t.country_of_birth} />
          </div>

          {/* Address */}
          {(t.address_line_1 || t.city) && (
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              <Field label="Address" value={[t.address_line_1, t.address_line_2].filter(Boolean).join(", ")} />
              <Field label="City" value={t.city} />
              <Field label="Country" value={t.country} />
              <Field label="State" value={t.state_province} />
              <Field label="Zip" value={t.zip_code} />
            </div>
          )}

          {/* Payment */}
          {(t.price || t.total_amount) && (
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              <Field label="Price" value={t.price ? `£${t.price}` : undefined} />
              <Field label="Total" value={t.total_amount ? `£${t.total_amount}` : undefined} />
              <Field label="Invoice" value={t.invoice_number} />
            </div>
          )}

          {/* Links */}
          {(t.visa_link || t.application_form_link) && (
            <div className="space-y-1">
              {t.visa_link && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Visa Link</p>
                  <a href={t.visa_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline break-all">{t.visa_link}</a>
                </div>
              )}
              {t.application_form_link && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Application Form</p>
                  <a href={t.application_form_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline break-all">{t.application_form_link}</a>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {(t.note || t.notes || t.notes2 || t.appointment_remarks) && (
            <div className="space-y-1">
              {t.appointment_remarks && <Field label="Appointment" value={t.appointment_remarks} />}
              {t.note && <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Note</p><p className="text-xs text-foreground whitespace-pre-wrap">{t.note}</p></div>}
              {t.notes2 && <Field label="Notes 2" value={t.notes2} />}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
            {t.created_by_username && <span>Created by {t.created_by_username}</span>}
            {t.created_at && <span>{formatDate(t.created_at)}</span>}
            {t.last_updated_by_username && <span>Updated by {t.last_updated_by_username}</span>}
            {t.last_updated_at && <span>{formatDate(t.last_updated_at)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactProfilePanel({ conversation, onClose, onDeleteChat }: ContactProfilePanelProps) {
  const contact = conversation.contact;
  const name = contactDisplayName(contact);
  const avatar = initials(name);
  const color = avatarColor(contact._id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [traveler, setTraveler] = useState<TravelerData | null>(null);
  const [dependents, setDependents] = useState<TravelerData[]>([]);
  const [loadingTraveler, setLoadingTraveler] = useState(false);

  useEffect(() => {
    const phone = contact.waId || contact.phoneNumber;
    if (!phone || phone.length < 7) return;

    setLoadingTraveler(true);
    api.get(`/sql/travelers/by-phone/${phone}`)
      .then(async (res) => {
        const data = res.data as TravelerData[];
        if (data.length > 0) {
          setTraveler(data[0]);
          // Fetch dependents
          try {
            const depRes = await api.get(`/sql/travelers/${data[0].id}/dependents`);
            setDependents(depRes.data as TravelerData[]);
          } catch { setDependents([]); }
        } else {
          setTraveler(null);
          setDependents([]);
        }
      })
      .catch(() => { setTraveler(null); setDependents([]); })
      .finally(() => setLoadingTraveler(false));
  }, [contact.waId, contact.phoneNumber]);

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex h-[60px] shrink-0 items-center gap-4 bg-wa-header px-4">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-wa-hover">
          <X size={20} className="text-wa-icon" />
        </button>
        <span className="text-base font-medium text-foreground">Contact info</span>
      </div>

      {/* Scrollable content */}
      <div className="wa-scrollbar flex-1 overflow-y-auto">
        {/* Avatar & name */}
        <div className="flex flex-col items-center py-5 bg-card">
          <div
            className="flex h-[100px] w-[100px] items-center justify-center rounded-full text-[36px] font-semibold"
            style={{ backgroundColor: color, color: "white" }}
          >
            {avatar}
          </div>
          <h2 className="mt-3 text-lg font-medium text-foreground">{name}</h2>
          <p className="text-sm text-muted-foreground">{contact.phoneNumber}</p>
          <div className="mt-2 flex items-center gap-2">
            {traveler?.status && <StatusBadge status={traveler.status} />}
            {dependents.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Users size={10} /> ({dependents.length})
              </span>
            )}
          </div>
        </div>

        <div className="h-1.5 bg-background" />

        {/* Traveler data */}
        {loadingTraveler ? (
          <div className="flex justify-center py-8">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : traveler ? (
          <div className="p-3 space-y-2">
            {/* Main traveler */}
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-1">Main Traveler</p>
            <TravelerCard t={traveler} label="Main" defaultOpen={true} />

            {/* Dependents */}
            {dependents.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-1 pt-2">
                  Dependents ({dependents.length})
                </p>
                {dependents.map((dep) => (
                  <TravelerCard key={dep.id} t={dep} label="Dependent" />
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="p-3">
            <div className="border border-border rounded-lg bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Contact Details</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="WhatsApp ID" value={contact.waId} />
                <Field label="Phone" value={contact.phoneNumber} />
                <Field label="Profile Name" value={contact.profileName} />
                <Field label="Name" value={contact.name} />
                <Field label="Email" value={contact.email} />
              </div>
            </div>
          </div>
        )}

        <div className="h-1.5 bg-background" />

        {/* Tags */}
        {conversation.tags.length > 0 && (
          <>
            <div className="px-4 py-3 bg-card">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {conversation.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{tag}</span>
                ))}
              </div>
            </div>
            <div className="h-1.5 bg-background" />
          </>
        )}

        {/* Delete chat */}
        <div className="py-2 bg-card">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center gap-6 px-5 py-3 hover:bg-wa-hover transition-colors"
            >
              <Trash2 size={18} className="text-destructive" />
              <span className="text-sm text-destructive">Delete chat</span>
            </button>
          ) : (
            <div className="px-5 py-3">
              <p className="text-sm text-destructive mb-2">Delete this chat and all messages?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-wa-hover">Cancel</button>
                <button
                  onClick={async () => {
                    setDeleting(true);
                    try { await deleteConversation(conversation._id); onDeleteChat?.(); } catch {} finally { setDeleting(false); }
                  }}
                  disabled={deleting}
                  className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {deleting && <Loader2 size={12} className="animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
