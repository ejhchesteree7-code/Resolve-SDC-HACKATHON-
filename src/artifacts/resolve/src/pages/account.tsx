import { type FormEvent, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { authHeader, type SessionUser } from '@/lib/session';
import './team.css';

export default function AccountPage({ user }: { user: SessionUser }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (next !== again) { setMessage({ ok: false, text: 'The two new passwords don’t match.' }); return; }
    setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'content-type': 'application/json', ...authHeader() },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Could not change the password.');
      setMessage({ ok: true, text: 'Password changed. Use the new one next time you log in.' });
      setCurrent(''); setNext(''); setAgain('');
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not change the password.' });
    } finally { setBusy(false); }
  };

  return (
    <main className="main-content" data-testid="page-account">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Account</div>
          <h1>My account</h1>
          <p>{user.name} · {user.role} · {user.tenantName}</p>
        </div>
      </div>
      <section className="team-card account-card" aria-label="Change password">
        <h2>Change password</h2>
        <form className="account-form" onSubmit={submit}>
          <label>Current password<input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required data-testid="input-current-password" /></label>
          <label>New password<input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required placeholder="8+ characters" data-testid="input-new-password" /></label>
          <label>New password again<input type="password" autoComplete="new-password" minLength={8} value={again} onChange={(e) => setAgain(e.target.value)} required data-testid="input-new-password-again" /></label>
          {message && <p className={message.ok ? 'account-ok' : 'inline-alert'} role="status" data-testid="text-password-message">{message.text}</p>}
          <button type="submit" className="button button-primary" disabled={busy} data-testid="button-change-password">
            {busy ? <LoaderCircle className="animate-spin" /> : null}Change password
          </button>
        </form>
      </section>
    </main>
  );
}
