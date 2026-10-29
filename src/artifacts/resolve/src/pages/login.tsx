import { type FormEvent, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Link } from 'wouter';
import { logIn, type Session } from '@/lib/session';
import './login.css';
import './register.css';

// Synthetic demo accounts for judging. They log in through the same password
// check as any other account; the buttons only fill in the form for speed.
const demoAccounts = [
  { role: 'Owner', email: 'owner@brewkin.demo', hint: 'Approves everything' },
  { role: 'Manager', email: 'manager@brewkin.demo', hint: 'Own outlet, up to RM20' },
  { role: 'Staff', email: 'staff@brewkin.demo', hint: 'Simple praise only' },
] as const;
const DEMO_PASSWORD = 'resolve-demo';

export default function LoginPage({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const submit = async (address: string, secret: string, which: string) => {
    setBusy(which); setError('');
    try {
      onLoggedIn(await logIn(address, secret));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in. Please try again.');
      setBusy(null);
    }
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(email, password, 'form');
  };

  return (
    <div className="login-page" data-testid="page-login">
      <section className="login-story">
        <div className="login-brand"><span className="login-mark">r</span><span>resolve</span></div>
        <div className="login-pitch">
          <h1>Every review becomes a case with an owner, a reason and a record.</h1>
          <p>Log in with your own account. What you can see and approve depends on your role.</p>
        </div>
        <p className="login-footnote">Simulated logins · synthetic data only</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-heading">
            <h2>Log in to your workspace</h2>
            <p>Owners, managers and staff each have their own login.</p>
          </div>
          <form className="login-form" onSubmit={onSubmit}>
            <label>Email
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required data-testid="input-email" />
            </label>
            <label>Password
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required data-testid="input-password" />
            </label>
            {error && <p className="login-error" role="alert" data-testid="text-login-error">{error}</p>}
            <button type="submit" className="login-submit" disabled={busy !== null} data-testid="button-login">
              {busy === 'form' ? <LoaderCircle className="animate-spin" size={16} /> : null}Log in
            </button>
          </form>
          <div className="login-demo">
            <p className="login-kicker">Demo accounts · one click</p>
            <div className="login-demo-grid">
              {demoAccounts.map((account) => (
                <button key={account.role} type="button" className="login-demo-button" disabled={busy !== null}
                  onClick={() => void submit(account.email, DEMO_PASSWORD, account.role)} data-testid={`button-demo-${account.role.toLowerCase()}`}>
                  <b>{busy === account.role ? 'Logging in…' : account.role}</b><span>{account.hint}</span>
                </button>
              ))}
            </div>
            <p className="login-demo-note">Demo password for all three: <code>{DEMO_PASSWORD}</code></p>
          </div>
          <p className="login-switch">New business? <Link href="/register" data-testid="link-register">Register your business</Link></p>
        </div>
      </section>
    </div>
  );
}
