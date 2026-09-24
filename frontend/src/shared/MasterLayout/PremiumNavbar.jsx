import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
  Heart,
  LogIn,
  LogOut,
  Search,
  Settings,
  User,
} from "lucide-react";
import {
  FiHeadphones,
  FiLock,
  FiStar,
} from "react-icons/fi";

import SearchModal from "@/components/Search/SearchModal";
import logo from "@/assets/images/logo.png";
import profileImage from "@/assets/images/user/user1.png";
import { logoutUser } from "@/store/slices/authSlice";
import NotificationPopover from "@/pages/User/Notifications/components/NotificationPopover";
import { resolveMediaUrl } from "@/services/api";

import styles from "./PremiumNavbar.module.css";

const touristMenuItems = [
  { path: "/user/profile", label: "My Profile", icon: User },
  { path: "/user/profile/bookings", label: "My Bookings", icon: Calendar },
  { path: "/user/saved", label: "Saved experiences", icon: Heart },
  { path: "/user/profile/reviews", label: "Reviews written", icon: FiStar },
  { path: "/user/profile/change-password", label: "Sign-in & Security", icon: FiLock },
  { path: "/user/settings", label: "Settings", icon: Settings },
  { path: "/user/profile/support", label: "Help & Support", icon: FiHeadphones },
];

const guideMenuItems = [
  { path: "/guide/dashboard", label: "Guide Dashboard", icon: User },
  { path: "/guide/calendar", label: "Guide Calendar", icon: Calendar },
  { path: "/guide/profile", label: "Guide Profile", icon: FiStar },
  { path: "/guide/notifications", label: "Guide Notifications", icon: Bell },
];

const adminMenuItems = [
  { path: "/admin/overview", label: "Admin Dashboard", icon: User },
];

const resolveGuideNotificationLink = (notification) => {
  const type = notification?.type?.trim();
  let link =
    typeof notification?.link === "string" &&
    notification.link.startsWith("/guide")
      ? notification.link
      : null;

  if (type === "booking") link = "/guide/bookings";
  if (type === "payment") link = "/guide/earnings";
  if (type === "review") link = "/guide/reviews";
  if (type === "account") {
    link = notification?.metadata?.verificationStatus
      ? "/guide/verification"
      : "/guide/profile";
  }
  if (type === "support") link = "/guide/profile";

  return link;
};

const getImgSrc = (img, fallback) => {
  if (!img || typeof img !== "string") return fallback;
  const source = /^(https?:|data:|blob:)/i.test(img) || img.startsWith("/")
    ? img
    : `/uploads/${img}`;
  return resolveMediaUrl(source) || fallback;
};

