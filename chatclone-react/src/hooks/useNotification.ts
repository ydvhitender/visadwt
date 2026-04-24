import { useEffect, useRef } from "react";
import { useSocket } from "@/context/SocketContext";

// Create a short WAV notification sound as a data URL
function createNotificationWav(): string {
  const sampleRate = 22050;
  const duration = 0.35;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  // Generate two-tone beep
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = t < 0.15 ? 880 : 1100;
    const envelope = t < 0.02 ? t / 0.02 : Math.max(0, 1 - (t - 0.02) / (duration - 0.02));
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample * 32767)), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
}

let notificationSoundUrl: string | null = null;

function getNotificationSoundUrl() {
  if (!notificationSoundUrl) {
    notificationSoundUrl = createNotificationWav();
  }
  return notificationSoundUrl;
}

function playNotificationSound() {
  try {
    const audio = new Audio(getNotificationSoundUrl());
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Browser blocked autoplay — nothing we can do
    });
  } catch {
    // Silently fail
  }
}

export function useNotification() {
  const { socket } = useSocket();
  const userInteracted = useRef(false);

  // Track user interaction so audio is allowed
  useEffect(() => {
    const markInteracted = () => { userInteracted.current = true; };
    window.addEventListener("click", markInteracted, { once: true });
    window.addEventListener("keydown", markInteracted, { once: true });
    return () => {
      window.removeEventListener("click", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, []);

  const isEnabled = () => localStorage.getItem("wab_notifications") !== "false";

  // Request notification permission on mount
  useEffect(() => {
    if (isEnabled() && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ conversation, message }: any) => {
      if (message.direction !== "inbound") return;
      if (!isEnabled()) return;

      // Play sound
      playNotificationSound();

      // Show browser notification
      if ("Notification" in window && Notification.permission === "granted") {
        const contactName =
          conversation?.contact?.name ||
          conversation?.contact?.profileName ||
          conversation?.contact?.phoneNumber ||
          "New message";
        const body = message.text?.body || message.type || "New message";
        const notification = new Notification(contactName, {
          body,
          icon: "/favicon.ico",
          tag: message._id,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      }
    };

    socket.on("new_message", handleNewMessage);
    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [socket]);
}
