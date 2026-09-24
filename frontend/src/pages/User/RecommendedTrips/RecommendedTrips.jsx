import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Filter,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";

import ExploreSearchBar from "@/components/Search/ExploreSearchBar";
import ExperienceCard from "@/components/ui/ExperienceCard/ExperienceCard";
import { apiRequest, resolveUploadsUrl } from "@/services/api";
import PremiumFooter from "@/pages/User/Home/PremiumFooter";

import pyramidsImg from "@/assets/images/explore/pyramids.webp";
import museumImg from "@/assets/images/explore/the_grand_museum.webp";
import oldCairoImg from "@/assets/images/explore/old-cairo.jpg";
import luxorImg from "@/assets/images/tours/Luxor.jpg";
import userAvatar from "@/assets/images/user/user1.png";

import styles from "./RecommendedTrips.module.css";

const CATEGORIES = ["All", "History", "Culture", "Food", "Adventure"];
const PRICE_CAP = 10000;
const CITIES = ["All Egypt", "Cairo", "Giza", "Luxor", "Aswan", "Alexandria"];
const DURATION_OPTIONS = [
  { value: "all", label: "Any duration" },
  { value: "short", label: "Up to 4 hours" },
  { value: "day", label: "Half / full day" },
  { value: "multi", label: "Multi-day" },
];
const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "popular", label: "Most reviewed" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const getImage = (value, fallback = pyramidsImg) => {
  if (!value) return fallback;
  return resolveUploadsUrl(value) || value || fallback;
};

const getDurationHours = (value) => {
  if (typeof value === "number") return value;
  const text = String(value || "").toLowerCase();
  const number = Number(text.match(/[\d.]+/)?.[0] || 0);
  if (!number) return 0;
  if (text.includes("day")) return number * 24;
  return number;
};

const inferCity = (location = "") => {
  const text = String(location).toLowerCase();
  for (const city of ["Cairo", "Giza", "Luxor", "Aswan", "Alexandria"]) {
    if (text.includes(city.toLowerCase())) return city;
  }
  return "Cairo";
};

const normalizeTrip = (trip, index) => ({
  _id: trip?._id || trip?.id || `trip-${index}`,
  title: trip?.title || "Egypt experience",
  category: trip?.category || "Culture",
  location: trip?.location || "Egypt",
  city: trip?.city || inferCity(trip?.location),
  duration: trip?.duration || "4 hours",
  durationHours: Number(trip?.durationHours) || getDurationHours(trip?.duration) || 4,
  price: Number(trip?.price) || 0,
  currency: trip?.currency || "EGP",
  rating: Number(trip?.rating) || 0,
  reviewsCount: Number(trip?.reviewsCount) || 0,
  groupSize: Number(trip?.groupSize) || 12,
  image: getImage(trip?.image, [pyramidsImg, museumImg, oldCairoImg, luxorImg][index % 4]),
  description: trip?.description || trip?.longDescription || "Guided experience in Egypt.",
  schedule: trip?.schedule || {},
  guide: {
    name: trip?.guide?.fullName || trip?.guide?.name || "Local guide",
    role: trip?.guide?.role || "Local expert guide",
    avatar: getImage(trip?.guide?.avatar, userAvatar),
    verified: Boolean(trip?.guide?.verified),
  },
});

const hasDate = (trip, selectedDate) => {
  if (!selectedDate) return true;
  const dates = trip?.schedule?.dates || [];
  if (!Array.isArray(dates) || dates.length === 0) return false;
  return dates.some((date) => String(date).slice(0, 10) === selectedDate);
};

