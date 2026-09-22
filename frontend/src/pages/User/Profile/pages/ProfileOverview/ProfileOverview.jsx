import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Globe2,
  Heart,
  Mail,
  MapPinned,
  PencilLine,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useSavedTrips } from "../../../../../context/useSavedTrips";
import { apiRequest } from "../../../../../services/api";
import styles from "./ProfileOverviewPremium.module.css";

const languageNames = {
  en: "English",
  ar: "Arabic",
  tr: "Turkish",
  fr: "French",
  de: "German",
  es: "Spanish",
};

function displayDate(value, fallback = "Not added yet") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

function valueOrFallback(value) {
  return String(value || "").trim() || "Not added yet";
}

export default function ProfileOverview() {
  const { user, profile } = useSelector((state) => state.auth || {});
  const { savedIds } = useSavedTrips();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    let active = true;
    apiRequest("/bookings/me")
      .then((response) => {
        if (active) setBookings(response?.data?.bookings || []);
      })
      .catch(() => {
        if (active) setBookings([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const upcomingCount = useMemo(
    () => bookings.filter((booking) => booking.statusGroup === "upcoming").length,
    [bookings],
  );

  const nextBooking = useMemo(
    () => bookings
      .filter((booking) => booking.statusGroup === "upcoming")
      .sort((a, b) => new Date(a.startsAt || a.date) - new Date(b.startsAt || b.date))[0] || null,
    [bookings],
  );

  const completion = useMemo(() => {
    const values = [
      profile?.fullName,
      profile?.avatar,
      profile?.phoneNumber,
      profile?.nationality,
      profile?.dateOfBirth,
      profile?.preferredLanguage,
    ];
    return Math.round((values.filter((value) => Boolean(String(value || "").trim())).length / values.length) * 100);
  }, [profile]);

  return (
    <div className={styles.pageContent}>
      <header className={styles.pageHeader}>
        <div>
          <span>Account overview</span>
          <h2>Your traveler profile</h2>
          <p>Keep your information current so booking and account recovery stay straightforward.</p>
        </div>
        <Link to="/user/profile/edit" className={styles.editLink}>
          <PencilLine size={17} /> Edit details
        </Link>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <div className={styles.summaryIcon}><CalendarDays size={20} /></div>
          <span>Upcoming bookings</span>
          <strong>{upcomingCount}</strong>
          <Link to="/user/profile/bookings">View bookings <ArrowRight size={14} /></Link>
        </article>
        <article className={styles.summaryCard}>
          <div className={styles.summaryIcon}><Heart size={20} /></div>
          <span>Saved experiences</span>
          <strong>{savedIds?.size || 0}</strong>
          <Link to="/user/saved">View saved <ArrowRight size={14} /></Link>
        </article>
        <article className={styles.summaryCard}>
          <div className={styles.summaryIcon}><BadgeCheck size={20} /></div>
          <span>Profile completion</span>
          <strong>{completion}%</strong>
          <Link to="/user/profile/edit">Complete profile <ArrowRight size={14} /></Link>
        </article>
      </section>

      {nextBooking && (
        <section className={styles.nextTripCard}>
          <div className={styles.nextTripIcon}><MapPinned size={22} /></div>
          <div>
            <span>Next experience</span>
            <h3>{nextBooking.title}</h3>
            <p>{displayDate(nextBooking.startsAt || nextBooking.date, "Upcoming")} · {nextBooking.startTime || "Time in booking"}</p>
          </div>
          <Link to="/user/profile/bookings">Open booking <ArrowRight size={16} /></Link>
        </section>
      )}

      <div className={styles.detailGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <UserRound size={19} />
            <div><h3>Personal information</h3><p>Details used for your traveler account.</p></div>
          </div>
          <dl className={styles.detailsList}>
            <div><dt>Full name</dt><dd>{valueOrFallback(profile?.fullName)}</dd></div>
            <div><dt>Date of birth</dt><dd>{displayDate(profile?.dateOfBirth)}</dd></div>
            <div><dt>Gender</dt><dd>{profile?.gender === "other" ? "Prefer not to say" : valueOrFallback(profile?.gender)}</dd></div>
            <div><dt>Nationality</dt><dd>{valueOrFallback(profile?.nationality)}</dd></div>
            <div><dt>Preferred language</dt><dd>{languageNames[profile?.preferredLanguage] || valueOrFallback(profile?.preferredLanguage)}</dd></div>
          </dl>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <ShieldCheck size={19} />
            <div><h3>Account & contact</h3><p>Sign-in and contact information for this account.</p></div>
          </div>
          <dl className={styles.detailsList}>
            <div><dt><Mail size={14} /> Email</dt><dd>{valueOrFallback(user?.email)}</dd></div>
            <div><dt><Phone size={14} /> Phone</dt><dd>{valueOrFallback(profile?.phoneNumber)}</dd></div>
            <div><dt><Globe2 size={14} /> Member since</dt><dd>{displayDate(user?.createdAt, "Recently joined")}</dd></div>
            <div><dt><CheckCircle2 size={14} /> Email status</dt><dd className={user?.emailVerified ? styles.positive : ""}>{user?.emailVerified ? "Verified" : "Not verified"}</dd></div>
          </dl>
        </section>
      </div>

      <section className={styles.personalBookingNote}>
        <ShieldCheck size={20} />
        <div>
          <strong>One account, one traveler</strong>
          <p>Every NEFRU booking reserves one place for the signed-in account holder. Group size on an experience describes the guide's total group capacity.</p>
        </div>
      </section>
    </div>
  );
}
