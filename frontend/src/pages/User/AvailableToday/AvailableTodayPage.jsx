import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, Clock, Star, Heart, ChevronDown, ArrowRight, Users, RotateCcw, Flame, Home, Briefcase, User } from "lucide-react";

import { apiRequest, resolveUploadsUrl } from "../../../services/api";


import styles from "./AvailableTodayPage.module.css";

import Footer from "../Home/Desktop/components/Footer/Footer";
import { useSavedTrips } from "../../../context/useSavedTrips";

// Image assets
import pyramidsImg from "../../../assets/images/explore/pyramids.jpg";
import userAvatar from "../../../assets/images/user/user1.png";

const getImgSrc = (img, fallback) => {
  if (!img) return fallback;
  return resolveUploadsUrl(img) || fallback;
};

const TIME_WINDOWS = [
  { label: "All Departure Times", value: "all" },
  { label: "🌅 Morning (8 AM - 12 PM)", value: "morning" },
  { label: "☀️ Afternoon (12 PM - 5 PM)", value: "afternoon" },
  { label: "🌇 Evening & Sunset (5 PM - 9 PM)", value: "evening" },
];

const CATEGORIES = [
  "All",
  "History",
  "Walking",
  "Nile",
  "Food",
  "Culture",
  "Safari",
];

const CITIES = [
  "All Cities",
  "Cairo",
  "Giza",
  "Luxor",
  "Aswan",
  "Alexandria",
];

const SORT_OPTIONS = [
  { label: "⚡ Starting Soonest", value: "soonest" },
  { label: "⭐ Highest Rated", value: "rating" },
  { label: "💵 Price: Low to High", value: "price_asc" },
  { label: "💎 Price: High to Low", value: "price_desc" },
  { label: "🔥 Fewest Spots Left", value: "spots" },
];

