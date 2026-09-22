import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Check,
  CircleDollarSign,
  CreditCard,
  Globe2,
  Languages,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { apiRequest } from "../../../services/api";
import { updateProfile } from "../../../store/slices/authSlice";
import { DISPLAY_CURRENCIES, useCurrency } from "../../../state/currencyContext";
import styles from "./Settings.module.css";

const languages = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "tr", label: "Türkçe" },
];

const currencyNames = {
  EGP: "Egyptian Pound",
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
};

function cardLabel(method) {
  const brand = method.brand || "Card";
  const last4 = method.last4 || String(method.maskedPan || "").replace(/\D/g, "").slice(-4);
  return `${brand}${last4 ? ` •••• ${last4}` : ""}`;
}

export default function Settings() {
  const dispatch = useDispatch();
  const { user, profile } = useSelector((state) => state.auth || {});
  const {
    displayCurrency,
    setDisplayCurrency,
    ratesUpdatedAt,
    ratesStale,
    ratesFallback,
    refreshHours,
    loadingRates,
  } = useCurrency();
  const [language, setLanguage] = useState(profile?.preferredLanguage || "en");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [paymentSavingEnabled, setPaymentSavingEnabled] = useState(false);
  const [removingMethodId, setRemovingMethodId] = useState("");

  useEffect(() => {
    let active = true;
    const loadPaymentMethods = async () => {
      setPaymentMethodsLoading(true);
      try {
        const response = await apiRequest("/payments/methods");
        if (!active) return;
        setPaymentMethods(response?.data?.methods || []);
        setPaymentSavingEnabled(Boolean(response?.data?.savingEnabled));
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load saved payment methods.");
      } finally {
        if (active) setPaymentMethodsLoading(false);
      }
    };
    loadPaymentMethods();
    return () => {
      active = false;
    };
  }, []);

  const savePreference = async (patch, successMessage, rollback) => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await apiRequest("/users/profile/me", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      dispatch(updateProfile({ user: response.data.user || user, profile: response.data.profile }));
      setMessage(successMessage);
      return true;
    } catch (requestError) {
      rollback?.();
      setError(requestError.message || "Unable to save your preference.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveLanguage = async (nextLanguage) => {
    const previous = language;
    setLanguage(nextLanguage);
    await savePreference(
      { preferredLanguage: nextLanguage },
      "Language preference saved.",
      () => setLanguage(previous),
    );
  };

  const saveCurrency = async (nextCurrency) => {
    const previous = displayCurrency;
    setDisplayCurrency(nextCurrency);
    const saved = await savePreference(
      { preferredCurrency: nextCurrency },
      "Display currency saved. Your real booking price is still charged in EGP.",
      () => setDisplayCurrency(previous),
    );
    if (!saved) setDisplayCurrency(previous);
  };

  const removePaymentMethod = async (methodId) => {
    if (!methodId || removingMethodId) return;
    setRemovingMethodId(methodId);
    setMessage("");
    setError("");
    try {
      await apiRequest(`/payments/methods/${methodId}`, { method: "DELETE" });
      setPaymentMethods((current) => current.filter((method) => method.id !== methodId && method._id !== methodId));
      setMessage("Saved card removed from your NEFRU account.");
    } catch (requestError) {
      setError(requestError.message || "Unable to remove this saved card.");
    } finally {
      setRemovingMethodId("");
    }
  };

  const updatedLabel = ratesUpdatedAt
    ? new Date(ratesUpdatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "Not available yet";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span>Account preferences</span>
          <h1>Settings</h1>
          <p>Choose how NEFRU presents your traveler experience. All bookings and payments remain priced in Egyptian pounds.</p>
        </header>

        {message && <div className={styles.success}><Check size={15} /> {message}</div>}
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <Languages size={20} />
              <div><h2>Preferred language</h2><p>This preference is saved to your traveler profile.</p></div>
            </div>
            <div className={styles.options}>
              {languages.map((option) => (
                <button key={option.value} type="button" className={language === option.value ? styles.activeOption : ""} onClick={() => saveLanguage(option.value)} disabled={saving}>
                  <Globe2 size={17} />
                  <span><strong>{option.label}</strong><small>{option.value.toUpperCase()}</small></span>
                  {language === option.value && <Check size={17} />}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <CircleDollarSign size={20} />
              <div><h2>Display currency</h2><p>EGP is always the real NEFRU price. Other currencies are approximate display conversions only.</p></div>
            </div>

            <div className={styles.options}>
              {DISPLAY_CURRENCIES.map((code) => (
                <button key={code} type="button" className={displayCurrency === code ? styles.activeOption : ""} onClick={() => saveCurrency(code)} disabled={saving}>
                  <CircleDollarSign size={17} />
                  <span><strong>{code}</strong><small>{currencyNames[code]}</small></span>
                  {displayCurrency === code && <Check size={17} />}
                </button>
              ))}
            </div>

            <div className={styles.providerNote}>
              {loadingRates ? <RefreshCw size={17} /> : <ShieldCheck size={17} />}
              <p>
                {displayCurrency === "EGP"
                  ? "No conversion is needed. Checkout charges the exact EGP amount shown."
                  : ratesFallback
                    ? "Approximate foreign-currency rates are temporarily unavailable. EGP prices and checkout still work normally."
                    : `Approximate rates refresh every ${refreshHours} hours. Last successful update: ${updatedLabel}${ratesStale ? " (latest available rate)" : ""}. Your bank may use a different conversion rate.`}
              </p>
            </div>
          </section>

          <section className={`${styles.card} ${styles.wideCard}`}>
            <div className={styles.cardTitle}>
              <CreditCard size={20} />
              <div>
                <h2>Saved payment methods</h2>
                <p>Cards are tokenized by Paymob. NEFRU never stores your full card number or CVV.</p>
              </div>
            </div>

            {paymentMethodsLoading ? (
              <div className={styles.paymentLoading}><LoaderCircle size={17} /> Loading payment methods…</div>
            ) : paymentMethods.length ? (
              <div className={styles.paymentMethods}>
                {paymentMethods.map((method) => {
                  const methodId = method.id || method._id;
                  return (
                    <div className={styles.paymentMethod} key={methodId}>
                      <div className={styles.paymentBrand}><CreditCard size={18} /></div>
                      <div className={styles.paymentMethodText}>
                        <strong>{cardLabel(method)}</strong>
                        <span>
                          {method.expiryMonth && method.expiryYear
                            ? `Expires ${method.expiryMonth}/${method.expiryYear}`
                            : "Saved with Paymob"}
                          {method.expired ? " · Expired" : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.removePayment}
                        onClick={() => removePaymentMethod(methodId)}
                        disabled={removingMethodId === methodId}
                      >
                        {removingMethodId === methodId ? <LoaderCircle size={15} /> : <Trash2 size={15} />}
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyPayment}>
                <CreditCard size={21} />
                <div>
                  <strong>No saved cards yet</strong>
                  <span>
                    {paymentSavingEnabled
                      ? "Choose Save card in Paymob secure checkout on your next booking."
                      : "Saved cards are disabled in this environment until secure token encryption is configured."}
                  </span>
                </div>
              </div>
            )}

            <div className={styles.securityNote}>
              <ShieldCheck size={17} />
              <p>
                Removing a card here disables its encrypted Paymob token in NEFRU. Payment credentials remain handled by Paymob&apos;s secure checkout.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
