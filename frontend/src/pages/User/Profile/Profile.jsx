import { useDispatch, useSelector } from "react-redux";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpenCheck,
  Heart,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";

import { resolveMediaUrl } from "../../../services/api";
import { logoutUser } from "../../../store/slices/authSlice";
import PremiumFooter from "../Home/PremiumFooter";
import styles from "./Profile.module.css";

const accountLinks = [
  { to: "/user/profile", label: "Overview", icon: UserRound, end: true },
  { to: "/user/profile/bookings", label: "My bookings", icon: BookOpenCheck },
  { to: "/user/saved", label: "Saved", icon: Heart },
  { to: "/user/profile/reviews", label: "Reviews", icon: Star },
  { to: "/user/profile/change-password", label: "Security", icon: ShieldCheck },
  { to: "/user/notifications", label: "Notifications", icon: Bell },
  { to: "/user/settings", label: "Settings", icon: Settings },
  { to: "/user/profile/support", label: "Support", icon: LifeBuoy },
];

function getInitials(fullName = "Traveler") {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Profile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, profile } = useSelector((state) => state.auth || {});

  const fullName = profile?.fullName || user?.email?.split("@")[0] || "Traveler";
  const avatar = resolveMediaUrl(profile?.avatar || "");
  const verified = Boolean(user?.emailVerified);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate("/auth/login", { replace: true });
  };

  return (
    <>
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.accountHero}>
            <div className={styles.identity}>
              {avatar ? (
                <img className={styles.avatar} src={avatar} alt={`${fullName} profile`} />
              ) : (
                <div className={styles.avatarFallback}>{getInitials(fullName)}</div>
              )}

              <div className={styles.identityCopy}>
                <span className={styles.eyebrow}>Your NEFRU account</span>
                <h1>{fullName}</h1>
                <p>{user?.email || "Traveler account"}</p>
                <div className={styles.identityBadges}>
                  <span>Traveler</span>
                  <span data-verified={verified || undefined}>
                    {verified ? "Email verified" : "Email not verified"}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className={styles.editProfileButton}
              onClick={() => navigate("/user/profile/edit")}
            >
              Edit profile
            </button>
          </section>

          <div className={styles.accountLayout}>
            <aside className={styles.sidebar}>
              <div className={styles.navScroller}>
                <nav className={styles.accountNav} aria-label="Account navigation">
                  {accountLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
                        }
                      >
                        <Icon size={18} aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </div>

              <div className={styles.sidebarNote}>
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>Personal booking account</strong>
                  <span>Each account reserves one traveler place per booking.</span>
                </div>
              </div>

              <button type="button" className={styles.logoutButton} onClick={handleLogout}>
                <LogOut size={18} aria-hidden="true" /> Log out
              </button>
            </aside>

            <section className={styles.content}>
              <Outlet />
            </section>
          </div>
        </div>
      </main>
      <PremiumFooter />
    </>
  );
}
