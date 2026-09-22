import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  MapPin,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiRequest, resolveMediaUrl } from "../../../services/api";
import styles from "./GuideCalendar.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

const dateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthTitle = (date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const readableDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const todayKey = () => dateKey(new Date());

function buildMonthCells(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const leading = first.getDay();
  const last = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = leading - 1; index >= 0; index -= 1) {
    const date = new Date(year, month, -index);
    cells.push({ key: dateKey(date), day: date.getDate(), muted: true });
  }
  for (let day = 1; day <= last; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ key: dateKey(date), day, muted: false });
  }
  while (cells.length % 7 !== 0) {
    const offset = cells.length - leading - last + 1;
    const date = new Date(year, month + 1, offset);
    cells.push({ key: dateKey(date), day: date.getDate(), muted: true });
  }
  return cells;
}

function mergeSlots(tours, occurrences) {
  const occurrenceMap = new Map(
    occurrences.map((item) => [`${item.tripId}:${item.occurrenceKey}`, item]),
  );

  return tours.flatMap((tour) => {
    const slots = tour?.schedule?.slots || [];
    return slots.map((slot) => {
      const occurrence = occurrenceMap.get(`${tour.id}:${slot.occurrenceKey}`);
      const bookings = occurrence?.bookings || [];
      const confirmed = bookings.filter((item) => item.status === "confirmed").length;
      const pending = bookings.filter((item) => item.status === "pending_payment").length;
      const completed = bookings.filter((item) => item.status === "completed").length;
      const paidEarnings = bookings
        .filter((item) => item.paymentStatus === "paid" && (item.currency || "EGP") === "EGP")
        .reduce((sum, item) => sum + Number(item.guideEarnings ?? item.totalPrice ?? 0), 0);
      const capacity = Number(slot.capacity || occurrence?.capacity || tour.groupSize || 1);
      const reserved = confirmed + pending;
      const status = completed > 0 && reserved === 0
        ? "completed"
        : reserved >= capacity
          ? "full"
          : reserved > 0
            ? "booked"
            : "available";

      return {
        ...slot,
        date: slot.date,
        tripId: tour.id,
        title: tour.title,
        location: tour.location,
        image: tour.image,
        capacity,
        confirmed,
        pending,
        reserved,
        paidEarnings,
        status,
      };
    });
  });
}

const statusLabel = {
  available: "Available",
  booked: "Partially booked",
  full: "Full",
  completed: "Completed",
};

