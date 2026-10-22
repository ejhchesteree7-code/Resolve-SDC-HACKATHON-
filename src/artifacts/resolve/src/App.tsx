import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import {
  Activity as ActivityIcon,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Coffee,
  FileClock,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  getGetInsightsQueryKey,
  getGetReviewQueryKey,
  getListActivityQueryKey,
  getListReviewsQueryKey,
  useApproveReview,
  useGetInsights,
  useGetReview,
  useListActivity,
  useListReviews,
  useRejectReview,
  useSimulateReview,
  useUpdateReview,
  setDemoUserId,
  type Activity as ActivityRecord,
  type Review,
  type ReviewAssignedRole,
  type ReviewStatus,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import PublicReviewsPage from '@/pages/public-reviews';
import QRCode from 'qrcode';

const queryClient = new QueryClient();
let currentDemoUser = 'demo-manager';
setDemoUserId(currentDemoUser);
type Role = 'Staff' | 'Manager' | 'Owner';
type StatusFilter = 'All' | ReviewStatus;

const statuses: StatusFilter[] = ['All', 'New', 'Needs approval', 'pending_owner', 'Resolved', 'Rejected'];

function labelStatus(status: ReviewStatus) {
  return status === 'pending_owner' ? 'Needs owner' : status;
}

function statusClass(status: ReviewStatus) {
  if (status === 'Needs approval') return 'approval';
  if (status === 'Needs owner' || status === 'pending_owner') return 'owner';
  if (status === 'Resolved') return 'resolved';
  if (status === 'Rejected') return 'rejected';
  return '';
}

function relativeTime(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
}

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((piece) => piece[0] ?? '').join('').toUpperCase();
}

function Shell({ children, role, setRole }: { children: ReactNode; role: Role; setRole: (role: Role) => void }) {
  const [location] = useLocation();
  const activeActivity = location === '/activity';
  return (
    <div className="app-shell">
      <aside className="side-rail">
        <Link href="/" className="brand" data-testid="link-resolve-home">
          <span className="brand-mark">r</span><span className="brand-name">resolve</span>
        </Link>
        <div className="rail-label">Workspace</div>
        <nav className="nav-stack" aria-label="Primary navigation">
          <Link href="/" className={`nav-link ${!activeActivity ? 'active' : ''}`} data-testid="link-inbox">
            <MessageSquareText /><span>Review inbox</span>
          </Link>
          {role !== 'Staff' && <Link href="/activity" className={`nav-link ${activeActivity ? 'active' : ''}`} data-testid="link-activity">
            <FileClock /><span>Activity log</span>
          </Link>}
        </nav>
        <div className="top-mobile">
          <Link href="/" className={`nav-link ${!activeActivity ? 'active' : ''}`} data-testid="mobile-link-inbox"><MessageSquareText />Inbox</Link>
          {role !== 'Staff' && <Link href="/activity" className={`nav-link ${activeActivity ? 'active' : ''}`} data-testid="mobile-link-activity"><FileClock />Log</Link>}
        </div>
        <div className="rail-bottom">
          <div className="rail-note">
            <strong>Built for owner-run cafés.</strong>
            <p>Every review becomes a case with an owner, a reason and a record.</p>
          </div>
          <div className="profile-chip">
            <span className="profile-avatar">{initials(role)}</span>
            <div className="profile-copy"><strong>Workspace role</strong><span>{role} view</span></div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>Resolve</span><ChevronRight size={13} /><b>{activeActivity ? 'Activity log' : 'Review inbox'}</b></div>
          <div className="top-actions">
            <span className="role-label">Viewing as</span>
            <select className="role-select" value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label="Simulated role" data-testid="select-role">
              <option value="Staff">Staff</option>
              <option value="Manager">Manager</option>
              <option value="Owner">Owner</option>
            </select>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  return <div className="toast-note" role="status" data-testid="status-toast">{message}</div>;
}

function LoadingRows() {
  return <div className="loading-list" aria-label="Loading reviews" data-testid="loading-reviews"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-state" data-testid="state-error">
      <div className="empty-symbol"><CircleAlert /></div>
      <h3>Couldn’t load this view</h3>
      <p>{message || 'There was a problem reaching the review service. Your work is safe.'}</p>
      <button className="button" onClick={retry} data-testid="button-retry"><RefreshCw />Try again</button>
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="empty-state" data-testid="state-empty-reviews">
      <div className="empty-symbol"><Coffee /></div>
      <h3>{filtered ? 'No cases in this view' : 'A clear counter'}</h3>
      <p>{filtered ? 'Nothing matches these filters right now. Try another status or outlet.' : 'There are no review cases waiting. New reviews will land here when they need a human decision.'}</p>
      {filtered && <button className="button" onClick={onClear} data-testid="button-clear-filters">Clear filters</button>}
    </div>
  );
}

