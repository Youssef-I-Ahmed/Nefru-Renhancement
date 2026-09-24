import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  UserRound,
  XCircle,
} from "lucide-react";

import { apiRequest, resolveMediaUrl } from "../../../../../services/api";
import PriceDisplay from "../../../../../shared/components/PriceDisplay/PriceDisplay";
import styles from "./MyBookingsPremium.module.css";

const tabs = [
  { key: "upcoming", label: "Upcoming", icon: CalendarDays },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "cancelled", label: "Cancelled", icon: XCircle },
];

function displayDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(booking) {
  if (booking.status === "pending_payment") return "Payment pending";
  if (booking.status === "confirmed") return "Confirmed";
  if (booking.status === "completed") return "Completed";
  if (booking.status === "cancelled") return "Cancelled";
  if (booking.status === "refunded") return "Refunded";
  return String(booking.status || "Booking").replaceAll("_", " ");
}

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [sortBy, setSortBy] = useState("date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/bookings/me");
      setBookings(response?.data?.bookings || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load your bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const counts = useMemo(() => bookings.reduce((result, booking) => {
    const key = booking.statusGroup || "upcoming";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, { upcoming: 0, completed: 0, cancelled: 0 }), [bookings]);

  const filtered = useMemo(() => {
    const next = bookings.filter((booking) => booking.statusGroup === activeTab);
    return [...next].sort((a, b) => {
      if (sortBy === "price") return Number(b.totalPrice || 0) - Number(a.totalPrice || 0);
      return new Date(a.startsAt || a.date) - new Date(b.startsAt || b.date);
    });
  }, [activeTab, bookings, sortBy]);

  const cancelBooking = async (booking) => {
    const paidNote = booking.paymentStatus === "paid"
      ? " If the booking is refund-eligible, NEFRU will route it to admin refund processing."
      : "";
    if (!window.confirm(`Cancel your booking for ${booking.title}?${paidNote}`)) return;

    setCancellingId(String(booking.id));
    setError("");
    try {
      await apiRequest(`/bookings/${booking.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason: "Cancelled by traveler" }),
      });
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to cancel this booking.");
    } finally {
      setCancellingId("");
    }
  };

  return (
    <div className={styles.pageContent}>
      <header className={styles.pageHeader}>
        <div><span>Your trips</span><h2>My bookings</h2><p>Manage one-person booking holds, confirmed experiences, and your trip history.</p></div>
      </header>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Booking status">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} type="button" role="tab" aria-selected={active} className={active ? styles.activeTab : ""} onClick={() => setActiveTab(tab.key)}>
                <Icon size={15} /> {tab.label} <strong>{counts[tab.key] || 0}</strong>
              </button>
            );
          })}
        </div>

        <label className={styles.sortControl}>
          <SlidersHorizontal size={15} />
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort bookings">
            <option value="date">Travel date</option>
            <option value="price">Highest price</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className={styles.emptyState}><span className={styles.loader} /><h3>Loading your bookings</h3><p>Checking your latest trip activity.</p></div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <CalendarDays size={28} />
          <h3>No {activeTab} bookings</h3>
          <p>{activeTab === "upcoming" ? "When you reserve an experience, it will appear here." : `You do not have any ${activeTab} bookings yet.`}</p>
          {activeTab === "upcoming" && <button type="button" onClick={() => navigate("/user/trips")}>Explore experiences</button>}
        </div>
      ) : (
        <div className={styles.bookingList}>
          {filtered.map((booking) => (
            <article key={booking.id} className={styles.bookingCard}>
              <div className={styles.media}>
                {booking.image ? <img src={resolveMediaUrl(booking.image)} alt={booking.title} /> : <div className={styles.imageFallback}>NEFRU</div>}
                <span className={styles.personalBadge}><UserRound size={13} /> Personal booking</span>
              </div>

              <div className={styles.bookingBody}>
                <div className={styles.titleRow}>
                  <div><span className={styles.status} data-group={booking.statusGroup}>{statusLabel(booking)}</span><h3>{booking.title}</h3></div>
                  <PriceDisplay amount={Number(booking.totalPrice || 0)} currency={booking.currency || "EGP"} className={styles.bookingPrice} />
                </div>

                <div className={styles.metaGrid}>
                  <span><CalendarDays size={15} /> {displayDate(booking.startsAt || booking.date)}</span>
                  <span><Clock3 size={15} /> {booking.startTime || "Time unavailable"}</span>
                  <span><MapPin size={15} /> {booking.location || "Meeting location in booking"}</span>
                  <span><UserRound size={15} /> 1 traveler · account holder</span>
                </div>

                <div className={styles.guideRow}>Guide <strong>{booking.guide || "NEFRU guide"}</strong></div>
                {booking.cancellationReason && <div className={styles.cancellationReason}>Cancellation reason: {booking.cancellationReason}</div>}
                {booking.refundStatus === "processing" && (
                  <div className={styles.cancellationReason}>
                    Refund status: processing with Paymob.
                  </div>
                )}
                {booking.paymentStatus === "refunded" && (
                  <div className={styles.cancellationReason}>
                    Refund completed: {Number(booking.refundedAmount || booking.totalPrice || 0).toLocaleString("en-US")} {booking.currency || "EGP"}.
                  </div>
                )}
                {booking.refundStatus === "failed" && (
                  <div className={styles.cancellationReason}>
                    Refund needs support review. Your booking record is preserved.
                  </div>
                )}

                <div className={styles.actions}>
                  {booking.status === "pending_payment" && (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => navigate(`/user/trips/${booking.tripId}/book/status?bookingId=${booking.id}`)}
                    >
                      <CreditCard size={15} /> Continue payment
                    </button>
                  )}
                  {["pending_payment", "confirmed"].includes(booking.status) && (
                    <button type="button" className={styles.dangerButton} disabled={cancellingId === String(booking.id)} onClick={() => cancelBooking(booking)}>
                      <XCircle size={15} /> {cancellingId === String(booking.id) ? "Cancelling..." : "Cancel booking"}
                    </button>
                  )}
                  <button type="button" className={styles.secondaryButton} onClick={() => navigate(`/user/trips/${booking.tripId}`)}>
                    <RotateCcw size={15} /> View experience
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
