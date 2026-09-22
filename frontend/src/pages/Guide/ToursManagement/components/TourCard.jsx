import styles from "./TourCard.module.css";

function TourCard({
  image,
  title,
  duration,
  maxPeople,
  price,
  status,
  actionText,
  onAction,
}) {
  return (
    <div className={styles.card}>
      <div className={styles.imageContainer}>
        <img src={image} alt={title} className={styles.image} />

        <span
          className={`${styles.badge} ${
            styles[status?.toLowerCase()]
          }`}
        >
          {status}
        </span>
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>

        <div className={styles.info}>
          <span>🕒 {duration}</span>
          <span>👥 Max {maxPeople}</span>
        </div>

        <div className={styles.footer}>
          <div className={styles.price}>
            ${price}
            <span>/ person</span>
          </div>

          <button
            className={styles.actionBtn}
            onClick={onAction}
          >
            {actionText} →
          </button>
        </div>
      </div>
    </div>
  );
}

export default TourCard;