function ReviewRow({ review, onOpen }: { review: Review; onOpen: () => void }) {
  return (
    <button className="review-row" onClick={onOpen} data-testid={`row-review-${review.id}`}>
      <span className={`rating-mark ${review.rating <= 2 ? 'low' : ''}`} data-testid={`text-rating-${review.id}`}>{review.rating}</span>
      <span className="review-info">
        <span className="review-title"><strong>{review.reviewer}</strong><span className={`severity-badge ${review.severity}`}><CircleAlert size={11} />{review.severity} attention</span>{review.usedFallback && <span className="basic-mode-badge" data-testid={`basic-mode-${review.id}`}>Basic mode</span>}</span>
        <span className="review-text">{review.text}</span>
        <span className="review-sub"><span>{review.outlet}</span><i className="dot" /><span>{review.category}</span><i className="dot" /><span>{review.language}</span></span>
      </span>
      <span className={`status-badge ${statusClass(review.status)}`} data-testid={`status-review-${review.id}`}>{labelStatus(review.status)}</span>
      <span className="row-role">{review.assignedRole}</span>
      <span className="row-arrow"><ChevronRight size={16} /></span>
    </button>
  );
}

function Inbox({ role, setToast }: { role: Role; setToast: (message: string) => void }) {
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [outlet, setOutlet] = useState('All outlets');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryParams = useMemo(() => ({
    ...(filter === 'All' ? {} : { status: filter }),
    ...(outlet === 'All outlets' ? {} : { outlet }),
  }), [filter, outlet]);
  const reviewsQuery = useListReviews(queryParams);
  const reviews = reviewsQuery.data ?? [];
  const simulate = useSimulateReview();

  const outlets = Array.from(new Set(reviews.map((review) => review.outlet))).sort();
  const openCase = (review: Review) => setSelectedId(review.id);
  const clearFilters = () => { setFilter('All'); setOutlet('All outlets'); };
  const handleSimulate = () => {
    simulate.mutate(undefined, {
      onSuccess: (review) => {
        void queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey(queryParams) });
        void queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetInsightsQueryKey() });
        setSelectedId(review.id);
        setToast('A new review case is ready to triage.');
      },
      onError: () => setToast('Could not add a review right now. Try again.'),
    });
  };

  return (
    <main className="main-content">
      {!selectedId ? (
        <>
          <div className="page-heading">
            <div><div className="eyebrow">Operations / Reviews</div><h1>Inbox</h1><p>Give every review the right response and the right sign-off.</p></div>
            <button className="button" onClick={handleSimulate} disabled={simulate.isPending} data-testid="button-simulate-review">
              {simulate.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}Bring in a review
            </button>
          </div>
          <GlanceStrip />
          <InsightPanel />
          <DemoLinks role={role} />
          <div className="filter-bar" role="tablist" aria-label="Review status filters">
            {statuses.map((status) => (
              <button key={status} role="tab" aria-selected={filter === status} className={`filter-tab ${filter === status ? 'active' : ''}`} onClick={() => setFilter(status)} data-testid={`filter-status-${status.toLowerCase().replaceAll(' ', '-')}`}>
                {status === 'All' ? status : labelStatus(status)}
              </button>
            ))}
            <span className="filter-spacer" />
            <select className="select-control" value={outlet} onChange={(event) => setOutlet(event.target.value)} aria-label="Filter by outlet" data-testid="select-outlet">
              <option>All outlets</option>
              {outlets.map((name) => <option key={name}>{name}</option>)}
            </select>
          </div>
          <div className="list-meta"><span>Case queue</span><span data-testid="text-review-count">{reviewsQuery.isLoading ? 'Loading' : `${reviews.length} ${reviews.length === 1 ? 'case' : 'cases'}`}</span></div>
          {reviewsQuery.isLoading ? <LoadingRows /> : reviewsQuery.isError ? <ErrorState message="The review inbox is temporarily unavailable." retry={() => void reviewsQuery.refetch()} /> : reviews.length === 0 ? <EmptyState filtered={filter !== 'All' || outlet !== 'All outlets'} onClear={clearFilters} /> : (
            <div className="review-list" data-testid="list-reviews">
              {reviews.map((review) => <ReviewRow key={review.id} review={review} onOpen={() => openCase(review)} />)}
            </div>
          )}
        </>
      ) : <ReviewDetail reviewId={selectedId} role={role} onBack={() => setSelectedId(null)} setToast={setToast} />}
    </main>
  );
}

