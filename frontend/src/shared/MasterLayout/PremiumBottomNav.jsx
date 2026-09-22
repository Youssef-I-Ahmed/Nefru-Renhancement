import { Briefcase, Heart, Home, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./PremiumBottomNav.module.css";

const items = [
  { label: "Home", path: "/user/home", icon: Home, match: (pathname) => pathname === "/user" || pathname === "/user/home" },
  { label: "Trips", path: "/user/trips", icon: Briefcase, match: (pathname) => pathname.startsWith("/user/trips") },
  { label: "Saved", path: "/user/saved", icon: Heart, match: (pathname) => pathname.startsWith("/user/saved") },
  { label: "Profile", path: "/user/profile", icon: User, match: (pathname) => pathname.startsWith("/user/profile") },
];

function PremiumBottomNav({ hidden = false }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (hidden) return null;

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
