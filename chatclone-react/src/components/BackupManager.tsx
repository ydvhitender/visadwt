import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  Trash2,
  HardDrive,
  Loader2,
  Database,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  Server,
} from 'lucide-react';
import api from '@/api/axios';

interface Backup {
  filename: string;
  size: number;
  sizeHuman: string;
  createdAt: string;
}

interface BackupResult {
  success: boolean;
  filename: string;
  sizeHuman: string;
  steps: string[];
  downloadUrl: string;
}

interface BackupManagerProps {
  onBack: () => void;
}

export default function BackupManager({ onBack }: BackupManagerProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<BackupResult | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBackups = async () => {
    try {
      const { data } = await api.get('/backup');
      setBackups(data.backups);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const createBackup = async () => {
    setCreating(true);
    setResult(null);
    try {
      const { data } = await api.post('/backup/create');
      setResult(data);
      fetchBackups();
    } catch (e: any) {
      setResult({ success: false, filename: '', sizeHuman: '', steps: [e.response?.data?.error || e.message], downloadUrl: '' });
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = async (filename: string) => {
    try {
      const { data } = await api.get(`/backup/download/${filename}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  };

  const deleteBackup = async (filename: string) => {
    setDeleting(filename);
    try {
      await api.delete(`/backup/${filename}`);
      setBackups((prev) => prev.filter((b) => b.filename !== filename));
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-[60px] items-center gap-3 px-4">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-wa-hover">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <h2 className="text-lg font-bold text-foreground">Backup & Restore</h2>
      </div>

      <div className="flex-1 overflow-y-auto wa-scrollbar px-5 pb-5">
        {/* Info card */}
        <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Server size={20} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Full Server Backup</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Creates a complete backup including MongoDB, MySQL, uploads, environment config,
                and restore instructions. Use this to migrate to another server.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              <Database size={11} /> MongoDB
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              <Database size={11} /> MySQL
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              <FileArchive size={11} /> Uploads
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              <HardDrive size={11} /> Config
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              <Server size={11} /> Source Code
            </span>
          </div>
        </div>

        {/* Create backup button */}
        <button
          onClick={createBackup}
          disabled={creating}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {creating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Creating backup... This may take a minute
            </>
          ) : (
            <>
              <HardDrive size={18} />
              Create New Backup
            </>
          )}
        </button>

        {/* Backup result */}
        {result && (
          <div className={`mb-5 rounded-xl border p-4 ${result.success ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.success ? (
                <CheckCircle2 size={18} className="text-green-500" />
              ) : (
                <AlertCircle size={18} className="text-destructive" />
              )}
              <span className="text-sm font-medium text-foreground">
                {result.success ? 'Backup Created Successfully' : 'Backup Failed'}
              </span>
              {result.sizeHuman && (
                <span className="ml-auto text-xs text-muted-foreground">{result.sizeHuman}</span>
              )}
            </div>
            <div className="space-y-1 mb-3">
              {result.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  {step.includes('OK') ? (
                    <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle size={12} className="text-yellow-500 shrink-0" />
                  )}
                  {step}
                </div>
              ))}
            </div>
            {result.success && (
              <button
                onClick={() => downloadBackup(result.filename)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/20"
              >
                <Download size={16} />
                Download {result.filename}
              </button>
            )}
          </div>
        )}

        {/* Previous backups */}
        <div className="mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Previous Backups
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : backups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center">
            <FileArchive size={32} className="mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No backups yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.filename}
                className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
              >
                <FileArchive size={20} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{backup.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(backup.createdAt)} &middot; {backup.sizeHuman}
                  </p>
                </div>
                <button
                  onClick={() => downloadBackup(backup.filename)}
                  className="rounded-full p-2 text-primary hover:bg-primary/10"
                  title="Download"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => deleteBackup(backup.filename)}
                  disabled={deleting === backup.filename}
                  className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === backup.filename ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
