import { Check, CircleCheckBig, Clock3, Headphones, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { apiRequest } from "../../../services/api";
import styles from "./TourApprove.module.css";

export default function TourApprove({ approveData }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tripId: routeTripId } = useParams();
  const tripId = routeTripId || location.state?.tripId || approveData?.tripId || "";

  const [state, setState] = useState({ loading: Boolean(tripId), error: tripId ? "" : "Missing tour reference.", status: "reviewing" });

  useEffect(() => {
    if (!tripId) {
      return undefined;
    }

    let active = true;
    const submit = async () => {
      try {
        const response = await apiRequest(`/marketplace/trips/${tripId}/edit`);
        const currentStatus = response?.data?.status || "draft";

        if (response?.data?.revisionId && ['draft','changes_requested'].includes(response.data.revisionStatus)) {
          await apiRequest(`/marketplace/revisions/${response.data.revisionId}/actions/submit`, { method: 'POST', body: '{}' });
        } else if (currentStatus === "draft" && response?.data?.reviewStatus !== 'in_review') {
          await apiRequest(`/trips/${tripId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: "reviewing" }),
          });
        }

        if (active) {
          setState({
            loading: false,
            error: "",
            status: response?.data?.revisionId ? 'reviewing' : currentStatus === "active" ? "active" : "reviewing",
          });
        }
      } catch (requestError) {
        if (active) setState({ loading: false, error: requestError.message || "Unable to submit this experience.", status: "draft" });
      }
    };

    submit();
    return () => { active = false; };
  }, [tripId]);

  const live = state.status === "active";

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <nav className={styles.stepper} aria-label="Experience setup progress">
          {["Basics", "Availability", "Media", "Submit"].map((label) => (
            <div key={label} className={`${styles.step} ${styles.stepDone}`}>
              <span><Check size={14} /></span><small>{label}</small>
            </div>
          ))}
        </nav>

        <section className={styles.card}>
          {state.loading ? (
            <div className={styles.loading}>Submitting your experience…</div>
          ) : state.error ? (
            <>
              <div className={`${styles.iconBadge} ${styles.errorIcon}`}>!</div>
              <span className={styles.eyebrow}>Submission needs attention</span>
              <h1>We couldn&apos;t submit this experience.</h1>
              <p>{state.error}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => navigate("/guide")}>My tours</button>
                {tripId && <button type="button" className={styles.primaryButton} onClick={() => navigate(`/guide/tours/${tripId}/media`)}>Return to media</button>}
              </div>
            </>
          ) : (
            <>
              <div className={styles.iconBadge}><CircleCheckBig size={34} /></div>
              <span className={styles.eyebrow}>{live ? "Experience is live" : "Submitted for review"}</span>
              <h1>{live ? "This experience is already published." : "Your experience is with the NEFRU review team."}</h1>
              <p>
                {live
                  ? "Travelers can discover and book the active dates you publish."
                  : "You can track it from My Tours. Publishing is controlled by the admin review flow, so the guide cannot activate a tour directly."}
              </p>

              {!live && (
                <div className={styles.reviewInfo}>
                  <Clock3 size={18} />
                  <span><strong>Current status: In review</strong><small>You can still inspect the experience from My Tours while it is being reviewed.</small></span>
                </div>
              )}

              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => { window.location.href = "mailto:support@nefru.com"; }}>
                  <Headphones size={17} /> Contact support
                </button>
                <button type="button" className={styles.primaryButton} onClick={() => navigate("/guide")}>
                  <LayoutDashboard size={17} /> Back to My Tours
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