function RecommendedTrips() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "All");
  const [selectedCity, setSelectedCity] = useState(searchParams.get("city") || "All Egypt");
  const [selectedDuration, setSelectedDuration] = useState(searchParams.get("duration") || "all");
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") || "");
  const [minRating, setMinRating] = useState(Number(searchParams.get("rating") || 0));
  const [maxPrice, setMaxPrice] = useState(Number(searchParams.get("maxPrice") || PRICE_CAP));
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get("verified") === "1");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "recommended");
  const paramsRef = useRef(searchParams.toString());
  const syncingExternalParams = useRef(false);

  useEffect(() => {
    const nextKey = searchParams.toString();
    if (nextKey === paramsRef.current) return;

    syncingExternalParams.current = true;
    paramsRef.current = nextKey;
    setSearchQuery(searchParams.get("search") || "");
    setSelectedCategory(searchParams.get("category") || "All");
    setSelectedCity(searchParams.get("city") || "All Egypt");
    setSelectedDuration(searchParams.get("duration") || "all");
    setSelectedDate(searchParams.get("date") || "");
    setMinRating(Number(searchParams.get("rating") || 0));
    setMaxPrice(Number(searchParams.get("maxPrice") || PRICE_CAP));
    setVerifiedOnly(searchParams.get("verified") === "1");
    setSortBy(searchParams.get("sort") || "recommended");
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const loadTrips = async () => {
      try {
        const response = await apiRequest("/trips");
        if (!active) return;
        const apiTrips = Array.isArray(response?.data) ? response.data : [];
        setTrips(apiTrips.map(normalizeTrip));
      } catch (error) {
        console.error("Unable to load trips.", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTrips();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (syncingExternalParams.current) {
      syncingExternalParams.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (selectedCategory !== "All") params.set("category", selectedCategory);
    if (selectedCity !== "All Egypt") params.set("city", selectedCity);
    if (selectedDuration !== "all") params.set("duration", selectedDuration);
    if (selectedDate) params.set("date", selectedDate);
    if (minRating > 0) params.set("rating", String(minRating));
    if (maxPrice < PRICE_CAP) params.set("maxPrice", String(maxPrice));
    if (verifiedOnly) params.set("verified", "1");
    if (sortBy !== "recommended") params.set("sort", sortBy);

    const nextKey = params.toString();
    if (nextKey !== searchParams.toString()) {
      paramsRef.current = nextKey;
      setSearchParams(params, { replace: true });
    }
  }, [
    searchQuery,
    selectedCategory,
    selectedCity,
    selectedDuration,
    selectedDate,
    minRating,
    maxPrice,
    verifiedOnly,
    sortBy,
    searchParams,
    setSearchParams,
  ]);

  const filteredTrips = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return trips
      .filter((trip) => {
        if (query) {
          const haystack = [
            trip.title,
            trip.location,
            trip.description,
            trip.guide?.name,
            trip.category,
          ].join(" ").toLowerCase();
          if (!haystack.includes(query)) return false;
        }

        if (selectedCategory !== "All" && trip.category !== selectedCategory) return false;
        if (selectedCity !== "All Egypt" && trip.city !== selectedCity) return false;

        if (selectedDuration === "short" && trip.durationHours > 4) return false;
        if (selectedDuration === "day" && (trip.durationHours <= 4 || trip.durationHours > 12)) return false;
        if (selectedDuration === "multi" && trip.durationHours <= 12) return false;

        if (trip.rating < minRating) return false;
        if (trip.price > maxPrice) return false;
        if (verifiedOnly && !trip.guide?.verified) return false;
        if (!hasDate(trip, selectedDate)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rating") return b.rating - a.rating;
        if (sortBy === "popular") return b.reviewsCount - a.reviewsCount;
        if (sortBy === "price_asc") return a.price - b.price;
        if (sortBy === "price_desc") return b.price - a.price;
        return (b.rating * 20 + Math.min(b.reviewsCount, 500) / 50) - (a.rating * 20 + Math.min(a.reviewsCount, 500) / 50);
      });
  }, [
    trips,
    searchQuery,
    selectedCategory,
    selectedCity,
    selectedDuration,
    selectedDate,
    minRating,
    maxPrice,
    verifiedOnly,
    sortBy,
  ]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedCity("All Egypt");
    setSelectedDuration("all");
    setSelectedDate("");
    setMinRating(0);
    setMaxPrice(PRICE_CAP);
    setVerifiedOnly(false);
    setSortBy("recommended");
  };

  const hasFilters = Boolean(
    searchQuery ||
    selectedCategory !== "All" ||
    selectedCity !== "All Egypt" ||
    selectedDuration !== "all" ||
    selectedDate ||
    minRating > 0 ||
    maxPrice < PRICE_CAP ||
    verifiedOnly ||
    sortBy !== "recommended"
  );

  const handleHeroSearch = ({ query, date, category }) => {
    setSearchQuery(query || "");
    setSelectedDate(date || "");
    setSelectedCategory(category || "All");
  };

  const renderFilters = (mobile = false) => (
    <div className={`${styles.filterControls} ${mobile ? styles.filterControlsMobile : ""}`}>
      <div className={styles.filterSection}>
        <label className={styles.filterLabel} htmlFor={`${mobile ? "m-" : ""}city-filter`}>Destination</label>
        <div className={styles.selectWrap}>
          <MapPin size={16} />
          <select
            id={`${mobile ? "m-" : ""}city-filter`}
            value={selectedCity}
            onChange={(event) => setSelectedCity(event.target.value)}
          >
            {CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <ChevronDown size={14} />
        </div>
      </div>

      <div className={styles.filterSection}>
        <label className={styles.filterLabel} htmlFor={`${mobile ? "m-" : ""}date-filter`}>Date</label>
        <div className={styles.selectWrap}>
          <CalendarDays size={16} />
          <input
            id={`${mobile ? "m-" : ""}date-filter`}
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.filterSection}>
        <label className={styles.filterLabel} htmlFor={`${mobile ? "m-" : ""}duration-filter`}>Duration</label>
        <div className={styles.selectWrap}>
          <select
            id={`${mobile ? "m-" : ""}duration-filter`}
            value={selectedDuration}
            onChange={(event) => setSelectedDuration(event.target.value)}
          >
            {DURATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={14} />
        </div>
      </div>

      <div className={styles.filterSection}>
        <div className={styles.rangeHeader}>
          <span className={styles.filterLabel}>Price per person</span>
          <strong>Up to EGP {maxPrice.toLocaleString("en-US")}</strong>
        </div>
        <input
          className={styles.range}
          type="range"
          min="500"
          max={PRICE_CAP}
          step="250"
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          aria-label="Maximum price"
        />
        <div className={styles.rangeScale}><span>EGP 500</span><span>EGP {PRICE_CAP.toLocaleString("en-US")}+</span></div>
      </div>

      <div className={styles.filterSection}>
        <span className={styles.filterLabel}>Rating</span>
        <div className={styles.ratingButtons}>
          {[0, 4.5, 4.8].map((value) => (
            <button
              key={value}
              type="button"
              className={minRating === value ? styles.choiceActive : ""}
              onClick={() => setMinRating(value)}
            >
              {value === 0 ? "Any" : <><Star size={13} fill="currentColor" /> {value}+</>}
            </button>
          ))}
        </div>
      </div>

      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={(event) => setVerifiedOnly(event.target.checked)}
        />
        <span><BadgeCheck size={17} /> Verified guides only</span>
      </label>
    </div>
  );

  return (
    <main className={styles.page}>
      <section className={styles.searchHeader}>
        <div className={styles.searchHeaderCopy}>
          <span>Experiences across Egypt</span>
          <h1>Find the experience that fits your trip.</h1>
          <p>Start broad, then narrow by place, date, pace, price and the guide you want to travel with.</p>
        </div>

        <ExploreSearchBar
          compact
          initialValues={{
            query: searchQuery,
            date: selectedDate,
                    category: selectedCategory === "All" ? "" : selectedCategory,
          }}
          onSearch={handleHeroSearch}
        />
      </section>

      <section className={styles.content}>
        <div className={styles.quickBar}>
          <div className={styles.categoryChips} aria-label="Experience types">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={selectedCategory === category ? styles.chipActive : ""}
                onClick={() => setSelectedCategory(category)}
              >
                {category === "All" ? "All experiences" : category}
              </button>
            ))}
          </div>

          <button type="button" className={styles.mobileFilterButton} onClick={() => setMobileFiltersOpen(true)}>
            <SlidersHorizontal size={17} /> Filters
            {hasFilters && <span />}
          </button>
        </div>

        <div className={styles.marketLayout}>
          <aside className={styles.sidebar} aria-label="Filter experiences">
            <div className={styles.sidebarHeader}>
              <span><Filter size={16} /> Filters</span>
              {hasFilters && <button type="button" onClick={resetFilters}><RotateCcw size={13} /> Reset</button>}
            </div>
            {renderFilters()}
          </aside>

          <section className={styles.results} aria-live="polite">
            <header className={styles.resultsHeader}>
              <div>
                <strong>{loading ? "Finding experiences…" : `${filteredTrips.length} experiences`}</strong>
                <span>{selectedCity === "All Egypt" ? "Across Egypt" : `In ${selectedCity}`}</span>
              </div>

              <label className={styles.sortControl}>
                <span>Sort</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
            </header>

            {!loading && filteredTrips.length === 0 ? (
              <div className={styles.emptyState}>
                <span><Search size={24} /></span>
                <h2>No experiences match those filters.</h2>
                <p>Try a broader destination, a different date or reset a few filters.</p>
                <button type="button" onClick={resetFilters}>Reset filters</button>
              </div>
            ) : (
              <div className={styles.grid}>{loading && <p role="status">Loading experiences…</p>}
                {filteredTrips.map((trip) => (
                  <ExperienceCard
                    key={trip._id}
                    id={trip._id}
                    image={trip.image}
                    title={trip.title}
                    location={trip.location}
                    duration={trip.duration}
                    groupSize={`Up to ${trip.groupSize}`}
                    rating={trip.rating}
                    reviewsCount={trip.reviewsCount}
                    price={trip.price}
                    currency={trip.currency}
                    category={trip.category}
                    guide={trip.guide}
                    verified={Boolean(trip.guide?.verified)}
                    fallbackPath="/trips"
                    className={loading ? styles.loadingCard : ""}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      <PremiumFooter />

      {mobileFiltersOpen && (
        <div className={styles.sheetBackdrop} onClick={() => setMobileFiltersOpen(false)}>
          <section
            className={styles.mobileSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Experience filters"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.sheetHandle} />
            <header className={styles.sheetHeader}>
              <div>
                <span>Refine your search</span>
                <strong>Filters</strong>
              </div>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters"><X size={20} /></button>
            </header>

            <div className={styles.mobileCategoryChips}>
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={selectedCategory === category ? styles.chipActive : ""}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category === "All" ? "All" : category}
                </button>
              ))}
            </div>

            {renderFilters(true)}

            <footer className={styles.sheetFooter}>
              <button type="button" className={styles.sheetReset} onClick={resetFilters}>Clear all</button>
              <button type="button" className={styles.sheetApply} onClick={() => setMobileFiltersOpen(false)}>
                Show {filteredTrips.length} experiences
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

export default RecommendedTrips;
