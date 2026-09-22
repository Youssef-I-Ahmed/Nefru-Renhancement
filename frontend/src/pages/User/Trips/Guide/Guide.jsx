import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  CalendarDays,
  Clock3,
  Globe2,
  Languages,
  MapPin,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import ExperienceCard from "@/components/ui/ExperienceCard/ExperienceCard";
import { apiRequest, resolveUploadsUrl } from "@/services/api";

import fallbackGuide from "@/assets/images/guiders/guide4.webp";
import fallbackTour from "@/assets/images/explore/pyramids.webp";
import PremiumFooter from "../../Home/PremiumFooter";
import styles from "./Guide.module.css";

const getMedia = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value !== "string") return fallback;
  return resolveUploadsUrl(value) || value || fallback;
};

const formatMemberSince = (value) => {
  if (!value) return "NEFRU local guide";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "NEFRU local guide";
  return `Member since ${date.getFullYear()}`;
};

const formatGroupSize = (value) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? `Up to ${count}` : undefined;
};

const buildFallbackGuide = (trip) => ({
  id: trip?.guide?.id || "",
  name: trip?.guide?.name || "Local guide",
  fullName: trip?.guide?.name || "Local guide",
  avatar: trip?.guide?.avatar || "",
  profileImage: trip?.guide?.avatar || "",
  heroImage: trip?.guide?.avatar || "",
  headline: trip?.guide?.badge || "Local expert guide",
  location: trip?.location || "Egypt",
  verified: Boolean(trip?.guide?.verified),
  rating: Number(trip?.guide?.rating || 0),
  reviewsCount: Number(trip?.guide?.reviewsCount || 0),
  yearsExperience: 0,
  languages: [],
  specialties: [],
  about: trip?.guide?.about || "",
  gallery: [],
  tours: trip
    ? [
        {
          id: trip.id || trip._id,
          title: trip.title,
          image: trip.image,
          duration: trip.duration,
          price: trip.price,
          currency: trip.currency || "EGP",
          location: trip.location,
          category: trip.category,
          groupSize: trip.groupSize,
          rating: trip.rating,
          reviewsCount: trip.reviewsCount,
        },
      ]
    : [],
});