function PremiumNavbar({ hideOnMobile = false }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const actionsRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const { user, profile, isAuthenticated } = useSelector((state) => state.auth || {});
  const notifications = useSelector((state) => state.notifications?.notifications || []);
  const unreadCount = useSelector((state) => state.notifications?.unreadCount ?? notifications.filter((notification) => !notification.isRead).length);

  const fullName = profile?.fullName || user?.email?.split("@")[0] || "Traveler";
  const firstName = fullName.split(" ")[0];
  const email = user?.email || "";
  const avatar = getImgSrc(profile?.avatar || profile?.profileImage, profileImage);
  const role = user?.role;

  const profileMenuItems = role === "guide"
    ? guideMenuItems
    : role === "admin"
      ? adminMenuItems
      : touristMenuItems;

  const defaultProfilePath = role === "guide"
    ? "/guide/profile"
    : role === "admin"
      ? "/admin/overview"
      : "/user/profile";

  useEffect(() => {
    if (!showNotifications && !showProfile) return undefined;

    const closeMenus = (event) => {
      if (!actionsRef.current?.contains(event.target)) {
        setShowNotifications(false);
        setShowProfile(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
        setShowProfile(false);
      }
    };

    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showNotifications, showProfile]);

  const goHomeSection = (sectionId) => {
    setShowNotifications(false);
    setShowProfile(false);

    if (
      location.pathname === "/explore" ||
      location.pathname === "/user" ||
      location.pathname === "/user/home"
    ) {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    navigate(`/explore#${sectionId}`);
  };

  const navigateFromMenu = (path) => {
    setShowProfile(false);
    navigate(path);
  };

  const handleLogout = () => {
    setShowProfile(false);
    dispatch(logoutUser());
    navigate("/auth/login", { replace: true });
  };

  const goToLogin = () => {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <>
      <header className={`${styles.header} ${hideOnMobile ? styles.hideOnMobile : ""}`}>
        <div className={styles.inner}>
          <button
            type="button"
            className={styles.brand}
            onClick={() => navigate("/explore")}
            aria-label="Go to NEFRU home"
          >
            <img src={logo} alt="" aria-hidden="true" />
            <span className={styles.brandText}>
              <strong>NEFRU</strong>
              <small>Egypt experiences</small>
            </span>
          </button>

          <nav className={styles.desktopNav} aria-label="Main navigation">
            <button type="button" onClick={() => goHomeSection("popular-tours")}>Experiences</button>
            <button type="button" onClick={() => navigate("/nearby")}>Nearby</button>
            <button type="button" onClick={() => goHomeSection("explore-egypt")}>Destinations</button>
            <button type="button" onClick={() => goHomeSection("top-guides")}>Guides</button>
          </nav>

          <div className={styles.desktopActions} ref={actionsRef}>
            <button
              type="button"
              className={styles.searchTrigger}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} aria-hidden="true" />
              <span>Search Egypt</span>
            </button>

            <button
              type="button"
              className={styles.iconButton}
              onClick={() => navigate("/user/saved")}
              aria-label="Saved experiences"
            >
              <Heart size={19} aria-hidden="true" />
            </button>

            {isAuthenticated ? (
              <>
                {role !== "admin" && (
                  <div className={styles.actionWrapper}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      data-open={showNotifications || undefined}
                      onClick={() => {
                        setShowNotifications((current) => !current);
                        setShowProfile(false);
                      }}
                      aria-label="Open notifications"
                      aria-expanded={showNotifications}
                    >
                      <Bell size={19} aria-hidden="true" />
                      {unreadCount > 0 && (
                        <span className={styles.notificationBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                      )}
                    </button>

                    {showNotifications && (
                      <NotificationPopover
                        onClose={() => setShowNotifications(false)}
                        viewAllTo={role === "guide" ? "/guide/notifications" : "/user/notifications"}
                        resolveLink={role === "guide" ? resolveGuideNotificationLink : undefined}
                      />
                    )}
                  </div>
                )}

                <div className={styles.actionWrapper}>
                  <button
                    type="button"
                    className={styles.profileTrigger}
                    data-open={showProfile || undefined}
                    onClick={() => {
                      setShowProfile((current) => !current);
                      setShowNotifications(false);
                    }}
                    aria-label="Open profile menu"
                    aria-expanded={showProfile}
                    aria-haspopup="menu"
                  >
                    <img src={avatar} alt="" aria-hidden="true" />
                    <span>{firstName}</span>
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>

                  {showProfile && (
                    <div className={styles.dropdown} role="menu" aria-label="Profile menu">
                      <button
                        type="button"
                        className={styles.profileHeader}
                        onClick={() => navigateFromMenu(defaultProfilePath)}
                      >
                        <img src={avatar} alt={`${fullName} profile`} />
                        <span>
                          <strong>{fullName}</strong>
                          <small>{email}</small>
                          <em>{role === "guide" ? "Open guide portal" : role === "admin" ? "Open admin portal" : "View profile"}</em>
                        </span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </button>

                      <div className={styles.menuList}>
                        {profileMenuItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = location.pathname === item.path;
                          return (
                            <button
                              key={item.path}
                              type="button"
                              className={styles.menuItem}
                              data-active={isActive || undefined}
                              onClick={() => navigateFromMenu(item.path)}
                              role="menuitem"
                            >
                              <span className={styles.menuIcon}><Icon size={17} aria-hidden="true" /></span>
                              <span>{item.label}</span>
                              <ChevronRight size={16} aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>

                      <div className={styles.menuFooter}>
                        <button type="button" className={styles.logoutButton} onClick={handleLogout}>
                          <LogOut size={17} aria-hidden="true" /> Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button type="button" className={styles.signInButton} onClick={goToLogin}>
                <LogIn size={17} aria-hidden="true" /> Sign in
              </button>
            )}
          </div>

          <div className={styles.mobileActions}>
            <button
              type="button"
              className={styles.mobileSearch}
              onClick={() => setSearchOpen(true)}
              aria-label="Search Egypt"
            >
              <Search size={17} aria-hidden="true" />
              <span>Search</span>
            </button>
            {isAuthenticated && role !== "admin" ? (
              <button
                type="button"
                className={styles.mobileIconButton}
                onClick={() => navigate(role === "guide" ? "/guide/notifications" : "/user/notifications")}
                aria-label="Notifications"
              >
                <Bell size={19} aria-hidden="true" />
                {unreadCount > 0 && <span className={styles.mobileDot} />}
              </button>
            ) : !isAuthenticated ? (
              <button type="button" className={styles.mobileSignIn} onClick={goToLogin}>
                Sign in
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

export default PremiumNavbar;
