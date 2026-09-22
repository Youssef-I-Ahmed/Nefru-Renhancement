import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Landmark,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
  Waves,
} from "lucide-react";

import SearchModal from "@/components/Search/SearchModal";
import ExploreSearchBar from "@/components/Search/ExploreSearchBar";
import { apiRequest, resolveUploadsUrl } from "@/services/api";
import ExperienceCard from "@/components/ui/ExperienceCard/ExperienceCard";
import PriceDisplay from "@/shared/components/PriceDisplay/PriceDisplay";

import pyramidsImg from "@/assets/images/explore/pyramids.webp";
import cairoImg from "@/assets/images/hero/cairo.jpg";
import luxorImg from "@/assets/images/hero/luxor.jpeg";
import aswanImg from "@/assets/images/hero/aswan.jpeg";
import alexandriaImg from "@/assets/images/hero/alexandria.jpg";
import museumImg from "@/assets/images/explore/the_grand_museum.webp";
import guide1 from "@/assets/images/guiders/guide1.webp";
import guide2 from "@/assets/images/guiders/guide3.webp";
import guide3 from "@/assets/images/guiders/guide4.webp";

import styles from "./PremiumHome.module.css";
import PremiumFooter from "./PremiumFooter";

const destinations = [
  { name: "Cairo", subtitle: "Culture, food & living history", image: cairoImg },
  { name: "Giza", subtitle: "Pyramids, Sphinx & ancient wonders", image: pyramidsImg },
  { name: "Luxor", subtitle: "Temples, tombs & Nile stories", image: luxorImg },
  { name: "Aswan", subtitle: "Nubian culture & river escapes", image: aswanImg },
  { name: "Alexandria", subtitle: "Mediterranean heritage", image: alexandriaImg },
];

const categories = [
  { label: "History", icon: Landmark },
  { label: "Food", icon: UtensilsCrossed },
  { label: "Nile", icon: Waves },
  { label: "Local life", icon: Users },
];

const imageFallbacks = [pyramidsImg, cairoImg, luxorImg, museumImg];

const resolveImage = (value, fallback) => {
  if (!value) return fallback;
  return resolveUploadsUrl(value) || fallback;
};

const normalizeExperience = (trip, index) => ({
  id: trip?._id || trip?.id || `experience-${index}`,
  title: trip?.title || "Experience",
  location: trip?.location || trip?.city || "Egypt",
  duration: trip?.duration || "4 hours",
  rating: Number(trip?.rating || 0),
  reviewsCount: trip?.reviewsCount || trip?.reviewCount || 0,
  price: trip?.price ?? 2300,
  currency: trip?.currency || "EGP",
  image: resolveImage(trip?.image || trip?.coverImage, imageFallbacks[index % imageFallbacks.length]),
});

const normalizeAvailable = (trip, index) => ({
  id: trip?._id || trip?.id || `available-${index}`,
  title: trip?.title || "Experience",
  location: trip?.location || "Egypt",
  timeSlot: trip?.timeSlot || trip?.duration || "Available today",
  price: trip?.price ?? 2050,
  currency: trip?.currency || "EGP",
  image: resolveImage(trip?.image || trip?.coverImage, imageFallbacks[index % imageFallbacks.length]),
});

const normalizeGuide = (guide, index) => ({
  id: guide?._id || guide?.id || `guide-${index}`,
  name: guide?.fullName || guide?.name || "Local guide",
  rating: Number(guide?.rating || 0),
  reviewsCount: guide?.reviewsCount || guide?.reviewCount || 0,
  languages: Array.isArray(guide?.languages) ? guide.languages.join(" · ") : guide?.languages || "Arabic · English",
  specialty: guide?.specialty || guide?.bio || "Local experiences",
  image: resolveImage(guide?.avatar || guide?.profileImage || guide?.heroImage, [guide1, guide2, guide3][index % 3]),
});