const demoOutlets = [
  { id: 'bangsar', name: 'Brew & Kin — Bangsar' },
  { id: 'mont-kiara', name: 'Brew & Kin — Mont Kiara' },
];

function DemoLinks({ role }: { role: Role }) {
  // The server scopes this metadata to the Manager's own outlet.
  const insight = useGetInsights();
  if (role === 'Staff') return null;
  const visibleOutlets = demoOutlets.filter((outlet) =>
    role === 'Owner' || outlet.name === insight.data?.outlet,
  );
  if (!visibleOutlets.length) return null;
  return (
    <section aria-label="Demo links" data-testid="demo-links" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, padding: 18, marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, margin: '0 0 14px' }}>Demo links <span style={{ fontSize: 12, fontWeight: 400 }}>— Open the simulated guest page (stands in for Google)</span></h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
        {visibleOutlets.map((outlet) => <DemoOutletLink key={outlet.id} {...outlet} />)}
      </div>
    </section>
  );
}

function DemoOutletLink({ id, name }: { id: string; name: string }) {
  const url = `${window.location.origin}/p/${id}`;
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  useEffect(() => {
    let active = true;
    setQr(null);
    setQrError(false);
    void QRCode.toDataURL(url, { width: 100, margin: 1 }).then(
      (value) => { if (active) setQr(value); },
      () => { if (active) setQrError(true); },
    );
    return () => { active = false; };
  }, [url]);
  return (
    <div data-testid={`demo-link-${id}`} style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
      {qr ? <img src={qr} alt={`QR code for ${name}`} width={100} height={100} /> : <span role="status">{qrError ? 'QR code unavailable' : 'Generating QR…'}</span>}
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>{name}</strong>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{url}</a>
      </div>
    </div>
  );
}

function GlanceStrip() {
  const query = useListReviews();
  const all = query.data ?? [];
  if (query.isLoading || query.isError || all.length === 0) return null;
  const count = (status: string) => all.filter((review) => review.status === status).length;
  const items = [
    { label: 'Needs approval', value: count('Needs approval'), hint: 'Manager sign-off' },
    { label: 'Needs owner', value: count('pending_owner') + count('Needs owner'), hint: 'Safety, money or large vouchers' },
    { label: 'Resolved', value: count('Resolved'), hint: 'Reply approved and recorded' },
  ];
  return (
    <section className="glance-strip" aria-label="Where cases stand" data-testid="panel-glance">
      {items.map((item) => (
        <div className="glance-item" key={item.label}>
          <strong>{item.value}</strong><span>{item.label}</span><small>{item.hint}</small>
        </div>
      ))}
    </section>
  );
}

function InsightPanel() {
  const query = useGetInsights();
  if (query.isLoading) return <div className="skeleton" style={{ height: 84, marginBottom: 25 }} data-testid="loading-insight" />;
  if (query.isError || !query.data) return null;
  const insight = query.data;
  return (
    <section className="insight-banner" data-testid="panel-insight">
      <span className="insight-icon"><Lightbulb /></span>
      <div className="insight-copy">
        <small>{insight.flagged ? 'Worth a closer look' : 'Inbox insight'} · {insight.outlet}</small>
        <strong>{insight.title}</strong>
        <p>{insight.period}</p>
        <p className="insight-action" data-testid="text-insight-action"><b>Suggested next step:</b> {insight.action}</p>
      </div>
      <div className="insight-count"><strong>{insight.count}</strong><span>cases</span></div>
    </section>
  );
}

function canApprove(role: Role, review: Review) {
  if (role === 'Owner') return true;
  if (review.assignedRole === 'Owner' || review.severity === 'high') return false;
  if (role === 'Manager') return true;
  return review.assignedRole === 'Staff' && review.sentiment !== 'negative' && review.severity === 'low' && review.voucherAmount == null && !review.usedFallback && !review.missingInfo && review.confidence >= 0.6;
}

