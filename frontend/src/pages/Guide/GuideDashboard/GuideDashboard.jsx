import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { apiRequest, resolveMediaUrl } from "../../../services/api";
import styles from "./GuideDashboard.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function startOfOccurrence(item) {
  if (item?.startsAt) return new Date(item.startsAt);
  if (!item?.date) return new Date(0);
  return new Date(`${item.date}T${String(item.startTime || "00:00").slice(0, 5)}:00`);
}

function isSameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function activeBookings(item) {
  return (item?.bookings || []).filter((booking) =>
    ["confirmed", "pending_payment"].includes(booking.status),
  );
}

function confirmedBookings(item) {
  return (item?.bookings || []).filter((booking) => booking.status === "confirmed");
}

function paidEarnings(bookings) {
  return bookings
    .filter((booking) => booking.paymentStatus === "paid" && (booking.currency || "EGP") === "EGP")
    .reduce((sum, booking) => sum + Number(booking.guideEarnings ?? booking.totalPrice ?? 0), 0);
}

function relativeTime(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "Just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function EmptyBlock({ title, text, action, onAction }) {
  return (
    <div className={styles.emptyBlock}>
      <span className={styles.emptyIcon}><Sparkles size={20} /></span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      {action && (
        <button type="button" onClick={onAction}>{action} <ArrowRight size={15} /></button>
      )}
    </div>
  );
}

