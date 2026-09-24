import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  Search,
  Sparkles,
} from "lucide-react";

import styles from "./ExploreSearchBar.module.css";

const EXPERIENCE_TYPES = ["", "History", "Culture", "Food", "Adventure"];

function ExploreSearchBar({
  initialValues = {},
  onSearch,
  compact = false,
  className = "",
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialValues.query || "");
  const [date, setDate] = useState(initialValues.date || "");
  const [category, setCategory] = useState(initialValues.category || "");

  const initialKey = JSON.stringify([initialValues.query, initialValues.date, initialValues.category]);
  const [previousKey, setPreviousKey] = useState(initialKey);
  if (previousKey !== initialKey) {
    setPreviousKey(initialKey);
    setQuery(initialValues.query || "");
    setDate(initialValues.date || "");
    setCategory(initialValues.category || "");
  }

  const submitSearch = (event) => {
    event?.preventDefault?.();

    const values = {
      query: query.trim(),
      date,
      category,
    };

    if (onSearch) {
      onSearch(values);
      return;
    }

    const params = new URLSearchParams();
    if (values.query) params.set("search", values.query);
    if (values.date) params.set("date", values.date);
    if (values.category) params.set("category", values.category);

    const queryString = params.toString();
    navigate(`/trips${queryString ? `?${queryString}` : ""}`);
  };

  return (
    <form
      className={`${styles.searchBar} ${compact ? styles.compact : ""} ${className}`.trim()}
      onSubmit={submitSearch}
      role="search"
      aria-label="Search Egypt experiences"
    >
      <label className={`${styles.field} ${styles.queryField}`}>
        <span className={styles.label}>Explore Egypt</span>
        <span className={styles.control}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cairo, pyramids, food..."
            autoComplete="off"
          />
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>When</span>
        <span className={styles.control}>
          <CalendarDays size={18} aria-hidden="true" />
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Travel date"
          />
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Experience</span>
        <span className={styles.control}>
          <Sparkles size={18} aria-hidden="true" />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Experience type"
          >
            {EXPERIENCE_TYPES.map((type) => (
              <option key={type || "all"} value={type}>
                {type || "Any type"}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </label>

      <button type="submit" className={styles.submitButton}>
        <Search size={19} aria-hidden="true" />
        <span>Explore</span>
      </button>
    </form>
  );
}

export default ExploreSearchBar;
