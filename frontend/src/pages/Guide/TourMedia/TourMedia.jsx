import { useEffect, useState } from "react";
import styles from "./TourMedia.module.css";
import {
  FaArrowLeft,
  FaImage,
  FaPlus,
  FaTrash,
  FaCircleCheck,
} from "react-icons/fa6";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest, resolveUploadsUrl } from "../../../services/api";

function getImageSrc(image) {
  return resolveUploadsUrl(image) || image || "";
}

function TourMedia({ mediaData = {}, tourId, onBack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tripId: routeTripId } = useParams();
  const tripId = tourId || routeTripId || location.state?.tripId;

  const [coverPhoto, setCoverPhoto] = useState(null);
  const [existingCoverPhoto, setExistingCoverPhoto] = useState("");
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [existingGalleryPhotos, setExistingGalleryPhotos] = useState([]);
  const [highlights, setHighlights] = useState(mediaData.highlights || ["", ""]);
  const [loading, setLoading] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(Boolean(tripId));

  const galleryUploadedCount = Array.from({ length: 6 }).filter(
    (_, index) => galleryPhotos[index] || existingGalleryPhotos[index],
  ).length;

  useEffect(() => {
    async function loadTripMedia() {
      if (!tripId) return;
      setLoadingTrip(true);

      try {
        const response = await apiRequest(`/marketplace/trips/${tripId}/edit`);
        const trip = response?.data;
        setExistingCoverPhoto(trip.image || "");
        setExistingGalleryPhotos(Array.isArray(trip.gallery) ? trip.gallery.slice(0, 6) : []);
        setHighlights(
          Array.isArray(trip.highlights) && trip.highlights.length > 0
            ? trip.highlights.map((item) =>
                typeof item === "string" ? item : item.title || item.text || "",
              )
            : ["", ""],
        );
      } catch (error) {
        console.error(error);
        alert(error.message);
      } finally {
        setLoadingTrip(false);
      }
    }

    loadTripMedia();
  }, [tripId]);

  function chooseCover(event) {
    setCoverPhoto(event.target.files?.[0] || null);
  }

  function chooseGallery(index, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setGalleryPhotos((previous) => {
      const next = [...previous];
      next[index] = file;
      return next.slice(0, 6);
    });
  }

  function changeHighlight(index, value) {
    const next = [...highlights];
    next[index] = value;
    setHighlights(next);
  }

  function addHighlight() {
    setHighlights([...highlights, ""]);
  }

  function deleteHighlight(index) {
    setHighlights(highlights.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submitForm() {
    setLoading(true);

    try {
      if (!tripId) {
        navigate("/guide");
        return;
      }

      const newGalleryEntries = galleryPhotos
        .map((file, index) => (file ? { file, index } : null))
        .filter(Boolean);

      if (coverPhoto || newGalleryEntries.length > 0) {
        const formData = new FormData();
        if (coverPhoto) formData.append("coverImage", coverPhoto);
        newGalleryEntries.forEach(({ file }) => formData.append("galleryImages", file));
        formData.append(
          "galleryIndexes",
          JSON.stringify(newGalleryEntries.map(({ index }) => index)),
        );

        const uploadResponse = await apiRequest(`/trips/${tripId}/upload-media`, {
          method: "POST",
          body: formData,
        });

        setExistingCoverPhoto(uploadResponse?.data?.image || existingCoverPhoto);
        setExistingGalleryPhotos(uploadResponse?.data?.gallery || existingGalleryPhotos);
      }

      const cleanHighlights = highlights.map((item) => item.trim()).filter(Boolean);
      await apiRequest(`/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify({
          highlights: cleanHighlights,
        }),
      });

      navigate(`/guide/tours/${tripId}/submit`);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onBack || (() => navigate(tripId ? `/guide/tours/${tripId}/schedule` : "/guide"))}>
          <FaArrowLeft />
        </button>
        <h1>Add Media</h1>
        <div className={styles.empty}></div>
      </header>

      <main className={styles.content}>
        <div className={styles.stepper}>
          <div className={styles.line}></div>
          <div className={styles.activeLine}></div>
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={`${styles.step} ${step <= 3 ? styles.activeStep : ""}`}
            >
              {step}
            </span>
          ))}
        </div>

        <p className={styles.intro}>
          Upload captivating photos and define the core highlights of your experience to attract travelers.
        </p>

        <section className={styles.section}>
          <h2>Cover Photo</h2>
          <label className={styles.coverBox}>
            <input type="file" accept="image/*" onChange={chooseCover} />
            {coverPhoto ? (
              <img src={URL.createObjectURL(coverPhoto)} alt="Cover preview" />
            ) : existingCoverPhoto ? (
              <img src={getImageSrc(existingCoverPhoto)} alt="Cover preview" />
            ) : (
              <>
                <FaImage className={styles.uploadIcon} />
                <strong>{loadingTrip ? "Loading cover photo..." : "Click to upload cover photo"}</strong>
                <span>High resolution (min 1920x1080) recommended.</span>
              </>
            )}
          </label>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitleRow}>
            <h2>Gallery Photos</h2>
            <span>{galleryUploadedCount} / 6 uploaded</span>
          </div>

          <div className={styles.galleryGrid}>
            {Array.from({ length: 6 }).map((_, index) => {
              const file = galleryPhotos[index];
              const existingImage = existingGalleryPhotos[index];
              return (
                <label key={index} className={styles.galleryItem}>
                  <input type="file" accept="image/*" onChange={(event) => chooseGallery(index, event)} />
                  {file ? (
                    <img src={URL.createObjectURL(file)} alt="Gallery preview" />
                  ) : existingImage ? (
                    <img src={getImageSrc(existingImage)} alt="Gallery preview" />
                  ) : (
                    <FaPlus />
                  )}
                </label>
              );
            })}
          </div>
        </section>

        <div className={styles.divider}></div>

        <section className={styles.section}>
          <h2>Experience Highlights</h2>
          <div className={styles.highlightsList}>
            {highlights.map((item, index) => (
              <div key={index} className={styles.highlightRow}>
                <FaCircleCheck className={styles.checkIcon} />
                <input
                  type="text"
                  value={item}
                  placeholder={index === 0 ? "e.g., Skip the line at the Great Pyramid" : "e.g., Expert Egyptologist guide"}
                  onChange={(event) => changeHighlight(index, event.target.value)}
                />
                <button type="button" onClick={() => deleteHighlight(index)}><FaTrash /></button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.addHighlight} onClick={addHighlight}>
            <FaPlus /> Add another highlight
          </button>
        </section>

      </main>

      <footer className={styles.footer}>
        <button type="button" onClick={submitForm} disabled={loading}>
          {loading ? "Uploading to Cloudinary..." : "Continue to review"}
        </button>
      </footer>
    </div>
  );
}

export default TourMedia;
