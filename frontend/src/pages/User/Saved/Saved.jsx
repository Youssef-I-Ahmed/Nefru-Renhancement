import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Compass, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import ExperienceCard from "@/components/ui/ExperienceCard/ExperienceCard";
import { useSavedTrips } from "@/context/useSavedTrips";
import PremiumFooter from "@/pages/User/Home/PremiumFooter";

import styles from "./Saved.module.css";

export default function Saved() {
  const navigate = useNavigate();
  const { savedIds, refresh } = useSavedTrips();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const savedTrips = await refresh();
      setTrips(savedTrips || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load saved experiences.");
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleTrips = useMemo(
    () => trips.filter((trip) => savedIds.has(String(trip.id || trip._id))),
    [savedIds, trips],
  );

  return (
    <>
      <main className={styles.page}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div>
              <span className={styles.eyebrow}>Your shortlist</span>
              <h1>Saved experiences</h1>
              <p>Keep the Egypt experiences you want to come back to in one place.</p>
            </div>
            {!loading && visibleTrips.length > 0 && (
              <span className={styles.count}>{visibleTrips.length} saved</span>
            )}
          </header>

          {error && (
            <section className={styles.stateCard} role="alert">
              <RefreshCw size={24} />
              <h2>We couldn&apos;t load your saved experiences.</h2>
              <p>{error}</p>
              <button type="button" onClick={load}>Try again</button>
            </section>
          )}

          {!error && loading && (
            <div className={styles.grid} aria-label="Loading saved experiences">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={styles.skeleton} />
              ))}
            </div>
          )}

          {!error && !loading && visibleTrips.length === 0 && (
            <section className={styles.stateCard}>
              <div className={styles.stateIcon}><Bookmark size={28} /></div>
              <h2>Your saved list is empty.</h2>
              <p>Tap the heart on any experience and it will stay here for your next visit.</p>
              <button type="button" onClick={() => navigate("/user/trips")}>
                <Compass size={17} /> Explore experiences
              </button>
            </section>
          )}

          {!error && !loading && visibleTrips.length > 0 && (
            <section className={styles.grid} aria-label="Saved experiences">
              {visibleTrips.map((trip) => (
                <ExperienceCard
                  key={trip.id || trip._id}
                  {...trip}
                  verified={trip.guide?.verified !== false}
                  guideName={trip.guide?.name}
                />
              ))}
            </section>
          )}
        </div>
      </main>
      <PremiumFooter />
    </>
  );
}
