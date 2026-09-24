import { useState } from "react";
import { BadgeCheck, Clock3, Heart, ImageOff, MapPin, Star, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useSavedTrips } from "@/context/useSavedTrips";
import { resolveUploadsUrl } from "@/services/api";
import PriceDisplay from "@/shared/components/PriceDisplay/PriceDisplay";

import styles from "./ExperienceCard.module.css";

const MONGO_ID = /^[a-f0-9]{24}$/i;


const getGuideName = (guide, guideName) => {
  if (guideName) return guideName;
  if (typeof guide === "string") return guide;
  return guide?.fullName || guide?.name || "Local guide";
};

function ExperienceCard({
  id,
  _id,
  image,
  title,
  location = "Egypt",
  duration,
  groupSize,
  rating = 0,
  reviewsCount,
  price = 0,
  currency = "EGP",
  category,
  badge,
  guide,
  guideName,
  verified = false,
  instantConfirmation = false,
  fallbackPath = "/trips",
  onOpen,
  className = "",
}) {
  const navigate = useNavigate();
  const { savedIds, toggleSaved } = useSavedTrips();
  const [failedImage, setFailedImage] = useState(null);

  const tripId = id || _id;
  const canUseTripRoute = MONGO_ID.test(String(tripId || ""));
  const isSaved = savedIds?.has?.(String(tripId));
  const resolvedImage = typeof image === "string" ? resolveUploadsUrl(image) || image : image;
  const displayGuide = getGuideName(guide, guideName);
  const displayRating = Number(rating);

  const imageFailed = failedImage === resolvedImage;

  const openCard = () => {
    if (onOpen) return onOpen(tripId);
    navigate(canUseTripRoute ? `/trips/${tripId}` : fallbackPath);
  };

  const saveCard = async (event) => {
    event.stopPropagation();
    if (!canUseTripRoute) return;
    await toggleSaved(tripId);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCard();
    }
  };

  return (
    <article
      className={`${styles.card} ${className}`.trim()}
      onClick={openCard}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`View ${title}`}
    >
      <div className={styles.media}>
        {resolvedImage && !imageFailed ? (
          <img
            src={resolvedImage}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={() => setFailedImage(resolvedImage)}
          />
        ) : (
          <div className={styles.placeholder} aria-label="Experience image unavailable">
            <ImageOff size={26} aria-hidden="true" />
          </div>
        )}

        <div className={styles.topRow}>
          <span className={styles.category}>{category || badge || "Experience"}</span>
          <button
            type="button"
            className={styles.saveButton}
            onClick={saveCard}
            disabled={!canUseTripRoute}
            aria-label={isSaved ? "Remove from saved" : "Save experience"}
          >
            <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
          </button>
        </div>

        {instantConfirmation && (
          <span className={styles.instantBadge}>Instant confirmation</span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.primaryMeta}>
          <span><MapPin size={14} /> {location}</span>
          <span className={styles.rating}>
            <Star size={14} fill={displayRating > 0 ? "currentColor" : "none"} />
            {displayRating > 0 ? displayRating.toFixed(1) : "New"}
            {reviewsCount ? <small>({reviewsCount})</small> : null}
          </span>
        </div>

        <h3>{title}</h3>

        <div className={styles.guideRow}>
          <span className={styles.guideName}>{displayGuide}</span>
          {verified && (
            <span className={styles.verified}><BadgeCheck size={14} /> Verified guide</span>
          )}
        </div>

        {(duration || groupSize) && (
          <div className={styles.details}>
            {duration && <span><Clock3 size={14} /> {duration}</span>}
            {groupSize && <span><Users size={14} /> Group up to {groupSize}</span>}
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.price}>
            <span>From</span>
            <PriceDisplay amount={price} currency={currency} suffix="/ person" />
          </div>
          <span className={styles.viewLink}>View details</span>
        </div>
      </div>
    </article>
  );
}

export default ExperienceCard;
