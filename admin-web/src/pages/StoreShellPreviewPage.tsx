import type { ReactNode } from 'react'
import { ArrowRight, BadgeCheck, ClipboardList, ReceiptText, Store, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'

export function StoreShellPreviewPage(input: {
  authSummary: AuthSessionSummary | null
  recommendedLanding: string
}) {
  const user = input.authSummary?.user

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Store Home Phase 1</div>
          <h2 className="hero-title">
            A task-first home for store users, separate from the admin control plane.
          </h2>
          <p className="hero-copy">
            This screen defines how future checklist, KPI, approval, and incentive work should
            arrive for store-scoped users: as focused daily action, not as admin reporting clutter.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Shell" value="/store" />
          <MetricAccent label="Current landing" value={input.recommendedLanding} />
          <MetricAccent label="Intent" value="Task-first" />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Tasks today"
          value={3}
          note="Checklist follow-up, approvals, and incentive-related reviews should start here."
          icon={<ClipboardList size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Store focus"
          value={1}
          note="Store users should see only the slice that matters to their own scope."
          icon={<Store size={18} />}
          tone="calm"
        />
        <MetricCard
          title="Shared auth"
          value={1}
          note="The shell is separate, but auth, scope, and audit foundations remain shared."
          icon={<BadgeCheck size={18} />}
          tone="warning"
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Store Home</div>
              <h3>What the store user should reach first</h3>
            </div>
            <StatusPill tone="accent">Phase 1</StatusPill>
          </div>

          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Today's tasks</strong>
                <StatusPill tone="warning">Priority</StatusPill>
              </div>
              <p>
                Checklist completions, outstanding approvals, and items requiring immediate store
                action.
              </p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>KPI highlights</strong>
                <StatusPill tone="calm">Visibility</StatusPill>
              </div>
              <p>
                Store-scoped summary cards and trends, not admin-style reporting grids as the
                default entry.
              </p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Incentive snapshot</strong>
                <StatusPill tone="accent">Later</StatusPill>
              </div>
              <p>
                Future `prim` visibility should live here for the store shell, while configuration
                and investigation remain in admin.
              </p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Resolved Session</div>
              <h3>What the current user brings into the store shell</h3>
            </div>
          </div>

          <div className="key-grid">
            <KeyValue label="User id" value={user?.userId ?? 'Session not resolved'} />
            <KeyValue label="Roles" value={user?.roleCodes.join(', ') || 'No resolved roles'} />
            <KeyValue label="Company ids" value={user?.scope.companyIds.join(', ') || 'none'} />
            <KeyValue label="Store ids" value={user?.scope.storeIds.join(', ') || 'none'} />
          </div>

          <div className="action-cluster">
            <Link className="control-button store-shell-link" to="/store/tasks">
              Store tasks
            </Link>
            <Link className="control-button store-shell-link" to="/store/checklists">
              Store checklists
            </Link>
            <Link className="control-button store-shell-link" to="/store/kpis">
              Store KPI highlights
            </Link>
            <Link className="control-button store-shell-link" to="/store/me">
              Benim performansim
            </Link>
            <Link className="control-button store-shell-link" to="/store/rankings">
              Siralamalar
            </Link>
            <Link className="control-button store-shell-link" to="/store/approvals">
              Store approvals
            </Link>
            <Link className="control-button store-shell-link" to="/store/incentives">
              Store incentives
            </Link>
            <Link className="control-button store-shell-link" to="/admin/reports">
              Admin reports
            </Link>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Route Skeleton</div>
            <h3>Where future store-facing work should land</h3>
          </div>
        </div>

        <div className="store-route-grid">
          <RoutePreviewCard
            route="/store/tasks"
            title="Task queue"
            copy="Daily action queue for checklist follow-up, pending requests, and future store actions."
            icon={<ClipboardList size={18} />}
            tone="accent"
          />
          <RoutePreviewCard
            route="/store/checklists"
            title="Checklists"
            copy="Store execution surface, completion progress, and checklist follow-up."
            icon={<BadgeCheck size={18} />}
            tone="calm"
          />
          <RoutePreviewCard
            route="/store/kpis"
            title="KPI highlights"
            copy="Store-focused KPI cards and quick trend visibility."
            icon={<Target size={18} />}
            tone="warning"
          />
          <RoutePreviewCard
            route="/store/me"
            title="Benim performansim"
            copy="Magaza personeli icin bireysel KPI, score ve siralama yuzeyi."
            icon={<BadgeCheck size={18} />}
            tone="calm"
          />
          <RoutePreviewCard
            route="/store/rankings"
            title="Siralamalar"
            copy="Kapanmis gun snapshot'larindan gelen historical personel ve magaza leaderboard."
            icon={<Target size={18} />}
            tone="warning"
          />
          <RoutePreviewCard
            route="/store/approvals"
            title="Approvals"
            copy="Future inbox for store-level approvals and acknowledgements."
            icon={<ReceiptText size={18} />}
            tone="accent"
          />
        </div>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">What Belongs Here</div>
              <h3>Store-shell ownership</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Checklist action</strong>
                <ArrowRight size={16} />
              </div>
              <p>Execution, completion, and follow-up that is scoped to a store team.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Store KPI visibility</strong>
                <ArrowRight size={16} />
              </div>
              <p>Fast signal and trend visibility that helps action, not platform governance.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Incentive and approval consumption</strong>
                <ArrowRight size={16} />
              </div>
              <p>
                Store users consume and act here; admin config and investigation stay elsewhere.
              </p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">What Stays In Admin</div>
              <h3>Do not leak these into `/store`</h3>
            </div>
          </div>
          <EmptyState
            title="Governance remains admin-first"
            copy="Import operations, snapshot orchestration, auth management, audit investigation, and cross-store platform controls should stay inside the admin shell even when they support store users indirectly."
          />
        </article>
      </section>
    </section>
  )
}

function RoutePreviewCard(input: {
  route: string
  title: string
  copy: string
  icon: ReactNode
  tone: 'accent' | 'calm' | 'warning'
}) {
  return (
    <article className={`store-route-card store-route-card-${input.tone}`}>
      <div className="store-route-card-head">
        <span className="store-route-card-icon">{input.icon}</span>
        <code>{input.route}</code>
      </div>
      <h4>{input.title}</h4>
      <p>{input.copy}</p>
    </article>
  )
}
