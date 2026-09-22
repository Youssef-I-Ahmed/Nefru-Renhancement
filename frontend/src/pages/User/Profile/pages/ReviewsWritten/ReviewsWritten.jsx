import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Edit3, MessageSquareText, Star, Trash2, X } from "lucide-react";

import { apiRequest, resolveUploadsUrl } from "@/services/api";

import styles from "./ReviewsWrittenPremium.module.css";

const emptyDraft = { rating: 5, title: "", comment: "", survey: {overall:5,knowledge:5,communication:5,punctuality:5,safety:5,value:5,matchedListing:5,privateFeedback:""} };

function Stars({ value, interactive = false, onChange }) {
  return (
    <div className={styles.stars} aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const rating = index + 1;
        const active = rating <= Number(value || 0);
        if (!interactive) {
          return <Star key={rating} size={17} fill={active ? "currentColor" : "none"} />;
        }
        return (
          <button
            key={rating}
            type="button"
            data-active={active || undefined}
            onClick={() => onChange?.(rating)}
            aria-label={`${rating} stars`}
          >
            <Star size={22} fill={active ? "currentColor" : "none"} />
          </button>
        );
      })}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ReviewsWritten() {
  const [reviews, setReviews] = useState([]);
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [editingReview, setEditingReview] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/reviews/me");
      setReviews(response?.data?.reviews || []);
      setEligibleBookings(response?.data?.eligibleBookings || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load your reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const hasActivity = reviews.length > 0 || eligibleBookings.length > 0;
  const reviewCountLabel = useMemo(
    () => `${reviews.length} ${reviews.length === 1 ? "review" : "reviews"} shared`,
    [reviews.length],
  );

  const openNewReview = (booking) => {
    setEditingReview(null);
    setActiveBooking(booking);
    setDraft(emptyDraft);
    setError("");
    setSuccess("");
  };

  const openEdit = (review) => {
    setActiveBooking(null);
    setEditingReview(review);
    setDraft({ rating: review.rating || 5, title: review.title || "", comment: review.comment || "" });
    setError("");
    setSuccess("");
  };

  const closeForm = () => {
    setActiveBooking(null);
    setEditingReview(null);
    setDraft(emptyDraft);
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (draft.comment.trim().length < 10) {
      setError("Tell us a little more — reviews need at least 10 characters.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editingReview) {
        await apiRequest(`/reviews/${editingReview.id}`, {
          method: "PATCH",
          body: JSON.stringify(draft),
        });
        setSuccess("Your review was resubmitted for moderation.");
      } else {
        await apiRequest("/reviews", {
          method: "POST",
          body: JSON.stringify({ ...draft, bookingId: activeBooking.bookingId }),
        });
        setSuccess("Thanks — your review is awaiting moderation.");
      }
      closeForm();
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to save your review.");
    } finally {
      setSaving(false);
    }
  };

  const removeReview = async (review) => {
    if (!window.confirm(`Withdraw your review for ${review.tripTitle}?`)) return;
    setError("");
    try {
      await apiRequest(`/reviews/${review.id}`, { method: "DELETE" });
      setSuccess("Review withdrawn. History is preserved.");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to withdraw your review.");
    }
  };

  const formTrip = activeBooking || editingReview;

  return (
    <div className={styles.pageContent}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Traveler feedback</span>
          <h1>Your reviews</h1>
          <p>Reviews require a paid, completed experience with confirmed attendance.</p>
        </div>
        {!loading && hasActivity && <span className={styles.count}>{reviewCountLabel}</span>}
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {success && <p className={styles.success} role="status">{success}</p>}

      {formTrip && (
        <section className={styles.formCard} aria-label={editingReview ? "Edit review" : "Write review"}>
          <div className={styles.formHeader}>
            <div>
              <span>{editingReview ? "Edit your review" : "Share your experience"}</span>
              <h2>{editingReview ? editingReview.tripTitle : activeBooking.title}</h2>
              <p>{editingReview ? editingReview.guideName : activeBooking.guideName}</p>
            </div>
            <button type="button" className={styles.closeButton} onClick={closeForm} aria-label="Close review form"><X size={18} /></button>
          </div>

          <form onSubmit={submitReview}>
            <label className={styles.ratingField}>
              <span>Your rating</span>
              <Stars value={draft.rating} interactive onChange={(rating) => setDraft((current) => ({ ...current, rating }))} />
            </label>
            <label>
              <span>Short title <small>(optional)</small></span>
              <input value={draft.title} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="What stood out?" />
            </label>
            <label>
              <span>Your review</span>
              <textarea value={draft.comment} maxLength={1500} onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))} placeholder="Tell future travelers what made this experience useful, memorable, or different." />
              <small className={styles.characterCount}>{draft.comment.length}/1500</small>
            </label>
            {!editingReview && <fieldset><legend>Private feedback to NEFRU</legend><p>These answers are confidential and are not shown to guides or published.</p>{['overall','knowledge','communication','punctuality','safety','value','matchedListing'].map(key=><label key={key}>{key}<select value={draft.survey?.[key]||5} onChange={e=>setDraft(prev=>({...prev,survey:{...prev.survey,[key]:Number(e.target.value)}}))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}<label>Private feedback<textarea maxLength={4000} value={draft.survey?.privateFeedback||''} onChange={e=>setDraft(prev=>({...prev,survey:{...prev.survey,privateFeedback:e.target.value}}))}/></label></fieldset>}
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeForm}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? "Saving…" : editingReview ? "Save changes" : "Submit review"}</button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <section className={styles.emptyCard}>Loading your review history…</section>
      ) : !hasActivity ? (
        <section className={styles.emptyCard}>
          <div className={styles.emptyIcon}><MessageSquareText size={28} /></div>
          <h2>No reviews yet</h2>
          <p>After your paid experience is completed and your attendance is confirmed, you can submit a review within 14 days.</p>
        </section>
      ) : (
        <>
          {eligibleBookings.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div><span className={styles.eyebrow}>Ready for feedback</span><h2>Completed experiences to review</h2></div>
                <span>{eligibleBookings.length}</span>
              </div>
              <div className={styles.eligibleGrid}>
                {eligibleBookings.map((booking) => (
                  <article key={booking.bookingId} className={styles.eligibleCard}>
                    {booking.image ? <img src={resolveUploadsUrl(booking.image)} alt={booking.title} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className={styles.imageFallback} />}
                    <div>
                      <span className={styles.verifiedBadge}><CalendarCheck size={14} /> Completed booking</span>
                      <h3>{booking.title}</h3>
                      <p>{booking.guideName} · {formatDate(booking.completedAt)}</p>
                      <button type="button" onClick={() => openNewReview(booking)}><Star size={16} /> Write review</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {reviews.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Review history</span><h2>Reviews you&apos;ve shared</h2></div></div>
              <div className={styles.reviewList}>
                {reviews.map((review) => (
                  <article key={review.id} className={styles.reviewCard}>
                    <div className={styles.reviewTop}>
                      <div>
                        {review.isVerifiedBooking === true && (
                          <span className={styles.verifiedBadge}>Verified booking</span>
                        )}
                        <h3>{review.tripTitle}</h3><small>{review.moderationStatus?.replaceAll("_", " ")}</small>
                        <p>With {review.guideName} · {formatDate(review.createdAt)}</p>
                      </div>
                      <Stars value={review.rating} />
                    </div>
                    {review.title && <h4>{review.title}</h4>}
                    <p className={styles.reviewText}>{review.comment}</p>
                    {review.guideResponse && <div className={styles.guideResponse}><strong>Guide response</strong><p>{review.guideResponse}</p></div>}
                    <div className={styles.reviewActions}>
                      <button type="button" onClick={() => openEdit(review)}><Edit3 size={15} /> Edit</button>
                      <button type="button" className={styles.deleteButton} onClick={() => removeReview(review)}><Trash2 size={15} /> Withdraw</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
