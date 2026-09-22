import {
  CalendarDays,
  CirclePlus,
  Clock3,
  ImageIcon,
  MapPin,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiRequest, resolveMediaUrl } from "../../../services/api";
import styles from "./ToursManagement.module.css";

const TABS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "In review", value: "reviewing" },
  { label: "Drafts", value: "draft" },
  { label: "Rejected", value: "rejected" },
];

function normalizeStatus(status) {
  if (["reviewing", "pending"].includes(status)) return "reviewing";
  return ["active", "draft", "rejected"].includes(status) ? status : "draft";
}

function statusLabel(status) {
  if (status === "active") return "Live";
  if (status === "reviewing") return "In review";
  if (status === "rejected") return "Rejected";
  return "Draft";
}

function nextActionLabel(status) {
  if (status === "draft") return "Continue setup";
  if (status === "reviewing") return "Review setup";
  if (status === "rejected") return "Review feedback";
  return "Manage tour";
}

function hasSchedule(trip) {
  const dates = trip?.schedule?.dates;
  const slots = trip?.schedule?.slots;
  return (Array.isArray(dates) && dates.length > 0) || (Array.isArray(slots) && slots.length > 0);
}

function TourImage({ trip }) {
  const [failed, setFailed] = useState(false);
  const source = resolveMediaUrl(trip.image);

  if (!source || failed) {
    return (
      <div className={styles.imageFallback} aria-hidden="true">
        <ImageIcon size={28} />
        <span>Add a cover photo</span>
      </div>
    );
  }

  return (
    <img
      src={source}
      alt={trip.title}
      className={styles.cardImage}
      onError={() => setFailed(true)}
    />
  );
}

export default function ToursManagement() {
  const navigate = useNavigate();
  const [tours, setTours] = useState([]);
  const [counts, setCounts] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTours = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/trips/guide/me");
      const data = response?.data || {};
      setTours(Array.isArray(data.tours) ? data.tours : []);
      setCounts(data.counts || null);
    } catch (requestError) {
      setError(requestError.message || "Unable to load your tours.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadTours, 0);
    return () => clearTimeout(timer);
  }, [loadTours]);

  const tabCounts = useMemo(() => {
    if (counts) {
      return {
        all: counts.all ?? tours.length,
        active: counts.active ?? 0,
        reviewing: counts.reviewing ?? 0,
        draft: counts.draft ?? 0,
        rejected: counts.rejected ?? 0,
      };
    }

    return {
      all: tours.length,
      active: tours.filter((trip) => trip.status === "active").length,
      reviewing: tours.filter((trip) => trip.status === "reviewing").length,
      draft: tours.filter((trip) => trip.status === "draft").length,
      rejected: tours.filter((trip) => trip.status === "rejected").length,
    };
  }, [counts, tours]);

  const visibleTours = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tours.filter((trip) => {
      const status = normalizeStatus(trip.status);
      if (activeTab !== "all" && status !== activeTab) return false;
      if (!normalizedQuery) return true;

      return [trip.title, trip.location, trip.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeTab, query, tours]);

  const openEditor = (trip) => {
    navigate(`/guide/tours/${trip.id}/edit`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Experience management</span>
          <h1>My tours</h1>
          <p>Create, finish, and manage the experiences travelers can book with you.</p>
        </div>

        <button
          type="button"
          className={styles.createButton}
          onClick={() => navigate("/guide/tours/new")}
        >
          <CirclePlus size={19} />
          Create experience
        </button>
      </header>

      <section className={styles.summaryGrid} aria-label="Tour status summary">
        <article>
          <span>All experiences</span>
          <strong>{tabCounts.all}</strong>
        </article>
        <article>
          <span>Live</span>
          <strong>{tabCounts.active}</strong>
        </article>
        <article>
          <span>Awaiting review</span>
          <strong>{tabCounts.reviewing}</strong>
        </article>
        <article>
          <span>Drafts</span>
          <strong>{tabCounts.draft}</strong>
        </article>
        <article>
          <span>Rejected</span>
          <strong>{tabCounts.rejected}</strong>
        </article>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Filter tours by status">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              className={activeTab === tab.value ? styles.tabActive : ""}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
              <span>{tabCounts[tab.value]}</span>
            </button>
          ))}
        </div>

        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your tours"
          />
        </label>
      </section>

      {error ? (
        <section className={styles.stateCard} role="alert">
          <strong>We couldn&apos;t load your tours.</strong>
          <p>{error}</p>
          <button type="button" onClick={loadTours}>Try again</button>
        </section>
      ) : loading ? (
        <div className={styles.grid} aria-label="Loading tours">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className={styles.skeletonCard} key={index} />
          ))}
        </div>
      ) : visibleTours.length === 0 ? (
        <section className={styles.stateCard}>
          <span className={styles.emptyIcon}><Sparkles /></span>
          <strong>{tours.length === 0 ? "Create your first NEFRU experience" : "No tours match this view"}</strong>
          <p>
            {tours.length === 0
              ? "Add the basics, availability, and media, then submit the experience for review."
              : "Try another status or clear your search."}
          </p>
          {tours.length === 0 ? (
            <button type="button" onClick={() => navigate("/guide/tours/new")}>Create experience</button>
          ) : (
            <button type="button" onClick={() => { setQuery(""); setActiveTab("all"); }}>Clear filters</button>
          )}
        </section>
      ) : (
        <div className={styles.grid}>
          {visibleTours.map((trip) => {
            const status = normalizeStatus(trip.status);
            const scheduleReady = hasSchedule(trip);
            const mediaReady = Boolean(trip.image || trip.gallery?.length);

            return (
              <article className={styles.card} key={trip.id}>
                <div className={styles.imageWrap}>
                  <TourImage trip={trip} />
                  <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
                    {statusLabel(status)}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.titleRow}>
                    <div>
                      <span className={styles.category}>{trip.category || "Experience"}</span>
                      <h2>{trip.title}</h2>
                    </div>
                    <strong className={styles.price}>EGP {Number(trip.price || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
                  </div>

                  <p className={styles.location}><MapPin size={15} /> {trip.location || "Location not set"}</p>

                  <div className={styles.metaGrid}>
                    <span><Clock3 size={15} /> {trip.duration || "Duration pending"}</span>
                    <span><UsersRound size={15} /> Capacity {trip.groupSize || 1}</span>
                    <span className={scheduleReady ? styles.ready : styles.pending}>
                      <CalendarDays size={15} /> {scheduleReady ? "Availability added" : "Add availability"}
                    </span>
                    <span className={mediaReady ? styles.ready : styles.pending}>
                      <ImageIcon size={15} /> {mediaReady ? "Media added" : "Add media"}
                    </span>
                  </div>

                  {status === "reviewing" && (
                    <div className={styles.reviewNote}>
                      NEFRU is reviewing this experience. Publishing is controlled by the admin review flow.
                    </div>
                  )}

                  {trip.moderation?.reason && ["draft", "rejected"].includes(status) && (
                    <div className={styles.feedbackNote} data-rejected={status === "rejected" || undefined}>
                      <strong>{status === "rejected" ? "Submission rejected" : "Changes requested"}</strong>
                      <p>{trip.moderation.reason}</p>
                    </div>
                  )}

                  <div className={styles.actions}>
                    <button type="button" className={styles.primaryAction} onClick={() => openEditor(trip)}>
                      {nextActionLabel(status)}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={() => navigate(`/guide/tours/${trip.id}/schedule`)}
                    >
                      Schedule
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={() => navigate(`/guide/tours/${trip.id}/media`)}
                    >
                      Media
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
