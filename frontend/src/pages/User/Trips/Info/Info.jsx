import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Heart,
  MapPin,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import { getTourById } from "../../api";
import { resolveMediaUrl } from "@/services/api";
import { useSavedTrips } from "@/context/useSavedTrips";
import PremiumFooter from "@/pages/User/Home/PremiumFooter";
import PriceDisplay from "@/shared/components/PriceDisplay/PriceDisplay";
import fallbackImage from "@/assets/images/explore/pyramids.jpg";
import fallbackGuide from "@/assets/images/user/user1.png";

import styles from "./Info.module.css";


const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", weekday: "short" }).format(date);
};

const formatTime = (value) => {
  if (!value) return "";
  const [hour, minute] = String(value).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return String(value);
  const date = new Date(2026, 0, 1, hour, minute);
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
};

const getMedia = (value, fallback = "") => resolveMediaUrl(value) || fallback;

function Info() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { savedIds, toggleSaved } = useSavedTrips();

  const [tour, setTour] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [shareStatus, setShareStatus] = useState("");

  const loadTrip = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getTourById(id);
      if (response?.error) throw new Error(response.error);
      if (!response?.data) throw new Error("Trip not found");
      setTour(response.data);
    } catch (err) {
      setError(err?.message || "Failed to load this experience.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(loadTrip, 0);
    return () => clearTimeout(timer);
  }, [loadTrip]);

  const gallery = useMemo(() => {
    if (!tour) return [fallbackImage];
    const values = [tour.image, ...(Array.isArray(tour.gallery) ? tour.gallery : [])]
      .map((item) => getMedia(item))
      .filter(Boolean);
    return [...new Set(values.length ? values : [fallbackImage])];
  }, [tour]);

  const dates = tour?.schedule?.dates || [];
  const slots = tour?.schedule?.slots || [];
  const nextDates = dates.slice(0, 3);
  const nextSlot = slots[0];
  const saved = savedIds.has(String(id));
  const isActive = tour?.status === "active";
  const guideImage = getMedia(tour?.guide?.avatar, fallbackGuide);

  const handleShare = async () => {
    const shareData = {
      title: tour?.title || "NEFRU experience",
      text: tour?.description || "Discover this Egypt experience on NEFRU.",
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus("Link copied");
        window.setTimeout(() => setShareStatus(""), 1800);
      }
    } catch (err) {
      if (err?.name !== "AbortError") setShareStatus("Unable to share");
    }
  };

  if (loading) {
    return (
      <main className={styles.statePage} role="status">
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLineSmall} />
      </main>
    );
  }

  if (error || !tour) {
    return (
      <main className={styles.statePage}>
        <div className={styles.errorCard}>
          <span>We couldn&apos;t open this experience.</span>
          <h1>{error || "Trip not found"}</h1>
          <button type="button" onClick={() => navigate("/user/trips")}>Browse experiences</button>
        </div>
      </main>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Back to experiences
          </button>
          <div className={styles.topActions}>
            <button type="button" onClick={handleShare}>
              <Share2 size={17} /> {shareStatus || "Share"}
            </button>
            <button type="button" onClick={() => toggleSaved(id)} data-saved={saved || undefined}>
              <Heart size={17} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        <section className={styles.gallery} data-single={gallery.length === 1 || undefined} aria-label={`${tour.title} photos`}>
          <button type="button" className={styles.mainImage} onClick={() => setActiveImage(0)}>
            <img src={gallery[activeImage] || gallery[0]} alt={tour.title} fetchPriority="high" decoding="async" />
          </button>
          {gallery.length > 1 && (
            <div className={styles.galleryRail}>
              {gallery.slice(0, 4).map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  className={styles.thumb}
                  data-active={activeImage === index || undefined}
                  onClick={() => setActiveImage(index)}
                >
                  <img src={image} alt={`${tour.title} view ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} />
                </button>
              ))}
            </div>
          )}
        </section>

        <div className={styles.layout}>
          <div className={styles.contentColumn}>
            <section className={styles.intro}>
              <div className={styles.chips}>
                <span>{tour.category || "Experience"}</span>
                {tour.guide?.verified && <span className={styles.verifiedChip}><BadgeCheck size={14} /> Verified guide</span>}
                {isActive && <span className={styles.instantChip}><Sparkles size={14} /> Available to book</span>}
              </div>

              <h1>{tour.title}</h1>

              <div className={styles.metaRow}>
                <span><Star size={16} fill="currentColor" /> <strong>{Number(tour.rating || 0).toFixed(1)}</strong> ({tour.reviewsCount || 0} reviews)</span>
                <span><MapPin size={16} /> {tour.location}</span>
                <span><Clock3 size={16} /> {tour.duration}</span>
                <span><Users size={16} /> Up to {tour.groupSize || 1}</span>
              </div>
            </section>

            <section className={styles.guideSection}>
              <img src={guideImage} alt={tour.guide?.name || "Local guide"} />
              <div className={styles.guideCopy}>
                <span className={styles.kicker}>Your local guide</span>
                <div className={styles.guideTitleRow}>
                  <h2>{tour.guide?.name || "Local guide"}</h2>
                  {tour.guide?.verified && <BadgeCheck size={19} aria-label="Verified guide" />}
                </div>
                <p className={styles.guideBadge}>{tour.guide?.badge || "Local expert"}</p>
                <div className={styles.guideRating}>
                  <Star size={15} fill="currentColor" /> {Number(tour.guide?.rating || 0).toFixed(1)} · {tour.guide?.reviewsCount || 0} guide reviews
                </div>
                {tour.guide?.about && <p className={styles.guideAbout}>{tour.guide.about}</p>}
                <button type="button" className={styles.inlineLink} onClick={() => navigate(`/user/trips/${id}/guide`)}>
                  View guide profile <ChevronRight size={16} />
                </button>
              </div>
            </section>

            <section className={styles.section}>
              <span className={styles.kicker}>About this experience</span>
              <h2>See more than the landmark.</h2>
              <p>{tour.description}</p>
              {tour.longDescription && tour.longDescription !== tour.description && <p>{tour.longDescription}</p>}
            </section>

            <section className={styles.detailsGrid} aria-label="Experience details">
              <div><Clock3 size={20} /><span><small>Duration</small><strong>{tour.duration}</strong></span></div>
              <div><Users size={20} /><span><small>Group size</small><strong>Up to {tour.groupSize || 1}</strong></span></div>
              <div><MapPin size={20} /><span><small>Area</small><strong>{tour.location}</strong></span></div>
              <div><ShieldCheck size={20} /><span><small>Guide</small><strong>{tour.guide?.verified ? "Verified by NEFRU" : "Local guide"}</strong></span></div>
            </section>

            {Array.isArray(tour.highlights) && tour.highlights.length > 0 && (
              <section className={styles.section}>
                <span className={styles.kicker}>Highlights</span>
                <h2>What makes this experience special</h2>
                <div className={styles.highlightList}>
                  {tour.highlights.map((item, index) => (
                    <div key={`${item.title || "highlight"}-${index}`}>
                      <CheckCircle2 size={19} />
                      <span>
                        <strong>{item.title}</strong>
                        {item.text && <small>{item.text}</small>}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(dates.length > 0 || slots.length > 0) && (
              <section className={styles.section}>
                <span className={styles.kicker}>Availability</span>
                <h2>Upcoming dates</h2>
                <div className={styles.availabilityList}>
                  {nextDates.map((date) => {
                    const dateSlots = tour.schedule?.slotsByDate?.[date] || slots.filter((slot) => slot.date === date);
                    return (
                      <div key={date} className={styles.availabilityDay}>
                        <div><CalendarDays size={18} /><strong>{formatDate(date)}</strong></div>
                        <span>{dateSlots.length ? `${dateSlots.length} time ${dateSlots.length === 1 ? "slot" : "slots"}` : "Date available"}</span>
                      </div>
                    );
                  })}
                  {!nextDates.length && nextSlot && (
                    <div className={styles.availabilityDay}>
                      <div><CalendarDays size={18} /><strong>{formatDate(nextSlot.date)}</strong></div>
                      <span>{formatTime(nextSlot.startTime)} – {formatTime(nextSlot.endTime)}</span>
                    </div>
                  )}
                </div>
                <p className={styles.availabilityNote}>Choose the exact date and time during booking. Each account reserves one place for its account holder.</p>
              </section>
            )}

            <section className={styles.section}>
              <span className={styles.kicker}>Guest reviews</span>
              <div className={styles.reviewHeading}>
                <h2>What travelers say</h2>
                <span><Star size={16} fill="currentColor" /> {Number(tour.rating || 0).toFixed(1)} · {tour.reviewsCount || 0} reviews</span>
              </div>

              {Array.isArray(tour.reviews) && tour.reviews.length > 0 ? (
                <div className={styles.reviewsGrid}>
                  {tour.reviews.slice(0, 4).map((review, index) => (
                    <article key={`${review.name || "review"}-${index}`} className={styles.reviewCard}>
                      <div className={styles.reviewAuthor}>
                        <img src={getMedia(review.avatar, fallbackGuide)} alt="" aria-hidden="true" />
                        <span><strong>{review.name}</strong><small>{review.date}</small></span>
                      </div>
                      <div className={styles.reviewStars} aria-label={`${review.rating || 0} out of 5 stars`}>
                        {Array.from({ length: Math.max(0, Math.min(5, Number(review.rating || 0))) }).map((_, star) => <Star key={star} size={14} fill="currentColor" />)}
                      </div>
                      <p>{review.text}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.noReviews}>This experience does not have guest reviews yet.</div>
              )}
            </section>
          </div>

          <aside className={styles.bookingCard} aria-label="Booking summary">
            <span className={styles.bookingKicker}>From</span>
            <div className={styles.bookingPrice}><PriceDisplay amount={tour.price} currency={tour.currency || "EGP"} suffix="/ person" /></div>
            <div className={styles.bookingFacts}>
              <span><CalendarDays size={17} /> {dates.length ? `${dates.length} upcoming ${dates.length === 1 ? "date" : "dates"}` : "Check booking availability"}</span>
              <span><Users size={17} /> Group capacity: up to {tour.groupSize || 1} travelers</span>
              {nextSlot && <span><Clock3 size={17} /> Next listed time {formatTime(nextSlot.startTime)}</span>}
            </div>
            <button
              type="button"
              className={styles.bookButton}
              onClick={() => navigate(`/user/trips/${id}/book`)}
              disabled={!isActive}
            >
              {isActive ? "Check availability" : "Currently unavailable"}
            </button>
            <div className={styles.bookingTrust}>
              <span><ShieldCheck size={16} /> Secure booking flow</span>
              {tour.guide?.verified && <span><BadgeCheck size={16} /> Verified local guide</span>}
            </div>
          </aside>
        </div>
      </main>

      <div className={styles.mobileBookingBar}>
        <div><span>From</span><PriceDisplay amount={tour.price} currency={tour.currency || "EGP"} /></div>
        <button type="button" onClick={() => navigate(`/user/trips/${id}/book`)} disabled={!isActive}>
          {isActive ? "Check availability" : "Unavailable"}
        </button>
      </div>

      <PremiumFooter />
    </div>
  );
}

export default Info;
