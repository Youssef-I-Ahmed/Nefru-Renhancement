import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPinned,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Star,
  UserCheck,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest, resolveMediaUrl } from "../../../services/api";
import styles from "./GuideOperations.module.css";

const ACTIVE_STATUSES = new Set(["upcoming", "check_in_open", "in_progress"]);
const CLOSED_STATUSES = new Set(["completed", "cancelled"]);

const idOf = (value) => String(value?._id || value || "");

const humanize = (value = "") =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusTone = (status) => {
  if (status === "in_progress" || status === "checked_in") return "success";
  if (status === "check_in_open" || status === "upcoming" || status === "booked") return "info";
  if (status === "completed") return "neutral";
  if (status === "no_show" || status === "cancelled") return "danger";
  return "warning";
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const isSameLocalDay = (a, b = new Date()) => {
  const date = new Date(a);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === b.getFullYear() &&
    date.getMonth() === b.getMonth() &&
    date.getDate() === b.getDate()
  );
};

const getInitials = (name = "Traveler") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function StatusBadge({ status }) {
  return (
    <span className={styles.statusBadge} data-tone={statusTone(status)}>
      {humanize(status || "unknown")}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, helper }) {
  return (
    <article className={styles.summaryCard}>
      <span className={styles.summaryIcon}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{helper}</span>
      </div>
    </article>
  );
}

