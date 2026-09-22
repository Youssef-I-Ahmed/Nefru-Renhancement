import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiMapPin,
  FiShield,
  FiUser,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";

import { apiRequest, resolveMediaUrl } from "../../../../services/api";
import PriceDisplay from "../../../../shared/components/PriceDisplay/PriceDisplay";
import styles from "./Book.module.css";

function formatDate(dateKey) {
  if (!dateKey) return "Choose a date";
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}


export default function Book() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useSelector((state) => state.auth || {});
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedOccurrence, setSelectedOccurrence] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    apiRequest(`/bookings/trips/${id}/availability`)
      .then((response) => {
        if (!active) return;
        const next = response?.data;
        setData(next);
        const firstDate = next?.schedule?.dates?.[0] || "";
        const firstOccurrence = next?.schedule?.slotsByDate?.[firstDate]?.find((slot) => slot.bookable)?.occurrenceKey || "";
        setSelectedDate(firstDate);
        setSelectedOccurrence(firstOccurrence);
      })
      .catch((requestError) => active && setError(requestError.message || "Unable to load availability."))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [id]);

  const slots = useMemo(
    () => data?.schedule?.slotsByDate?.[selectedDate] || [],
    [data, selectedDate],
  );

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.occurrenceKey === selectedOccurrence) || null,
    [slots, selectedOccurrence],
  );

  const accountHolder =
    profile?.fullName ||
    profile?.name ||
    user?.fullName ||
    user?.name ||
    user?.email ||
    "Account holder";

  const selectDate = (date) => {
    setSelectedDate(date);
    setSelectedOccurrence(
      data?.schedule?.slotsByDate?.[date]?.find((slot) => slot.bookable)?.occurrenceKey || "",
    );
  };

  const createBooking = async () => {
    if (!selectedOccurrence || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await apiRequest("/bookings", {
        method: "POST",
        body: JSON.stringify({
          tripId: id,
          occurrenceKey: selectedOccurrence,
          specialRequest,
        }),
      });

      const booking = response?.data?.booking;
      const bookingId = booking?.bookingId || booking?.id || booking?._id;
      if (!bookingId) throw new Error("Booking was created but the checkout reference is missing.");

      navigate(
        `/user/trips/${id}/book/status?bookingId=${encodeURIComponent(bookingId)}`,
        { replace: true },
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to hold your place.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.statePage}>
        <span className={styles.loader} aria-hidden="true" />
        <strong>Checking live availability…</strong>
      </main>
    );
  }

  if (!data) {
    return <main className={styles.statePage}>{error || "Trip availability is unavailable."}</main>;
  }

  const trip = data.trip;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)} aria-label="Back to experience">
            <FiArrowLeft />
          </button>
          <div className={styles.headerCopy}>
            <span className={styles.eyebrow}><FiShield /> Secure booking</span>
            <h1>Choose your date and time.</h1>
            <p>Your NEFRU account reserves one place for you — no traveler selector is needed.</p>
          </div>
        </header>

        <div className={styles.progress} aria-label="Booking progress">
          <span className={styles.progressActive}><b>1</b> Availability</span>
          <i />
          <span><b>2</b> Payment</span>
          <i />
          <span><b>3</b> Confirmed</span>
        </div>

        <div className={styles.layout}>
          <section className={styles.bookingPanel}>
            <article className={styles.tripSummary}>
              <img src={resolveMediaUrl(trip.image)} alt={trip.title} />
              <div>
                <span className={styles.tripLabel}>Your experience</span>
                <h2>{trip.title}</h2>
                <div className={styles.meta}>
                  <span><FiMapPin /> {trip.location}</span>
                  <span><FiClock /> {trip.duration}</span>
                </div>
              </div>
            </article>

            <div className={styles.personalBooking}>
              <span className={styles.personalIcon}><FiUser /></span>
              <div>
                <strong>Personal booking · 1 traveler</strong>
                <p>This booking is for <b>{accountHolder}</b>, the signed-in account holder.</p>
              </div>
              <FiCheckCircle className={styles.personalCheck} />
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span className={styles.stepIcon}><FiCalendar /></span>
                <div>
                  <span>Step 1</span>
                  <h2>Select a date</h2>
                  <p>Only dates published by the guide can be booked.</p>
                </div>
              </div>

              {data.schedule.dates.length ? (
                <div className={styles.dateGrid}>
                  {data.schedule.dates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      className={selectedDate === date ? styles.selected : ""}
                      onClick={() => selectDate(date)}
                    >
                      <span>{new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</span>
                      <strong>{new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>No future dates are available yet.</p>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span className={styles.stepIcon}><FiClock /></span>
                <div>
                  <span>Step 2</span>
                  <h2>Select a time</h2>
                  <p>Availability below is live. One account uses one available place.</p>
                </div>
              </div>

              {slots.length ? (
                <div className={styles.slotGrid}>
                  {slots.map((slot) => (
                    <button
                      key={slot.occurrenceKey}
                      type="button"
                      disabled={!slot.bookable}
                      className={selectedOccurrence === slot.occurrenceKey ? styles.selected : ""}
                      onClick={() => setSelectedOccurrence(slot.occurrenceKey)}
                    >
                      <strong>{slot.startTime} – {slot.endTime}</strong>
                      <span>{slot.bookable ? `${slot.availableSpots} places remaining` : "Sold out"}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>No available times on this date.</p>
              )}
            </section>

            <label className={styles.requestField}>
              <span>Anything your guide should know? <small>Optional</small></span>
              <textarea
                value={specialRequest}
                maxLength={500}
                onChange={(event) => setSpecialRequest(event.target.value)}
                placeholder="Accessibility, meeting, or other useful information for your guide"
              />
              <small className={styles.characterCount}>{specialRequest.length}/500</small>
            </label>
          </section>

          <aside className={styles.pricePanel}>
            <span className={styles.summaryKicker}>Booking summary</span>
            <h2><PriceDisplay amount={trip.price} currency={trip.currency || "EGP"} suffix="/ your place" /></h2>

            <div className={styles.summaryRows}>
              <div><span><FiUser /> Traveler</span><strong>1 · Account holder</strong></div>
              <div><span><FiCalendar /> Date</span><strong>{formatDate(selectedDate)}</strong></div>
              <div><span><FiClock /> Time</span><strong>{selectedSlot ? `${selectedSlot.startTime} – ${selectedSlot.endTime}` : "Choose a time"}</strong></div>
            </div>

            <div className={styles.totalRow}>
              <span>Total</span>
              <PriceDisplay amount={trip.price} currency={trip.currency || "EGP"} />
            </div>

            <div className={styles.confirmationNote}>
              <FiCheckCircle />
              <span><strong>Instant confirmation after payment.</strong> Your confirmed booking will appear in My Bookings.</span>
            </div>

            <p className={styles.holdNote}>
              <FiLock /> Your selected place is held for {data.holdMinutes} minutes after you continue to checkout.
            </p>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="button"
              className={styles.continueButton}
              disabled={!selectedOccurrence || submitting}
              onClick={createBooking}
            >
              {submitting ? "Holding your place…" : "Continue to secure checkout"}
            </button>

            <span className={styles.secureLine}><FiShield /> Secure card payment powered by Stripe</span>
          </aside>
        </div>
      </div>
    </main>
  );
}
