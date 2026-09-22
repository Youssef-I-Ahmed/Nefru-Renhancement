import {
  CalendarDays,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ReceiptText,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../../../services/api";
import styles from "./GuideEarnings.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EGP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function monthLabel(key) {
  if (!key) return "";
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function GuideEarnings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/bookings/guide/me");
      setBookings((response?.data?.bookings || []).filter((booking) => booking.paymentStatus === "paid" && (booking.currency || "EGP") === "EGP"));
    } catch (requestError) {
      setError(requestError.message || "Unable to load earnings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;

  const summary = useMemo(() => {
    const total = bookings.reduce((sum, booking) => sum + Number(booking.guideEarnings ?? booking.totalPrice ?? 0), 0);
    const thisMonthBookings = bookings.filter((booking) => monthKey(booking.createdAt || booking.startsAt) === currentMonth);
    const thisMonth = thisMonthBookings.reduce((sum, booking) => sum + Number(booking.guideEarnings ?? booking.totalPrice ?? 0), 0);
    const completed = bookings.filter((booking) => booking.status === "completed" && booking.earningsAvailableAt && new Date(booking.earningsAvailableAt) <= new Date() && booking.settlementStatus !== "settled").reduce((sum, booking) => sum + Number(booking.guideEarnings ?? booking.totalPrice ?? 0), 0);
    return { total, thisMonth, completed, paidBookings: bookings.length };
  }, [bookings, currentMonth]);

  const months = useMemo(() => {
    const now = new Date(`${currentMonth}-01T12:00:00`);
    const result = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
      const amount = bookings
        .filter((booking) => monthKey(booking.createdAt || booking.startsAt) === key)
        .reduce((sum, booking) => sum + Number(booking.guideEarnings ?? booking.totalPrice ?? 0), 0);
      result.push({ key, amount });
    }
    return result;
  }, [bookings, currentMonth]);

  const maxMonth = Math.max(1, ...months.map((item) => item.amount));
  const sortedBookings = [...bookings].sort((a, b) => new Date(b.createdAt || b.startsAt) - new Date(a.createdAt || a.startsAt));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Financial overview</span>
          <h1>Earnings</h1>
          <p>Track captured booking earnings from travelers. Raw payment credentials are never stored by NEFRU.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.stats}>
        <article><span><CircleDollarSign /></span><div><small>This month</small><strong>{loading ? "—" : money.format(summary.thisMonth)}</strong><p>Paid bookings captured this month</p></div></article>
        <article><span><TrendingUp /></span><div><small>Lifetime captured</small><strong>{loading ? "—" : money.format(summary.total)}</strong><p>Across all paid bookings</p></div></article>
        <article><span><ReceiptText /></span><div><small>Paid bookings</small><strong>{loading ? "—" : summary.paidBookings}</strong><p>Successful payment records</p></div></article>
        <article><span><CalendarDays /></span><div><small>Available earnings</small><strong>{loading ? "—" : money.format(summary.completed)}</strong><p>Completed experiences after the dispute window; not paid out</p></div></article>
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.sectionHeader}><div><span>Last 6 months</span><h2>Captured earnings trend</h2></div></div>
          <div className={styles.chart}>
            {months.map((item) => (
              <div className={styles.barColumn} key={item.key}>
                <strong>{item.amount ? money.format(item.amount) : "EGP 0"}</strong>
                <div className={styles.barTrack}><span style={{ height: `${Math.max(4, (item.amount / maxMonth) * 100)}%` }} /></div>
                <small>{monthLabel(item.key)}</small>
              </div>
            ))}
          </div>
        </section>

        <aside className={`${styles.card} ${styles.infoCard}`}>
          <span className={styles.infoIcon}><CreditCard /></span>
          <h2>About payouts</h2>
          <p>This screen tracks money already captured from bookings. Guide payout transfers are not implemented in the current backend, so NEFRU does not show fake payout dates or balances.</p>
          <div><Clock3 size={15} /><span>When payouts are added, provider transfer status can live here without changing booking earnings history.</span></div>
        </aside>
      </div>

      <section className={`${styles.card} ${styles.transactionsCard}`}>
        <div className={styles.sectionHeader}><div><span>Payment history</span><h2>Captured booking transactions</h2></div><b>{sortedBookings.length} records</b></div>
        {loading ? (
          <div className={styles.empty}>Loading earnings…</div>
        ) : sortedBookings.length === 0 ? (
          <div className={styles.empty}>No successful booking payments yet.</div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHeader}><span>Experience</span><span>Traveler</span><span>Date</span><span>Payment</span><span>Reference</span><span>Guide earnings</span></div>
            {sortedBookings.map((booking) => (
              <div className={styles.row} key={booking.id}>
                <span><strong>{booking.title}</strong><small>{booking.location || "—"}</small></span>
                <span><strong>{booking.tourist}</strong><small>{booking.touristEmail || ""}</small></span>
                <span>{dateLabel(booking.createdAt || booking.startsAt)}</span>
                <span><b>{booking.paymentMethod && booking.paymentMethod !== "none" ? booking.paymentMethod : "Paymob"}</b><small>{booking.paymentStatus}</small></span>
                <span className={styles.reference}>{booking.paymentReference || "—"}</span>
                <span className={styles.amount}>{money.format(Number(booking.guideEarnings ?? booking.totalPrice ?? 0))}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