function Guide() {
  const { id: tripId } = useParams();
  const navigate = useNavigate();

  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  const loadGuide = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const tripResponse = await apiRequest(`/trips/${tripId}`);
      const tripData = tripResponse?.data;
      if (!tripData) throw new Error("Experience not found.");


      const fallback = buildFallbackGuide(tripData);
      const guideRef = tripData?.guide?.profileId || tripData?.guide?.id;

      if (!guideRef) {
        setGuide(fallback);
        return;
      }

      try {
        const guideResponse = await apiRequest(`/guides/${guideRef}`);
        setGuide(guideResponse?.data?.guide || fallback);
      } catch {
        // Tour details already expose a limited public guide snapshot. Keep the page useful
        // if the guide's full public profile is unavailable or still awaiting verification.
        setGuide(fallback);
      }
    } catch (loadError) {
      setError(loadError?.message || "Unable to load this guide profile.");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    const timer = setTimeout(loadGuide, 0);
    return () => clearTimeout(timer);
  }, [loadGuide]);

  const gallery = useMemo(() => {
    if (!guide) return [];
    const candidates = [
      guide.heroImage,
      guide.avatar,
      ...(Array.isArray(guide.gallery) ? guide.gallery.map((item) => item?.src) : []),
    ]
      .filter(Boolean)
      .map((src) => getMedia(src, fallbackGuide));

    return [...new Set(candidates)].slice(0, 5);
  }, [guide]);

  const guideTours = useMemo(
    () => (Array.isArray(guide?.tours) ? guide.tours.filter((tour) => tour?.id) : []),
    [guide],
  );

  const handleShare = async () => {
    const shareData = {
      title: guide?.name ? `${guide.name} on NEFRU` : "NEFRU local guide",
      text: guide?.headline || "Meet a local guide on NEFRU.",
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
    } catch (shareError) {
      if (shareError?.name !== "AbortError") setShareStatus("Unable to share right now");
    }
  };

  if (loading) {
    return (
      <main className={styles.statePage}>
        <div className={styles.loader} />
        <strong>Meeting your local guide…</strong>
      </main>
    );
  }

  if (error || !guide) {
    return (
      <main className={styles.statePage}>
        <span className={styles.stateIcon}><Users size={24} /></span>
        <h1>Guide profile unavailable</h1>
        <p>{error || "This guide profile is not available right now."}</p>
        <button type="button" onClick={() => navigate(-1)}>Go back</button>
      </main>
    );
  }

  const heroImage = gallery[0] || getMedia(guide.avatar, fallbackGuide);
  const displayName = guide.fullName || guide.name || "Local guide";
  const displayRating = Number(guide.rating || 0);
  const experienceYears = Number(guide.yearsExperience || 0);
  const languages = Array.isArray(guide.languages) ? guide.languages.filter(Boolean) : [];
  const specialties = Array.isArray(guide.specialties) ? guide.specialties.filter(Boolean) : [];

  return (
    <>
      <main className={styles.page}>
        <div className={styles.topActions}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Back to experience
          </button>
          <button type="button" className={styles.shareButton} onClick={handleShare}>
            <Share2 size={18} /> {shareStatus || "Share"}
          </button>
        </div>

        <section className={styles.profileHero}>
          <div className={styles.heroMedia}>
            <img src={heroImage} alt={`${displayName}, local guide`} />
            <div className={styles.heroShade} />
            <span className={styles.heroLabel}><Sparkles size={15} /> Explore Egypt with a local</span>
          </div>

          <div className={styles.heroContent}>
            <div className={styles.identityRow}>
              <img
                className={styles.avatar}
                src={getMedia(guide.avatar, fallbackGuide)}
                alt={displayName}
              />
              <div>
                <span className={styles.kicker}>Your NEFRU guide</span>
                <h1>{displayName}</h1>
                <p className={styles.headline}>{guide.headline || "Local expert guide"}</p>
              </div>
            </div>

            <div className={styles.identityMeta}>
              {guide.location && <span><MapPin size={16} /> {guide.location}</span>}
              {guide.verified && <span className={styles.verified}><BadgeCheck size={16} /> Identity verified</span>}
            </div>

            <div className={styles.statsGrid}>
              <div>
                <Star size={18} fill="currentColor" />
                <strong>{displayRating > 0 ? displayRating.toFixed(1) : "New"}</strong>
                <span>{guide.reviewsCount || 0} reviews</span>
              </div>
              <div>
                <Award size={18} />
                <strong>{experienceYears > 0 ? `${experienceYears}+` : "Local"}</strong>
                <span>years experience</span>
              </div>
              <div>
                <Languages size={18} />
                <strong>{languages.length || "—"}</strong>
                <span>{languages.length === 1 ? "language" : "languages"}</span>
              </div>
              <div>
                <CalendarDays size={18} />
                <strong>{guideTours.length}</strong>
                <span>{guideTours.length === 1 ? "experience" : "experiences"}</span>
              </div>
            </div>

            <div className={styles.heroCtas}>
              <button type="button" className={styles.primaryCta} onClick={() => navigate(`/user/trips/${tripId}/book`)}>
                Book this experience
              </button>
              <button type="button" className={styles.secondaryCta} onClick={() => navigate(`/user/trips/${tripId}`)}>
                View experience
              </button>
            </div>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <section className={styles.contentSection}>
              <span className={styles.sectionKicker}>The person behind the experience</span>
              <h2>About {displayName.split(" ")[0]}</h2>
              <p className={styles.aboutText}>
                {guide.about || "This guide has not added a public biography yet."}
              </p>
              <div className={styles.memberLine}>
                <ShieldCheck size={17} /> {formatMemberSince(guide.memberSince)}
              </div>
            </section>

            {(languages.length > 0 || specialties.length > 0) && (
              <section className={styles.contentSection}>
                <span className={styles.sectionKicker}>What you can expect</span>
                <h2>Languages & specialties</h2>
                {languages.length > 0 && (
                  <div className={styles.tagGroup}>
                    <div className={styles.tagHeading}><Globe2 size={18} /> Languages</div>
                    <div className={styles.tags}>{languages.map((language) => <span key={language}>{language}</span>)}</div>
                  </div>
                )}
                {specialties.length > 0 && (
                  <div className={styles.tagGroup}>
                    <div className={styles.tagHeading}><Sparkles size={18} /> Specialties</div>
                    <div className={styles.tags}>{specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div>
                  </div>
                )}
              </section>
            )}

            {gallery.length > 1 && (
              <section className={styles.contentSection}>
                <span className={styles.sectionKicker}>A glimpse into their Egypt</span>
                <h2>Guide gallery</h2>
                <div className={styles.galleryGrid}>
                  {gallery.slice(1).map((image, index) => (
                    <img key={`${image}-${index}`} src={image} alt={`${displayName} gallery ${index + 1}`} loading="lazy" decoding="async" />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className={styles.trustCard}>
            <span className={styles.trustIcon}><ShieldCheck size={22} /></span>
            <span className={styles.sectionKicker}>Why this profile matters</span>
            <h2>Know who you are exploring with.</h2>
            <p>NEFRU puts the guide next to the experience so you can make the booking decision with more context.</p>
            <div className={styles.trustList}>
              <span><BadgeCheck size={17} /> {guide.verified ? "Verified guide identity" : "Guide identity shown clearly"}</span>
              <span><Star size={17} /> Rating and review count upfront</span>
              <span><Languages size={17} /> Languages before you book</span>
              <span><MapPin size={17} /> Local expertise and specialties</span>
            </div>
          </aside>
        </div>

        <section className={styles.toursSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.sectionKicker}>Explore with {displayName.split(" ")[0]}</span>
              <h2>Experiences by this guide</h2>
              <p>Choose the experience first, with the person leading it already clear.</p>
            </div>
          </div>

          {guideTours.length > 0 ? (
            <div className={styles.toursGrid}>
              {guideTours.map((tour) => (
                <ExperienceCard
                  key={tour.id}
                  id={tour.id}
                  image={tour.image || fallbackTour}
                  title={tour.title}
                  location={tour.location}
                  duration={tour.duration}
                  groupSize={formatGroupSize(tour.groupSize)}
                  rating={Number(tour.rating || 0)}
                  reviewsCount={tour.reviewsCount || 0}
                  price={tour.price}
                  currency={tour.currency || "EGP"}
                  category={tour.category}
                  guideName={displayName}
                  verified={Boolean(guide.verified)}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyTours}>
              <Clock3 size={22} />
              <div>
                <strong>No public experiences yet</strong>
                <span>Check back when this guide publishes a new experience.</span>
              </div>
            </div>
          )}
        </section>
      </main>
      <PremiumFooter />
    </>
  );
}

export default Guide;
