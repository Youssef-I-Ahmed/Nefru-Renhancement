import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";

import { logoutUser } from "../../../../store/slices/authSlice";
import styles from "./Navbar.module.css";

const PAGE_TITLES = {
  overview: ["Overview", "Platform operations at a glance"],
  accounts: ["Accounts", "Manage tourists, guides, verification and access"],
  cms: ["Tour moderation", "Review and control marketplace experiences"],
  analytics: ["Analytics", "Understand marketplace performance"],
  booking: ["Bookings", "Review reservation and payment activity"],
};

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth?.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const activeKey = location.pathname.split("/").filter(Boolean).pop() || "overview";
  const [title, subtitle] = PAGE_TITLES[activeKey] || PAGE_TITLES.overview;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const escape = (event) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  const email = user?.email || "admin@nefru";
  const displayName = user?.fullName || email.split("@")[0] || "Admin";
  const initial = displayName.slice(0, 1).toUpperCase();

  const logout = () => {
    setMenuOpen(false);
    dispatch(logoutUser());
    navigate("/auth/login", { replace: true });
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.context}><span>NEFRU Admin</span><strong>{title}</strong><small>{subtitle}</small></div>
      <div className={styles.accountWrap} ref={menuRef}>
        <button type="button" className={styles.accountButton} onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
          <span className={styles.avatar}>{initial}</span>
          <span className={styles.identity}><strong>{displayName}</strong><small>Administrator</small></span>
          <ChevronDown size={15} />
        </button>
        {menuOpen && (
          <div className={styles.menu} role="menu">
            <div className={styles.menuHeader}><span className={styles.menuAvatar}>{initial}</span><span><strong>{displayName}</strong><small>{email}</small></span></div>
            <div className={styles.role}><ShieldCheck size={14} /> Admin access</div>
            <button type="button" onClick={logout}><LogOut size={15} /> Log out</button>
          </div>
        )}
      </div>
    </header>
  );
}
