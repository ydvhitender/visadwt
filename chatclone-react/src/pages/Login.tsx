import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { login as loginApi, register as registerApi } from '@/api/auth';
import { Lock, MessageCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = isRegister
        ? await registerApi(email, password, name)
        : await loginApi(email, password);
      login(res.token, res.user);
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      setError(msg || (isRegister ? 'Registration failed' : 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-wa-panel-bg">
      {/* Green header bar */}
      <div className="fixed inset-x-0 top-0 h-[220px] bg-primary" />

      <div className="relative z-10 w-full max-w-md rounded-lg bg-card p-8 shadow-xl">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <MessageCircle size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-light text-foreground">WAB Messenger</h1>
          <p className="text-sm text-muted-foreground">
            {isRegister ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary"
                placeholder="Your full name"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Email or username</label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary"
              placeholder="you@example.com or username"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Toggle register / login */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="font-medium text-primary hover:underline"
          >
            {isRegister ? 'Sign in' : 'Register'}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
          <Lock size={12} />
          <span>End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}
