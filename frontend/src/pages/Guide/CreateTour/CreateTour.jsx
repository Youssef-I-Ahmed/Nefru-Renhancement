import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  DollarSign,
  MapPin,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { apiRequest } from "../../../services/api";
import styles from "./CreateTour.module.css";

const CATEGORIES = [
  { value: "History", label: "History", helper: "Ancient sites, monuments, museums" },
  { value: "Culture", label: "Culture", helper: "Local life, traditions, neighborhoods" },
  { value: "Food", label: "Food", helper: "Markets, tastings, culinary stories" },
  { value: "Adventure", label: "Adventure", helper: "Desert, outdoors, active experiences" },
];

function numericDuration(duration = "") {
  const match = String(duration).match(/(\d+(?:\.\d+)?)/);
  return match?.[1] || "";
}

export default function CreateTour({ tourData = {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tripId: routeTripId } = useParams();
  const editingTripId = routeTripId || location.state?.tripId || "";

  const [title, setTitle] = useState(tourData.title || "");
  const [city, setCity] = useState(tourData.city || "");
  const [price, setPrice] = useState(tourData.price || "");
  const [groupSize, setGroupSize] = useState(tourData.groupSize || 12);
  const [durationValue, setDurationValue] = useState(tourData.durationValue || "");
  const [description, setDescription] = useState(tourData.description || "");
  const [category, setCategory] = useState(tourData.category || "History");
  const [tripStatus, setTripStatus] = useState("draft");
  const [loading, setLoading] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(Boolean(editingTripId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editingTripId) return undefined;
    let active = true;

    const loadTrip = async () => {
      setLoadingTrip(true);
      setError("");

      try {
        const response = await apiRequest(`/marketplace/trips/${editingTripId}/edit`);
        const trip = response?.data || {};
        if (!active) return;

        setTitle(trip.title || "");
        setCity(trip.location || "");
        setPrice(trip.price ?? "");
        setGroupSize(trip.groupSize || 12);
        setDurationValue(numericDuration(trip.duration));
        setDescription(trip.description || "");
        setCategory(CATEGORIES.some((item) => item.value === trip.category) ? trip.category : "History");
        setTripStatus(trip.status || "draft");
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load this tour.");
      } finally {
        if (active) setLoadingTrip(false);
      }
    };

    loadTrip();
    return () => { active = false; };
  }, [editingTripId]);

  const valid = useMemo(() => {
    return Boolean(
      title.trim()
      && city.trim()
      && description.trim()
      && Number(durationValue) > 0
      && Number(price) > 0
      && Number(groupSize) > 0,
    );
  }, [city, description, durationValue, groupSize, price, title]);

  const saveAndContinue = async () => {
    if (!valid || loading) {
      setError("Complete the title, destination, category, duration, price, capacity, and description first.");
      return;
    }

    setLoading(true);
    setError("");

    const payload = {
      title: title.trim(),
      description: description.trim(),
      location: city.trim(),
      price: Number(price),
      duration: `${Number(durationValue)} Hours`,
      category,
      groupSize: Number(groupSize),
    };

    try {
      const response = editingTripId
        ? await apiRequest(`/trips/${editingTripId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiRequest("/trips", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      const id = response?.data?.id || editingTripId;
      if (!id) throw new Error("Tour was saved, but its reference was not returned.");

      navigate(`/guide/tours/${id}/schedule`);
    } catch (requestError) {
      setError(requestError.message || "Unable to save this experience.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <button type="button" className={styles.backButton} onClick={() => navigate("/guide")}>
          <ArrowLeft size={20} />
          <span>My tours</span>
        </button>
        <div className={styles.topbarTitle}>
          <strong>{editingTripId ? "Edit experience" : "Create experience"}</strong>
          <small>Step 1 of 4 · Basics</small>
        </div>
        <div className={styles.topbarSpacer} />
      </header>

      <main className={styles.content}>
        <section className={styles.intro}>
          <span className={styles.eyebrow}><Sparkles size={14} /> Experience basics</span>
          <h1>{editingTripId ? "Shape the experience travelers will see." : "Start with the story of your experience."}</h1>
          <p>Keep it clear, local, and specific. Availability and media come in the next steps.</p>
        </section>

        <nav className={styles.stepper} aria-label="Experience setup progress">
          {["Basics", "Availability", "Media", "Submit"].map((label, index) => (
            <div key={label} className={`${styles.step} ${index === 0 ? styles.stepActive : ""}`}>
              <span>{index === 0 ? <Check size={14} /> : index + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </nav>

        {tripStatus === "reviewing" && (
          <div className={styles.statusNotice}>This experience is in review. Content is locked until the admin requests changes.</div>
        )}
        {tripStatus === "active" && (
          <div className={styles.statusNotice}>This experience is live. Saved changes become a private revision and require admin approval. The published experience stays unchanged.</div>
        )}

        {error && <div className={styles.error} role="alert">{error}</div>}

        <section className={styles.formCard} aria-busy={loadingTrip}>
          {loadingTrip ? (
            <div className={styles.loadingState}>Loading your saved experience…</div>
          ) : (
            <>
              <div className={styles.fieldFull}>
                <label htmlFor="tour-title">Experience title</label>
                <input
                  id="tour-title"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Cairo after dark with a local storyteller"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <small>{title.length}/100 · Make the experience easy to understand at a glance.</small>
              </div>

              <div className={styles.twoColumns}>
                <div className={styles.field}>
                  <label htmlFor="destination">Destination</label>
                  <div className={styles.inputWithIcon}>
                    <MapPin size={17} />
                    <input
                      id="destination"
                      type="text"
                      placeholder="Cairo"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="duration">Duration</label>
                  <div className={styles.inputWithIcon}>
                    <Clock3 size={17} />
                    <input
                      id="duration"
                      type="number"
                      min="0.5"
                      step="0.5"
                      placeholder="4"
                      value={durationValue}
                      onChange={(event) => setDurationValue(event.target.value)}
                    />
                    <span>hours</span>
                  </div>
                </div>
              </div>

              <fieldset className={styles.categoryFieldset}>
                <legend>Experience type</legend>
                <p>NEFRU currently assigns one primary category to each tour so traveler filters stay accurate.</p>
                <div className={styles.categoryGrid}>
                  {CATEGORIES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={category === item.value ? styles.categoryActive : ""}
                      onClick={() => setCategory(item.value)}
                    >
                      <span className={styles.categoryCheck}>{category === item.value && <Check size={13} />}</span>
                      <strong>{item.label}</strong>
                      <small>{item.helper}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className={styles.twoColumns}>
                <div className={styles.field}>
                  <label htmlFor="price">Price per traveler</label>
                  <div className={styles.inputWithIcon}>
                    <DollarSign size={17} />
                    <input
                      id="price"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="3000"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                    />
                    <span>EGP</span>
                  </div>
                  <small>Set the real customer price in Egyptian pounds. Each NEFRU account reserves one place.</small>
                </div>

                <div className={styles.field}>
                  <label htmlFor="capacity">Maximum group capacity</label>
                  <div className={styles.inputWithIcon}>
                    <UsersRound size={17} />
                    <input
                      id="capacity"
                      type="number"
                      min="1"
                      max="100"
                      value={groupSize}
                      onChange={(event) => setGroupSize(event.target.value)}
                    />
                    <span>places</span>
                  </div>
                  <small>This is the total capacity of each scheduled slot.</small>
                </div>
              </div>

              <div className={styles.fieldFull}>
                <label htmlFor="description">About this experience</label>
                <textarea
                  id="description"
                  maxLength={1000}
                  rows={7}
                  placeholder="What will travelers do, learn, taste, or discover with you?"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <small>{description.length}/1000 · Focus on what makes your local perspective different.</small>
              </div>
            </>
          )}
        </section>

        <footer className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={() => navigate("/guide")}>Save later</button>
          <button type="button" className={styles.primaryButton} disabled={!valid || loading || loadingTrip} onClick={saveAndContinue}>
            {loading ? "Saving…" : "Save & add availability"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </footer>
      </main>
    </div>
  );
}
