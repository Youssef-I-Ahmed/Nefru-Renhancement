import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { apiRequest } from "../../../services/api";
import styles from "./Schedule.module.css";

function todayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function makeSlot(overrides = {}) {
  return {
    id: overrides.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    startTime: String(overrides.startTime || "09:00").slice(0, 5),
    endTime: String(overrides.endTime || "13:00").slice(0, 5),
    capacity: Math.max(1, Number(overrides.capacity ?? overrides.maxGuests ?? overrides.availableSpots ?? 12) || 12),
  };
}

function normalizeSchedule(schedule = {}, fallbackCapacity = 12) {
  const dates = Array.isArray(schedule.dates) ? schedule.dates.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)) : [];
  const map = {};

  dates.forEach((date) => {
    const direct = schedule.slotsByDate?.[date];
    if (Array.isArray(direct) && direct.length) {
      map[date] = direct.map((slot) => makeSlot({ ...slot, capacity: slot.capacity ?? fallbackCapacity }));
    }
  });

  if (Array.isArray(schedule.slots)) {
    schedule.slots.forEach((slot) => {
      const date = slot.date || slot.dateKey;
      if (!date || !dates.includes(date) || map[date]?.length) return;
      map[date] = [...(map[date] || []), makeSlot({ ...slot, capacity: slot.capacity ?? fallbackCapacity })];
    });
  }

  dates.forEach((date) => {
    if (!map[date]?.length) map[date] = [makeSlot({ capacity: fallbackCapacity })];
  });

  return { dates: [...new Set(dates)].sort(), slotsByDate: map };
}

function readableDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Schedule() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tripId: routeTripId } = useParams();
  const tripId = routeTripId || location.state?.tripId || "";

  const [trip, setTrip] = useState(null);
  const [dates, setDates] = useState([]);
  const [slotsByDate, setSlotsByDate] = useState({});
  const [newDate, setNewDate] = useState("");
  const [loading, setLoading] = useState(Boolean(tripId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(tripId ? "" : "Missing tour reference. Open availability from My Tours.");

  useEffect(() => {
    if (!tripId) {
      return undefined;
    }

    let active = true;
    const load = async () => {
      try {
        const response = await apiRequest(`/marketplace/trips/${tripId}/edit`);
        if (!active) return;
        const nextTrip = response?.data || {};
        const normalized = normalizeSchedule(nextTrip.schedule, nextTrip.groupSize || 12);
        setTrip(nextTrip);
        setDates(normalized.dates);
        setSlotsByDate(normalized.slotsByDate);
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load availability.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [tripId]);

  const totalSlots = useMemo(
    () => dates.reduce((sum, date) => sum + (slotsByDate[date]?.length || 0), 0),
    [dates, slotsByDate],
  );

  const addDate = () => {
    if (!newDate) return;
    if (newDate < todayKey()) {
      setError("Choose today or a future date.");
      return;
    }
    if (dates.includes(newDate)) {
      setError("That date is already in your availability.");
      return;
    }

    setDates((current) => [...current, newDate].sort());
    setSlotsByDate((current) => ({
      ...current,
      [newDate]: [makeSlot({ capacity: trip?.groupSize || 12 })],
    }));
    setNewDate("");
    setError("");
  };

  const removeDate = (date) => {
    setDates((current) => current.filter((item) => item !== date));
    setSlotsByDate((current) => {
      const next = { ...current };
      delete next[date];
      return next;
    });
  };

  const addSlot = (date) => {
    setSlotsByDate((current) => ({
      ...current,
      [date]: [...(current[date] || []), makeSlot({ capacity: trip?.groupSize || 12 })],
    }));
  };

  const updateSlot = (date, slotId, field, value) => {
    setSlotsByDate((current) => ({
      ...current,
      [date]: (current[date] || []).map((slot) =>
        slot.id === slotId
          ? { ...slot, [field]: field === "capacity" ? Math.max(1, Number(value) || 1) : value }
          : slot,
      ),
    }));
  };

  const removeSlot = (date, slotId) => {
    setSlotsByDate((current) => ({
      ...current,
      [date]: (current[date] || []).filter((slot) => slot.id !== slotId),
    }));
  };

  const validate = () => {
    if (!dates.length) return "Add at least one available date.";

    for (const date of dates) {
      const slots = slotsByDate[date] || [];
      if (!slots.length) return `Add at least one time slot for ${readableDate(date)}.`;
      for (const slot of slots) {
        if (!slot.startTime || !slot.endTime) return `Complete the start and end time for ${readableDate(date)}.`;
        if (slot.endTime <= slot.startTime) return `End time must be after start time on ${readableDate(date)}.`;
        if (Number(slot.capacity) < 1) return `Capacity must be at least 1 on ${readableDate(date)}.`;
      }
    }

    return "";
  };

  const saveAndContinue = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    const flatSlots = dates.flatMap((date) =>
      (slotsByDate[date] || []).map((slot) => ({
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: Number(slot.capacity),
      })),
    );

    const cleanSlotsByDate = Object.fromEntries(
      dates.map((date) => [
        date,
        (slotsByDate[date] || []).map((slot) => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: Number(slot.capacity),
        })),
      ]),
    );

    try {
      await apiRequest(`/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify({
          schedule: { dates, slotsByDate: cleanSlotsByDate, slots: flatSlots },
        }),
      });
      navigate(`/guide/tours/${tripId}/media`);
    } catch (requestError) {
      setError(requestError.message || "Unable to save availability.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(tripId ? `/guide/tours/${tripId}/edit` : "/guide")}
        >
          <ArrowLeft size={20} /><span>Basics</span>
        </button>
        <div className={styles.topbarTitle}>
          <strong>Availability</strong>
          <small>Step 2 of 4</small>
        </div>
        <div className={styles.topbarSpacer} />
      </header>

      <main className={styles.content}>
        <section className={styles.intro}>
          <span className={styles.eyebrow}><CalendarDays size={14} /> Schedule</span>
          <h1>Choose exactly when travelers can book you.</h1>
          <p>Every account reserves one place. Capacity controls how many individual travelers can join the same time slot.</p>
        </section>

        <nav className={styles.stepper} aria-label="Experience setup progress">
          {["Basics", "Availability", "Media", "Submit"].map((label, index) => (
            <div key={label} className={`${styles.step} ${index <= 1 ? styles.stepDone : ""} ${index === 1 ? styles.stepActive : ""}`}>
              <span>{index < 1 ? <Check size={14} /> : index + 1}</span><small>{label}</small>
            </div>
          ))}
        </nav>

        {error && <div className={styles.error} role="alert">{error}</div>}

        {loading ? (
          <section className={styles.loadingCard}>Loading saved availability…</section>
        ) : !tripId ? (
          <section className={styles.loadingCard}>
            <button type="button" onClick={() => navigate("/guide")}>Return to My Tours</button>
          </section>
        ) : (
          <>
            <section className={styles.addDateCard}>
              <div>
                <h2>Add an available date</h2>
                <p>{trip?.title || "Your experience"}</p>
              </div>
              <div className={styles.dateControls}>
                <input type="date" min={todayKey()} value={newDate} onChange={(event) => setNewDate(event.target.value)} />
                <button type="button" onClick={addDate} disabled={!newDate}><Plus size={17} /> Add date</button>
              </div>
            </section>

            <section className={styles.summaryStrip}>
              <span><CalendarDays size={16} /><strong>{dates.length}</strong> dates</span>
              <span><Clock3 size={16} /><strong>{totalSlots}</strong> time slots</span>
              <span><UsersRound size={16} /><strong>{trip?.groupSize || 1}</strong> default capacity</span>
            </section>

            <div className={styles.dateList}>
              {dates.length === 0 ? (
                <section className={styles.emptyState}>
                  <CalendarDays size={28} />
                  <h2>No availability yet</h2>
                  <p>Add the first date above. You can create more than one time slot for the same day.</p>
                </section>
              ) : dates.map((date) => (
                <section className={styles.dateCard} key={date}>
                  <header className={styles.dateHeader}>
                    <div><span>Available date</span><h2>{readableDate(date)}</h2></div>
                    <button type="button" className={styles.removeDate} onClick={() => removeDate(date)}><Trash2 size={16} /> Remove date</button>
                  </header>

                  <div className={styles.slots}>
                    {(slotsByDate[date] || []).map((slot, index) => (
                      <div className={styles.slot} key={slot.id}>
                        <span className={styles.slotNumber}>{index + 1}</span>
                        <label>
                          <span>Start</span>
                          <input type="time" value={slot.startTime} onChange={(event) => updateSlot(date, slot.id, "startTime", event.target.value)} />
                        </label>
                        <label>
                          <span>End</span>
                          <input type="time" value={slot.endTime} onChange={(event) => updateSlot(date, slot.id, "endTime", event.target.value)} />
                        </label>
                        <label>
                          <span>Capacity</span>
                          <input type="number" min="1" max="100" value={slot.capacity} onChange={(event) => updateSlot(date, slot.id, "capacity", event.target.value)} />
                        </label>
                        <button type="button" className={styles.removeSlot} aria-label="Remove time slot" disabled={(slotsByDate[date] || []).length <= 1} onClick={() => removeSlot(date, slot.id)}><Trash2 size={17} /></button>
                      </div>
                    ))}
                  </div>

                  <button type="button" className={styles.addSlot} onClick={() => addSlot(date)}><Plus size={16} /> Add another time</button>
                </section>
              ))}
            </div>

            <footer className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => navigate("/guide")}>Save later</button>
              <button type="button" className={styles.primaryButton} onClick={saveAndContinue} disabled={saving}>
                {saving ? "Saving…" : "Save & add media"}{!saving && <ArrowRight size={18} />}
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
