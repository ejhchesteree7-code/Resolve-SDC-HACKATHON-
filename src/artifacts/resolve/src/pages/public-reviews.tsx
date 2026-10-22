import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListPublicReviewsQueryKey,
  useListPublicReviews,
  useReceivePublicReview,
  type PublicReview,
} from '@workspace/api-client-react';
import './public-reviews.css';

const OUTLETS: Record<string, string> = {
  bangsar: 'Brew & Kin — Bangsar',
  'mont-kiara': 'Brew & Kin — Mont Kiara',
};

const keyOf = (r: PublicReview) => `${r.alias}|${r.rating}|${r.text}|${r.date}`;

function stars(n: number) {
  const v = Math.max(0, Math.min(5, Math.round(n)));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(v: string) {
  return v.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase() || '?';
}

export default function PublicReviewsPage({ outletId }: { outletId: string }) {
  const name = OUTLETS[outletId];
  if (!name) {
    return (
      <div className="pr-page">
        <div className="pr-banner">Simulated guest page · stands in for the café’s Google review page · Resolve is the team tool behind it</div>
        <main className="pr-wrap">
          <div className="pr-empty" data-testid="state-outlet-not-found">
            <h3>Listing not found</h3>
            <p>There is no public review page for this address.</p>
          </div>
        </main>
      </div>
    );
  }
  return <Listing outletId={outletId} name={name} />;
}

function Listing({ outletId, name }: { outletId: string; name: string }) {
  const queryClient = useQueryClient();
  const queryKey = getListPublicReviewsQueryKey(outletId);
  const query = useListPublicReviews(outletId, { query: { queryKey, refetchInterval: 3000, refetchIntervalInBackground: true } });
  const receive = useReceivePublicReview();
  const reviews = query.data ?? [];

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setOk('');
    const t = text.trim();
    const a = alias.trim();
    if (rating < 1 || rating > 5) return setError('Choose a rating from 1 to 5.');
    if (!t) return setError('Write a few words about your visit.');
    if (t.length > 500) return setError('Keep your review under 500 characters.');
    if (!a) return setError('Add a display name.');
    if (a.length > 80) return setError('Display name must be 80 characters or fewer.');
    setError('');
    try {
      const created = await receive.mutateAsync({ data: { outletId, source: 'public_page', rating, text: t, alias: a } });
      queryClient.setQueryData<PublicReview[]>(queryKey, (old) => {
        const list = old ?? [];
        const k = keyOf(created);
        return [created, ...list.filter((r) => keyOf(r) !== k)];
      });
      setRating(0); setText(''); setAlias('');
      setOk('Thank you. Your review is now on the listing.');
    } catch {
      setError('Your review could not be sent. Please try again.');
    }
  };

  const pollError = query.isError && query.data !== undefined;

  return (
    <div className="pr-page">
      <div className="pr-banner" data-testid="text-demo-label">Simulated guest page · stands in for the café’s Google review page · Resolve is the team tool behind it</div>
      <main className="pr-wrap">
        <header className="pr-hero">
          <div>
            <div className="pr-kicker">Neighbourhood café · Kuala Lumpur</div>
            <h1 data-testid="text-outlet-name">{name}</h1>
            <p>Every review stays up, whatever the rating. When the team has checked a reply, it appears right under the guest's words.</p>
          </div>
          <div className="pr-score" aria-label={`${reviews.length} reviews on this page`}>
            <div>
              <small>Guest page</small>
              <strong data-testid="text-public-review-count">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</strong>
            </div>
          </div>
        </header>

        <div className="pr-grid">
          <section aria-label="Reviews">
            <div className="pr-meta">
              <span>All reviews · newest first</span>
              <span className={`pr-live ${query.isError ? 'err' : ''}`}>{query.isError ? 'Offline' : 'Live'}</span>
            </div>
            {pollError && (
              <div className="pr-alert" role="alert" data-testid="state-poll-error">
                <span>Could not refresh. Showing the last loaded reviews.</span>
                <button type="button" onClick={() => void query.refetch()} data-testid="button-retry-public">Retry</button>
              </div>
            )}
            {query.isLoading ? (
              <div className="pr-list" aria-label="Loading reviews" data-testid="loading-public-reviews"><div className="pr-skel" /><div className="pr-skel" /></div>
            ) : query.isError && query.data === undefined ? (
              <div className="pr-empty" role="alert" data-testid="state-public-error">
                <h3>Reviews unavailable</h3>
                <p>We could not load reviews right now.</p>
                <button type="button" className="button" onClick={() => void query.refetch()} data-testid="button-retry-public">Try again</button>
              </div>
            ) : reviews.length === 0 ? (
              <div className="pr-empty" data-testid="state-public-empty"><h3>No reviews yet</h3><p>Be the first to tell others about your visit.</p></div>
            ) : (
              <div className="pr-list" data-testid="list-public-reviews">
                {reviews.map((r, i) => (
                  <article className="pr-review" key={`${keyOf(r)}-${i}`} data-testid={`row-public-review-${i}`}>
                    <div className="pr-review-top">
                      <span className="pr-avatar" aria-hidden="true">{initials(r.alias)}</span>
                      <span className="pr-alias">{r.alias}</span>
                      <span className="pr-stars" aria-label={`${r.rating} out of 5 stars`}>{stars(r.rating)}</span>
                      <time className="pr-date" dateTime={r.date}>{formatDate(r.date)}</time>
                    </div>
                    <p className="pr-text">{r.text}</p>
                    {r.posted_reply != null && (
                      <div className="pr-reply" data-testid={`reply-public-review-${i}`}>
                        <b>Response from the owner</b>
                        <p>{r.posted_reply}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <form className="pr-form" onSubmit={(e) => void submit(e)} noValidate aria-labelledby="pr-form-title">
            <h2 id="pr-form-title">Leave a review</h2>
            <p>Tell us how it went. Honest notes help the team get better.</p>
            <div className="pr-label" id="pr-rating-label"><span>Your rating</span><span className="pr-count">{rating ? `${rating} / 5` : 'Pick one'}</span></div>
            <div className="pr-rate" role="radiogroup" aria-labelledby="pr-rating-label">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} data-testid={`button-rating-${n}`}>{n}</button>
              ))}
            </div>
            <label className="pr-label" htmlFor="pr-text"><span>Your review</span><span className="pr-count">{text.length}/500</span></label>
            <textarea id="pr-text" className="pr-input" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="The kopi, the service, the corner seat..." data-testid="input-review-text" />
            <label className="pr-label" htmlFor="pr-alias"><span>Display name</span><span className="pr-count">{alias.length}/80</span></label>
            <input id="pr-alias" className="pr-input" maxLength={80} value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. Aisyah R." data-testid="input-review-alias" />
            <button type="submit" className="pr-submit" disabled={receive.isPending} data-testid="button-submit-review">{receive.isPending ? 'Sending...' : 'Post review'}</button>
            <div aria-live="polite">
              {error && <p className="pr-msg err" role="alert" data-testid="text-form-error">{error}</p>}
              {ok && <p className="pr-msg ok" data-testid="text-form-success">{ok}</p>}
            </div>
          </form>
        </div>
        <p className="pr-foot">Fictional café. This page is a simulated stand-in for a Google review page, used to show how a reply reaches the guest.</p>
      </main>
    </div>
  );
}