export default function GuideCalendar() {
  const navigate = useNavigate();
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [filter, setFilter] = useState("all");
  const [tours, setTours] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
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
      setError(requestError.message || "Unable to load your calendar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const slots = useMemo(() => mergeSlots(tours, occurrences), [tours, occurrences]);
  const cells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);
  const slotsByDate = useMemo(() => {
    const map = new Map();
    slots.forEach((slot) => {
      if (!map.has(slot.date)) map.set(slot.date, []);
      map.get(slot.date).push(slot);
    });
    map.forEach((items) => items.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [slots]);

  const selectedSlots = useMemo(() => {
    const items = slotsByDate.get(selectedDate) || [];
    return filter === "all" ? items : items.filter((slot) => slot.status === filter);
  }, [filter, selectedDate, slotsByDate]);

  const monthPrefix = `${monthCursor.getFullYear()}-${`${monthCursor.getMonth() + 1}`.padStart(2, "0")}`;
  const monthSlots = slots.filter((slot) => slot.date?.startsWith(monthPrefix));
  const monthOccurrenceBookings = occurrences
    .filter((item) => String(item.date || "").startsWith(monthPrefix))
    .flatMap((item) => item.bookings || []);
  const monthPaid = monthOccurrenceBookings
    .filter((booking) => booking.paymentStatus === "paid" && (booking.currency || "EGP") === "EGP")
    .reduce((sum, booking) => sum + Number(booking.guideEarnings ?? booking.totalPrice ?? 0), 0);
  const monthConfirmed = monthOccurrenceBookings.filter((booking) => booking.status === "confirmed").length;
  const availableCount = monthSlots.filter((slot) => slot.status === "available").length;
  const bookedCount = monthSlots.filter((slot) => slot.status === "booked").length;
  const fullCount = monthSlots.filter((slot) => slot.status === "full").length;

  const changeMonth = (delta) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const goToday = () => {
    const now = new Date();
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey());
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Guide workspace</span>
          <h1>Calendar & availability</h1>
          <p>Your published schedule and live booking occupancy in one place.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={load} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => navigate("/guide/tours/new")}>
            Add availability
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.stats}>
        <article><span><CalendarDays size={19} /></span><div><small>Scheduled slots</small><strong>{loading ? "—" : monthSlots.length}</strong><p>{monthTitle(monthCursor)}</p></div></article>
        <article><span><UsersRound size={19} /></span><div><small>Confirmed travelers</small><strong>{loading ? "—" : monthConfirmed}</strong><p>This month</p></div></article>
        <article><span><CircleDollarSign size={19} /></span><div><small>Captured earnings</small><strong>{loading ? "—" : money.format(monthPaid)}</strong><p>Paid bookings only</p></div></article>
      </section>

      <div className={styles.layout}>
        <section className={styles.calendarCard}>
          <div className={styles.calendarToolbar}>
            <div>
              <button type="button" className={styles.iconButton} onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
              <button type="button" className={styles.iconButton} onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight /></button>
              <button type="button" className={styles.todayButton} onClick={goToday}>Today</button>
            </div>
            <h2>{monthTitle(monthCursor)}</h2>
            <div className={styles.legend}>
              <span><i data-tone="available" /> Available</span>
              <span><i data-tone="booked" /> Booked</span>
              <span><i data-tone="full" /> Full</span>
            </div>
          </div>

          <div className={styles.weekHeader}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className={styles.calendarGrid}>
            {cells.map((cell) => {
              const daySlots = slotsByDate.get(cell.key) || [];
              const tone = daySlots.some((slot) => slot.status === "full")
                ? "full"
                : daySlots.some((slot) => slot.status === "booked")
                  ? "booked"
                  : daySlots.length
                    ? "available"
                    : "empty";
              return (
                <button
                  type="button"
                  key={cell.key}
                  data-selected={selectedDate === cell.key || undefined}
                  data-muted={cell.muted || undefined}
                  className={styles.dayCell}
                  onClick={() => setSelectedDate(cell.key)}
                >
                  <span>{cell.day}</span>
                  {daySlots.length > 0 && (
                    <small data-tone={tone}>{daySlots.length} {daySlots.length === 1 ? "slot" : "slots"}</small>
                  )}
                  {cell.key === todayKey() && <b>Today</b>}
                </button>
              );
            })}
          </div>
        </section>

        <aside className={styles.agendaCard}>
          <div className={styles.agendaHeader}>
            <div><span>Selected day</span><h2>{readableDate(selectedDate)}</h2></div>
            <button type="button" onClick={() => navigate("/guide/bookings")}>Bookings</button>
          </div>

          <div className={styles.filters}>
            {["all", "available", "booked", "full"].map((value) => (
              <button type="button" key={value} data-active={filter === value || undefined} onClick={() => setFilter(value)}>
                {value === "all" ? "All" : statusLabel[value]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className={styles.empty}>Loading schedule…</div>
          ) : selectedSlots.length === 0 ? (
            <div className={styles.empty}>No matching availability on this day.</div>
          ) : (
            <div className={styles.agendaList}>
              {selectedSlots.map((slot) => (
                <article key={`${slot.tripId}:${slot.occurrenceKey}`}>
                  {slot.image ? <img src={resolveMediaUrl(slot.image)} alt="" /> : <div className={styles.imageFallback}>NEFRU</div>}
                  <div className={styles.agendaMain}>
                    <div className={styles.agendaTitleRow}><h3>{slot.title}</h3><span data-status={slot.status}>{statusLabel[slot.status]}</span></div>
                    <p><Clock3 size={14} /> {slot.startTime} – {slot.endTime}</p>
                    <p><MapPin size={14} /> {slot.location}</p>
                    <p><UsersRound size={14} /> {slot.reserved} / {slot.capacity} reserved · {slot.confirmed} confirmed{slot.pending ? ` · ${slot.pending} pending payment` : ""}</p>
                    <div className={styles.agendaActions}>
                      <button type="button" onClick={() => navigate(`/guide/tours/${slot.tripId}/schedule`)}>Edit availability</button>
                      {slot.reserved > 0 && <button type="button" onClick={() => navigate("/guide/bookings")}>Guest list</button>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className={styles.capacitySummary}>
            <div><strong>{availableCount}</strong><span>Available slots</span></div>
            <div><strong>{bookedCount}</strong><span>Partially booked</span></div>
            <div><strong>{fullCount}</strong><span>Full slots</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
