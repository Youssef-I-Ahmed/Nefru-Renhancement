import { Link } from "react-router-dom";
import {
  Bell,
  CalendarCheck,
  CreditCard,
  Info,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  Star,
} from "lucide-react";

import { formatTimeAgo } from "../utils/formatTimeAgo";
import styles from "./NotificationItem.module.css";

const iconMap = {
  booking: CalendarCheck,
  payment: CreditCard,
  account: ShieldCheck,
  support: MessageCircle,
  system: Info,
  review: Star,
  trip: MapPinned,
  reminder: Bell,
  default: Bell,
};

export default function NotificationItem({ notification, compact = false, onRead }) {
  const type = notification?.type?.trim();
  const Icon = iconMap[type] || iconMap.default;
  const isUnread = !notification?.isRead;
  const rawLink = notification?.link;
  const safeLink =
    typeof rawLink === "string" &&
    rawLink.startsWith("/") &&
    !rawLink.startsWith("//")
      ? rawLink
      : "";
  const hasLink = Boolean(safeLink);
  const itemClassName = `${styles.item} ${isUnread ? styles.unread : ""} ${compact ? styles.compact : ""}`;
  const content = <>
    <div className={styles.iconBox} aria-hidden="true"><Icon size={19} /></div>
    <div className={styles.content}>
      <div className={styles.titleRow}><h3>{notification?.title || "Notification"}</h3>{isUnread && <span className={styles.dot} aria-label="Unread" />}</div>
      <p>{notification?.message || "You have a new notification."}</p>
      <time dateTime={notification?.createdAt}>{formatTimeAgo(notification?.createdAt)}</time>
    </div>
  </>;
  const common = {
    className: itemClassName,
    onClick: () => {
      if (isUnread) onRead?.(notification.id, hasLink);
    },
    "data-type": type || "default",
  };
  return hasLink ? <Link to={safeLink} {...common}>{content}</Link> : <button type="button" {...common}>{content}</button>;
}
