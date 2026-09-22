import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Headphones,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import logo from "@/assets/images/logo.png";
import styles from "./PremiumFooter.module.css";

const exploreLinks = [
  { label: "Explore tours", to: "/user/trips" },
  { label: "Saved experiences", to: "/user/saved" },
  { label: "Nearby map", to: "/user/nearby" },
];

const accountLinks = [
  { label: "My bookings", to: "/user/profile/bookings" },
  { label: "Settings", to: "/user/settings" },
  { label: "Help & support", to: "/user/profile/support" },
];

function PremiumFooter() {
  return (
    <footer className={styles.footer} aria-label="NEFRU footer">
      <div className={styles.inner}>
        <section className={styles.cta}>
          <div>
            <span className={styles.kicker}>Your Egypt story starts here</span>
            <h2>Ready to explore with someone who knows the place by heart?</h2>
          </div>
          <div className={styles.ctaActions}>
            <Link className={styles.primaryCta} to="/user/trips">
              Explore experiences <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryCta} to="/user/nearby">
              <MapPin size={17} aria-hidden="true" /> Find nearby
            </Link>
          </div>
        </section>

        <div className={styles.mainGrid}>
          <div className={styles.brandColumn}>
            <Link className={styles.brand} to="/user/home" aria-label="NEFRU home">
              <img src={logo} alt="" aria-hidden="true" />
              <span>NEFRU</span>
            </Link>
            <p>
              Discover Egypt through authentic experiences, transparent booking,
              and verified local guides.
            </p>
            <div className={styles.trustBadges}>
              <span><BadgeCheck size={15} /> Verified guides</span>
              <span><ShieldCheck size={15} /> Clear booking</span>
            </div>
          </div>

          <nav className={styles.linkColumn} aria-label="Explore NEFRU">
            <h3>Explore</h3>
            {exploreLinks.map((item) => (
              <Link key={item.to} to={item.to}>{item.label}</Link>
            ))}
            <a href="/user/home#top-guides">Meet local guides</a>
          </nav>

          <nav className={styles.linkColumn} aria-label="Your NEFRU account">
            <h3>Your account</h3>
            {accountLinks.map((item) => (
              <Link key={item.to} to={item.to}>{item.label}</Link>
            ))}
          </nav>

          <div className={styles.linkColumn}>
            <h3>For guides</h3>
            <p className={styles.columnCopy}>
              Share your expertise and create meaningful experiences for travelers.
            </p>
            <Link className={styles.guideLink} to="/auth/register">
              Become a guide <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link className={styles.supportLink} to="/user/profile/support">
              <Headphones size={15} aria-hidden="true" /> Contact support
            </Link>
          </div>
        </div>

        <div className={styles.bottomBar}>
          <span>© 2026 NEFRU. All rights reserved.</span>
          <span>Made for discovering Egypt with locals.</span>
        </div>
      </div>
    </footer>
  );
}

export default PremiumFooter;
