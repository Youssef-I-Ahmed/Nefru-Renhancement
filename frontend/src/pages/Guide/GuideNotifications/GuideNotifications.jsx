import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  fetchNotifications,
  markAllAsRead,
  markAsRead,
} from "../../../store/slices/notificationSlice";
import NotificationItem from "../../User/Notifications/components/NotificationItem";
import { formatTimeAgo } from "../../User/Notifications/utils/formatTimeAgo";
import styles from "./GuideNotifications.module.css";

const resolveGuideNotification = (notification) => {
  const type = notification?.type?.trim();
  let link = notification?.link?.startsWith("/guide") ? notification.link : null;

  if (type === "booking") link = "/guide/bookings";
  if (type === "payment") link = "/guide/earnings";
  if (type === "review") link = "/guide/reviews";
  if (type === "account") link = notification?.metadata?.verificationStatus ? "/guide/verification" : "/guide/profile";
  if (type === "support") link = "/guide/profile";

  return { ...notification, link };
};

const filters = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Bookings", value: "booking" },
  { label: "Payments", value: "payment" },
  { label: "Reviews", value: "review" },
  { label: "Account", value: "account" },
];

export default function GuideNotifications() {
  const [activeFilter, setActiveFilter] = useState("all");
  const dispatch = useDispatch();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    actionError,
    lastSyncedAt,
  } = useSelector((state) => state.notifications);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return notifications;
    if (activeFilter === "unread") return notifications.filter((notification) => !notification.isRead);
    return notifications.filter((notification) => notification.type?.trim() === activeFilter);
  }, [activeFilter, notifications]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</span>
          <h1>Guide notifications</h1>
          <p>Bookings, successful payments, reviews, and verification updates from NEFRU.</p>
          {lastSyncedAt && (
            <small className={styles.syncMeta}>
              Updated {formatTimeAgo(lastSyncedAt)}
            </small>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => dispatch(fetchNotifications({ force: true }))} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" onClick={() => dispatch(markAllAsRead())} disabled={unreadCount === 0}>
            <CheckCheck size={16} /> Mark all read
          </button>
        </div>
      </header>

      {(actionError || (error && notifications.length > 0)) && (
        <div className={styles.warning} role="status">
          <span>{actionError || "Could not refresh notifications. Showing the latest saved list."}</span>
          <button type="button" onClick={() => dispatch(fetchNotifications({ force: true }))}>
            Try again
          </button>
        </div>
      )}
      {error && notifications.length === 0 && <div className={styles.error}>{error}</div>}

      <section className={styles.panel}>
        <div className={styles.tabs} role="tablist" aria-label="Notification filters">
          {filters.map((filter) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.value}
              key={filter.value}
              data-active={activeFilter === filter.value || undefined}
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
              {filter.value === "unread" && unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
          ))}
        </div>

        {loading && notifications.length === 0 ? (
          <div className={styles.emptyState}>Loading notifications…</div>
        ) : filteredNotifications.length === 0 ? (
          <div className={styles.emptyState}>
            <span><Bell size={27} /></span>
            <h2>No notifications here</h2>
            <p>New booking, payment, review, and account updates will appear here.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={resolveGuideNotification(notification)}
                onRead={(id) => dispatch(markAsRead(id))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
