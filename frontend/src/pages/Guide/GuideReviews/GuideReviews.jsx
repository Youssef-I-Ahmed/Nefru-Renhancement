import {
  BadgeCheck,
  CheckCircle2,
  MessageSquareReply,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest, resolveMediaUrl } from "../../../services/api";
import styles from "./GuideReviews.module.css";

const FILTERS = [
  ["all", "All reviews"],
  ["unanswered", "Awaiting reply"],
  ["replied", "Replied"],
];

const formatDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const initials = (name = "Traveler") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function RatingStars({ value = 0 }) {
  return (
    <span className={styles.stars} aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={16}
          fill={index < Number(value) ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default function GuideReviews() {
  const [data, setData] = useState({ reviews: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [reply, setReply] = useState("");
  const [savingId, setSavingId] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await apiRequest("/reviews/guide/me");
      setData(response.data || { reviews: [], summary: {} });
    } catch (requestError) {
      setError(requestError.message || "Unable to load your published reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const reviews = useMemo(
    () => (Array.isArray(data.reviews) ? data.reviews : []),
    [data.reviews],
  );

  const visibleReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reviews.filter((review) => {
      if (filter === "unanswered" && review.guideResponse) return false;
      if (filter === "replied" && !review.guideResponse) return false;
      if (!normalizedQuery) return true;

      return [
        review.tripTitle,
        review.tripLocation,
        review.travelerName,
        review.title,
        review.comment,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [filter, query, reviews]);

  const repliedCount = reviews.filter((review) => review.guideResponse).length;
  const awaitingReply = Math.max(0, reviews.length - repliedCount);
  const summary = data.summary || {};

  const startReply = (review) => {
    setEditingId(review.id);
    setReply(review.guideResponse || "");
    setError("");
    setNotice("");
  };

  const cancelReply = () => {
    if (savingId) return;
    setEditingId("");
    setReply("");
  };

  const saveReply = async (reviewId) => {
    const trimmed = reply.trim();
    if (trimmed.length < 3) {
      setError("Your public reply must be at least 3 characters.");
      return;
    }

    setSavingId(reviewId);
    setError("");
    setNotice("");

    try {
      await apiRequest(`/reviews/guide/${reviewId}/response`, {
        method: "PATCH",
        body: JSON.stringify({ response: trimmed }),
      });
      setNotice("Your public reply has been saved.");
      setEditingId("");
      setReply("");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to save your reply.");
    } finally {
      setSavingId("");
    }
  };

  if (loading) {
    return (
      <section className={styles.loading} role="status">
        <span className={styles.spinner} />
        <h1>Loading reviews…</h1>
        <p>Getting published traveler feedback for your experiences.</p>
      </section>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Reputation & traveler feedback</span>
          <h1>Reviews</h1>
          <p>
            See published feedback from verified experiences and reply publicly
            without exposing traveler contact details or private survey answers.
          </p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={load} disabled={Boolean(savingId)}>
          <RefreshCw size={17} /> Refresh
        </button>
      </header>

      <section className={styles.stats}>
        <article>
          <span><Star size={19} /></span>
          <div>
            <small>Public rating</small>
            <strong>{Number(summary.rating || 0).toFixed(1)} / 5</strong>
            <em>{summary.reviewsCount || reviews.length} published reviews</em>
          </div>
        </article>
        <article>
          <span><MessageSquareReply size={19} /></span>
          <div>
            <small>Awaiting reply</small>
            <strong>{awaitingReply}</strong>
            <em>Published reviews without your response</em>
          </div>
        </article>
        <article>
          <span><CheckCircle2 size={19} /></span>
          <div>
            <small>Replied</small>
            <strong>{repliedCount}</strong>
            <em>Public guide responses</em>
          </div>
        </article>
      </section>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {notice && (
        <div className={styles.successBanner} role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}

      <section className={styles.controls}>
        <div className={styles.tabs} role="tablist" aria-label="Review filters">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              data-active={filter === value || undefined}
              onClick={() => setFilter(value)}
            >
              {label}
              {value === "unanswered" && awaitingReply > 0 && <span>{awaitingReply}</span>}
            </button>
          ))}
        </div>

        <label className={styles.search}>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search traveler or experience"
          />
        </label>
      </section>

      {visibleReviews.length === 0 ? (
        <section className={styles.empty}>
          <Star size={28} />
          <h2>{reviews.length ? "No reviews match this view" : "No published reviews yet"}</h2>
          <p>
            {reviews.length
              ? "Try another filter or search term."
              : "Published traveler feedback will appear here after admin moderation."}
          </p>
        </section>
      ) : (
        <section className={styles.reviewList}>
          {visibleReviews.map((review) => {
            const avatar = review.travelerAvatar
              ? resolveMediaUrl(review.travelerAvatar)
              : "";
            const editing = editingId === review.id;

            return (
              <article className={styles.reviewCard} key={review.id}>
                <div className={styles.reviewHeader}>
                  <div className={styles.traveler}>
                    {avatar ? (
                      <img src={avatar} alt="" aria-hidden="true" />
                    ) : (
                      <span className={styles.avatarFallback}>
                        {initials(review.travelerName)}
                      </span>
                    )}
                    <div>
                      <strong>{review.travelerName || "Traveler"}</strong>
                      <small>{formatDate(review.createdAt)}</small>
                    </div>
                  </div>
                  <div className={styles.rating}>
                    <RatingStars value={review.rating} />
                    <strong>{review.rating}/5</strong>
                  </div>
                </div>

                <div className={styles.experienceRow}>
                  <div>
                    <span>Experience</span>
                    <strong>{review.tripTitle}</strong>
                    <small>{review.tripLocation || "Egypt"}</small>
                  </div>
                  <Link to={`/trips/${review.tripId}`}>View experience</Link>
                </div>

                <div className={styles.reviewBody}>
                  <div className={styles.reviewMeta}>
                    {review.isVerifiedBooking && (
                      <span className={styles.verified}>
                        <BadgeCheck size={14} /> Verified experience
                      </span>
                    )}
                    <span>Published review</span>
                  </div>
                  {review.title && <h2>{review.title}</h2>}
                  <p>{review.comment}</p>
                </div>

                {review.guideResponse && !editing && (
                  <div className={styles.response}>
                    <span>YOUR PUBLIC REPLY</span>
                    <p>{review.guideResponse}</p>
                  </div>
                )}

                {editing ? (
                  <div className={styles.replyEditor}>
                    <label htmlFor={`reply-${review.id}`}>Public reply</label>
                    <textarea
                      id={`reply-${review.id}`}
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      maxLength={1000}
                      placeholder="Thank the traveler, clarify helpful context, or respond professionally…"
                    />
                    <div>
                      <small>{reply.length}/1000</small>
                      <span>
                        <button type="button" onClick={cancelReply} disabled={savingId === review.id}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={styles.saveReply}
                          onClick={() => saveReply(review.id)}
                          disabled={savingId === review.id || reply.trim().length < 3}
                        >
                          {savingId === review.id ? "Saving…" : "Publish reply"}
                        </button>
                      </span>
                    </div>
                  </div>
                ) : (
                  <footer className={styles.cardFooter}>
                    <p>
                      Your reply is public. Traveler email, phone, and private
                      survey responses are intentionally not available here.
                    </p>
                    <button type="button" onClick={() => startReply(review)}>
                      <MessageSquareReply size={16} />
                      {review.guideResponse ? "Edit reply" : "Reply publicly"}
                    </button>
                  </footer>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
