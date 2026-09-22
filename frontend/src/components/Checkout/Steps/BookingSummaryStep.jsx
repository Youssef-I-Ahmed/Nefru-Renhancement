import { FiArrowRight, FiCalendar, FiCheckCircle, FiInfo, FiUser } from "react-icons/fi";

import { resolveMediaUrl } from "../../../services/api";
import styles from "../Checkout.module.css";

export default function BookingSummaryStep({ bookingData, onNext, expired }) {
  return (
    <div className={styles.content}>
      <div className={styles.stepTitleContainer}>
        <span className={styles.stepKicker}>Review</span>
        <h3 className={styles.stepTitle}>Check your booking details</h3>
        <p className={styles.stepIntro}>Your booking is personal: one NEFRU account reserves one place for its account holder.</p>
      </div>

      <div className={styles.tourBannerOverlay}>
        <img src={resolveMediaUrl(bookingData.image)} alt={bookingData.title} className={styles.tourBanner} />
        <span className={styles.tourBannerTag}><FiCheckCircle /> Personal booking</span>
        <h4 className={styles.tourBannerTitle}>{bookingData.title}</h4>
      </div>

      <div className={styles.infoGrid}>
        <div className={styles.infoBox}>
          <FiCalendar className={styles.infoIcon} />
          <div>
            <div className={styles.infoLabel}>Schedule</div>
            <div className={styles.infoValue}>{bookingData.date}</div>
            <div className={styles.infoSub}>{bookingData.startTime}</div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <FiUser className={styles.infoIcon} />
          <div>
            <div className={styles.infoLabel}>Traveler</div>
            <div className={styles.infoValue}>Account holder</div>
            <div className={styles.infoSub}>1 reserved place</div>
          </div>
        </div>
      </div>

      <div className={styles.priceBox}>
        <div className={styles.priceHeader}>Price details</div>
        <div className={styles.priceRow}><span>Your place</span><span>${bookingData.totalAmount.toFixed(2)}</span></div>
        <div className={styles.priceRowTotal}><span>Total</span><span className={styles.priceTotalValue}>${bookingData.totalAmount.toFixed(2)} USD</span></div>
      </div>

      <div className={styles.confirmationBanner}>
        <FiCheckCircle />
        <span><strong>Instant confirmation.</strong> A successful payment confirms the booking immediately.</span>
      </div>

      <div className={styles.cancellationNote}>
        <FiInfo />
        <span>Cancellation is available before the trip starts. Automatic refund handling is not available yet.</span>
      </div>

      <button className={styles.mainBtn} onClick={onNext} disabled={expired}>
        Choose payment method <FiArrowRight />
      </button>
    </div>
  );
}
