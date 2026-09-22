import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock3,
  CreditCard,
  ExternalLink,
  LockKeyhole,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { apiRequest, resolveUploadsUrl } from "../../services/api";
import PriceDisplay from "../../shared/components/PriceDisplay/PriceDisplay";
import styles from "./Checkout.module.css";
import PaymobPixel from "./PaymobPixel";

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function CheckoutWizard({ initialData }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnedFromPaymob = searchParams.get("payment") === "return";
  const bookingId = initialData.bookingId || initialData.id;
  const [bookingState, setBookingState] = useState(initialData);
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const expiresAt = new Date(initialData.holdExpiresAt || 0).getTime();
    return Number.isFinite(expiresAt)
      ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      : 0;
  });
  const [startingPayment, setStartingPayment] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(returnedFromPaymob);
  const [checkoutSession, setCheckoutSession] = useState(null);
  const [error, setError] = useState("");

  const confirmed =
    bookingState.status === "confirmed" && bookingState.paymentStatus === "paid";
  const expired = bookingState.status === "expired" || (!confirmed && remainingSeconds <= 0);
  const failedPayment = bookingState.paymentStatus === "failed";

  useEffect(() => {
    const update = () => {
      if (!bookingState.holdExpiresAt || confirmed) {
        setRemainingSeconds(0);
        return;
      }
      const expiresAt = new Date(bookingState.holdExpiresAt).getTime();
      setRemainingSeconds(
        Number.isFinite(expiresAt)
          ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
          : 0,
      );
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [bookingState.holdExpiresAt, confirmed]);

  const countdown = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    return `${minutes}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  }, [remainingSeconds]);

  const mergePaymentStatus = useCallback((status = {}) => {
    setBookingState((current) => ({ ...current, ...status }));
    return {
      ...status,
      confirmed: Boolean(status.confirmed),
    };
  }, []);

  const checkPayment = useCallback(async ({ silent = false } = {}) => {
    if (!bookingId) return { confirmed: false };
    try {
      const response = await apiRequest(`/payments/${bookingId}/status`);
      const status = mergePaymentStatus(response?.data || {});
      if (!silent) setError("");
      return status;
    } catch (requestError) {
      if (!silent) setError(requestError.message || "Unable to check payment status.");
      return { confirmed: false, requestError };
    }
  }, [bookingId, mergePaymentStatus]);

  const reconcilePayment = useCallback(async ({ silent = false } = {}) => {
    if (!bookingId) return { confirmed: false };
    try {
      const response = await apiRequest(`/payments/${bookingId}/reconcile`, {
        method: "POST",
      });
      const status = mergePaymentStatus(response?.data || {});
      if (!silent) setError("");
      return status;
    } catch (requestError) {
      // Local reconciliation is an optional fallback. A brand-new transaction may
      // also take a moment to become queryable, so keep checking our verified DB state.
      if (
        requestError.code === "PAYMOB_INQUIRY_NOT_CONFIGURED" ||
        requestError.code === "PAYMOB_TRANSACTION_NOT_FOUND"
      ) {
        return checkPayment({ silent });
      }
      if (!silent) setError(requestError.message || "Unable to reconcile payment with Paymob.");
      return { confirmed: false, requestError };
    }
  }, [bookingId, checkPayment, mergePaymentStatus]);

  const syncUntilFinal = useCallback(async ({ attempts = 10, delayMs = 1400 } = {}) => {
    let latest = { confirmed: false };
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      latest = await reconcilePayment({ silent: true });
      if (latest.confirmed || latest.paymentStatus === "failed" || latest.status === "expired") {
        return latest;
      }
      if (attempt < attempts - 1) await sleep(delayMs);
    }
    return latest;
  }, [reconcilePayment]);

  const handleProviderProcessed = useCallback(async () => {
    setCheckingPayment(true);
    setError("");
    const result = await syncUntilFinal({ attempts: 12, delayMs: 1250 });
    setCheckingPayment(false);

    if (result.paymentStatus === "failed") {
      setCheckoutSession(null);
      setError(
        result.paymentFailureReason ||
          "Paymob reported that this payment attempt did not succeed. You can try again while the booking hold is active.",
      );
      return;
    }

    if (!result.confirmed) {
      setError(
        "The payment result has not been confirmed yet. Use “Check Paymob status” to reconcile it again.",
      );
    }
  }, [syncUntilFinal]);

  useEffect(() => {
    if (!returnedFromPaymob || confirmed || expired) {
      return undefined;
    }

    let active = true;
    const run = async () => {
      const result = await syncUntilFinal({ attempts: 12, delayMs: 1250 });
      if (!active) return;
      setCheckingPayment(false);
      if (result.paymentStatus === "failed") {
        setError(result.paymentFailureReason || "Paymob reported that this payment attempt failed.");
      } else if (!result.confirmed) {
        setError("The redirect completed, but NEFRU has not confirmed the payment yet. Check Paymob status again.");
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [returnedFromPaymob, confirmed, expired, syncUntilFinal]);

  const startPaymobCheckout = async () => {
    if (expired || startingPayment || checkingPayment) return;
    setStartingPayment(true);
    setError("");
    setCheckoutSession(null);

    try {
      const response = await apiRequest("/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ bookingId }),
      });
      const session = response?.data || {};
      if (!session.checkoutUrl) throw new Error("Paymob checkout URL was not returned.");

      if (
        session.checkoutMode === "pixel" &&
        session.publicKey &&
        session.clientSecret
      ) {
        setCheckoutSession(session);
        setStartingPayment(false);
        return;
      }

      window.location.assign(session.checkoutUrl);
    } catch (requestError) {
      setError(requestError.message || "Unable to start secure checkout.");
      setStartingPayment(false);
    }
  };

  const manualReconcile = async () => {
    setCheckingPayment(true);
    setError("");
    const result = await syncUntilFinal({ attempts: 4, delayMs: 1000 });
    setCheckingPayment(false);
    if (result.paymentStatus === "failed") {
      setCheckoutSession(null);
      setError(result.paymentFailureReason || "Paymob reported that this payment attempt failed.");
    } else if (!result.confirmed) {
      setError("Paymob has not reported a final successful transaction for this booking yet.");
    }
  };

  const image = resolveUploadsUrl(bookingState.image) || bookingState.image;

  if (confirmed) {
    return (
      <main className={styles.checkoutWrapper}>
        <section className={styles.checkoutShell}>
          <div className={styles.checkoutCard}>
            <div className={styles.content}>
              <div className={styles.successContainer}>
                <div className={styles.successCheckBadge}><BadgeCheck /></div>
                <div>
                  <span className={styles.stepKicker}>Paymob payment verified</span>
                  <h1 className={styles.successHeading}>Your booking is confirmed.</h1>
                  <p className={styles.successSub}>
                    NEFRU confirmed the booking from Paymob&apos;s verified server state — never from a browser success flag alone.
                  </p>
                </div>
                <div className={styles.ticketCard}>
                  <div className={styles.ticketRow}>
                    <span>Booking reference</span>
                    <span className={styles.ticketId}>{bookingId}</span>
                  </div>
                  <div className={styles.ticketExperience}>
                    {image ? <img src={image} alt="" /> : <div />}
                    <div>
                      <strong>{bookingState.title}</strong>
                      <span><CalendarDays size={13} /> {bookingState.date}</span>
                      <span><Clock3 size={13} /> {bookingState.startTime}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.successActions}>
                  <button className={styles.mainBtn} onClick={() => navigate("/user/profile/bookings")}>
                    View my bookings
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => navigate(`/user/trips/${bookingState.tripId}`)}>
                    Back to experience
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (expired) {
    return (
      <main className={styles.checkoutWrapper}>
        <section className={styles.checkoutShell}>
          <div className={styles.checkoutCard}>
            <div className={styles.expiredState}>
              <LockKeyhole />
              <h2>Your 15-minute hold has expired.</h2>
              <p>The reserved place was released. Choose an available time again to create a new booking hold.</p>
              <button className={styles.mainBtn} onClick={() => navigate(`/user/trips/${bookingState.tripId}/book`)}>
                Choose another time
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.checkoutWrapper}>
      <section className={styles.checkoutShell}>
        <header className={styles.checkoutTopbar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className={styles.checkoutEyebrow}><ShieldCheck size={14} /> NEFRU secure checkout</span>
            <h1>Complete your booking.</h1>
          </div>
          <div className={styles.timerPill}>
            <LockKeyhole size={14} />
            <span>{countdown} left</span>
          </div>
        </header>

        <div className={styles.checkoutCard}>
          <div className={styles.content}>
            <div className={styles.stepTitleContainer}>
              <span className={styles.stepKicker}>Personal booking · 1 traveler</span>
              <h2 className={styles.stepTitle}>
                {checkingPayment ? "Confirming your payment…" : "Review and pay with Paymob"}
              </h2>
              <p className={styles.stepIntro}>
                Your account reserves one place. With embedded checkout, Paymob renders the sensitive card fields inside this NEFRU page; NEFRU never receives your raw card number or CVV.
              </p>
            </div>

            {image && (
              <div className={styles.tourBannerOverlay}>
                <img className={styles.tourBanner} src={image} alt={bookingState.title || "Experience"} />
                <span className={styles.tourBannerTag}><BadgeCheck size={14} /> 1 account · 1 traveler</span>
                <h3 className={styles.tourBannerTitle}>{bookingState.title}</h3>
              </div>
            )}

            <div className={styles.infoGrid}>
              <div className={styles.infoBox}>
                <CalendarDays className={styles.infoIcon} />
                <div><div className={styles.infoLabel}>Date</div><div className={styles.infoValue}>{bookingState.date}</div></div>
              </div>
              <div className={styles.infoBox}>
                <Clock3 className={styles.infoIcon} />
                <div><div className={styles.infoLabel}>Time</div><div className={styles.infoValue}>{bookingState.startTime}</div></div>
              </div>
              <div className={styles.infoBox}>
                <MapPin className={styles.infoIcon} />
                <div><div className={styles.infoLabel}>Meeting area</div><div className={styles.infoValue}>{bookingState.location || "See booking details"}</div></div>
              </div>
              <div className={styles.infoBox}>
                <ShieldCheck className={styles.infoIcon} />
                <div><div className={styles.infoLabel}>Payment</div><div className={styles.infoValue}>Paymob secure card processing</div></div>
              </div>
            </div>

            <div className={styles.priceBox}>
              <div className={styles.priceHeader}>Booking total</div>
              <div className={styles.priceRowTotal}>
                <span>1 traveler</span>
                <PriceDisplay amount={bookingState.totalPrice || bookingState.price} currency={bookingState.currency || "EGP"} primaryClassName={styles.priceTotalValue} />
              </div>
            </div>

            <div className={styles.confirmationBanner}>
              <ShieldCheck size={17} />
              <span>You will be charged the exact EGP total shown above. Any foreign-currency amount is approximate only; your bank may use a different exchange rate.</span>
            </div>

            {checkingPayment ? (
              <div className={styles.confirmationBanner}>
                <RefreshCw size={17} />
                <span>NEFRU is checking Paymob&apos;s verified server state. Webhooks remain the production source of truth; transaction inquiry is used as a fallback if a callback is delayed or unavailable locally.</span>
              </div>
            ) : (
              <div className={styles.confirmationBanner}>
                <ShieldCheck size={17} />
                <span>A browser or Pixel success result never confirms a booking by itself. NEFRU confirms only after a verified Paymob callback or server-to-server transaction inquiry.</span>
              </div>
            )}

            {failedPayment && !error && (
              <div className={styles.paymentFailure}>
                <strong>Payment attempt did not complete.</strong>
                <span>{bookingState.paymentFailureReason || "You can start another attempt while this booking hold remains active."}</span>
              </div>
            )}

            {error && <div className={styles.cancellationNote}>{error}</div>}

            {checkoutSession ? (
              <>
                <PaymobPixel
                  bookingId={bookingId}
                  publicKey={checkoutSession.publicKey}
                  clientSecret={checkoutSession.clientSecret}
                  showSaveCard={checkoutSession.showSaveCard}
                  savedCardsCount={checkoutSession.savedCardsCount}
                  onPaymentProcessed={handleProviderProcessed}
                />

                {!checkoutSession.webhookConfigured && checkoutSession.showSaveCard === false && (
                  <div className={styles.cancellationNote}>
                    Card saving is hidden in this local session because Paymob needs a public callback URL to deliver the card token. Payment confirmation can still use transaction inquiry when `PAYMOB_API_KEY` is configured.
                  </div>
                )}

                <button type="button" className={styles.secondaryBtn} onClick={manualReconcile} disabled={checkingPayment}>
                  <RefreshCw size={16} /> {checkingPayment ? "Checking Paymob…" : "Check Paymob status"}
                </button>

                <a className={styles.hostedFallback} href={checkoutSession.checkoutUrl}>
                  <ExternalLink size={14} /> Open Paymob hosted checkout instead
                </a>
              </>
            ) : (
              <button
                type="button"
                className={styles.mainBtn}
                disabled={startingPayment || checkingPayment}
                onClick={startPaymobCheckout}
              >
                <CreditCard size={17} />
                {startingPayment ? "Preparing secure checkout…" : failedPayment ? "Try payment again" : "Pay securely"}
              </button>
            )}

            {(returnedFromPaymob || failedPayment) && !checkingPayment && !checkoutSession ? (
              <button type="button" className={styles.secondaryBtn} onClick={manualReconcile}>
                <RefreshCw size={16} /> Check Paymob status again
              </button>
            ) : null}

            <div className={styles.securityBanner}>
              <LockKeyhole size={14} /> Paymob handles sensitive payment credentials. NEFRU stores only payment references and, when you opt in, an encrypted provider token for saved-card reuse.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
