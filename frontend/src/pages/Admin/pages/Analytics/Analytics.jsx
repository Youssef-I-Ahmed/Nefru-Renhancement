import {
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  CreditCard,
  RefreshCw,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getAdminAnalytics } from "../../api";
import styles from "./Analytics.module.css";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function shortDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SummaryCard({ icon: Icon, label, value, helper }) {
  return (
    <article className={styles.summaryCard}>
      <span><Icon size={19} /></span>
      <div><small>{label}</small><strong>{value}</strong><em>{helper}</em></div>
    </article>
  );
}

function Distribution({ title, values = {}, formatter = (value) => value }) {
  const entries = Object.entries(values).filter(([, value]) => Number(value) > 0).sort((a, b) => Number(b[1]) - Number(a[1]));
  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0) || 1;
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}><div><h2>{title}</h2><p>{total === 1 && entries.length === 0 ? "No records in this period" : `${total} records`}</p></div></header>
      <div className={styles.distribution}>
        {entries.length === 0 ? <div className={styles.empty}>No data yet.</div> : entries.map(([key, value]) => {
          const share = (Number(value) / total) * 100;
          return <div key={key}><span><strong>{key.replaceAll("_", " ")}</strong><small>{formatter(value)} · {share.toFixed(1)}%</small></span><div><i style={{ width: `${Math.max(4, share)}%` }} /></div></div>;
        })}
      </div>
    </section>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await getAdminAnalytics(days);
    if (response.error) setError(response.error);
    else setAnalytics(response.data);
    setLoading(false);
  }, [days]);

  useEffect(() => { const timer=setTimeout(load,0); return ()=>clearTimeout(timer); }, [load]);

  const summary = analytics?.summary || {};
  const series = useMemo(() => analytics?.series || [], [analytics?.series]);
  const visibleSeries = useMemo(() => days === 365 ? series.filter((_, index) => index % 7 === 0 || index === series.length - 1) : series, [series, days]);
  const maxBookings = Math.max(1, ...visibleSeries.map((item) => Number(item.bookings || 0)));
  const maxRevenue = Math.max(1, ...visibleSeries.map((item) => Number(item.paidRevenue || 0)));
  const maxUsers = Math.max(1, ...(analytics?.userGrowth || []).map((item) => Number(item.users || 0)));

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>Marketplace intelligence</span><h1>Analytics</h1><p>Paid revenue, booking conversion, customer growth, top experiences, and guide performance.</p></div>
        <div className={styles.headerActions}><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option></select><button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button></div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.summaryGrid}>
        <SummaryCard icon={CircleDollarSign} label="Paid gross revenue" value={loading ? "…" : money(summary.grossRevenue)} helper={`${money(summary.platformFees)} platform fees`} />
        <SummaryCard icon={CreditCard} label="Paid conversion" value={loading ? "…" : percent(summary.paidConversionRate)} helper={`${summary.paidBookings || 0} of ${summary.totalBookings || 0} bookings paid`} />
        <SummaryCard icon={TrendingUp} label="Avg. booking value" value={loading ? "…" : money(summary.avgBookingValue)} helper={`${percent(summary.completionRate)} completion rate`} />
        <SummaryCard icon={UsersRound} label="Guide earnings recorded" value={loading ? "…" : money(summary.guideEarnings)} helper={`${percent(summary.cancellationRate)} closed/cancelled rate`} />
      </section>

      <section className={`${styles.card} ${styles.trendCard}`}>
        <header className={styles.cardHeader}><div><h2>Booking & paid-revenue trend</h2><p>Revenue includes only records where paymentStatus = paid.</p></div><BarChart3 size={20} /></header>
        {loading ? <div className={styles.empty}>Loading trend…</div> : visibleSeries.length === 0 ? <div className={styles.empty}>No activity in this range.</div> : (
          <div className={styles.chartScroll}>
            <div className={styles.comboChart}>
              {visibleSeries.map((item) => (
                <div className={styles.chartColumn} key={item.date} title={`${shortDate(item.date)} · ${item.bookings} bookings · ${money(item.paidRevenue)}`}>
                  <div className={styles.barArea}><i className={styles.revenueBar} style={{ height: `${Math.max(2, (Number(item.paidRevenue || 0) / maxRevenue) * 100)}%` }} /><i className={styles.bookingBar} style={{ height: `${Math.max(2, (Number(item.bookings || 0) / maxBookings) * 100)}%` }} /></div>
                  <small>{shortDate(item.date)}</small>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={styles.legend}><span><i className={styles.legendRevenue} /> Paid revenue</span><span><i className={styles.legendBookings} /> Bookings</span></div>
      </section>

      <div className={styles.twoColumn}>
        <Distribution title="Booking status" values={analytics?.bookingStatus || {}} />
        <Distribution title="Payment status" values={analytics?.paymentStatus || {}} />
      </div>

      <div className={styles.twoColumn}>
        <section className={styles.card}>
          <header className={styles.cardHeader}><div><h2>Top experiences</h2><p>Ranked by paid gross revenue.</p></div></header>
          <div className={styles.ranking}>{(analytics?.topTours || []).length === 0 ? <div className={styles.empty}>No paid tour activity yet.</div> : analytics.topTours.map((item, index) => <article key={item.id || item.title}><b>{index + 1}</b><span><strong>{item.title}</strong><small>{item.location || "Egypt"} · {item.bookings} paid bookings</small></span><em>{money(item.revenue)}</em></article>)}</div>
        </section>
        <section className={styles.card}>
          <header className={styles.cardHeader}><div><h2>Top guides</h2><p>Gross booking value and guide earnings.</p></div></header>
          <div className={styles.ranking}>{(analytics?.topGuides || []).length === 0 ? <div className={styles.empty}>No paid guide activity yet.</div> : analytics.topGuides.map((item, index) => <article key={item.id || item.email}><b>{index + 1}</b><span><strong>{item.name || "Guide"}</strong><small>{item.bookings} paid bookings · earnings {money(item.guideEarnings)}</small></span><em>{money(item.grossRevenue)}</em></article>)}</div>
        </section>
      </div>

      <div className={styles.twoColumn}>
        <section className={styles.card}>
          <header className={styles.cardHeader}><div><h2>New accounts</h2><p>Daily new-user activity in the selected range.</p></div></header>
          <div className={styles.sparkBars}>{(analytics?.userGrowth || []).filter((_, index) => days !== 365 || index % 7 === 0).map((item) => <span key={item.date} title={`${shortDate(item.date)} · ${item.users} new users`}><i style={{ height: `${Math.max(3, (Number(item.users || 0) / maxUsers) * 100)}%` }} /></span>)}</div>
        </section>
        <Distribution title="Payment providers" values={analytics?.paymentProviders || {}} />
      </div>

      <section className={styles.insightStrip}>
        <ArrowUpRight size={18} />
        <p><strong>Operational definition:</strong> revenue is recognized here only when the booking record is marked <code>paid</code>. Refund and payout execution are intentionally not simulated by the admin UI.</p>
      </section>
    </div>
  );
}