export default function GuideDashboard() {
  const navigate = useNavigate();
  const authProfile = useSelector((state) => state.auth.profile);
  const syncedNotifications = useSelector((state) => state.notifications.notifications || []);

  const [tours, setTours] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tourResponse, bookingResponse] = await Promise.all([
        apiRequest("/trips/guide/me"),
        apiRequest("/bookings/guide/me"),
      ]);
      setTours(tourResponse?.data?.tours || []);
      setOccurrences(bookingResponse?.data?.occurrences || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load your guide dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const dashboard = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const futureOccurrences = occurrences
      .filter((item) => startOfOccurrence(item) > now && activeBookings(item).length > 0)
      .sort((a, b) => startOfOccurrence(a) - startOfOccurrence(b));

    const allBookings = occurrences.flatMap((item) => item.bookings || []);
    const confirmedUpcoming = futureOccurrences.flatMap(confirmedBookings);
    const monthlyPaid = allBookings.filter((booking) => {
      const referenceDate = new Date(booking.startsAt || booking.date || booking.createdAt || 0);
      return referenceDate.getFullYear() === year && referenceDate.getMonth() === month;
    });

    const today = futureOccurrences.filter((item) => isSameDay(startOfOccurrence(item), now));
    const specialRequests = confirmedUpcoming.filter((booking) => booking.specialRequest?.trim()).length;
    const pendingPayments = allBookings.filter((booking) => booking.status === "pending_payment").length;
    const drafts = tours.filter((tour) => tour.status === "draft").length;
    const reviewing = tours.filter((tour) => tour.status === "reviewing").length;

    return {
      futureOccurrences,
      next: futureOccurrences[0] || null,
      today,
      upcomingTravelers: confirmedUpcoming.length,
      monthlyEarnings: paidEarnings(monthlyPaid),
      specialRequests,
      pendingPayments,
      drafts,
      reviewing,
      activeTours: tours.filter((tour) => tour.status === "active").length,
    };
  }, [occurrences, tours]);

  const guideName = authProfile?.fullName || authProfile?.name || "Guide";
  const rating = Number(authProfile?.rating || 0);
  const reviewsCount = Number(authProfile?.reviewsCount || 0);
  const nextDate = dashboard.next ? startOfOccurrence(dashboard.next) : null;
  const nextConfirmed = dashboard.next ? confirmedBookings(dashboard.next) : [];
  const nextActive = dashboard.next ? activeBookings(dashboard.next) : [];
  const nextEarnings = dashboard.next ? paidEarnings(dashboard.next.bookings || []) : 0;

  const reminders = [
    dashboard.pendingPayments > 0 && {
      title: `${dashboard.pendingPayments} payment ${dashboard.pendingPayments === 1 ? "hold" : "holds"} pending`,
      text: "Seats stay reserved only while each payment window is active.",
      to: "/guide/bookings",
      tone: "warning",
    },
    dashboard.specialRequests > 0 && {
      title: `${dashboard.specialRequests} special ${dashboard.specialRequests === 1 ? "request" : "requests"}`,
      text: "Review traveler notes before the experience starts.",
      to: "/guide/bookings",
      tone: "gold",
    },
    dashboard.reviewing > 0 && {
      title: `${dashboard.reviewing} ${dashboard.reviewing === 1 ? "tour is" : "tours are"} under review`,
      text: "You can keep preparing schedules while approval is pending.",
      to: "/guide",
      tone: "blue",
    },
    dashboard.drafts > 0 && {
      title: `${dashboard.drafts} draft ${dashboard.drafts === 1 ? "tour" : "tours"}`,
      text: "Finish the details and media when you are ready.",
      to: "/guide",
      tone: "neutral",
    },
  ].filter(Boolean).slice(0, 3);

  const activity = syncedNotifications.slice(0, 5);

  return (
    <div className={styles.page}>
      <header className={styles.heroHeader}>
        <div>
          <span className={styles.eyebrow}>Guide workspace</span>
          <h1>Welcome back, {guideName.split(" ")[0]}.</h1>
          <p>See what needs your attention today, then manage tours and travelers from one place.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={loadDashboard} disabled={loading}>
            <RefreshCw size={16} className={loading ? styles.spinning : ""} /> Refresh
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => navigate("/guide/createtour")}>
            <Plus size={17} /> Create experience
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={loadDashboard}>Try again</button>
        </div>
      )}

      <section className={styles.statsGrid} aria-label="Guide overview">
        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.blue}`}><CalendarDays size={20} /></span>
          <div><small>Upcoming occurrences</small><strong>{loading ? "—" : dashboard.futureOccurrences.length}</strong><p>{dashboard.today.length ? `${dashboard.today.length} today` : "Next 30+ days"}</p></div>
        </article>
        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.gold}`}><UsersRound size={20} /></span>
          <div><small>Confirmed travelers</small><strong>{loading ? "—" : dashboard.upcomingTravelers}</strong><p>Across upcoming bookings</p></div>
        </article>
        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.gold}`}><Star size={20} /></span>
          <div><small>Guide rating</small><strong>{rating ? rating.toFixed(1) : "New"}</strong><p>{reviewsCount ? `${reviewsCount} reviews` : "No reviews yet"}</p></div>
        </article>
        <article
          className={styles.statCard}
          role="button"
          tabIndex={0}
          onClick={() => navigate("/guide/earnings")}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate("/guide/earnings"); }}
        >
          <span className={`${styles.statIcon} ${styles.green}`}><CircleDollarSign size={20} /></span>
          <div><small>This month</small><strong>{loading ? "—" : money.format(dashboard.monthlyEarnings)}</strong><p>Paid guide earnings · open details</p></div>
        </article>
      </section>

      <div className={styles.dashboardGrid}>
        <div className={styles.primaryColumn}>
          <section className={`${styles.card} ${styles.nextCard}`}>
            <div className={styles.sectionHeader}>
              <div><span className={styles.sectionKicker}>Next booking</span><h2>Your next experience</h2></div>
              <button type="button" className={styles.textAction} onClick={() => navigate("/guide/bookings")}>All bookings <ArrowRight size={15} /></button>
            </div>

            {loading ? (
              <div className={styles.loadingBlock}>Loading your next booking…</div>
            ) : !dashboard.next ? (
              <EmptyBlock title="No booked experiences yet" text="Your next confirmed traveler booking will appear here." action="Manage tours" onAction={() => navigate("/guide")} />
            ) : (
              <div className={styles.nextExperience}>
                <div className={styles.nextMedia}>
                  {dashboard.next.image ? <img src={resolveMediaUrl(dashboard.next.image)} alt={dashboard.next.title} /> : <div className={styles.imageFallback}>NEFRU</div>}
                  <span className={styles.nextBadge}>{isSameDay(nextDate, new Date()) ? "Today" : shortDateFormatter.format(nextDate)}</span>
                </div>
                <div className={styles.nextBody}>
                  <div className={styles.nextTitleRow}>
                    <div><h3>{dashboard.next.title}</h3><p><MapPin size={14} /> {dashboard.next.location || "Meeting location pending"}</p></div>
                    <strong className={styles.nextRevenue}>{money.format(nextEarnings)}</strong>
                  </div>
                  <div className={styles.metaGrid}>
                    <span><CalendarDays /><small>Date</small><strong>{dateFormatter.format(nextDate)}</strong></span>
                    <span><Clock3 /><small>Start</small><strong>{timeFormatter.format(nextDate)}</strong></span>
                    <span><UsersRound /><small>Travelers</small><strong>{nextActive.length} / {dashboard.next.capacity || 1}</strong></span>
                    <span><CheckCircle2 /><small>Confirmed</small><strong>{nextConfirmed.length}</strong></span>
                  </div>
                  <div className={styles.nextActions}>
                    <button type="button" className={styles.primaryButton} onClick={() => navigate("/guide/bookings")}>Open guest list <ArrowRight size={16} /></button>
                    <button type="button" className={styles.secondaryButton} onClick={() => navigate("/guide/calendar")}>View calendar</button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className={`${styles.card} ${styles.upcomingCard}`}>
            <div className={styles.sectionHeader}>
              <div><span className={styles.sectionKicker}>Schedule</span><h2>Upcoming booked experiences</h2></div>
              <button type="button" className={styles.textAction} onClick={() => navigate("/guide/calendar")}>Calendar <ArrowRight size={15} /></button>
            </div>
            {loading ? <div className={styles.loadingBlock}>Loading schedule…</div> : dashboard.futureOccurrences.length === 0 ? (
              <EmptyBlock title="Your schedule is clear" text="When travelers book an active experience, it will appear here." />
            ) : (
              <div className={styles.upcomingList}>
                {dashboard.futureOccurrences.slice(0, 5).map((item) => {
                  const startsAt = startOfOccurrence(item);
                  const confirmed = confirmedBookings(item);
                  const active = activeBookings(item);
                  return (
                    <button key={`${item.tripId}:${item.occurrenceKey}`} type="button" className={styles.upcomingRow} onClick={() => navigate("/guide/bookings")}>
                      <span className={styles.dateTile}><strong>{startsAt.getDate()}</strong><small>{startsAt.toLocaleString("en-US", { month: "short" })}</small></span>
                      <span className={styles.rowMain}><strong>{item.title}</strong><small><MapPin size={12} /> {item.location || "Location pending"}</small></span>
                      <span className={styles.rowMeta}><small>{timeFormatter.format(startsAt)}</small><strong>{confirmed.length} confirmed</strong></span>
                      <span className={styles.capacityPill}>{active.length}/{item.capacity || 1}</span>
                      <ArrowRight size={17} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={`${styles.card} ${styles.sideCard}`}>
            <div className={styles.sectionHeader}><div><span className={styles.sectionKicker}>Portfolio</span><h2>Your experiences</h2></div></div>
            <div className={styles.portfolioGrid}>
              <button type="button" onClick={() => navigate("/guide")}><strong>{tours.length}</strong><span>Total tours</span></button>
              <button type="button" onClick={() => navigate("/guide")}><strong>{dashboard.activeTours}</strong><span>Active</span></button>
              <button type="button" onClick={() => navigate("/guide")}><strong>{dashboard.reviewing}</strong><span>Reviewing</span></button>
              <button type="button" onClick={() => navigate("/guide")}><strong>{dashboard.drafts}</strong><span>Drafts</span></button>
            </div>
          </section>

          <section className={`${styles.card} ${styles.sideCard}`}>
            <div className={styles.sectionHeader}><div><span className={styles.sectionKicker}>Attention</span><h2>Things to check</h2></div></div>
            {reminders.length === 0 ? (
              <div className={styles.allClear}><CheckCircle2 size={19} /><div><strong>All clear</strong><p>No urgent booking or tour actions right now.</p></div></div>
            ) : (
              <div className={styles.reminderList}>
                {reminders.map((item) => (
                  <button type="button" key={item.title} className={styles.reminderItem} onClick={() => navigate(item.to)}>
                    <span className={`${styles.reminderDot} ${styles[item.tone]}`} />
                    <span><strong>{item.title}</strong><small>{item.text}</small></span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`${styles.card} ${styles.sideCard}`}>
            <div className={styles.sectionHeader}>
              <div><span className={styles.sectionKicker}>Activity</span><h2>Latest updates</h2></div>
              <button type="button" className={styles.textAction} onClick={() => navigate("/guide/notifications")}>View all</button>
            </div>
            {activity.length === 0 ? (
              <div className={styles.activityEmpty}>New booking, payment and review updates will appear here.</div>
            ) : (
              <div className={styles.activityList}>
                {activity.map((item) => (
                  <article key={item.id || item._id} className={styles.activityItem}>
                    <span className={styles.activityIcon}><span /></span>
                    <div><strong>{item.title || "Update"}</strong><p>{item.message || ""}</p><time>{relativeTime(item.createdAt)}</time></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
