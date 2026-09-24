import { FiCompass, FiHome } from "react-icons/fi";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import Logo_Light from "../../assets/images/Logo_Light.png";
import illustration from "../../assets/images/not-found-illustration.png";
import { Button } from "../components/Button/Button";
import styles from "./NotFound.module.css";

const ROLE_DESTINATIONS = {
  tourist: {
    label: "Traveler",
    homePath: "/explore",
    homeLabel: "Back to traveler home",
    showExplore: true,
  },
  guide: {
    label: "Guide",
    homePath: "/guide/dashboard",
    homeLabel: "Back to guide dashboard",
    showExplore: false,
  },
  admin: {
    label: "Admin",
    homePath: "/admin/overview",
    homeLabel: "Back to admin overview",
    showExplore: false,
  },
};

export default function NotFound() {
  const navigate = useNavigate();
  const { initialized, isAuthenticated, user } = useSelector(
    (state) => state.auth || {},
  );

  const role = isAuthenticated ? user?.role : null;
  const destination = ROLE_DESTINATIONS[role] || {
    label: "Guest",
    homePath: "/explore",
    homeLabel: "Go to Nefru home",
    showExplore: true,
  };

  const sessionMessage =
    initialized && isAuthenticated
      ? `You’re still signed in as ${destination.label.toLowerCase()}.`
      : "You can keep exploring NEFRU from here.";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <img src={Logo_Light} alt="Nefru" className={styles.logo} />

        <div className={styles.content}>
          <div className={styles.textContent}>
            <p className={styles.contextLabel}>
              {destination.label} · Page not found
            </p>

            <p className={styles.errorCode}>404</p>

            <h1 className={styles.title}>
              Oops! This page got lost in the sands.
            </h1>

            <p className={styles.description}>
              The page you’re looking for doesn’t exist, was moved, or may have
              never existed.
            </p>

            <p className={styles.sessionNote}>{sessionMessage}</p>
          </div>

          <div className={styles.imageWrapper}>
            <img
              src={illustration}
              alt="Compass map with pyramids"
              className={styles.illustration}
            />
          </div>

          <div className={styles.actions}>
            <Button
              type="secondary"
              className={styles.button}
              icon={<FiHome />}
              onClick={() => navigate(destination.homePath, { replace: true })}
            >
              {destination.homeLabel}
            </Button>

            {destination.showExplore && (
              <Button
                type="outline"
                className={styles.button}
                icon={<FiCompass />}
                onClick={() => navigate("/trips")}
              >
                Explore Tours
              </Button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}