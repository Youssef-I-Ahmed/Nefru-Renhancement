import { FiArrowRight, FiCheck, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { resolveMediaUrl } from "../../../services/api";
import styles from "../Checkout.module.css";

export default function PaymentSuccessStep({ bookingData }) {
  const navigate = useNavigate();

  return (
    <div className={styles.content}>
      <div className={styles.successContainer}>
        <div className={styles.successCheckBadge}><FiCheck /></div>
        <div>
          <span className={styles.stepKicker}>Confirmed</span>
          <h2 className={styles.successHeading}>You’re booked.</h2>
          <p className={styles.successSub}>Payment succeeded and your place is confirmed instantly.</p>
        </div>

        <div className={styles.ticketCard}>
          <div className={styles.ticketRow}>
            <span>Booking ID</span>
            <span className={styles.ticketId}>{bookingData.bookingId}</span>
          </div>
          <div className={styles.ticketExperience}>
            <img src={resolveMediaUrl(bookingData.image)} alt="" />
            <div>
              <strong>{bookingData.title}</strong>
              <span>{bookingData.date}</span>
              <span><FiUser /> 1 traveler · account holder</span>
            </div>
          </div>
        </div>

        <div className={styles.successActions}>
          <button className={styles.mainBtn} onClick={() => navigate("/user/profile/bookings")}>
            Go to My Bookings <FiArrowRight />
          </button>
          <button className={styles.secondaryBtn} onClick={() => navigate("/user/home")}>Back to Home</button>
        </div>
      </div>
    </div>
  );
}
