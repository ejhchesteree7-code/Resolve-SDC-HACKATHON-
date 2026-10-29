import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Check, Copy, Download, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import { registerBusiness, startSession, type Registration, type Session } from '@/lib/session';
import './login.css';
import './register.css';

type BusinessType = 'cafe' | 'salon';
type TeamRow = { name: string; email: string; role: 'Manager' | 'Staff' };

// What the settings panel shows; the server holds the same lists per business type.
const typeInfo: Record<BusinessType, { label: string; categories: string[]; safety: string }> = {
  cafe: {
    label: 'café',
    categories: ['Slow service', 'Food quality', 'Order accuracy', 'Staff attitude', 'Value', 'Food safety'],
    safety: 'Food safety complaints',
  },
  salon: {
    label: 'hair salon',
    categories: ['Wait time', 'Service quality', 'Wrong service', 'Staff attitude', 'Pricing', 'Hygiene & safety'],
    safety: 'Hygiene and safety complaints',
  },
};

const emptyTeam: TeamRow[] = [{ name: '', email: '', role: 'Manager' }, { name: '', email: '', role: 'Staff' }];

export default function RegisterPage({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('salon');
  const [outletName, setOutletName] = useState('');
  const [voucherLimit, setVoucherLimit] = useState('30');
  const [placeId, setPlaceId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [team, setTeam] = useState<TeamRow[]>(emptyTeam);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Registration | null>(null);

  // Live-demo shortcut: a fresh example salon with unique emails each time.
  const fillExample = () => {
    const tag = Math.random().toString(36).slice(2, 6);
    setBusinessName('Glow & Co Salon'); setBusinessType('salon'); setOutletName('Glow & Co — SS15');
    setVoucherLimit('30'); setPlaceId('');
    setOwnerName('Aisha Rahman'); setOwnerEmail(`aisha.${tag}@glowco.demo`); setPassword('glowco-demo');
    setTeam([
      { name: 'Farah Lim', email: `farah.${tag}@glowco.demo`, role: 'Manager' },
      { name: 'Danial Hakim', email: `danial.${tag}@glowco.demo`, role: 'Staff' },
    ]);
    setError('');
  };
  const updateMember = (index: number, change: Partial<TeamRow>) =>
    setTeam((rows) => rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const members = team.filter((row) => row.name.trim() || row.email.trim());
      setDone(await registerBusiness({
        businessName, businessType, outletName, voucherLimitRm: Number(voucherLimit), googlePlaceId: placeId,
        owner: { name: ownerName, email: ownerEmail, password }, team: members,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <Registered result={done} onContinue={() => { startSession(done); onLoggedIn(done); }} />;
  }

  const info = typeInfo[businessType];
  const limit = Number(voucherLimit);
  return (
    <div className="reg-page" data-testid="page-register">
      <div className="reg-wrap">
        <div className="reg-top">
          <div className="login-brand reg-brand"><span className="login-mark">r</span><span>resolve</span></div>
          <Link href="/" className="reg-link" data-testid="link-login">Already registered? Log in</Link>
        </div>
        <div className="reg-heading">
          <h1>Register your business</h1>
          <p>Set up once. Resolve creates your outlet, your logins and your own review QR code.</p>
        </div>
        <div className="reg-columns">
          <form className="reg-form" onSubmit={submit}>
            <section className="reg-card">
              <div className="reg-card-head">
                <h2>1 · Your business</h2>
                <button type="button" className="reg-example" onClick={fillExample} data-testid="button-fill-example">Fill example salon</button>
              </div>
              <div className="reg-grid">
                <label>Business name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required maxLength={80} placeholder="e.g. Glow & Co Salon" data-testid="input-business-name" /></label>
                <label>Business type
                  <select value={businessType} onChange={(e) => setBusinessType(e.target.value as BusinessType)} data-testid="select-business-type">
                    <option value="salon">Hair salon</option>
                    <option value="cafe">Café</option>
                  </select>
                </label>
                <label>First outlet<input value={outletName} onChange={(e) => setOutletName(e.target.value)} required maxLength={80} placeholder="e.g. Glow & Co — SS15" data-testid="input-outlet-name" /></label>
                <label>Manager voucher limit (RM)<input type="number" min={0} max={500} step={1} value={voucherLimit} onChange={(e) => setVoucherLimit(e.target.value)} required data-testid="input-voucher-limit" /></label>
                <label className="reg-span">Google Place ID <span className="reg-optional">optional · simulated</span>
                  <input value={placeId} onChange={(e) => setPlaceId(e.target.value)} maxLength={200} placeholder="Where a live version would connect your Google listing" data-testid="input-place-id" />
                </label>
              </div>
            </section>
            <section className="reg-card">
              <h2>2 · Owner account</h2>
              <div className="reg-grid reg-grid-3">
                <label>Your name<input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required maxLength={80} data-testid="input-owner-name" /></label>
                <label>Email<input type="email" autoComplete="off" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required data-testid="input-owner-email" /></label>
                <label>Password<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="8+ characters" data-testid="input-owner-password" /></label>
              </div>
            </section>
            <section className="reg-card">
              <div className="reg-card-head">
                <h2>3 · Your team</h2>
                <span className="reg-hint">Each person gets their own login</span>
              </div>
              {team.map((row, index) => (
                <div className="reg-team-row" key={index}>
                  <label>Name<input value={row.name} onChange={(e) => updateMember(index, { name: e.target.value })} maxLength={80} data-testid={`input-team-name-${index}`} /></label>
                  <label>Email<input type="email" autoComplete="off" value={row.email} onChange={(e) => updateMember(index, { email: e.target.value })} data-testid={`input-team-email-${index}`} /></label>
                  <label>Role
                    <select value={row.role} onChange={(e) => updateMember(index, { role: e.target.value as TeamRow['role'] })} data-testid={`select-team-role-${index}`}>
                      <option value="Manager">Manager</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </label>
                  <button type="button" className="reg-remove" aria-label={`Remove team member ${index + 1}`} onClick={() => setTeam((rows) => rows.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
                </div>
              ))}
              {team.length < 6 && (
                <button type="button" className="reg-add" onClick={() => setTeam((rows) => [...rows, { name: '', email: '', role: 'Staff' }])} data-testid="button-add-member">
                  <Plus size={16} />Add team member
                </button>
              )}
            </section>
            {error && <p className="login-error" role="alert" data-testid="text-register-error">{error}</p>}
            <div className="reg-submit-row">
              <button type="submit" className="login-submit reg-submit" disabled={busy} data-testid="button-create-business">
                {busy ? <LoaderCircle className="animate-spin" size={16} /> : null}Create business
              </button>
              <span className="reg-hint">Simulated sign-up · synthetic data only · no payment taken</span>
            </div>
          </form>
          <aside className="reg-aside" aria-label="What Resolve sets up">
            <h2>What Resolve sets up for a {info.label}</h2>
            <div>
              <p className="reg-aside-kicker">Review categories</p>
              <div className="reg-chips">{info.categories.map((category) => <span key={category}>{category}</span>)}</div>
            </div>
            <div>
              <p className="reg-aside-kicker">Who approves what</p>
              <p>{info.safety} go to the owner. Vouchers above RM {Number.isFinite(limit) ? limit : 0} go to the owner. Managers handle the rest for their outlet.</p>
            </div>
            <div>
              <p className="reg-aside-kicker">Same product, new settings</p>
              <p>Approval gate, activity log and reply drafting are shared. Only these settings change per business.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Registered({ result, onContinue }: { result: Registration; onContinue: () => void }) {
  const url = `${window.location.origin}/p/${result.outlet.slug}`;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { width: 220, margin: 1 }).then((value) => { if (active) setQr(value); }, () => undefined);
    return () => { active = false; };
  }, [url]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <div className="reg-page" data-testid="page-registered">
      <div className="reg-wrap">
        <div className="login-brand reg-brand"><span className="login-mark">r</span><span>resolve</span></div>
        <div className="reg-heading">
          <span className="reg-badge"><Check size={14} />Business created</span>
          <h1 data-testid="text-business-ready">{result.business.name} is ready</h1>
          <p>No code changed. Resolve created the outlet, the logins and the review link from your settings.</p>
        </div>
        <div className="reg-columns">
          <section className="reg-card reg-qr-card">
            <h2>Your customer review QR</h2>
            <div className="reg-qr">
              {qr ? <img src={qr} alt={`QR code for the ${result.outlet.name} review page`} width={148} height={148} /> : <span className="reg-qr-wait">Generating QR…</span>}
              <div className="reg-qr-copy">
                <strong>{result.outlet.name}</strong>
                <a href={url} target="_blank" rel="noopener noreferrer" data-testid="link-review-page">{url}</a>
                <p>Print it for the counter or write it onto an NFC card. Every review sent through it lands in your inbox.</p>
              </div>
            </div>
            <div className="reg-qr-actions">
              {qr && <a className="button" href={qr} download={`${result.outlet.slug}-review-qr.png`}><Download />Download QR</a>}
              <button type="button" className="button" onClick={() => void copy()}><Copy />{copied ? 'Copied' : 'Copy link'}</button>
            </div>
          </section>
          <section className="reg-card reg-accounts">
            <h2>Logins created</h2>
            <div className="reg-table-wrap">
              <table>
                <thead><tr><th>Person</th><th>Role</th><th>First password</th><th>Can do</th></tr></thead>
                <tbody>
                  {result.accounts.map((account) => (
                    <tr key={account.email} data-testid={`row-account-${account.role.toLowerCase()}`}>
                      <td><b>{account.name}</b><span>{account.email}</span></td>
                      <td><span className={`reg-role reg-role-${account.role.toLowerCase()}`}>{account.role}</span></td>
                      <td>{account.temporaryPassword ? <code>{account.temporaryPassword}</code> : <span>The one you chose</span>}</td>
                      <td>{account.role === 'Owner' ? 'Approves any case, sees every outlet and the full log'
                        : account.role === 'Manager' ? 'Approves their outlet’s cases and vouchers up to the limit'
                        : 'Replies to simple praise only. No vouchers, no activity log'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="reg-hint">Team passwords are shown once. Hand them over in person.</p>
          </section>
        </div>
        <button type="button" className="login-submit reg-continue" onClick={onContinue} data-testid="button-go-workspace">Go to my workspace</button>
      </div>
    </div>
  );
}
