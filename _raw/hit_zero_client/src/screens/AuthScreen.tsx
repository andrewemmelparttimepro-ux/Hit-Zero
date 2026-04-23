// src/screens/AuthScreen.tsx — magic-link sign-in + role onboarding.
import { useState } from 'react';
import { signInWithMagicLink } from '../lib/supabase';
import { haptics } from '../lib/native';

type Role = 'coach' | 'owner' | 'athlete' | 'parent';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('coach');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await signInWithMagicLink(email, role);
      haptics.success();
      setSent(true);
    } catch (e: any) {
      setErr(e.message ?? 'Something went wrong');
      haptics.warn();
    } finally {
      setBusy(false);
    }
  }

  if (sent) return (
    <div className="auth">
      <div className="auth-card">
        <div className="mark">HZ</div>
        <h1>Check your email.</h1>
        <p>We sent a sign-in link to <b>{email}</b>. Tap it on this device.</p>
      </div>
    </div>
  );

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="mark">HZ</div>
        <h1>Hit Zero</h1>
        <p>Sign in to your gym.</p>

        <label>Email
          <input type="email" required autoFocus value={email}
            onChange={e => setEmail(e.target.value)} placeholder="you@gym.com" />
        </label>

        <label>I am a…</label>
        <div className="role-picker">
          {(['coach','owner','athlete','parent'] as Role[]).map(r => (
            <button key={r} type="button"
              className={role===r ? 'on' : ''}
              onClick={() => { setRole(r); haptics.tap(); }}>
              {r}
            </button>
          ))}
        </div>

        {err && <div className="err">{err}</div>}

        <button className="primary" disabled={busy || !email}>
          {busy ? 'Sending…' : 'Send magic link'}
        </button>
      </form>
    </div>
  );
}