function PremiumHome() {
  const navigate = useNavigate();
  const [openSearch, setOpenSearch] = useState(false);
  const [homeData, setHomeData] = useState({ featuredTrips: [], availableToday: [], trustedGuides: [] });

  useEffect(() => {
    let active = true;
    const loadHome = async () => {
      try {
        const response = await apiRequest("/home");
        if (!active || !response?.data) return;
        setHomeData({
          featuredTrips: Array.isArray(response.data.featuredTrips) && response.data.featuredTrips.length ? response.data.featuredTrips.map(normalizeExperience) : [],
          availableToday: Array.isArray(response.data.availableToday) && response.data.availableToday.length ? response.data.availableToday.map(normalizeAvailable) : [],
          trustedGuides: Array.isArray(response.data.trustedGuides) && response.data.trustedGuides.length ? response.data.trustedGuides.map(normalizeGuide) : [],
        });
      } catch (error) {
        console.error("Unable to load home content.", error);
      }
    };
    loadHome();
    return () => { active = false; };
  }, []);

  const featured = useMemo(() => homeData.featuredTrips.slice(0, 4), [homeData.featuredTrips]);
  const available = useMemo(() => homeData.availableToday.slice(0, 3), [homeData.availableToday]);
  const guides = useMemo(() => homeData.trustedGuides.slice(0, 3), [homeData.trustedGuides]);

  const openExperience = (id) => {
    if (!id) return navigate("/user/trips");
    navigate(`/user/trips/${id}`);
  };

  return (
    <main className={styles.page} id="Home">
      <section className={styles.heroSection} aria-labelledby="home-hero-title">
        <div className={styles.heroMedia}>
          <img src={pyramidsImg} alt="" aria-hidden="true" loading="eager" fetchPriority="high" decoding="async" />
          <div className={styles.heroOverlay} />
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><Sparkles size={15} /> Local guides · real Egypt</span>
            <h1 id="home-hero-title">See Egypt through local eyes.</h1>
            <p>Discover authentic experiences with verified local guides, clear prices, and simple booking from the first search to the meeting point.</p>
          </div>
        </div>
        <div className={styles.heroSearch}>
          <ExploreSearchBar />
          <button type="button" className={styles.moreSearch} onClick={() => setOpenSearch(true)}>
            Browse ideas & quick destinations
          </button>
        </div>
        <div className={styles.categoryRow} aria-label="Experience categories">
          {categories.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => setOpenSearch(true)}><Icon size={18} />{label}</button>)}
        </div>
      </section>

      <section className={styles.section} id="popular-tours">
        <div className={styles.sectionHeader}><div><span className={styles.sectionKicker}>Handpicked for you</span><h2>Unforgettable experiences</h2><p>Trusted guides, strong reviews and the details you need before opening the tour.</p></div><button type="button" className={styles.textLink} onClick={() => navigate("/user/trips")}>View all <ArrowRight size={17} /></button></div>
        <div className={styles.experienceGrid}>
          {featured.map((trip) => (
            <ExperienceCard
              key={trip.id}
              id={trip.id}
              image={trip.image}
              title={trip.title}
              location={trip.location}
              duration={trip.duration}
              rating={trip.rating}
              reviewsCount={trip.reviewsCount}
              price={trip.price}
              currency={trip.currency}
              category="Experience"
              guideName="Local guide"
              onOpen={openExperience}
            />
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.softSection}`} id="explore-egypt">
        <div className={styles.sectionHeader}><div><span className={styles.sectionKicker}>Explore by destination</span><h2>Egypt, one place at a time</h2><p>Start with a city, then discover it with people who know it by heart.</p></div></div>
        <div className={styles.destinationGrid}>{destinations.map((destination) => <button key={destination.name} type="button" className={styles.destinationCard} onClick={() => setOpenSearch(true)}><img src={destination.image} alt={destination.name} loading="lazy" decoding="async" /><span className={styles.destinationShade} /><span className={styles.destinationCopy}><strong>{destination.name}</strong><small>{destination.subtitle}</small></span></button>)}</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><span className={styles.sectionKicker}>Last-minute plans</span><h2>Available today</h2><p>Book an experience that still has availability without digging through calendars.</p></div><button type="button" className={styles.textLink} onClick={() => navigate("/user/trips")}>Browse tours <ArrowRight size={17} /></button></div>
        <div className={styles.availableGrid}>{available.map((trip) => <article key={trip.id} className={styles.availableCard} onClick={() => openExperience(trip.id)}><img src={trip.image} alt={trip.title} loading="lazy" decoding="async" /><div><span className={styles.sameDay}>Available today</span><h3>{trip.title}</h3><p><MapPin size={14} /> {trip.location}</p><p><CalendarDays size={14} /> {trip.timeSlot}</p><PriceDisplay amount={trip.price} currency={trip.currency || "EGP"} /></div></article>)}</div>
      </section>

      <section className={`${styles.section} ${styles.guidesSection}`} id="top-guides">
        <div className={styles.sectionHeader}><div><span className={styles.sectionKicker}>People first</span><h2>Meet verified local guides</h2><p>Know who you are exploring with before you book.</p></div></div>
        {!guides.length && <p>No rated guides to show yet.</p>}<div className={styles.guideGrid}>{guides.map((guide) => <article key={guide.id} className={styles.guideCard}><img src={guide.image} alt={guide.name} loading="lazy" decoding="async" /><div className={styles.guideBody}><span className={styles.guideVerified}><BadgeCheck size={14} /> Verified local guide</span><h3>{guide.name}</h3><p className={styles.guideSpecialty}>{guide.specialty}</p><div className={styles.guideStats}><span><Star size={14} fill="currentColor" /> {guide.rating.toFixed(1)} · {guide.reviewsCount} reviews</span><span>{guide.languages}</span></div></div></article>)}</div>
      </section>

      <section className={styles.trustSection}><div className={styles.trustIntro}><span className={styles.sectionKicker}>Why NEFRU</span><h2>Travel with context, not just a checklist.</h2></div><div className={styles.trustGrid}><div><BadgeCheck size={22} /><strong>Verified guides</strong><span>Guide identity is reviewed. Activity credentials are checked where required.</span></div><div><ShieldCheck size={22} /><strong>Clear booking</strong><span>Pricing, availability and next steps stay easy to understand.</span></div><div><MapPin size={22} /><strong>Local by design</strong><span>Experiences are built around people, places and real local knowledge.</span></div></div></section>

      <PremiumFooter />

      <SearchModal open={openSearch} onOpenChange={setOpenSearch} />
    </main>
  );
}

export default PremiumHome;
