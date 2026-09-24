import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  clearNotifications,
  fetchNotifications,
} from "../../../store/slices/notificationSlice";

const POLL_INTERVAL_MS = 60_000;

export default function NotificationSync() {
  const dispatch = useDispatch();
  const initialized = useSelector((state) => state.auth.initialized);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (!initialized) return undefined;

    if (!isAuthenticated) {
      dispatch(clearNotifications());
      return undefined;
    }

    const sync = (force = false) => {
      dispatch(fetchNotifications({ force }));
    };

    sync(true);

    const intervalId = window.setInterval(() => sync(false), POLL_INTERVAL_MS);
    const handleFocus = () => sync(false);
    const handleOnline = () => sync(true);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sync(false);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [dispatch, initialized, isAuthenticated]);

  return null;
}