function canReject(role: Role, assignedRole: ReviewAssignedRole) {
  return role === 'Owner' || (role === 'Manager' && assignedRole !== 'Owner') || (role === 'Staff' && assignedRole === 'Staff');
}

function ReviewDetail({ reviewId, role, onBack, setToast }: { reviewId: string; role: Role; onBack: () => void; setToast: (message: string) => void }) {
  const queryClient = useQueryClient();
  const query = useGetReview(reviewId, { query: { queryKey: getGetReviewQueryKey(reviewId) } });
  const activityQuery = useListActivity({ query: { queryKey: getListActivityQueryKey(), enabled: role !== 'Staff' } });
  const updateMutation = useUpdateReview();
  const approveMutation = useApproveReview();
  const rejectMutation = useRejectReview();
  const [reply, setReply] = useState('');
  const [voucher, setVoucher] = useState('');
  const [initializedId, setInitializedId] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [localError, setLocalError] = useState('');
  const review = query.data;
  const activity = (activityQuery.data ?? []).filter((item) => item.reviewId === reviewId);
  const isMutating = updateMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

  useEffect(() => {
    if (review && initializedId !== review.id) {
      setReply(review.draftReply);
      setVoucher(review.voucherAmount == null ? '' : String(review.voucherAmount));
      setInitializedId(review.id);
    }
  }, [review, initializedId]);

  const invalidateAfterChange = () => {
    void queryClient.invalidateQueries({ queryKey: getGetReviewQueryKey(reviewId) });
    void queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetInsightsQueryKey() });
  };

  const updateData = () => ({
    draftReply: reply.trim(),
    ...(role === 'Staff' ? {} : { voucherAmount: voucher.trim() === '' ? null : Number(voucher) }),
    role,
  });

  const saveDraft = () => {
    setLocalError('');
    if (!reply.trim()) { setLocalError('Write a reply before saving.'); return; }
    updateMutation.mutate({ reviewId, data: updateData() }, {
      onSuccess: (updatedReview) => {
        invalidateAfterChange();
        setToast(updatedReview.assignedRole === 'Owner' && updatedReview.voucherAmount != null && updatedReview.voucherAmount > 20
          ? 'Voucher above RM 20 escalated to the owner.'
          : 'Draft saved to the case record.');
      },
      onError: () => setLocalError('The draft could not be saved. Check your connection and try again.'),
    });
  };

  const approve = async (saveFirst: boolean) => {
    if (!review || !canApprove(role, review)) return;
    if (!reply.trim()) { setLocalError('Write a reply before approval.'); return; }
    const proposedVoucher = voucher.trim() === '' ? null : Number(voucher);
    if (role !== 'Owner' && proposedVoucher != null && proposedVoucher > 20) {
      setLocalError('');
      try {
        const updatedReview = await updateMutation.mutateAsync({ reviewId, data: updateData() });
        invalidateAfterChange();
        setToast(updatedReview.assignedRole === 'Owner'
          ? 'Voucher above RM 20 escalated to the owner. No reply was posted.'
          : 'Draft saved to the case record.');
      } catch {
        setLocalError('The voucher proposal could not be saved. Please try again.');
      }
      return;
    }
    if (saveFirst) {
      try {
        const updatedReview = await updateMutation.mutateAsync({ reviewId, data: updateData() });
        if (updatedReview.assignedRole === 'Owner' && updatedReview.voucherAmount != null && updatedReview.voucherAmount > 20 && role !== 'Owner') {
          invalidateAfterChange();
          setToast('Voucher above RM 20 escalated to the owner. No reply was posted.');
          return;
        }
      } catch {
        setLocalError('The updated reply could not be saved, so it was not approved.');
        return;
      }
    }
    setLocalError('');
    approveMutation.mutate({
      reviewId,
      data: { role, draftReply: reply.trim(), ...(role === 'Staff' ? {} : { voucherAmount: voucher.trim() === '' ? null : Number(voucher) }) },
    }, {
      onSuccess: () => { invalidateAfterChange(); setToast('Reply approved and recorded.'); },
      onError: () => setLocalError('Approval was not completed. The backend may require a different role.'),
    });
  };

  const reject = () => {
    if (!review || !canReject(role, review.assignedRole)) return;
    if (!rejectReason.trim()) return;
    rejectMutation.mutate({ reviewId, data: { role, reason: rejectReason.trim() } }, {
      onSuccess: () => { setRejectOpen(false); setRejectReason(''); invalidateAfterChange(); setToast('Draft rejected with a recorded reason.'); },
      onError: () => setLocalError('The rejection was not accepted. Please try again.'),
    });
  };

  if (query.isLoading) return <div><button className="button button-quiet" onClick={onBack} data-testid="button-back-inbox"><ArrowLeft />Inbox</button><div className="skeleton" style={{ height: 360, marginTop: 20 }} data-testid="loading-review-detail" /></div>;
  if (query.isError || !review) return <div><button className="button button-quiet" onClick={onBack} data-testid="button-back-inbox"><ArrowLeft />Inbox</button><ErrorState message="This case could not be loaded." retry={() => void query.refetch()} /></div>;

  const approveAllowed = canApprove(role, review) && review.status !== 'Resolved' && review.status !== 'Rejected';
  const rejectAllowed = canReject(role, review.assignedRole) && review.status !== 'Resolved' && review.status !== 'Rejected';
  const updateAllowed = canApprove(role, review) && review.status !== 'Resolved' && review.status !== 'Rejected';
  const trail = activity.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);

  return (
    <>
      <button className="button button-quiet" onClick={onBack} data-testid="button-back-inbox"><ArrowLeft />Back to inbox</button>
      <div className="review-shell" style={{ marginTop: 14 }}>
        <article className="detail-card" data-testid={`detail-review-${review.id}`}>
          <div className="detail-top">
            <div><div className="eyebrow">Review case</div><h2>{review.outlet}</h2><span className="case-id">CASE / {review.id}</span></div>
            <div className="detail-badges"><span className={`status-badge ${statusClass(review.status)}`} data-testid={`detail-status-${review.id}`}>{review.status}</span><span className={`severity-badge ${review.severity}`}><CircleAlert size={12} />{review.severity}</span>{review.usedFallback && <span className="basic-mode-badge" data-testid={`basic-mode-detail-${review.id}`}>Basic mode</span>}</div>
          </div>
          <section className="detail-body">
            <div className="section-kicker">Original review</div>
            <p className="review-quote" data-testid="text-original-review">“{review.text}”</p>
            <div className="review-context"><span className="stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><span>{review.reviewer}</span><i className="dot" /><span>{relativeTime(review.createdAt)}</span><i className="dot" /><span>{review.language}</span></div>
          </section>
          <div className="reason-box">
            <div className="reason-item"><span>Case category</span><strong>{review.category}</strong></div>
            <div className="reason-item"><span>Why it was flagged</span><strong>{review.reason}</strong></div>
            <div className="reason-item"><span>Sentiment</span><strong>{review.sentiment}</strong></div>
            <div className="reason-item"><span>Confidence</span><strong>{Math.round(review.confidence * 100)}%</strong></div>
            {review.ruleFired && <div className="reason-item"><span>Rule fired</span><strong>{review.ruleFired}</strong></div>}
            {review.missingInfo && <div className="reason-item"><span>Information needed</span><strong>Some details are missing</strong></div>}
          </div>
          {review.rejectionReason && <div className="inline-alert" data-testid="text-rejection-reason"><strong>Last rejection:</strong> {review.rejectionReason}</div>}
          <section className="draft-section">
            <div className="field-label"><label htmlFor="reply-draft">Suggested reply</label><span className="field-note">Visible to the reviewer after approval</span></div>
            <textarea id="reply-draft" className="text-area" value={reply} onChange={(event) => setReply(event.target.value)} disabled={!updateAllowed} data-testid="input-reply-draft" />
            {role === 'Staff' && <div className="inline-alert">Staff can approve simple reviews assigned to them. Vouchers (sent privately) and escalations need a manager or owner.</div>}
            {review.assignedRole === 'Owner' && role !== 'Owner' && <div className="inline-alert">This case is assigned to the owner. You can prepare the reply, but only the owner can resolve it.</div>}
            {localError && <div className="inline-alert" role="alert" data-testid="text-action-error">{localError}</div>}
            <div className="detail-actions">
              <div className="action-left">
                <button className="button button-danger" onClick={() => setRejectOpen(true)} disabled={!rejectAllowed || isMutating} data-testid="button-reject-review"><X />Reject</button>
                <button className="button" onClick={saveDraft} disabled={!updateAllowed || isMutating || !reply.trim()} data-testid="button-save-draft">{updateMutation.isPending ? <LoaderCircle /> : <ClipboardCheck />}Save draft</button>
              </div>
              <div className="action-right">
                <button className="button" onClick={() => void approve(true)} disabled={!approveAllowed || isMutating || !reply.trim()} data-testid="button-edit-approve">Edit then approve</button>
                <button className="button button-primary" onClick={() => void approve(false)} disabled={!approveAllowed || isMutating || !reply.trim()} data-testid="button-approve-review">{approveMutation.isPending ? <LoaderCircle /> : <Check />}Approve</button>
              </div>
            </div>
          </section>
        </article>
        <aside className="side-stack">
          <section className="side-card" data-testid="panel-approval-path">
            <h3>Approval path</h3>
            <div className="approval-track">
              <ApprovalStep number="01" title="Triage" subtitle="Flag and prepare response" done current />
              <ApprovalStep number="02" title="Manager review" subtitle="Check tone and remedy" current={review.assignedRole === 'Manager' && review.status !== 'Resolved'} done={review.status === 'Resolved'} />
              <ApprovalStep number="03" title="Owner sign-off" subtitle="Higher-risk decisions" current={review.assignedRole === 'Owner' && review.status !== 'Resolved'} done={review.status === 'Resolved'} />
              <ApprovalStep number="04" title="Resolved" subtitle="Reply recorded in the audit trail" done={review.status === 'Resolved'} />
            </div>
          </section>
          <GuestFollowUp review={review} role={role} voucher={voucher} setVoucher={setVoucher} voucherLocked={!updateAllowed} voucherAmount={voucher.trim() === '' ? null : Number(voucher)} alreadySent={activity.some((item) => item.action === 'guest_followup_sent')} onSent={(message) => { setToast(message); void queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() }); }} />
          <section className="side-card" data-testid="panel-case-activity">
            <h3>Case activity <span className="field-note">{activityQuery.isLoading ? 'Loading' : `${activity.length} events`}</span></h3>
            {activityQuery.isError ? <p className="field-note">The audit trail is temporarily unavailable.</p> : trail.length === 0 && !activityQuery.isLoading ? <p className="field-note">No recorded actions for this case yet.</p> : (
              <div className="audit-list">
                {trail.map((item) => <AuditItem key={item.id} item={item} />)}
              </div>
            )}
            {activityQuery.isLoading && <div className="skeleton" style={{ height: 80 }} />}
          </section>
        </aside>
      </div>
      {rejectOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRejectOpen(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="reject-title" data-testid="dialog-reject">
            <h3 id="reject-title">Return this draft</h3>
            <p>A short reason helps the next person make a better revision. This will be included in the audit trail.</p>
            <label className="field-label" htmlFor="reject-reason">Reason for rejection</label>
            <textarea id="reject-reason" className="text-area" style={{ minHeight: 95 }} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="What needs to change?" data-testid="input-rejection-reason" />
            <div className="modal-actions"><button className="button" onClick={() => setRejectOpen(false)} data-testid="button-cancel-reject">Keep draft</button><button className="button button-danger" onClick={reject} disabled={!rejectReason.trim() || rejectMutation.isPending} data-testid="button-confirm-reject">{rejectMutation.isPending ? <LoaderCircle /> : <X />}Reject draft</button></div>
          </section>
        </div>
      )}
    </>
  );
}

