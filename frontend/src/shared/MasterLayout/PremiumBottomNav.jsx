import {
  Briefcase,
  Heart,
  Home,
  LayoutDashboard,
  LogIn,
  MapPinned,
  User,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./PremiumBottomNav.module.css";

const baseItems = [
  { label: "Home", path: "/explore", icon: Home, match: (pathname) => pathname === "/explore" || pathname === "/user" || pathname === "/user/home" },
  { label: "Trips", path: "/trips", icon: Briefcase, match: (pathname) => pathname === "/trips" || pathname.startsWith("/trips/") || pathname.startsWith("/user/trips") },
];

const touristItems = [
  ...baseItems,
  { label: "Saved", path: "/user/saved", icon: Heart, match: (pathname) => pathname.startsWith("/user/saved") },
  { label: "Profile", path: "/user/profile", icon: User, match: (pathname) => pathname.startsWith("/user/profile") },
];

const guideItems = [
  ...baseItems,
  { label: "Nearby", path: "/nearby", icon: MapPinned, match: (pathname) => pathname === "/nearby" },
  { label: "Guide", path: "/guide/dashboard", icon: LayoutDashboard, match: (pathname) => pathname.startsWith("/guide") },
];

const guestItems = [
  ...baseItems,
  { label: "Nearby", path: "/nearby", icon: MapPinned, match: (pathname) => pathname === "/nearby" },
  { label: "Sign in", path: "/auth/login", icon: LogIn, match: (pathname) => pathname.startsWith("/auth") },
];

function PremiumBottomNav({ hidden = false }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isAuthenticated } = useSelector((state) => state.auth || {});
  const role = user?.role;

  if (hidden || role === "admin") return null;

  const items =
    role === "guide"
      ? guideItems
      : isAuthenticated
        ? touristItems
        : guestItems;

  return (
    <nav className={styles.nav} aria-label="Mobile navigation">
      <div className={styles.inner}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <button
              key={item.path}
              type="button"
              className={styles.item}
              data-active={active || undefined}
              onClick={() => navigate(item.path)}
              aria-current={active ? "page" : undefined}
            >
              <span className={styles.iconWrap}><Icon size={20} aria-hidden="true" /></span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default PremiumBottomNav;
