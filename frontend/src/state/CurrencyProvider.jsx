import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import { apiRequest } from "../services/api";

import { CurrencyContext, DISPLAY_CURRENCIES } from "./currencyContext.js";
const STORAGE_KEY = "nefru_display_currency";


const currencyLabels = {
  EGP: "Egyptian Pound",
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
};

function validCurrency(value) {
  const code = String(value || "").toUpperCase();
  return DISPLAY_CURRENCIES.includes(code) ? code : "EGP";
}

function storedCurrency() {
  try {
    return validCurrency(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "EGP";
  }
}

export function CurrencyProvider({ children }) {
  const profileCurrency = useSelector((state) => state.auth?.profile?.preferredCurrency);
  const [displayCurrency, setCurrencyState] = useState(() => validCurrency(profileCurrency || storedCurrency()));
  const [fx, setFx] = useState({
    baseCurrency: "EGP",
    rates: { EGP: 1 },
    provider: "",
    updatedAt: null,
    stale: false,
    fallback: false,
    refreshHours: 12,
  });
  const [loadingRates, setLoadingRates] = useState(true);

  const setDisplayCurrency = useCallback((currency) => {
    const code = validCurrency(currency);
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Browsing still works if storage is unavailable.
    }
  }, []);

  const [previousProfileCurrency, setPreviousProfileCurrency] = useState(profileCurrency);
  if (previousProfileCurrency !== profileCurrency) {
    setPreviousProfileCurrency(profileCurrency);
    if (profileCurrency) setCurrencyState(validCurrency(profileCurrency));
  }
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, displayCurrency); } catch { /* storage optional */ } }, [displayCurrency]);

  useEffect(() => {
    let active = true;
    apiRequest("/fx/rates")
      .then((response) => {
        if (!active || !response?.data) return;
        setFx({
          baseCurrency: "EGP",
          rates: { EGP: 1, ...(response.data.rates || {}) },
          provider: response.data.provider || "",
          updatedAt: response.data.updatedAt || null,
          stale: Boolean(response.data.stale),
          fallback: Boolean(response.data.fallback),
          refreshHours: Number(response.data.refreshHours) || 12,
        });
      })
      .catch(() => {
        // EGP is the real price, so a display-rate outage must never block browsing.
      })
      .finally(() => {
        if (active) setLoadingRates(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const formatEgp = useCallback((amount, options = {}) => {
    const value = Number(amount || 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EGP",
      currencyDisplay: "code",
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
    }).format(value);
  }, []);

  const convertFromEgp = useCallback(
    (amount, currency = displayCurrency) => {
      const code = validCurrency(currency);
      const value = Number(amount);
      if (!Number.isFinite(value)) return null;
      if (code === "EGP") return value;
      const rate = Number(fx.rates?.[code]);
      if (!Number.isFinite(rate) || rate <= 0) return null;
      return Math.round(value * rate * 100) / 100;
    },
    [displayCurrency, fx.rates],
  );

  const formatDisplay = useCallback(
    (amount, currency = displayCurrency) => {
      const code = validCurrency(currency);
      const converted = convertFromEgp(amount, code);
      if (converted === null) return null;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        minimumFractionDigits: code === "EGP" ? 0 : 2,
        maximumFractionDigits: code === "EGP" ? 2 : 2,
      }).format(converted);
    },
    [convertFromEgp, displayCurrency],
  );

  const value = useMemo(
    () => ({
      displayCurrency,
      setDisplayCurrency,
      currencyLabels,
      rates: fx.rates,
      ratesUpdatedAt: fx.updatedAt,
      ratesStale: fx.stale,
      ratesFallback: fx.fallback,
      refreshHours: fx.refreshHours,
      loadingRates,
      formatEgp,
      formatDisplay,
      convertFromEgp,
    }),
    [displayCurrency, setDisplayCurrency, fx, loadingRates, formatEgp, formatDisplay, convertFromEgp],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