function voucherCode(reviewId: string) {
  let hash = 0;
  for (const char of reviewId) hash = (hash * 31 + char.charCodeAt(0)) % 1679616;
  return `RK-${hash.toString(36).toUpperCase().padStart(4, '0').slice(-4)}`;
}

function followUpMessage(review: Review, voucherAmount: number | null) {
  const first = review.reviewer.split(/\s+/)[0] || 'there';
  const amount = voucherAmount != null && voucherAmount > 0 ? voucherAmount : null;
  const code = voucherCode(review.id);
  if (review.language === 'Malay') {
    return `Hai ${first}, ini ${review.outlet}. Terima kasih kerana berkongsi tentang lawatan anda. ${amount ? `Sila terima diskaun RM${amount} untuk lawatan seterusnya (kod ${code}). ` : ''}Kami sudah membalas ulasan anda dan ingin memohon maaf secara peribadi. Balas di sini jika anda mahu berkongsi lebih lanjut.`;
  }
  if (review.language === 'Manglish') {
    return `Hi ${first}, this is ${review.outlet}. Thanks for telling us about your visit. ${amount ? `Here's RM${amount} off your next visit (code ${code}). ` : ''}We replied to your review and wanted to say sorry personally. Boleh reply here if you want to share more.`;
  }
  return `Hi ${first}, it's ${review.outlet}. Thank you for telling us about your visit. ${amount ? `Please accept RM${amount} off your next visit (code ${code}). ` : ''}We replied to your review and wanted to say sorry personally. Reply here if you'd like to tell us more.`;
}

