import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, Phone, X, Check, Move, ZoomIn, ZoomOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { initials } from '@/lib/format';
import type { User } from '@/types';
import api from '@/api/axios';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onAvatarUpdate: (avatarUrl: string) => void;
}

const WA_PHONE = '+44 7463 444194';

export default function ProfileDialog({ open, onOpenChange, user, onAvatarUpdate }: ProfileDialogProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Drag-to-position state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setFile(null);
      setPosition({ x: 0, y: 0 });
      setScale(1);
    }
  }, [open]);

  const handleFile = (f: File) => {
    setFile(f);
    setPosition({ x: 0, y: 0 });
    setScale(1);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  // Mouse drag for repositioning
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [position]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: posStart.current.x + dx,
        y: posStart.current.y + dy,
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // Touch drag for mobile
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDragging(true);
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    posStart.current = { ...position };
  }, [position]);

  useEffect(() => {
    if (!dragging) return;
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.current.x;
      const dy = touch.clientY - dragStart.current.y;
      setPosition({
        x: posStart.current.x + dx,
        y: posStart.current.y + dy,
      });
    };
    const onTouchEnd = () => setDragging(false);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragging]);

  const handleUpload = async () => {
    if (!file) return;

    // Draw cropped image from the canvas with position + scale applied
    const canvas = document.createElement('canvas');
    const size = 300;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const img = new Image();
    img.src = preview!;
    await new Promise((res) => { img.onload = res; });

    const containerSize = containerRef.current?.clientWidth ?? 200;
    const ratio = img.width / (containerSize * scale);
    const srcX = (-position.x) * ratio;
    const srcY = (-position.y) * ratio;
    const srcSize = containerSize * ratio;

    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setUploading(true);
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.png');
      try {
        const { data } = await api.post('/users/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        onAvatarUpdate(data.avatar);
        onOpenChange(false);
      } catch {
        // silent fail
      } finally {
        setUploading(false);
      }
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Profile & Logo</DialogTitle>
          <DialogDescription>Upload and position your business logo</DialogDescription>
        </DialogHeader>

        {/* Current profile info */}
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
          {user?.avatar && !preview ? (
            <img src={user.avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/30" />
          ) : !preview ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
              {initials(user?.name ?? '')}
            </div>
          ) : null}
          {!preview && (
            <div className="flex-1">
              <p className="font-medium text-foreground">{user?.name}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Phone size={12} className="text-primary" />
                {WA_PHONE}
              </div>
            </div>
          )}
        </div>

        {/* Upload / Preview area */}
        {!preview ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Upload size={28} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Drop your logo here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* Circular crop preview */}
            <div className="relative">
              <div
                ref={containerRef}
                className="relative h-[200px] w-[200px] overflow-hidden rounded-full border-4 border-primary/30 bg-muted"
                style={{ cursor: dragging ? 'grabbing' : 'grab' }}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
              >
                <img
                  src={preview}
                  alt="Preview"
                  className="absolute select-none"
                  draggable={false}
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    minWidth: '100%',
                    minHeight: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
              <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-card px-2 py-1 shadow-lg border border-border">
                <Move size={12} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Drag to reposition</span>
              </div>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                className="rounded-full p-1.5 hover:bg-muted"
                title="Zoom out"
              >
                <ZoomOut size={18} className="text-muted-foreground" />
              </button>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <button
                onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                className="rounded-full p-1.5 hover:bg-muted"
                title="Zoom in"
              >
                <ZoomIn size={18} className="text-muted-foreground" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex w-full gap-2">
              <button
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                  setPosition({ x: 0, y: 0 });
                  setScale(1);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Check size={16} />
                {uploading ? 'Saving...' : 'Save Logo'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
