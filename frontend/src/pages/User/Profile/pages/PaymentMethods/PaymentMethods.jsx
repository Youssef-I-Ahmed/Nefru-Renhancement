import { CreditCard, ExternalLink, ShieldCheck, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";

import styles from "../ProfilePageShared.module.css";

export default function PaymentMethods() {
  const navigate = useNavigate();

  return (
    <div className={styles.pageContent}>
      <header className={styles.header}>
        <div>
          <h1>Payments</h1>
          <p>Payments are completed securely through Paymob during checkout.</p>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}><WalletCards /></div>
          <h3>No saved payment credentials on NEFRU</h3>
          <p>
            NEFRU does not store raw card numbers. When you book an experience, you are redirected to Paymob&apos;s secure hosted checkout and return here after payment.
          </p>
          <button type="button" className={styles.primaryButton} onClick={() => navigate("/user/profile/bookings")}>
            <CreditCard /> View my bookings
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitleCompact}>
          <ShieldCheck />
          <div>
            <h2>Webhook-verified payments</h2>
            <p>
              A browser redirect never confirms a booking by itself. NEFRU waits for Paymob&apos;s signed server callback before marking your booking as paid and confirmed.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitleCompact}>
          <ExternalLink />
          <div>
            <h2>Payment options</h2>
            <p>The methods shown at checkout depend on the Paymob Integration IDs enabled for the current environment.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
