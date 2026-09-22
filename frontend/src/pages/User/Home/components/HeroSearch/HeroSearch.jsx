import { useEffect, useState } from "react";
import styles from "./HeroSearch.module.css";

import cairo from "../../../../../assets/images/hero/cairo.jpg";
import luxor from "../../../../../assets/images/hero/luxor.jpeg";
import aswan from "../../../../../assets/images/hero/aswan.jpeg";
import alexandria from "../../../../../assets/images/hero/alexandria.jpg";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { MapPin, Calendar, Users, Search, Star, ShieldCheck, Sparkles } from "lucide-react";

import SearchModal from "@/components/Search/SearchModal";

const images = [
  { src: cairo, label: "Pyramids of Giza", location: "Cairo" },
  { src: luxor, label: "Karnak & Valley of Kings", location: "Luxor" },
  { src: aswan, label: "Philae & Nile Cruise", location: "Aswan" },
  { src: alexandria, label: "Citadel of Qaitbay", location: "Alexandria" },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const GREETING_EMOJI = { "Good Morning": "☀️", "Good Afternoon": "🌤️", "Good Evening": "🌙" };

function HeroSearch() {
  const [openSearch, setOpenSearch] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const { profile } = useSelector((state) => state.auth || {});
  const fullName = profile?.fullName || "Explorer";

  const greeting = getGreeting();
  const greetingEmoji = GREETING_EMOJI[greeting];

  return (
    <section className={styles.hero} id="Home">
      <div className={styles.left}>
        <div className={styles.greetingBadge}>
          <Sparkles size={14} className={styles.sparkleIcon} />
          <span>{greeting}, {fullName} {greetingEmoji}</span>
        </div>

        <h1 className={styles.title}>
          Where do you want to
          <br />
          <span className={styles.highlightText}>explore today?</span>
        </h1>

        <p className={styles.subtitle}>
          Discover the timeless wonders of Egypt with expert Egyptologists, curated itineraries, and unforgettable luxury experiences.
        </p>

        {/* Luxury Segmented Search Bar */}
        <div className={styles.searchBar} onClick={() => setOpenSearch(true)}>
          <div className={styles.searchSegment}>
            <MapPin size={18} className={styles.segmentIcon} />
            <div className={styles.segmentText}>
              <label>Destination</label>
              <span>Search landmarks or cities</span>
            </div>
          </div>

          <div className={styles.searchDivider} />

          <div className={styles.searchSegment}>
            <Calendar size={18} className={styles.segmentIcon} />
            <div className={styles.segmentText}>
              <label>Date</label>
              <span>Choose your days</span>
            </div>
          </div>

          <div className={styles.searchDivider} />

          <div className={styles.searchSegment}>
            <Users size={18} className={styles.segmentIcon} />
            <div className={styles.segmentText}>
              <label>Travelers</label>
              <span>Add guests</span>
            </div>
          </div>

          <button
            type="button"
            className={styles.searchBtn}
            onClick={(e) => {
              e.stopPropagation();
              setOpenSearch(true);
            }}
            aria-label="Search tours"
          >
            <Search size={18} />
            <span>Search</span>
          </button>
        </div>

        {/* Popular Destinations Chips */}
        <div className={styles.destinations}>
          <span className={styles.destinationsLabel}>Popular:</span>
          <button onClick={() => navigate("/user/discover")}>Giza Pyramids</button>
          <button onClick={() => navigate("/user/discover")}>Old Cairo</button>
          <button onClick={() => navigate("/user/discover")}>Luxor Temples</button>
          <button onClick={() => navigate("/user/discover")}>Khan El-Khalili</button>
          <button onClick={() => navigate("/user/discover")}>Nile Cruise</button>
        </div>
      </div>

      {/* Hero Visual Showcase */}
      <div className={styles.right}>
        <div className={styles.imageFrame}>
          <img
            src={images[currentImage].src}
            alt={images[currentImage].label}
            className={styles.heroImage}
          />
          <div className={styles.imageOverlay} />

          <div className={styles.locationTag}>
            <MapPin size={14} />
            <span>{images[currentImage].label} • {images[currentImage].location}</span>
          </div>

          {/* Floating Glass Badge: Rating */}
          <div className={styles.ratingBadge}>
            <div className={styles.starCircle}>
              <Star size={14} fill="#EDAE49" color="#EDAE49" />
            </div>
            <div>
              <strong>4.9 ★</strong>
              <small>1,200+ Verified Reviews</small>
            </div>
          </div>

          {/* Floating Glass Badge: Guides */}
          <div className={styles.guidesBadge}>
            <div className={styles.shieldCircle}>
              <ShieldCheck size={16} color="#003D5B" />
            </div>
            <div>
              <strong>500+ Verified</strong>
              <small>Licensed Egyptologists</small>
            </div>
          </div>

          {/* Carousel dots */}
          <div className={styles.carouselDots}>
            {images.map((_, idx) => (
              <span
                key={idx}
                className={`${styles.dot} ${idx === currentImage ? styles.activeDot : ""}`}
                onClick={() => setCurrentImage(idx)}
              />
            ))}
          </div>
        </div>
      </div>

      <SearchModal
        open={openSearch}
        onOpenChange={setOpenSearch}
      />
    </section>
  );
}

export default HeroSearch;
