import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import api from "@/api/axios";
import { toast } from "sonner";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

// Common country codes
const COUNTRY_CODES = [
  { code: "+1", country: "United States" },
  { code: "+44", country: "United Kingdom" },
  { code: "+91", country: "India" },
  { code: "+86", country: "China" },
  { code: "+81", country: "Japan" },
  { code: "+33", country: "France" },
  { code: "+49", country: "Germany" },
  { code: "+39", country: "Italy" },
  { code: "+34", country: "Spain" },
  { code: "+61", country: "Australia" },
  { code: "+27", country: "South Africa" },
  { code: "+55", country: "Brazil" },
  { code: "+52", country: "Mexico" },
  { code: "+65", country: "Singapore" },
  { code: "+60", country: "Malaysia" },
  { code: "+62", country: "Indonesia" },
  { code: "+66", country: "Thailand" },
  { code: "+84", country: "Vietnam" },
  { code: "+92", country: "Pakistan" },
  { code: "+88", country: "Bangladesh" },
  { code: "+234", country: "Nigeria" },
  { code: "+254", country: "Kenya" },
  { code: "+20", country: "Egypt" },
  { code: "+212", country: "Morocco" },
];

export default function NewChatDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewChatDialogProps) {
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateChat = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    setLoading(true);
    try {
      // Combine country code and phone number (strip spaces/dashes only)
      const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, "");
      const fullPhoneNumber = `${countryCode}${cleanNumber}`;

      // API call to create/get conversation
      const response = await api.post("/conversations", {
        phoneNumber: fullPhoneNumber,
      });

      const conversationId = response.data._id || response.data.id;
      toast.success("Chat created successfully");
      onConversationCreated(conversationId);
      onOpenChange(false);

      // Reset form
      setPhoneNumber("");
      setCountryCode("+1");
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message || "Failed to create chat";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleCreateChat();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Start New Chat</DialogTitle>
          <DialogDescription>
            Enter the phone number of the contact you want to chat with
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Country Code */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Country Code
            </label>
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {COUNTRY_CODES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} - {item.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Phone Number
            </label>
            <Input
              type="tel"
              placeholder="Enter phone number (e.g., 9876543210)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Full number: {countryCode}
              {phoneNumber}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreateChat} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Creating..." : "Create Chat"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