export default function AvailableTodayPage() {

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const { savedIds, toggleSaved } = useSavedTrips();

  // Filter states initialized from URL
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );
  const [selectedTime, setSelectedTime] = useState(
    searchParams.get("time") || "all"
  );
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "All"
  );
  const [selectedCity, setSelectedCity] = useState(
    searchParams.get("city") || "All Cities"
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "soonest");

  // Fetch API available tours
  useEffect(() => {
    const fetchAvailableTours = async () => {
      try {
        const response = await apiRequest("/home");
        setTours((response.data?.availableToday || []).map(t => ({
          ...t, _id: t._id || t.id, city: t.location,
          timeWindow: Number(t.startTime?.split(':')[0]) < 12 ? 'morning' : Number(t.startTime?.split(':')[0]) < 17 ? 'afternoon' : 'evening',
          startsIn: 'Scheduled today', rating: Number(t.rating || 0), reviewsCount: Number(t.reviewsCount || 0),
          groupSize: `Up to ${t.groupSize}`, image: getImgSrc(t.image, pyramidsImg), badge: 'Available today',
          guide: { name: t.guide?.fullName || 'Local guide', role: 'Experience guide', avatar: t.guide?.avatar || userAvatar }
        })));
      } catch (err) {
        console.error("Error fetching available today data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableTours();
  }, []);

  // Sync params to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedTime !== "all") params.set("time", selectedTime);
    if (selectedCategory !== "All") params.set("category", selectedCategory);
    if (selectedCity !== "All Cities") params.set("city", selectedCity);
    if (sortBy !== "soonest") params.set("sort", sortBy);
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedTime, selectedCategory, selectedCity, sortBy, setSearchParams]);

  const toggleSave = async (id, e) => {
    e.stopPropagation();
    if (!/^[a-f0-9]{24}$/i.test(String(id || ""))) return;
    await toggleSaved(id);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedTime("all");
    setSelectedCategory("All");
    setSelectedCity("All Cities");
    setSortBy("soonest");
  };

  const filteredTours = useMemo(() => {
    return tours
      .filter((tour) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = tour.title?.toLowerCase().includes(q);
          const matchesLoc = tour.location?.toLowerCase().includes(q);
          const matchesDesc = tour.description?.toLowerCase().includes(q);
          const matchesGuide = tour.guide?.name?.toLowerCase().includes(q);
          if (!matchesTitle && !matchesLoc && !matchesDesc && !matchesGuide) {
            return false;
          }
        }

        if (selectedTime !== "all" && tour.timeWindow !== selectedTime) {
          return false;
        }

        if (
          selectedCategory !== "All" &&
          !tour.category?.toLowerCase().includes(selectedCategory.toLowerCase())
        ) {
          return false;
        }

        if (
          selectedCity !== "All Cities" &&
          tour.city !== selectedCity &&
          !tour.location?.toLowerCase().includes(selectedCity.toLowerCase())
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
        if (sortBy === "price_asc") return (a.price || 0) - (b.price || 0);
        if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
        if (sortBy === "spots") return (a.spotsLeft || 0) - (b.spotsLeft || 0);
        return new Date(a.startsAt) - new Date(b.startsAt);
      });
  }, [tours, searchQuery, selectedTime, selectedCategory, selectedCity, sortBy]);

  const hasActiveFilters =
    searchQuery ||
    selectedTime !== "all" ||
    selectedCategory !== "All" ||
    selectedCity !== "All Cities" ||
    sortBy !== "soonest";

  return (
    <div className={styles.container}>
      {/* <DesktopNavbar /> */}

      {/* MAIN SECTION */}
      <main className={styles.main}>{loading && <p role="status">Checking today’s availability…</p>}
        {/* FILTERS CARD */}
        <div className={styles.filterCard}>
          <div className={styles.searchRow}>
            <div className={styles.dropdowns}>
              {/* Departure Window Filter */}
              <div className={styles.selectWrapper}>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className={styles.selectInput}
                  aria-label="Filter by departure window"
                >
                  {TIME_WINDOWS.map((win) => (
                    <option key={win.value} value={win.value}>
                      {win.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className={styles.selectIcon} />
              </div>

              {/* City Filter */}
              <div className={styles.selectWrapper}>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className={styles.selectInput}
                  aria-label="Filter by City"
                >
                  {CITIES.map((city) => (
                    <option key={city} value={city}>
                      📍 {city}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className={styles.selectIcon} />
              </div>

              {/* Sort By */}
              <div className={styles.selectWrapper}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={styles.selectInput}
                  aria-label="Sort options"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className={styles.selectIcon} />
              </div>
            </div>
          </div>

          {/* Category Pills */}
          <div className={styles.categoryPills}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`${styles.pill} ${
                  selectedCategory === cat ? styles.pillActive : ""
                }`}
              >
                {cat === "All" ? "⚡ All Available Today" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* RESULTS HEADER */}
        <div className={styles.resultsHeader}>
          <div className={styles.resultsCount}>
            Showing {filteredTours.length}{" "}
            <span>
              {filteredTours.length === 1 ? "tour" : "tours"} available today
            </span>
            <span className={styles.liveIndicator}>
              <span className={styles.pulseDot} style={{ width: 6, height: 6 }} />
              Live Available
            </span>
          </div>

          {hasActiveFilters && (
            <button onClick={resetFilters} className={styles.resetBtn}>
              <RotateCcw size={14} /> Reset Filters
            </button>
          )}
        </div>

        {/* TOURS GRID */}
        {filteredTours.length > 0 ? (
          <div className={styles.grid}>
            {filteredTours.map((tour) => {
              const isSaved = savedIds.has(String(tour._id));
              const tourId = tour._id;
              const hasMongoId = tourId && tourId.length === 24;

              return (
                <div
                  key={tour._id}
                  className={styles.card}
                  onClick={() => {
                    navigate(`/user/trips/${tour._id}`);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className={styles.cardImageWrapper}>
                    <img
                      src={tour.image}
                      alt={tour.title}
                      className={styles.cardImage}
                      loading="lazy"
                    />

                    <span className={styles.cardBadge}>
                      <Clock size={12} />
                      {tour.startsIn || "Today"}
                    </span>

                    {tour.spotsLeft && (
                      <span className={styles.spotsBadge}>
                        <Flame size={12} style={{ display: "inline", marginRight: 4, color: "#f87171" }} />
                        Only {tour.spotsLeft} spots left
                      </span>
                    )}

                    <button
                      className={styles.favoriteButton}
                      onClick={(e) => toggleSave(tour._id, e)}
                      aria-label="Save trip"
                      disabled={!hasMongoId}
                    >
                      <Heart
                        size={18}
                        fill={isSaved ? "#ef4444" : "none"}
                        color={isSaved ? "#ef4444" : "#475569"}
                      />
                    </button>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardMetaRow}>
                      <div className={styles.location}>
                        <MapPin size={14} />
                        <span>{tour.location}</span>
                      </div>

                      <div className={styles.rating}>
                        <Star size={14} fill="#f59e0b" color="#f59e0b" />
                        <span>
                          {tour.rating}{" "}
                          <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                            ({tour.reviewsCount})
                          </span>
                        </span>
                      </div>
                    </div>

                    <h3 className={styles.cardTitle}>{tour.title}</h3>

                    {/* Time Slot Highlight */}
                    <div className={styles.timeSchedule}>
                      <Clock size={14} />
                      <span>{tour.timeSlot}</span>
                    </div>

                    <div className={styles.cardDetails}>
                      <div className={styles.detailItem}>
                        <Clock size={14} color="#059669" />
                        <span>{tour.duration}</span>
                      </div>
                      <div className={styles.detailItem}>
                        <Users size={14} color="#059669" />
                        <span>{tour.groupSize}</span>
                      </div>
                    </div>

                    {tour.guide && (
                      <div className={styles.guideInfo}>
                        <img
                          src={tour.guide.avatar || userAvatar}
                          alt={tour.guide.name}
                          className={styles.guideAvatar}
                        />
                        <div className={styles.guideText}>
                          <span className={styles.guideName}>
                            {tour.guide.name}
                          </span>
                          <span className={styles.guideRole}>
                            {tour.guide.role}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className={styles.cardFooter}>
                      <div className={styles.priceWrapper}>
                        <span className={styles.priceLabel}>Price</span>
                        <div className={styles.priceValue}>
                          ${tour.price} <span>/ person</span>
                        </div>
                      </div>

                      <button
                        className={styles.actionButton}
                        onClick={() => {
                          navigate(`/user/trips/${tour._id}`);
                        }}
                      >
                        <span>{hasMongoId ? "Book Now" : "Preview only"}</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Clock size={28} />
            </div>
            <h3 className={styles.emptyTitle}>No Tours Found for Today</h3>
            <p className={styles.emptyDesc}>
              No tours matched your selected departure time, city, or category filter. Try clearing filters or checking other times.
            </p>
            <button onClick={resetFilters} className={styles.emptyResetBtn}>
              Reset All Filters
            </button>
          </div>
        )}
      </main>

      <Footer />

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex justify-around items-center py-2 px-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => navigate("/user/home")}
          className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700"
        >
          <Home size={20} />
          <span>Home</span>
        </button>

        <button
          onClick={() => navigate("/user/trips")}
          className="flex flex-col items-center gap-1 text-xs font-bold text-[#003D5B]"
        >
          <Briefcase size={20} />
          <span>Trips</span>
        </button>

        <button
          onClick={() => navigate("/user/saved")}
          className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700"
        >
          <Heart size={20} />
          <span>Saved</span>
        </button>

        <button
          onClick={() => navigate("/user/profile")}
          className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700"
        >
          <User size={20} />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
