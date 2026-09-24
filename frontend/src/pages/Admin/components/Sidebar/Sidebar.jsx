import {
  BarChart3,
  CalendarCheck2,
  LayoutDashboard,
  MapPinned,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import Logo from "../../../../assets/logo.png";
import styles from "./Sidebar.module.css";

const pages = [
  { label: "Overview", to: "/admin/overview", icon: LayoutDashboard },
  { label: "Trust & safety", to: "/admin/operations", icon: ShieldAlert },
  { label: "Accounts", to: "/admin/accounts", icon: UsersRound },
  { label: "Tour moderation", to: "/admin/cms", icon: MapPinned },
  { label: "Bookings", to: "/admin/booking", icon: CalendarCheck2 },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
];

export default function SideBar() {
  const navigate = useNavigate();
  return (
    <div className={styles.sidebar}>
      <button type="button" className={styles.brand} onClick={() => navigate("/admin/overview")}>
        <img src={Logo} alt="" />
        <span><strong>NEFRU</strong><small>ADMIN CONSOLE</small></span>
      </button>
      <nav className={styles.items} aria-label="Admin sections">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <NavLink key={page.to} to={page.to} className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}>
              <Icon size={18} /><span>{page.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className={styles.footerNote}><strong>Operations console</strong><span>Moderation, accounts, bookings and platform health.</span></div>
    </div>
  );
}
