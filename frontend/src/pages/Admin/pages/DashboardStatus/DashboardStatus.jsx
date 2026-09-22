import { CalendarClock, ChevronRight, CircleDollarSign, Clock3, Compass, CreditCard, RefreshCw, ShieldCheck, Star, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { resolveMediaUrl } from "../../../../services/api";
import { getDashboard } from "../../api";
import styles from "./DashboardStatus.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EGP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusText(value = "") {
  return value.replaceAll("_", " ");
}

export default function DashboardStatus() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState("bookings");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await getDashboard();
    if (result.error) setError(result.error);
    else setDashboard(result.data || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const summary = dashboard?.summary || {};
  const topTours = Array.isArray(dashboard?.topTours)
    ? dashboard.topTours
    : Array.isArray(dashboard?.topTours?.data)
      ? dashboard.topTours.data
      : [];
  const series = useMemo(() => dashboard?.series || { labels: [], bookingValues: [], revenueValues: [] }, [dashboard?.series]);
  const activeSeries = useMemo(() => metric === "bookings" ? series.bookingValues || [] : series.revenueValues || [], [metric, series]);
  const maxValue = Math.max(1, ...activeSeries);
  const chartRows = useMemo(() => (series.labels || []).map((label, index) => ({
    label,
    value: Number(activeSeries[index] || 0),
  })).slice(-20), [activeSeries, series.labels]);

  const cards = [
    { label: "Users", value: summary.totalUsers ?? 0, helper: `${dashboard?.users?.guide || 0} guides · ${dashboard?.users?.tourist || 0} tourists`, icon: UsersRound },
    { label: "Tours", value: summary.totalTours ?? 0, helper: `${summary.toursAwaitingReview || 0} awaiting review`, icon: Compass, action: () => navigate("/admin/cms") },
    { label: "Bookings", value: summary.totalBookings ?? 0, helper: `${summary.pendingPayments || 0} pending payment`, icon: CalendarClock, action: () => navigate("/admin/booking") },
    { label: "Paid revenue", value: money.format(summary.paidRevenue || 0), helper: "Captured payments only", icon: CircleDollarSign },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Operations overview</span>
          <h1>Admin dashboard</h1>
          <p>Monitor real platform activity, moderation queues, bookings, and captured revenue.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.cards}>
        {cards.map((card) => {
          const Icon = card.icon;
          const content = (
            <>
              <span className={styles.cardIcon}><Icon size={20} /></span>
              <div><small>{card.label}</small><strong>{loading ? "—" : card.value}</strong><p>{card.helper}</p></div>
              {card.action && <ChevronRight size={18} className={styles.cardArrow} />}
            </>
          );
          return card.action ? (
            <button type="button" className={styles.metricCard} key={card.label} onClick={card.action}>{content}</button>
          ) : <article className={styles.metricCard} key={card.label}>{content}</article>;
        })}
      </section>

      <section className={styles.priorityGrid}>
        <button type="button" className={styles.priorityCard} onClick={() => navigate("/admin/accounts")}>
          <span className={styles.priorityIcon}><ShieldCheck /></span>
          <div><small>Guide verification queue</small><strong>{loading ? "—" : summary.pendingGuideVerifications || 0}</strong><p>Applications waiting for admin review</p></div>
          <ChevronRight />
        </button>
        <button type="button" className={styles.priorityCard} onClick={() => navigate("/admin/cms")}>
          <span className={styles.priorityIcon}><Clock3 /></span>
          <div><small>Tour moderation queue</small><strong>{loading ? "—" : summary.toursAwaitingReview || 0}</strong><p>Guide experiences awaiting a publishing decision</p></div>
          <ChevronRight />
        </button>
        <button type="button" className={styles.priorityCard} onClick={() => navigate("/admin/booking")}>
          <span className={styles.priorityIcon}><CreditCard /></span>
          <div><small>Payment holds</small><strong>{loading ? "—" : summary.pendingPayments || 0}</strong><p>Bookings still waiting for successful payment</p></div>
          <ChevronRight />
        </button>
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div><span>Last 20 days</span><h2>Platform activity</h2></div>
            <div className={styles.segmented}>
              <button type="button" data-active={metric === "bookings" || undefined} onClick={() => setMetric("bookings")}>Bookings</button>
              <button type="button" data-active={metric === "revenue" || undefined} onClick={() => setMetric("revenue")}>Revenue</button>
            </div>
          </div>
          <div className={styles.barChart}>
            {chartRows.map((item) => (
              <div className={styles.barColumn} key={item.label} title={`${item.label}: ${metric === "revenue" ? money.format(item.value) : item.value}`}>
                <span style={{ height: `${Math.max(3, (item.value / maxValue) * 100)}%` }} />
                <small>{item.label}</small>
              </div>
            ))}
          </div>
          <div className={styles.chartFooter}><span>{metric === "revenue" ? "Paid revenue only" : "All created bookings"}</span><strong>{metric === "revenue" ? money.format(activeSeries.reduce((a, b) => a + Number(b || 0), 0)) : activeSeries.reduce((a, b) => a + Number(b || 0), 0)}</strong></div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}><div><span>Moderation</span><h2>Guide applications</h2></div><button type="button" className={styles.textAction} onClick={() => navigate("/admin/accounts")}>View accounts <ChevronRight size={15} /></button></div>
          {loading ? <div className={styles.empty}>Loading applications…</div> : (dashboard?.pendingGuideApprovals || []).length === 0 ? <div className={styles.empty}>No guide applications are waiting for review.</div> : (
            <div className={styles.guideList}>
              {dashboard.pendingGuideApprovals.map((guide) => (
                <button type="button" key={guide.id} onClick={() => navigate("/admin/accounts")}>
                  {guide.avatar ? <img src={resolveMediaUrl(guide.avatar)} alt="" /> : <span className={styles.avatarFallback}>{(guide.fullName || "G")[0]}</span>}
                  <span><strong>{guide.fullName || "Guide"}</strong><small>{guide.email || guide.location || "Pending guide"}</small></span>
                  <time>{formatDate(guide.submittedAt)}</time>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className={styles.lowerGrid}>
        <section className={styles.card}>
          <div className={styles.sectionHeader}><div><span>Marketplace quality</span><h2>Top active tours</h2></div><button type="button" className={styles.textAction} onClick={() => navigate("/admin/cms")}>Manage tours <ChevronRight size={15} /></button></div>
          {loading ? <div className={styles.empty}>Loading tours…</div> : topTours.length === 0 ? <div className={styles.empty}>No active tours yet.</div> : (
            <div className={styles.tourList}>
              {topTours.map((tour, index) => (
                <article key={tour._id || tour.id}>
                  <b>{index + 1}</b>
                  {tour.image ? <img src={resolveMediaUrl(tour.image)} alt="" /> : <span className={styles.tourFallback}>NEFRU</span>}
                  <span><strong>{tour.title}</strong><small>{tour.location} · {tour.category || "Experience"}</small></span>
                  <span className={styles.rating}><Star size={14} fill="currentColor" /> {Number(tour.rating || 0).toFixed(1)} <small>({tour.reviewsCount || 0})</small></span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}><div><span>Latest activity</span><h2>Recent bookings</h2></div><button type="button" className={styles.textAction} onClick={() => navigate("/admin/booking")}>All bookings <ChevronRight size={15} /></button></div>
          {loading ? <div className={styles.empty}>Loading bookings…</div> : (dashboard?.recentBookings || []).length === 0 ? <div className={styles.empty}>No bookings yet.</div> : (
            <div className={styles.bookingList}>
              {dashboard.recentBookings.map((booking) => (
                <article key={booking.id}>
                  <span><strong>{booking.title}</strong><small>{booking.touristEmail || "Traveler"} · {formatDate(booking.createdAt)}</small></span>
                  <span className={styles.statusPair}><b data-status={booking.status}>{statusText(booking.status)}</b><b data-payment={booking.paymentStatus}>{statusText(booking.paymentStatus)}</b></span>
                  <strong className={styles.amount}>{money.format(Number(booking.totalPrice || 0))}</strong>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
