import { ArrowRight, Coins, Eye, ShieldCheck, SlidersHorizontal, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'

function hasStoreShellIntent(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || Boolean(authSummary?.user.scope.storeIds.length)
}

export function StoreIncentivesPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const user = input.authSummary?.user
  const primaryStoreId = user?.scope.storeIds[0] ?? null
  const storeIntent = hasStoreShellIntent(input.authSummary)

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Store Incentives</div>
          <h2 className="hero-title">Incentive visibility should reach store users as readable outcomes, not as rule-engine administration.</h2>
          <p className="hero-copy">
            This route protects the future store-shell home for `prim` or incentive work before the
            cross-module domain model is implemented. The purpose is to keep store users focused on
            visibility and action, while governance and calculation controls stay outside this shell.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/store/incentives" />
          <MetricAccent label="Store scope" value={primaryStoreId ?? 'No store scope'} />
          <MetricAccent label="State" value="Foundation" />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Visibility shape"
          value={1}
          note="Store users should eventually see a narrow incentive summary here."
          icon={<Eye size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Store intent"
          value={storeIntent ? 1 : 0}
          note="Store scope or store-oriented role makes this the correct consumption shell."
          icon={<ShieldCheck size={18} />}
          tone={storeIntent ? 'calm' : 'warning'}
        />
        <MetricCard
          title="Live payouts"
          value={0}
          note="No real incentive engine, payout model, or approval flow is active yet."
          icon={<Wallet size={18} />}
          tone="warning"
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Future Store View</div>
              <h3>What belongs here for a store user</h3>
            </div>
            <StatusPill tone="accent">Preview</StatusPill>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Store-level incentive snapshot</strong>
                <StatusPill tone="calm">Readable</StatusPill>
              </div>
              <p>Store users should see summary-level incentive outcomes, payout direction, and status without needing admin-grade rule detail.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Explanation context</strong>
                <StatusPill tone="warning">Important</StatusPill>
              </div>
              <p>Incentive visibility should later explain what moved the outcome, which KPIs mattered, and whether approval is still pending.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Action handoff</strong>
                <StatusPill tone="accent">Later</StatusPill>
              </div>
              <p>Store users may later acknowledge, review, or respond here, but rule design and recalculation controls should stay in admin.</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Resolved Session</div>
              <h3>Why this shell is still the right place</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label="User id" value={user?.userId ?? 'Session not resolved'} />
            <KeyValue label="Roles" value={user?.roleCodes.join(', ') || 'No resolved roles'} />
            <KeyValue label="Store ids" value={user?.scope.storeIds.join(', ') || 'none'} />
            <KeyValue label="Incentive route fit" value={storeIntent ? 'Store shell is the correct visibility surface' : 'Boundary is ready before domain contract'} />
          </div>

          <div className="action-cluster">
            <Link className="control-button store-shell-link" to="/store/tasks">
              Store tasks
            </Link>
            <Link className="control-button store-shell-link" to="/store/kpis">
              Store KPI highlights
            </Link>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Not Implemented Yet</div>
            <h3>What this page should not pretend to do</h3>
          </div>
        </div>
        <EmptyState
          title="No fake incentive engine"
          copy="There is no live payout calculation, approval outcome, rule lookup, or recalculation contract behind this route yet. This page exists to keep future incentive visibility in the correct shell while the cross-module design is still forming."
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Next Evolution</div>
              <h3>What should be built after this foundation</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Incentive summary cards</strong>
                <ArrowRight size={16} />
              </div>
              <p>Add store-scoped summary cards for payout direction, current status, and variance drivers before any deeper detail surface appears.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Explanation detail</strong>
                <ArrowRight size={16} />
              </div>
              <p>Introduce a readable breakdown that ties KPI outcomes, approvals, and incentive effects together without exposing admin-only rule management.</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Boundary Rule</div>
              <h3>What stays outside `/store/incentives`</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Rule and formula governance</strong>
                <SlidersHorizontal size={16} />
              </div>
              <p>Formula design, thresholds, calculation policy, retroactive recalculation, and audit-heavy investigation should remain admin-first.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Store consumption</strong>
                <Coins size={16} />
              </div>
              <p>Store users should consume outcomes, understand drivers, and take limited follow-up actions here without carrying the operational burden of system governance.</p>
            </div>
          </div>
        </article>
      </section>

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to="/store">
          Back to store home
        </Link>
        <Link className="control-button store-shell-link" to="/store/approvals">
          Store approvals
        </Link>
      </div>
    </section>
  )
}
