import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  MapPin,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import styles from "./SearchModal.module.css";

const DESTINATIONS = ["Cairo", "Giza", "Luxor", "Aswan", "Alexandria", "Siwa"];
const CATEGORIES = ["History", "Culture", "Food", "Adventure"];
const POPULAR = ["Pyramids", "Nile experiences", "Local food", "Private tours"];

const SearchModal = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");

  const goToResults = ({ overrideQuery, destination } = {}) => {
    const params = new URLSearchParams();
    const nextQuery = typeof overrideQuery === "string" ? overrideQuery : query.trim();

    if (nextQuery) params.set("search", nextQuery);
    if (destination) params.set("city", destination);
    if (date) params.set("date", date);
    if (category) params.set("category", category);

    onOpenChange?.(false);
    const queryString = params.toString();
    navigate(`/trips${queryString ? `?${queryString}` : ""}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <div className={styles.topline}>
          <span><Sparkles size={15} /> Explore Egypt</span>
          <h2>What do you want to discover?</h2>
          <p>Search by place, experience or the kind of day you want to have.</p>
        </div>

        <form
          className={styles.searchForm}
          onSubmit={(event) => {
            event.preventDefault();
            goToResults();
          }}
        >
          <div className={styles.queryBox}>
            <Search size={20} aria-hidden="true" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “Pyramids”, “Cairo food” or a guide name"
              aria-label="Search Egypt experiences"
            />
          </div>

          <div className={styles.detailGrid}>
            <label>
              <span><CalendarDays size={15} /> Date</span>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>

            <label>
              <span><Sparkles size={15} /> Experience type</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">Any type</option>
                {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <div className={styles.personalBookingNote}>
            <UserRound size={16} aria-hidden="true" />
            <span><strong>Personal booking.</strong> Each NEFRU account reserves one place for its account holder.</span>
          </div>

          <button type="submit" className={styles.searchButton}>
            <Search size={18} /> Search experiences
          </button>
        </form>

        <div className={styles.discoveryGrid}>
          <section>
            <h3>Popular right now</h3>
            <div className={styles.chips}>
              {POPULAR.map((item) => (
                <button key={item} type="button" onClick={() => goToResults({ overrideQuery: item })}>
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Start with a destination</h3>
            <div className={styles.destinations}>
              {DESTINATIONS.map((destination) => (
                <button
                  key={destination}
                  type="button"
                  onClick={() => goToResults({ destination, overrideQuery: "" })}
                >
                  <MapPin size={15} /> {destination}
                </button>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchModal;
