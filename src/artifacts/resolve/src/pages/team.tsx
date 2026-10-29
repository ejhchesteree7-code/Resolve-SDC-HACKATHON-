import { type FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LoaderCircle, UserMinus, UserPlus, UserCheck } from 'lucide-react';
import { authHeader } from '@/lib/session';
import './team.css';

type Member = { id: string; name: string; email: string | null; role: string; outletId: string; active: boolean; isYou: boolean };
type Shown = { name: string; email?: string | null; password: string; why: string };

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, headers: { 'content-type': 'application/json', ...authHeader() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');
  return data;
}

export default function TeamPage() {
  const queryClient = useQueryClient();
  const team = useQuery({ queryKey: ['team'], queryFn: () => call<Member[]>('/api/team') });
  const [shown, setShown] = useState<Shown | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Staff' | 'Manager'>('Staff');

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['team'] });
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key); setError('');
    try { await action(); refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    finally { setBusy(null); }
  };
  const add = (event: FormEvent) => {
    event.preventDefault();
    void run('add', async () => {
      const created = await call<{ name: string; email: string; temporaryPassword: string }>('/api/team', 'POST', { name, email, role });
      setShown({ name: created.name, email: created.email, password: created.temporaryPassword, why: 'New login created.' });
      setName(''); setEmail('');
    });
  };
  const reset = (member: Member) => run(`reset-${member.id}`, async () => {
    const result = await call<{ temporaryPassword: string }>(`/api/team/${member.id}/reset-password`, 'POST');
    setShown({ name: member.name, email: member.email, password: result.temporaryPassword, why: 'Password reset. The old one no longer works.' });
  });
  const setAccess = (member: Member, active: boolean) => {
    if (!active && !window.confirm(`Remove ${member.name}'s access? They will be logged out straight away and can't log in again until you give access back.`)) return;
    void run(`access-${member.id}`, async () => { await call(`/api/team/${member.id}/access`, 'POST', { active }); setShown(null); });
  };

  // Owner first, then managers, then staff; removed people last.
  const order: Record<string, number> = { Owner: 0, Manager: 1, Staff: 2 };
  const members = [...(team.data ?? [])].sort((a, b) =>
    Number(!a.active) - Number(!b.active) || (order[a.role] ?? 3) - (order[b.role] ?? 3) || a.name.localeCompare(b.name));
  return (
    <main className="main-content" data-testid="page-team">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Operations / People</div>
          <h1>Team</h1>
          <p>Who can log in to your business. Remove access the day someone leaves.</p>
        </div>
      </div>

      {shown && (
        <div className="team-password" role="status" data-testid="panel-new-password">
          <div>
            <strong>{shown.why}</strong>
            <p>Give this one-time password to <b>{shown.name}</b>{shown.email ? ` (${shown.email})` : ''} in person. It is shown only once; they can change it under My account.</p>
          </div>
          <code data-testid="text-new-password">{shown.password}</code>
          <button type="button" className="button button-quiet" onClick={() => setShown(null)}>Done</button>
        </div>
      )}
      {error && <p className="inline-alert" role="alert" data-testid="text-team-error">{error}</p>}

      <section className="team-card" aria-label="Team members">
        {team.isLoading ? <div className="loading-list"><div className="skeleton" /><div className="skeleton" /></div>
          : team.isError ? <p className="inline-alert">The team list is unavailable right now.</p>
          : (
            <div className="team-table-wrap">
              <table className="team-table" data-testid="table-team">
                <thead><tr><th>Person</th><th>Role</th><th>Access</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className={member.active ? '' : 'is-removed'} data-testid={`row-member-${member.id}`}>
                      <td><b>{member.name}{member.isYou ? ' (you)' : ''}</b><span>{member.email}</span></td>
                      <td><span className={`team-role team-role-${member.role.toLowerCase()}`}>{member.role}</span></td>
                      <td>{member.active ? <span className="team-access on">Active</span> : <span className="team-access off">Access removed</span>}</td>
                      <td><div className="team-actions">
                        {!member.isYou && member.active && (
                          <>
                            <button type="button" className="button" disabled={busy !== null} onClick={() => void reset(member)} data-testid={`button-reset-${member.id}`}>
                              {busy === `reset-${member.id}` ? <LoaderCircle className="animate-spin" /> : <KeyRound />}Reset password
                            </button>
                            <button type="button" className="button button-danger" disabled={busy !== null} onClick={() => setAccess(member, false)} data-testid={`button-remove-${member.id}`}>
                              <UserMinus />Remove access
                            </button>
                          </>
                        )}
                        {!member.isYou && !member.active && (
                          <button type="button" className="button" disabled={busy !== null} onClick={() => setAccess(member, true)} data-testid={`button-restore-${member.id}`}>
                            <UserCheck />Give access back
                          </button>
                        )}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <section className="team-card" aria-label="Add a team member">
        <h2>Add a team member</h2>
        <form className="team-add" onSubmit={add}>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} data-testid="input-member-name" /></label>
          <label>Email<input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-member-email" /></label>
          <label>Role
            <select value={role} onChange={(e) => setRole(e.target.value as 'Staff' | 'Manager')} data-testid="select-member-role">
              <option value="Staff">Staff</option>
              <option value="Manager">Manager</option>
            </select>
          </label>
          <button type="submit" className="button button-primary" disabled={busy !== null} data-testid="button-add-member">
            {busy === 'add' ? <LoaderCircle className="animate-spin" /> : <UserPlus />}Add
          </button>
        </form>
        <p className="field-note">Use synthetic demo emails (for example name@yourbusiness.demo). New people join your outlet.</p>
      </section>
    </main>
  );
}