function GuestFollowUp({ review, voucherAmount, role, alreadySent, onSent, voucher, setVoucher, voucherLocked }: { review: Review; voucherAmount: number | null; role: Role; alreadySent: boolean; onSent: (message: string) => void; voucher: string; setVoucher: (value: string) => void; voucherLocked: boolean }) {
  const amount = voucherAmount != null && voucherAmount > 0 ? voucherAmount : null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (review.sentiment !== 'negative' && !amount && !voucher.trim()) return null;
  const resolved = review.status === 'Resolved';
  const canSend = resolved && role !== 'Staff' && !alreadySent;
  const send = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/cases/' + review.id + '/followup', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-user-id': currentDemoUser },
        body: JSON.stringify({ message: draft }),
      });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not send.');
      setOpen(false);
      onSent('Message sent (simulated). Nothing left this demo; the send is in the case activity.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="side-card" data-testid="panel-guest-followup">
      <h3>Private follow-up <span className="field-note">{alreadySent ? 'Sent to guest' : resolved ? 'Ready to send' : 'After approval'}</span></h3>
      <p className="field-note" style={{ margin: '0 0 10px' }}>Simulated WhatsApp message. The public reply stays on the review page; the voucher goes only to the guest.</p>
      <div className="voucher-line" style={{ marginBottom: 10 }}>
        <div><div className="field-label" style={{ marginBottom: 3 }}>Goodwill voucher</div><span className="field-note">Optional · sent only in this private message</span></div>
        <label className="voucher-input-wrap" aria-label="Voucher amount in ringgit">RM<input type="number" min="0" step="1" placeholder="—" value={voucher} disabled={voucherLocked || role === 'Staff'} onChange={(event) => setVoucher(event.target.value)} data-testid="input-voucher-amount" /></label>
      </div>
      <div className="chat-bubble" data-testid="text-guest-followup">{followUpMessage(review, amount)}</div>
      {role === 'Staff' ? <p className="field-note" style={{ marginTop: 10 }}>Managers and owners send guest messages.</p> : (
        <button className="button button-primary" style={{ marginTop: 10 }} disabled={!canSend} onClick={() => { setDraft(followUpMessage(review, amount)); setError(''); setOpen(true); }} data-testid="button-whatsapp-guest">
          {alreadySent ? 'Sent on WhatsApp (simulated)' : resolved ? 'Message guest on WhatsApp' : 'Approve the case first'}
        </button>
      )}
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Message guest on WhatsApp" data-testid="dialog-whatsapp">
          <section className="modal">
            <h3>Message {review.reviewer} on WhatsApp</h3>
            <p className="field-note">Simulated. In production this would go through the WhatsApp Business Platform to a guest who opted in, using an approved template.</p>
            <textarea className="text-area" rows={6} maxLength={600} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="WhatsApp message" data-testid="input-whatsapp-message" />
            {error && <div className="inline-alert" role="alert">{error}</div>}
            <div className="detail-actions">
              <button className="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button className="button button-primary" onClick={() => void send()} disabled={busy || !draft.trim()} data-testid="button-whatsapp-send">{busy ? 'Sending…' : 'Send (simulated)'}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function ApprovalStep({ number, title, subtitle, current, done }: { number: string; title: string; subtitle: string; current?: boolean; done?: boolean }) {
  return (
    <div className="approval-step" data-testid={`approval-step-${number}`}>
      <span className={`step-icon ${current ? 'current' : ''}`}>{done ? <Check size={12} /> : number.slice(-1)}</span>
      <span className="step-copy"><strong>{title}</strong><span>{subtitle}</span></span>
      <span className="step-state">{done ? 'Done' : current ? 'Current' : 'Next'}</span>
    </div>
  );
}

