import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest, resolveMediaUrl } from "../../../services/api";
import styles from "./GuideBookings.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EGP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function occurrenceStart(item) {
  return item.startsAt
    ? new Date(item.startsAt)
    : new Date(`${item.date}T${String(item.startTime || "00:00").slice(0, 5)}:00`);
}

function occurrenceEnd(item) {
  return item.endsAt
    ? new Date(item.endsAt)
    : new Date(`${item.date}T${String(item.endTime || "23:59").slice(0, 5)}:00`);
}

function groupStatus(item) {
  const statuses = (item.bookings || []).map((booking) => booking.status);
  if (statuses.some((status) => ["confirmed", "pending_payment"].includes(status))) return "upcoming";
  if (statuses.some((status) => status === "completed")) return "completed";
  return "cancelled";
}

function readableDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function statusText(value = "") {
  return value.replaceAll("_", " ");
}

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export default function GuideBookings() {
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingKey, setWorkingKey] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [query, setQuery] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/bookings/guide/me");
      setOccurrences(response?.data?.occurrences || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load guide bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = useMemo(() => {
    const bookings = occurrences.flatMap((item) => item.bookings || []);
    return {
      upcoming: occurrences.filter((item) => groupStatus(item) === "upcoming").length,
      confirmed: bookings.filter((item) => item.status === "confirmed").length,
      pending: bookings.filter((item) => item.status === "pending_payment").length,
      paid: bookings
        .filter((item) => item.paymentStatus === "paid" && (item.currency || "EGP") === "EGP")
        .reduce((sum, item) => sum + Number(item.guideEarnings ?? item.totalPrice ?? 0), 0),
    };
  }, [occurrences]);

  const counts = useMemo(() => Object.fromEntries(TABS.map(({ value }) => [
    value,
    value === "all" ? occurrences.length : occurrences.filter((item) => groupStatus(item) === value).length,
  ])), [occurrences]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return occurrences
      .filter((item) => activeTab === "all" || groupStatus(item) === activeTab)
      .filter((item) => {
        if (!normalized) return true;
        const haystack = [
          item.title,
          item.location,
          item.date,
          ...(item.bookings || []).flatMap((booking) => [booking.tourist, booking.touristEmail, booking.specialRequest]),
        ].join(" ").toLowerCase();
        return normalized.split(/\s+/).every((word) => haystack.includes(word));
      })
      .sort((a, b) => occurrenceStart(a) - occurrenceStart(b));
  }, [activeTab, occurrences, query]);

  const complete = async (item) => {
    const itemKey = `${item.tripId}:${item.occurrenceKey}`;
    setWorkingKey(itemKey);
    setError("");
    try {
      await apiRequest("/bookings/guide/occurrences/complete", {
        method: "PATCH",
        body: JSON.stringify({ tripId: item.tripId, occurrenceKey: item.occurrenceKey }),
      });
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to mark this occurrence as completed.");
    } finally {
      setWorkingKey("");
    }
  };

  const openCancel = (item) => {
    setCancelTarget(item);
    setCancelReason("");
    setError("");
  };

  const cancelOccurrence = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    const itemKey = `${cancelTarget.tripId}:${cancelTarget.occurrenceKey}`;
    setWorkingKey(itemKey);
    setError("");
    try {
      await apiRequest("/bookings/guide/occurrences/cancel", {
        method: "PATCH",
        body: JSON.stringify({
          tripId: cancelTarget.tripId,
          occurrenceKey: cancelTarget.occurrenceKey,
          reason: cancelReason.trim(),
        }),
      });
      setCancelTarget(null);
      setCancelReason("");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to cancel this occurrence.");
    } finally {
      setWorkingKey("");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Booking management</span>
          <h1>Travelers & booked occurrences</h1>
          <p>Manage the real reservations attached to your scheduled experiences.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={load} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <section className={styles.stats}>
        <article><CalendarDays /><div><strong>{loading ? "—" : stats.upcoming}</strong><span>Upcoming occurrences</span></div></article>
        <article><UserRound /><div><strong>{loading ? "—" : stats.confirmed}</strong><span>Confirmed travelers</span></div></article>
        <article><Clock3 /><div><strong>{loading ? "—" : stats.pending}</strong><span>Payment holds</span></div></article>
        <article><CheckCircle2 /><div><strong>{loading ? "—" : money.format(stats.paid)}</strong><span>Captured guide earnings</span></div></article>
      </section>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.toolbar}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button type="button" key={tab.value} data-active={activeTab === tab.value || undefined} onClick={() => setActiveTab(tab.value)}>
              {tab.label}<span>{counts[tab.value] || 0}</span>
            </button>
          ))}
        </div>
        <label className={styles.searchBox}>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search experience or traveler" />
        </label>
      </section>

      {loading ? (
        <div className={styles.empty}>Loading guide bookings…</div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>No booking occurrences match this view.</div>
      ) : (
        <div className={styles.list}>
          {visible.map((item) => {
            const itemKey = `${item.tripId}:${item.occurrenceKey}`;
            const confirmed = item.bookings.filter((booking) => booking.status === "confirmed");
            const pending = item.bookings.filter((booking) => booking.status === "pending_payment");
            const group = groupStatus(item);
            const active = confirmed.length + pending.length > 0;
            const ended = occurrenceEnd(item) <= new Date();
            const started = occurrenceStart(item) <= new Date();
            const paidEarnings = item.bookings
              .filter((booking) => booking.paymentStatus === "paid" && (booking.currency || "EGP") === "EGP")
              .reduce((sum, booking) => sum + Number(booking.guideEarnings ?? booking.totalPrice ?? 0), 0);

            return (
              <article className={styles.card} key={itemKey}>
                <div className={styles.tripHeader}>
                  {item.image ? <img src={resolveMediaUrl(item.image)} alt="" /> : <div className={styles.imageFallback}>NEFRU</div>}
                  <div className={styles.tripInfo}>
                    <div className={styles.titleRow}><h2>{item.title}</h2><span data-status={group}>{group}</span></div>
                    <p><MapPin size={14} /> {item.location}</p>
                    <div className={styles.meta}>
                      <span><CalendarDays size={14} /> {readableDate(item.date)}</span>
                      <span><Clock3 size={14} /> {item.startTime} – {item.endTime}</span>
                      <span><UserRound size={14} /> {confirmed.length + pending.length} / {item.capacity}</span>
                      <span>{money.format(paidEarnings)} captured</span>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.completeButton}
                      disabled={!confirmed.length || !ended || workingKey === itemKey}
                      title={!ended ? "Available after the experience ends" : ""}
                      onClick={() => complete(item)}
                    >
                      <CheckCircle2 size={15} /> Mark completed
                    </button>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      disabled={!active || started || workingKey === itemKey}
                      title={started ? "Started experiences cannot be cancelled here" : ""}
                      onClick={() => openCancel(item)}
                    >
                      <XCircle size={15} /> Cancel occurrence
                    </button>
                  </div>
                </div>

                <div className={styles.guestTable}>
                  <div className={styles.guestHeader}><span>Traveler</span><span>Booking</span><span>Payment</span><span>Special request</span><span>Amount</span></div>
                  {item.bookings.map((booking) => (
                    <div className={styles.guestRow} key={booking.id}>
                      <span className={styles.traveler}><strong>{booking.tourist}</strong><small>{booking.touristEmail || "No email"}</small></span>
                      <span><b data-booking={booking.status}>{statusText(booking.status)}</b></span>
                      <span><b data-payment={booking.paymentStatus}>{statusText(booking.paymentStatus)}</b>{booking.paymentMethod && booking.paymentMethod !== "none" ? <small>{booking.paymentMethod}</small> : null}</span>
                      <span className={styles.request}>{booking.specialRequest || "—"}</span>
                      <span className={styles.amount}><strong>{money.format(Number(booking.guideEarnings ?? booking.totalPrice ?? 0))}</strong>{booking.paymentReference ? <small title={booking.paymentReference}>Ref {String(booking.paymentReference).slice(-8)}</small> : null}</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {cancelTarget && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCancelTarget(null)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="cancel-title">
            <button type="button" className={styles.modalClose} onClick={() => setCancelTarget(null)} aria-label="Close"><X /></button>
            <span className={styles.warningIcon}><AlertTriangle /></span>
            <h2 id="cancel-title">Cancel this occurrence?</h2>
            <p>All active travelers on <strong>{cancelTarget.title}</strong> will be notified. The time slot will also be removed from the tour schedule.</p>
            <label>Reason for travelers<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} placeholder="Explain why this occurrence is being cancelled…" /></label>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setCancelTarget(null)}>Keep occurrence</button>
              <button type="button" className={styles.dangerButton} disabled={!cancelReason.trim() || Boolean(workingKey)} onClick={cancelOccurrence}>Cancel & notify travelers</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
