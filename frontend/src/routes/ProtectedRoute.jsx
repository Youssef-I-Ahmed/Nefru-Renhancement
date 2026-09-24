import { getSafeReturnTo } from "./returnTo.js";
import { Navigate, Outlet, matchPath, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

import { DEV_AUTH_BYPASS } from "../config/devAccess";

const PUBLIC_USER_PATTERNS = [
  "/user",
  "/user/home",
  "/user/nearby",
  "/user/trips",
  "/user/trips/:id",
  "/user/trips/:id/guide",
];

const TOURIST_ONLY_PATTERNS = [
  "/user/saved",
  "/user/profile",
  "/user/profile/*",
  "/user/settings",
  "/user/notifications",
  "/user/trips/:id/book",
  "/user/trips/:id/book/*",
];

function matchesAny(pathname, patterns) {
  return patterns.some((pattern) => Boolean(matchPath({ path: pattern, end: true }, pathname)));
}

function getHomePathByRole(role) {
  if (role === "admin") return "/admin/overview";
  if (role === "guide") return "/guide/dashboard";
  return "/explore";
}


export function RouteLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "45vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        background: "#fbfaf7",
        color: "#16233f",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            margin: "0 auto 12px",
            borderRadius: "50%",
            border: "3px solid #e8e2d7",
            borderTopColor: "#c1633b",
            animation: "nefruRouteSpin .8s linear infinite",
          }}
        />
        <style>{"@keyframes nefruRouteSpin{to{transform:rotate(360deg)}}"}</style>
        <strong style={{ display: "block", fontSize: 14 }}>Checking your session…</strong>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();
  const auth = useSelector((state) => state.auth || {});
  const {
    initialized = false,
    isAuthenticated = false,
    user = null,
  } = auth;

  const isUserArea = location.pathname === "/user" || location.pathname.startsWith("/user/");
  const isPublicBrowseRoute = isUserArea && matchesAny(location.pathname, PUBLIC_USER_PATTERNS);

  // Discovery is intentionally public: guests can browse Home, Trips, Tour Details,
  // Nearby and Guide Details. Authentication is required only when an action becomes personal.
  if (isPublicBrowseRoute) return <Outlet />;

  // Explicit local-development escape hatch. Production can never enable this
  // because DEV_AUTH_BYPASS is already guarded by import.meta.env.DEV.
  if (DEV_AUTH_BYPASS) return <Outlet />;

  if (!initialized) return <RouteLoadingScreen />;

  if (!isAuthenticated || !user) {
    const returnTo = getSafeReturnTo(location);
    return (
      <Navigate
        to={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
        state={{ from: returnTo }}
      />
    );
  }

  const role = user.role;

  // Guides and admins may browse the tourist marketplace, but tourist account actions
  // (saved items, booking checkout, tourist profile/settings) remain tourist-only.
  if (isUserArea && matchesAny(location.pathname, TOURIST_ONLY_PATTERNS) && role !== "tourist") {
    return <Navigate to={getHomePathByRole(role)} replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={getHomePathByRole(role)} replace />;
  }

  return <Outlet />;
}
