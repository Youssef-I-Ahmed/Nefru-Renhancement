import { useEffect, useMemo, useState } from "react";
import { CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";

import styles from "./Checkout.module.css";

const PAYMOB_PIXEL_SRC = "https://cdn.jsdelivr.net/npm/paymob-pixel@1.2.7/main.js";
let pixelLoaderPromise = null;

function loadPaymobPixel() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paymob Pixel requires a browser."));
  }
  if (window.Pixel) return Promise.resolve(window.Pixel);
  if (pixelLoaderPromise) return pixelLoaderPromise;

  pixelLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-nefru-paymob-pixel="1"]`);
    const script = existing || document.createElement("script");

    const finish = () => {
      if (window.Pixel) resolve(window.Pixel);
      else reject(new Error("Paymob Pixel loaded, but the SDK was not available."));
    };
    const fail = () => reject(new Error("Unable to load Paymob secure card component."));

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });

    if (!existing) {
      script.type = "module";
      script.src = PAYMOB_PIXEL_SRC;
      script.dataset.nefruPaymobPixel = "1";
      document.head.appendChild(script);
    }

    // A previously injected module script may already have finished loading.
    if (existing) window.setTimeout(finish, 0);
  }).catch((error) => {
    pixelLoaderPromise = null;
    throw error;
  });

  return pixelLoaderPromise;
}

export default function PaymobPixel({
  bookingId,
  publicKey,
  clientSecret,
  showSaveCard = false,
  savedCardsCount = 0,
  onPaymentProcessed,
}) {
  const [loading, setLoading] = useState(true);
  const [sdkError, setSdkError] = useState("");
  const elementId = useMemo(
    () => `nefru-paymob-${String(bookingId || "checkout").replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [bookingId],
  );

  useEffect(() => {
    if (!publicKey || !clientSecret) {
      return undefined;
    }

    let active = true;
    const mount = async () => {
      if (!active) return;
      setLoading(true);
      setSdkError("");
      const Pixel = await loadPaymobPixel();
      if (!active) return;

      const container = document.getElementById(elementId);
      if (!container) throw new Error("Paymob checkout container was not found.");
      container.replaceChildren();

      new Pixel({
        publicKey,
        clientSecret,
        paymentMethods: ["card"],
        elementId,
        showSaveCard: Boolean(showSaveCard),
        forceSaveCard: false,
        afterPaymentComplete: async (result) => {
          if (!active) return;
          await onPaymentProcessed?.(result);
        },
      });

      if (active) setLoading(false);
    };

    Promise.resolve().then(mount).catch((error) => {
      if (!active) return;
      setLoading(false);
      setSdkError(error.message || "Unable to initialize Paymob secure checkout.");
    });

    return () => {
      active = false;
      const container = document.getElementById(elementId);
      container?.replaceChildren();
    };
  }, [clientSecret, elementId, onPaymentProcessed, publicKey, showSaveCard]);

  return (
    <section className={styles.pixelShell} aria-label="Secure card payment">
      <div className={styles.pixelHeader}>
        <div className={styles.pixelIcon}><CreditCard size={19} /></div>
        <div>
          <strong>Pay securely without leaving NEFRU</strong>
          <span>Card fields are rendered and processed by Paymob.</span>
        </div>
        <ShieldCheck size={19} />
      </div>

      {savedCardsCount > 0 && (
        <div className={styles.pixelSavedNote}>
          {savedCardsCount} saved {savedCardsCount === 1 ? "card is" : "cards are"} available in this checkout.
        </div>
      )}

      {showSaveCard && (
        <div className={styles.pixelSavedNote}>
          You can choose “Save card” in the secure Paymob form. NEFRU stores only an encrypted Paymob token and masked card details — never the full card number or CVV.
        </div>
      )}

      {loading && publicKey && clientSecret && (
        <div className={styles.pixelLoading}><LoaderCircle size={18} /> Loading secure card form…</div>
      )}
      {(!publicKey || !clientSecret) && <p role="alert">Checkout configuration is unavailable.</p>}
      {sdkError && <div className={styles.pixelError}>{sdkError}</div>}
      <div id={elementId} className={styles.pixelContainer} />
    </section>
  );
}