function AuditItem({ item }: { item: ActivityRecord }) {
  return (
    <div className="audit-item" data-testid={`audit-event-${item.id}`}>
      <span className="audit-dot"><Check /></span>
      <div className="audit-copy"><strong>{item.action} · {item.actor}</strong><p>{item.details}</p><time>{relativeTime(item.createdAt)} · {item.role}</time></div>
    </div>
  );
}

function ActivityPage({ setToast }: { setToast: (message: string) => void }) {
  const query = useListActivity({ query: { queryKey: getListActivityQueryKey() } });
  const [filter, setFilter] = useState('All activity');
  const events = query.data ?? [];
  const actions = ['All activity', ...Array.from(new Set(events.map((event) => event.action)))];
  const filtered = filter === 'All activity' ? events : events.filter((event) => event.action === filter);
  return (
    <main className="main-content">
      <div className="page-heading activity-heading">
        <div><div className="eyebrow">Operations / Record</div><h1>Activity log</h1><p>A clear record of every decision made across your review queue.</p></div>
        <div className="field-note">Audit trail · {events.length} entries</div>
      </div>
      <div className="filter-bar">
        <span className="section-kicker" style={{ margin: 0 }}>Show</span>
        <select className="select-control" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter activity" data-testid="select-activity-filter">
          {actions.map((action) => <option key={action}>{action}</option>)}
        </select>
        <span className="filter-spacer" />
        <span className="field-note">Most recent first</span>
      </div>
      {query.isLoading ? <div className="loading-list" style={{ marginTop: 17 }} data-testid="loading-activity"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div> : query.isError ? <div style={{ marginTop: 18 }}><ErrorState message="The activity record is temporarily unavailable." retry={() => void query.refetch()} /></div> : filtered.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 18 }} data-testid="state-empty-activity"><div className="empty-symbol"><ActivityIcon /></div><h3>{events.length ? 'No matching activity' : 'No actions recorded yet'}</h3><p>{events.length ? 'Try another action filter.' : 'As your team works through review cases, decisions and changes will appear here.'}</p>{events.length > 0 && <button className="button" onClick={() => setFilter('All activity')} data-testid="button-clear-activity-filter">Clear filter</button>}</div>
      ) : (
        <div className="activity-list" data-testid="list-activity">
          {filtered.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((event) => (
            <div className="activity-row" key={event.id} data-testid={`row-activity-${event.id}`}>
              <time className="activity-time">{new Date(event.createdAt).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
              <span className="activity-avatar">{initials(event.actor)}</span>
              <div className="activity-description"><strong>{event.action} <span className="field-note">· {event.actor} / {event.role}</span></strong><p>{event.details}</p></div>
              <button className="activity-case" onClick={() => setToast(`Case ${event.reviewId} — open it from the inbox.`)} data-testid={`button-activity-case-${event.id}`}>CASE {event.reviewId} <ArrowRight size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function AppRoutes({ role, setRole, setToast }: { role: Role; setRole: (role: Role) => void; setToast: (message: string) => void }) {
  const [location] = useLocation();
  const [isPublic, publicParams] = useRoute('/p/:outletId');
  return (
    <ErrorBoundary resetKey={location}>
      {isPublic ? <PublicReviewsPage outletId={publicParams.outletId} /> : <Shell role={role} setRole={setRole}>
        <Switch>
          <Route path="/"><Inbox role={role} setToast={setToast} /></Route>
          <Route path="/activity">{role === 'Staff' ? <p className="inline-alert">Staff cannot view the activity log.</p> : <ActivityPage setToast={setToast} />}</Route>
          <Route component={NotFound} />
        </Switch>
      </Shell>}
    </ErrorBoundary>
  );
}

function AppContent() {
  const [role, setRole] = useState<Role>('Manager');
  const [toastMessage, setToastMessage] = useState('');
  const dismissToast = () => setToastMessage('');
  const switchUser = (next: Role) => {
    currentDemoUser = `demo-${next.toLowerCase()}`;
    setDemoUserId(currentDemoUser);
    void queryClient.cancelQueries();
    queryClient.clear();
    setToastMessage('');
    setRole(next);
  };
  return (
    <>
      <AppRoutes key={role} role={role} setRole={switchUser} setToast={setToastMessage} />
      {toastMessage && <Toast message={toastMessage} onClose={dismissToast} />}
    </>
  );
}

function App() {
  return <QueryClientProvider client={queryClient}><AppContent /></QueryClientProvider>;
}

export default App;
