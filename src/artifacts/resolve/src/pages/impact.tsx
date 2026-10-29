import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleDashed } from 'lucide-react';
import { authHeader } from '@/lib/session';
import './impact.css';

type Impact = {
  phase1: { baselineSeconds: number; targetReductionPct: number; targetRoutingPct: number; targetApprovalPct: number; targetFirstTimeUsersPct: number };
  assumptions: { reviewsPerWeek: number; responseTargetHours?: { urgent: number; normal: number } };
  steps: { manual: string[]; resolve: string[] };
  measured: {
    handling: { measuredApprovals: number; medianSeconds: number | null; reductionPct: number | null; weeklyMinutesSaved: number | null };
    approvals: { actionsTaken: number; withLoggedHumanApproval: number; pct: number | null };
    exceptions: { urgentToOwner: number; needsMoreDetail: number; rejectedByHuman: number; possibleDuplicates: number; overdueUrgent: number; overdueOther: number };
    totalCases: number;
  };
  routing: { testCases: number; routingPct: number; categoryPct: number; urgentCaught: number; urgentTotal: number };
};

function Verdict({ met, pending }: { met: boolean; pending?: boolean }) {
  if (pending) return <span className="impact-verdict pending"><CircleDashed size={14} />Not measured yet</span>;
  return met
    ? <span className="impact-verdict met"><CircleCheck size={14} />Target met</span>
    : <span className="impact-verdict missed"><CircleDashed size={14} />Below target</span>;
}

export default function ImpactPage() {
  const query = useQuery({
    queryKey: ['impact'],
    queryFn: async () => {
      const response = await fetch('/api/impact', { headers: authHeader() });
      if (!response.ok) throw new Error('Could not load impact.');
      return (await response.json()) as Impact;
    },
  });
  const data = query.data;
  return (
    <main className="main-content" data-testid="page-impact">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Operations / Evidence</div>
          <h1>Impact</h1>
          <p>Measured from this business’s own activity log, against the baseline in our Phase 1 proposal.</p>
        </div>
        <button className="button" onClick={() => void query.refetch()} data-testid="button-refresh-impact">Refresh</button>
      </div>
      {query.isLoading ? <div className="loading-list"><div className="skeleton" /><div className="skeleton" /></div>
        : query.isError || !data ? <p className="inline-alert">Impact figures are temporarily unavailable.</p>
        : <ImpactBody data={data} />}
    </main>
  );
}

function ImpactBody({ data }: { data: Impact }) {
  const { handling, approvals, exceptions } = data.measured;
  const { phase1, routing } = data;
  return (
    <>
      <section className="impact-grid" aria-label="Key results">
        <article className="impact-tile" data-testid="tile-handling-time">
          <p className="impact-label">Handling time per review</p>
          <p className="impact-value">{handling.medianSeconds === null ? '—' : `${handling.medianSeconds} s`}</p>
          <p className="impact-compare">
            {handling.reductionPct === null ? 'Approve a case to start measuring.' : `${handling.reductionPct}% faster than ${phase1.baselineSeconds} s by hand`}
          </p>
          <Verdict pending={handling.reductionPct === null} met={(handling.reductionPct ?? 0) >= phase1.targetReductionPct} />
          <p className="impact-how">Target: at least {phase1.targetReductionPct}% faster. Median of {handling.measuredApprovals} approvals, timed from opening a case to clicking Approve and written into each approval’s log entry.</p>
        </article>
        <article className="impact-tile" data-testid="tile-approvals">
          <p className="impact-label">Replies and vouchers with a logged human approval</p>
          <p className="impact-value">{approvals.pct === null ? '—' : `${approvals.pct}%`}</p>
          <p className="impact-compare">{approvals.withLoggedHumanApproval} of {approvals.actionsTaken} actions taken</p>
          <Verdict pending={approvals.pct === null} met={(approvals.pct ?? 0) >= phase1.targetApprovalPct} />
          <p className="impact-how">Target: {phase1.targetApprovalPct}%. Every “reply posted” or “voucher issued” entry is checked for an “approved” entry by a Staff, Manager or Owner on the same case.</p>
        </article>
        <article className="impact-tile" data-testid="tile-routing">
          <p className="impact-label">Correct routing on our test set</p>
          <p className="impact-value">{routing.routingPct}%</p>
          <p className="impact-compare">{routing.urgentCaught} of {routing.urgentTotal} urgent cases reached the Owner · category {routing.categoryPct}% correct</p>
          <Verdict met={routing.routingPct >= phase1.targetRoutingPct} />
          <p className="impact-how">Target: at least {phase1.targetRoutingPct}%. {routing.testCases} labelled synthetic reviews (café and salon, English, Malay and Manglish) run through the same rules on every refresh.</p>
        </article>
        <article className="impact-tile" data-testid="tile-time-saved">
          <p className="impact-label">Estimated owner time saved</p>
          <p className="impact-value">{handling.weeklyMinutesSaved === null ? '—' : `${handling.weeklyMinutesSaved} min`}</p>
          <p className="impact-compare">per week, per outlet</p>
          <p className="impact-how">Estimate, not a measurement: ({phase1.baselineSeconds} s − measured median) × {data.assumptions.reviewsPerWeek} reviews a week (our assumption for one busy outlet).</p>
        </article>
      </section>
      <section className="impact-row">
        <article className="impact-card" data-testid="card-steps">
          <h2>Steps per review</h2>
          <div className="impact-steps">
            <div>
              <p className="impact-label">By hand · {data.steps.manual.length} steps</p>
              <ol>{data.steps.manual.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
            <div>
              <p className="impact-label">With Resolve · {data.steps.resolve.length} steps</p>
              <ol>{data.steps.resolve.map((step) => <li key={step}>{step}</li>)}</ol>
              <p className="impact-how">Collecting, sorting, routing, drafting and record-keeping are automatic. {data.steps.manual.length - data.steps.resolve.length} manual steps removed.</p>
            </div>
          </div>
        </article>
        <article className="impact-card" data-testid="card-exceptions">
          <h2>Handed to a person, with a reason</h2>
          <dl className="impact-list">
            <div><dt>Urgent cases sent straight to the Owner</dt><dd>{exceptions.urgentToOwner}</dd></div>
            <div><dt>Too vague, so a person asks for details</dt><dd>{exceptions.needsMoreDetail}</dd></div>
            <div><dt>Open urgent cases past the {data.assumptions.responseTargetHours?.urgent ?? 2} h target</dt><dd>{exceptions.overdueUrgent}</dd></div>
            <div><dt>Other open cases past the {data.assumptions.responseTargetHours?.normal ?? 24} h target</dt><dd>{exceptions.overdueOther}</dd></div>
            <div><dt>Possible duplicates or spam, checked by a person</dt><dd>{exceptions.possibleDuplicates}</dd></div>
            <div><dt>Drafts a person rejected (nothing posted)</dt><dd>{exceptions.rejectedByHuman}</dd></div>
            <div><dt>Cases in this view</dt><dd>{data.measured.totalCases}</dd></div>
          </dl>
          <p className="impact-how">First-time users resolving a complaint unaided (target {phase1.targetFirstTimeUsersPct}%) is measured in person with new users, not by the app.</p>
        </article>
      </section>
    </>
  );
}