export default function GuideOperations() {
  const [data, setData] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [activeView, setActiveView] = useState("active");
  const [cancelOpenId, setCancelOpenId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showAccountClosure, setShowAccountClosure] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await apiRequest("/marketplace/dashboard");
      setData(response.data || {});
    } catch (requestError) {
      setError(requestError.message || "Unable to load guide operations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trips = useMemo(
    () => (Array.isArray(data.trips) ? data.trips : []),
    [data.trips],
  );
  const occurrences = useMemo(
    () => (Array.isArray(data.occurrences) ? data.occurrences : []),
    [data.occurrences],
  );
  const bookings = useMemo(
    () => (Array.isArray(data.bookings) ? data.bookings : []),
    [data.bookings],
  );
  const revisions = useMemo(
    () => (Array.isArray(data.revisions) ? data.revisions : []),
    [data.revisions],
  );

  const tripById = useMemo(
    () => new Map(trips.map((trip) => [idOf(trip._id), trip])),
    [trips],
  );

  const bookingsByOccurrence = useMemo(() => {
    const map = new Map();
    bookings.forEach((booking) => {
      const occurrenceId = idOf(booking.occurrence);
      if (!map.has(occurrenceId)) map.set(occurrenceId, []);
      map.get(occurrenceId).push(booking);
    });
    return map;
  }, [bookings]);

  const sortedOccurrences = useMemo(
    () =>
      [...occurrences].sort((a, b) => {
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (b.status === "in_progress" && a.status !== "in_progress") return 1;
        return new Date(a.startsAt) - new Date(b.startsAt);
      }),
    [occurrences],
  );

  const visibleOccurrences = useMemo(() => {
    if (activeView === "history") {
      return sortedOccurrences
        .filter((item) => CLOSED_STATUSES.has(item.status))
        .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
    }

    if (activeView === "today") {
      return sortedOccurrences.filter(
        (item) => ACTIVE_STATUSES.has(item.status) && isSameLocalDay(item.startsAt),
      );
    }

    return sortedOccurrences.filter((item) => ACTIVE_STATUSES.has(item.status));
  }, [activeView, sortedOccurrences]);

  const activeNow = occurrences.filter(
    (item) => item.status === "in_progress" || item.status === "check_in_open",
  ).length;

  const upcoming = occurrences.filter(
    (item) => ACTIVE_STATUSES.has(item.status) && new Date(item.startsAt) > new Date(),
  ).length;

  const waitingAttendance = bookings.filter((booking) => {
    if ((booking.attendance?.status || "booked") !== "booked") return false;
    const occurrence = occurrences.find(
      (item) => idOf(item._id) === idOf(booking.occurrence),
    );
    return occurrence?.status === "in_progress";
  }).length;

  const listingTasks = [
    ...trips
      .filter(
        (trip) =>
          trip.lifecycleStatus === "draft" &&
          ["not_submitted", "changes_requested"].includes(trip.reviewStatus),
      )
      .map((trip) => ({ type: "trip", item: trip })),
    ...revisions
      .filter((revision) =>
        ["draft", "changes_requested"].includes(revision.reviewStatus),
      )
      .map((revision) => ({ type: "revision", item: revision })),
  ];

  const runAction = async (key, path, payload = {}, successMessage = "Updated.") => {
    setBusyAction(key);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/marketplace/${path}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice(successMessage);
      await load();
      return true;
    } catch (requestError) {
      setError(requestError.message || "Unable to complete that action.");
      return false;
    } finally {
      setBusyAction("");
    }
  };

  const handleCancel = async (occurrenceId) => {
    if (cancelReason.trim().length < 3) {
      setError("Add a short cancellation reason before cancelling this experience.");
      return;
    }

    const ok = await runAction(
      `cancel:${occurrenceId}`,
      `occurrences/${occurrenceId}/actions/cancel`,
      { reason: cancelReason.trim() },
      "Experience cancelled. Affected travelers will receive an update.",
    );

    if (ok) {
      setCancelOpenId("");
      setCancelReason("");
    }
  };

  const quality = data.quality || {};
  const surveyCount = Number(quality.surveyCount || 0);

  if (loading) {
    return (
      <section className={styles.stateCard} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        <h1>Loading operations…</h1>
        <p>Getting your scheduled experiences and traveler roster.</p>
      </section>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
            <Activity size={15} /> Guide workspace · Operations
          </span>
          <h1>Run your experiences</h1>
          <p>
            Start scheduled experiences, manage attendance, finish the day, and
            handle the few listing tasks that need your attention.
          </p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={load}
          disabled={Boolean(busyAction)}
        >
          <RefreshCw size={17} /> Refresh
        </button>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {notice && (
        <div className={styles.successBanner} role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}

      <section className={styles.summaryGrid} aria-label="Operations summary">
        <SummaryCard
          icon={Activity}
          label="Active now"
          value={activeNow}
          helper="Started or ready for check-in"
        />
        <SummaryCard
          icon={CalendarClock}
          label="Upcoming"
          value={upcoming}
          helper="Scheduled experiences ahead"
        />
        <SummaryCard
          icon={UserCheck}
          label="Attendance"
          value={waitingAttendance}
          helper="Travelers waiting to be marked"
        />
        <SummaryCard
          icon={Star}
          label="Quality feedback"
          value={surveyCount}
          helper="Private surveys received"
        />
      </section>

      <section className={styles.operationsSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.sectionKicker}>Schedule & attendance</span>
            <h2>Experience control room</h2>
            <p>Only operational actions for scheduled experiences live here.</p>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Experience status">
            {[
              ["active", "Active & upcoming"],
              ["today", "Today"],
              ["history", "History"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeView === value}
                data-active={activeView === value || undefined}
                onClick={() => setActiveView(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visibleOccurrences.length === 0 ? (
          <div className={styles.emptyState}>
            <CalendarClock size={26} />
            <h3>
              {activeView === "history"
                ? "No completed experiences yet"
                : "Nothing needs operating right now"}
            </h3>
            <p>
              {activeView === "history"
                ? "Completed and cancelled occurrences will appear here."
                : "Your upcoming scheduled experiences will appear here automatically."}
            </p>
            <Link to="/guide/calendar">Open calendar</Link>
          </div>
        ) : (
          <div className={styles.occurrenceList}>
            {visibleOccurrences.map((occurrence) => {
              const occurrenceId = idOf(occurrence._id);
              const trip = tripById.get(idOf(occurrence.trip));
              const roster = bookingsByOccurrence.get(occurrenceId) || [];
              const startsAt = new Date(occurrence.startsAt);
              const endsAt = new Date(occurrence.endsAt);
              const noShowAllowed = Date.now() >= +startsAt + 30 * 60 * 1000;
              const endAllowed = Date.now() >= +endsAt;
              const checkedIn = roster.filter(
                (booking) => booking.attendance?.status === "checked_in",
              ).length;

              return (
                <article
                  key={occurrenceId}
                  className={styles.occurrenceCard}
                  data-live={occurrence.status === "in_progress" || undefined}
                >
                  <div className={styles.occurrenceHeader}>
                    <div className={styles.occurrenceIdentity}>
                      <span className={styles.occurrenceIcon}>
                        <MapPinned size={20} />
                      </span>
                      <div>
                        <div className={styles.titleRow}>
                          <h3>{trip?.title || "Experience"}</h3>
                          <StatusBadge status={occurrence.status} />
                        </div>
                        <p>
                          <CalendarClock size={15} />
                          {formatDate(occurrence.startsAt)} · {formatTime(occurrence.startsAt)}
                          {" – "}
                          {formatTime(occurrence.endsAt)}
                        </p>
                      </div>
                    </div>

                    <div className={styles.capacityStat}>
                      <Users size={17} />
                      <span>
                        <strong>{roster.length}</strong>
                        <small> / {occurrence.capacity || "—"} booked</small>
                      </span>
                    </div>
                  </div>

                  {occurrence.status === "in_progress" && (
                    <div className={styles.liveStrip}>
                      <Activity size={17} />
                      <span>
                        Experience in progress · {checkedIn} of {roster.length} travelers checked in
                      </span>
                    </div>
                  )}

                  <div className={styles.occurrenceActions}>
                    {["upcoming", "check_in_open"].includes(occurrence.status) && (
                      <>
                        <button
                          type="button"
                          className={styles.primaryAction}
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            runAction(
                              `start:${occurrenceId}`,
                              `occurrences/${occurrenceId}/actions/start`,
                              {},
                              "Experience started. Attendance controls are now open.",
                            )
                          }
                        >
                          <Play size={17} />
                          {busyAction === `start:${occurrenceId}`
                            ? "Starting…"
                            : "Start experience"}
                        </button>

                        <button
                          type="button"
                          className={styles.dangerTextAction}
                          disabled={Boolean(busyAction)}
                          onClick={() => {
                            setCancelOpenId(
                              cancelOpenId === occurrenceId ? "" : occurrenceId,
                            );
                            setCancelReason("");
                            setError("");
                          }}
                        >
                          <XCircle size={17} /> Cancel occurrence
                        </button>
                      </>
                    )}

                    {occurrence.status === "in_progress" && (
                      <button
                        type="button"
                        className={styles.primaryAction}
                        disabled={Boolean(busyAction) || !endAllowed}
                        title={
                          endAllowed
                            ? "Complete this experience"
                            : `Available after ${formatTime(occurrence.endsAt)}`
                        }
                        onClick={() =>
                          runAction(
                            `end:${occurrenceId}`,
                            `occurrences/${occurrenceId}/actions/end`,
                            {},
                            "Experience completed.",
                          )
                        }
                      >
                        <Square size={16} />
                        {busyAction === `end:${occurrenceId}`
                          ? "Ending…"
                          : endAllowed
                            ? "End experience"
                            : `End after ${formatTime(occurrence.endsAt)}`}
                      </button>
                    )}
                  </div>

                  {cancelOpenId === occurrenceId && (
                    <div className={styles.cancelPanel}>
                      <div>
                        <strong>Cancel this scheduled experience?</strong>
                        <p>
                          Confirmed travelers will be cancelled and notified. Add a
                          clear operational reason.
                        </p>
                      </div>
                      <textarea
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                        maxLength={1000}
                        placeholder="Example: Guide illness or venue unexpectedly closed."
                      />
                      <div className={styles.cancelActions}>
                        <button
                          type="button"
                          onClick={() => {
                            setCancelOpenId("");
                            setCancelReason("");
                          }}
                        >
                          Keep experience
                        </button>
                        <button
                          type="button"
                          className={styles.dangerAction}
                          disabled={
                            Boolean(busyAction) || cancelReason.trim().length < 3
                          }
                          onClick={() => handleCancel(occurrenceId)}
                        >
                          {busyAction === `cancel:${occurrenceId}`
                            ? "Cancelling…"
                            : "Confirm cancellation"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={styles.rosterSection}>
                    <div className={styles.rosterHeading}>
                      <div>
                        <h4>Traveler roster</h4>
                        <p>
                          Attendance is available only while an experience is in progress.
                        </p>
                      </div>
                      <span>{roster.length} traveler{roster.length === 1 ? "" : "s"}</span>
                    </div>

                    {roster.length === 0 ? (
                      <div className={styles.rosterEmpty}>
                        No confirmed travelers on this occurrence.
                      </div>
                    ) : (
                      <div className={styles.rosterList}>
                        {roster.map((booking) => {
                          const bookingId = idOf(booking._id);
                          const travelerName =
                            booking.traveler?.fullName ||
                            `Traveler · ${idOf(booking.tourist).slice(-6)}`;
                          const avatar = booking.traveler?.avatar
                            ? resolveMediaUrl(booking.traveler.avatar)
                            : "";
                          const attendance = booking.attendance?.status || "booked";

                          return (
                            <div className={styles.rosterRow} key={bookingId}>
                              <div className={styles.traveler}>
                                {avatar ? (
                                  <img src={avatar} alt="" aria-hidden="true" />
                                ) : (
                                  <span className={styles.avatarFallback}>
                                    {getInitials(travelerName)}
                                  </span>
                                )}
                                <div>
                                  <strong>{travelerName}</strong>
                                  <small>
                                    Booking {bookingId.slice(-6).toUpperCase()} ·{" "}
                                    {booking.paymentStatus === "paid" ? "Paid" : humanize(booking.paymentStatus)}
                                  </small>
                                </div>
                              </div>

                              <div className={styles.attendanceCell}>
                                <StatusBadge status={attendance} />

                                {occurrence.status === "in_progress" &&
                                  attendance === "booked" && (
                                    <div className={styles.attendanceActions}>
                                      <button
                                        type="button"
                                        className={styles.checkInAction}
                                        disabled={Boolean(busyAction)}
                                        onClick={() =>
                                          runAction(
                                            `checkin:${bookingId}`,
                                            `bookings/${bookingId}/attendance/check_in`,
                                            {},
                                            `${travelerName} checked in.`,
                                          )
                                        }
                                      >
                                        <UserCheck size={16} />
                                        {busyAction === `checkin:${bookingId}`
                                          ? "Saving…"
                                          : "Check in"}
                                      </button>

                                      <button
                                        type="button"
                                        className={styles.noShowAction}
                                        disabled={Boolean(busyAction) || !noShowAllowed}
                                        title={
                                          noShowAllowed
                                            ? "Mark traveler as no-show"
                                            : `Available 30 minutes after ${formatTime(occurrence.startsAt)}`
                                        }
                                        onClick={() =>
                                          runAction(
                                            `noshow:${bookingId}`,
                                            `bookings/${bookingId}/attendance/no_show`,
                                            {},
                                            `${travelerName} marked as no-show.`,
                                          )
                                        }
                                      >
                                        <UserX size={16} />
                                        No show
                                      </button>
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className={styles.secondaryGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.sectionKicker}>Listings</span>
              <h2>Needs your attention</h2>
            </div>
            <Link to="/guide">
              My tours <ArrowRight size={15} />
            </Link>
          </div>

          {listingTasks.length === 0 ? (
            <div className={styles.compactEmpty}>
              <ShieldCheck size={20} />
              <span>
                <strong>No listing actions pending.</strong>
                <small>Drafts and requested revisions will appear here.</small>
              </span>
            </div>
          ) : (
            <div className={styles.taskList}>
              {listingTasks.map(({ type, item }) => {
                const itemId = idOf(item._id);
                const tripId =
                  type === "trip" ? itemId : idOf(item.trip);
                const title =
                  type === "trip"
                    ? item.title
                    : item.content?.title || tripById.get(tripId)?.title || "Experience";

                return (
                  <div className={styles.taskRow} key={`${type}:${itemId}`}>
                    <div>
                      <strong>{title}</strong>
                      <small>
                        {type === "trip"
                          ? humanize(item.reviewStatus)
                          : `Revision · ${humanize(item.reviewStatus)}`}
                      </small>
                    </div>
                    <div className={styles.taskActions}>
                      <Link to={`/guide/tours/${tripId}/edit`}>Edit</Link>
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() =>
                          runAction(
                            `${type}:${itemId}`,
                            type === "trip"
                              ? `trips/${itemId}/actions/submit`
                              : `revisions/${itemId}/actions/submit`,
                            {},
                            "Submitted for review.",
                          )
                        }
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.sectionKicker}>Private feedback</span>
              <h2>Experience quality</h2>
            </div>
          </div>

          <div className={styles.qualityIntro}>
            <Star size={21} />
            <div>
              <strong>{surveyCount} private survey{surveyCount === 1 ? "" : "s"}</strong>
              <p>
                Quality aggregates appear after five responses to protect traveler privacy.
              </p>
            </div>
          </div>

          {quality.metrics ? (
            <div className={styles.metricList}>
              {Object.entries(quality.metrics).map(([name, value]) => (
                <div key={name}>
                  <span>{humanize(name)}</span>
                  <strong>{value === null ? "—" : `${Number(value).toFixed(1)}/5`}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.qualityLocked}>
              <Clock3 size={18} />
              <span>
                {Math.max(0, 5 - surveyCount)} more response
                {Math.max(0, 5 - surveyCount) === 1 ? "" : "s"} needed for aggregates.
              </span>
            </div>
          )}
        </section>
      </div>

      <section className={styles.dangerZone}>
        <button
          type="button"
          className={styles.dangerToggle}
          aria-expanded={showAccountClosure}
          onClick={() => setShowAccountClosure((current) => !current)}
        >
          <AlertTriangle size={18} />
          <span>
            <strong>Account closure</strong>
            <small>Only use this when you intend to stop using your guide account.</small>
          </span>
          <span>{showAccountClosure ? "Hide" : "Open"}</span>
        </button>

        {showAccountClosure && (
          <div className={styles.dangerContent}>
            <p>
              Requesting deletion disables normal access. Existing bookings and
              financial records remain preserved while outstanding obligations are resolved.
            </p>
            <button
              type="button"
              className={styles.dangerAction}
              disabled={Boolean(busyAction)}
              onClick={() =>
                runAction(
                  "account-close",
                  "accounts/me/actions/request_deletion",
                  {},
                  "Account closure requested.",
                )
              }
            >
              {busyAction === "account-close"
                ? "Requesting…"
                : "Request account closure"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
