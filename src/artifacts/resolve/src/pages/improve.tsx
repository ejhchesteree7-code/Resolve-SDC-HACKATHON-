import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, LoaderCircle, Pencil, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import { authHeader } from '@/lib/session';
import './team.css';
import './improve.css';

type Result = {
  beforeCount: number; beforeDays: number; afterCount: number; afterDays: number;
  beforePerWeek: number; afterPerWeek: number; changePct: number | null; enoughData: boolean;
};
type Item = {
  id: string; category: string; outlet: string | null; title: string; evidence: string;
  source: 'ai' | 'rules'; status: 'suggested' | 'accepted' | 'done'; createdAt: string;
  doneAt: string | null; note: string | null; result: Result | null;
};

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, headers: { 'content-type': 'application/json', ...authHeader() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');
  return data;
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });

function Outcome({ item }: { item: Item }) {
  const r = item.result;
  if (!r) return null;
  if (!r.enoughData) {
    return <p className="improve-wait" data-testid={`text-measuring-${item.id}`}>Measuring. Done on {day(item.doneAt!)}; Resolve compares a full week of new reviews first ({r.afterDays} of 7 days so far).</p>;
  }
  const better = (r.changePct ?? 0) < 0;
  return (
    <div className={`improve-result ${better ? 'is-better' : 'is-worse'}`} data-testid={`result-${item.id}`}>
      <div><span>Before</span><b>{r.beforePerWeek}</b><small>complaints / week<br />{r.beforeCount} in {r.beforeDays} days</small></div>
      <div className="improve-arrow">{better ? <TrendingDown /> : <TrendingUp />}</div>
      <div><span>After</span><b>{r.afterPerWeek}</b><small>complaints / week<br />{r.afterCount} in {r.afterDays} days</small></div>
      <div className="improve-change"><b>{r.changePct === null ? '—' : `${r.changePct > 0 ? '+' : ''}${r.changePct}%`}</b><small>{better ? 'fewer complaints' : 'no improvement yet'}</small></div>
    </div>
  );
}

export default function ImprovePage({ role }: { role: string }) {
  const queryClient = useQueryClient();
  const isOwner = role === 'Owner';
  const list = useQuery({ queryKey: ['improvements'], queryFn: () => call<Item[]>('/api/improvements') });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const run = async (key: string, action: () => Promise<Item[]>) => {
    setBusy(key); setError('');
    try { queryClient.setQueryData(['improvements'], await action()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    finally { setBusy(null); }
  };
  const act = (item: Item, action: string, extra: Record<string, string> = {}) =>
    run(`${action}-${item.id}`, () => call<Item[]>(`/api/improvements/${item.id}`, 'POST', { action, ...extra }));

  const items = list.data ?? [];
  const groups: { status: Item['status']; title: string; hint: string }[] = [
    { status: 'suggested', title: 'Suggested fixes', hint: 'From complaints in the last 30 days. Accept, edit or dismiss each one.' },
    { status: 'accepted', title: 'To do', hint: 'Mark a fix done the day the team starts it. Resolve measures from that date.' },
    { status: 'done', title: 'Did it work?', hint: 'Complaints per week in the 4 weeks before the fix vs since, for the same category.' },
  ];

  return (
    <main className="main-content" data-testid="page-improve">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Operations / Improve</div>
          <h1>Improvement checklist</h1>
          <p>Turn repeated complaints into fixes, then check whether complaints actually went down.</p>
        </div>
        {isOwner && (
          <button type="button" className="button button-primary" disabled={busy !== null}
            onClick={() => void run('generate', () => call<Item[]>('/api/improvements/generate', 'POST'))} data-testid="button-generate">
            {busy === 'generate' ? <LoaderCircle className="animate-spin" /> : <Sparkles />}Find what to fix
          </button>
        )}
      </div>

      {error && <p className="inline-alert" role="alert">{error}</p>}
      {!isOwner && <p className="field-note">Only the Owner can accept or complete fixes. You can see the checklist and results.</p>}

      {list.isLoading ? <div className="loading-list"><div className="skeleton" /><div className="skeleton" /></div>
        : list.isError ? <p className="inline-alert">The checklist is unavailable right now.</p>
        : groups.map((group) => {
          const rows = items.filter((item) => item.status === group.status);
          if (!rows.length && group.status !== 'suggested') return null;
          return (
            <section className="team-card" key={group.status} aria-label={group.title}>
              <div className="improve-head"><h2>{group.title}</h2><span>{group.hint}</span></div>
              {!rows.length && (
                <p className="field-note">{isOwner ? 'Press "Find what to fix" to check the last 30 days of complaints.' : 'No suggestions yet.'}</p>
              )}
              {rows.map((item) => (
                <article className="improve-item" key={item.id} data-testid={`item-${item.id}`}>
                  <div className="improve-main">
                    <div className="improve-tags">
                      <span className="improve-cat">{item.category}</span>
                      <span className={`improve-source ${item.source}`}>{item.source === 'ai' ? 'AI suggestion' : 'Rule suggestion'}</span>
                      {item.doneAt && <span className="improve-date">Done {day(item.doneAt)}</span>}
                    </div>
                    {editing?.id === item.id ? (
                      <div className="improve-edit">
                        <input value={editing.title} maxLength={220} onChange={(e) => setEditing({ id: item.id, title: e.target.value })} data-testid={`input-title-${item.id}`} />
                        <button type="button" className="button button-primary" disabled={!editing.title.trim() || busy !== null}
                          onClick={() => { void act(item, item.status === 'suggested' ? 'accept' : 'edit', { title: editing.title }); setEditing(null); }}>Save</button>
                        <button type="button" className="button button-quiet" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    ) : <h3>{item.title}</h3>}
                    <p className="improve-evidence">Evidence: {item.evidence}</p>
                    {item.note && <p className="improve-evidence">What we did: {item.note}</p>}
                    <Outcome item={item} />
                  </div>
                  {isOwner && editing?.id !== item.id && (
                    <div className="team-actions improve-actions">
                      {item.status === 'suggested' && (
                        <>
                          <button type="button" className="button button-primary" disabled={busy !== null} onClick={() => void act(item, 'accept')} data-testid={`button-accept-${item.id}`}>
                            {busy === `accept-${item.id}` ? <LoaderCircle className="animate-spin" /> : <Check />}Accept
                          </button>
                          <button type="button" className="button" disabled={busy !== null} onClick={() => setEditing({ id: item.id, title: item.title })}><Pencil />Edit</button>
                          <button type="button" className="button button-quiet" disabled={busy !== null} onClick={() => void act(item, 'dismiss')} data-testid={`button-dismiss-${item.id}`}><X />Dismiss</button>
                        </>
                      )}
                      {item.status === 'accepted' && (
                        <div className="improve-done">
                          <input placeholder="What did the team do? (optional)" value={notes[item.id] ?? ''} maxLength={300}
                            onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} data-testid={`input-note-${item.id}`} />
                          <button type="button" className="button button-primary" disabled={busy !== null}
                            onClick={() => void act(item, 'done', notes[item.id] ? { note: notes[item.id]! } : {})} data-testid={`button-done-${item.id}`}>
                            {busy === `done-${item.id}` ? <LoaderCircle className="animate-spin" /> : <CheckCheck />}Mark done
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </section>
          );
        })}
      <p className="field-note">Counts come from your own cases, never from the AI. The AI only words the suggested fix; the Owner decides.</p>
    </main>
  );
}
