import { useState, useMemo } from "react";
import styles from "./RecommendedTours.module.css";
import RecommendedTourCard from "./RecommendedTourCard";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";

import pyramids from "../../../assets/images/explore/pyramids.jpg";
import oldCairo from "../../../assets/images/explore/old-cairo.jpg";
import museum from "../../../assets/images/explore/the_grand_museum.webp";
import sphinx from "../../../assets/images/explore/Sphinx.jpg";

const defaultTours = [
  {
    _id: "1",
    image: pyramids,
    badge: "Best Seller",
    category: "History",
    title: "Pyramids Sunrise & Sphinx Experience",
    location: "Giza Plateau",
    duration: "4 hours",
    rating: 4.9,
    reviewsCount: 582,
    guide: { name: "Mohamed Hassan", title: "Licensed Egyptologist" },
    price: 45,
  },
  {
    _id: "2",
    image: oldCairo,
    badge: "Cultural Walk",
    category: "History",
    title: "Historic Cairo Walking Trip",
    location: "Cairo",
    duration: "3 hours",
    rating: 4.8,
    reviewsCount: 340,
    guide: { name: "Mariam El-Sayed", title: "Licensed Egyptologist" },
    price: 35,
  },
  {
    _id: "3",
    image: museum,
    badge: "Must Visit",
    category: "Culture",
    title: "Coptic Cairo & Civilization Museum",
    location: "Cairo",
    duration: "5 hours",
    rating: 4.9,
    reviewsCount: 410,
    guide: { name: "Mariam El-Sayed", title: "Cultural Trip Specialist" },
    price: 40,
  },
  {
    _id: "4",
    image: sphinx,
    badge: "Top Rated",
    category: "History",
    title: "Luxor East & West Banks Expedition",
    location: "Luxor",
    duration: "Full Day",
    rating: 5.0,
    reviewsCount: 420,
    guide: { name: "Omar Khalil", title: "Upper Egypt Specialist" },
    price: 65,
  },
];

const CATEGORIES = ["All", "History", "Culture", "Nile Cruises", "Adventure"];

function RecommendedTours({ trips }) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All");

  const displayTrips = useMemo(() => {
    const list = trips && trips.length > 0 ? trips : defaultTours;
    if (activeCategory === "All") return list;
    return list.filter((t) =>
      (t.category || t.badge || "").toLowerCase().includes(activeCategory.toLowerCase())
    );
  }, [trips, activeCategory]);

  return (
    <section className={styles.section} id="popular-tours">
      <div className={styles.header}>
        <div>
          <div className={styles.subHeaderBadge}>
            <Compass size={14} />
            <span>Curated Experiences</span>
          </div>
          <h2>Recommended for your trip</h2>
          <p>Hand-picked experiences led by verified Egyptologists and local experts.</p>
        </div>

        <button className={styles.viewAllBtn} onClick={() => navigate("/user/trips")}>
          <span>View all tours</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`${styles.filterTab} ${activeCategory === cat ? styles.activeFilterTab : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {displayTrips.map((trip, idx) => (
          <RecommendedTourCard key={trip._id || idx} {...trip} />
        ))}
      </div>
    </section>
  );
}

export default RecommendedTours;