import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

import { DEV_AUTH_BYPASS } from "../config/devAccess";
import { RouteLoadingScreen } from "./ProtectedRoute";
import { getSafeReturnTo } from "./returnTo.js";

export default function RequireApprovedGuide() {
  const location = useLocation();
  const { initialized, isAuthenticated, user, profile } = useSelector(
    (state) => state.auth || {},
  );

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

  if (user.role !== "guide") {
    return <Navigate to={user.role === "admin" ? "/admin/overview" : "/user/home"} replace />;
  }

  if (profile?.verificationStatus !== "approved") {
    return <Navigate to="/guide/verification" replace />;
  }

  return <Outlet />;
}
