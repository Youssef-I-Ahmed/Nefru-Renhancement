import axios from "axios";

import { env } from "../config/env.js";
import { FxRate } from "../models/fxRate.model.js";

export const BASE_CURRENCY = "EGP";
export const DISPLAY_CURRENCIES = ["EGP", "USD", "EUR", "GBP"];
const CACHE_KEY = "tourist-display";

function rateObject(document) {
  const mapped = document?.rates instanceof Map
    ? Object.fromEntries(document.rates.entries())
    : { ...(document?.rates || {}) };
  return {
    EGP: 1,
    ...Object.fromEntries(
      DISPLAY_CURRENCIES
        .filter((currency) => currency !== "EGP")
        .map((currency) => [currency, Number(mapped[currency]) || 0]),
    ),
  };
}

function isUsableRateSet(rates) {
  return DISPLAY_CURRENCIES.every(
    (currency) => currency === "EGP" || Number(rates?.[currency]) > 0,
  );
}

function isFresh(document) {
  const updatedAt = document?.sourceUpdatedAt || document?.updatedAt;
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < env.fxRefreshMs;
}

function publicSnapshot(document, { stale = false, fallback = false } = {}) {
  const rates = rateObject(document);
  return {
    baseCurrency: BASE_CURRENCY,
    rates,
    supportedCurrencies: DISPLAY_CURRENCIES,
    provider: document?.provider || env.fxProvider,
    sourceDate: document?.sourceDate || "",
    updatedAt: document?.sourceUpdatedAt || document?.updatedAt || null,
    stale,
    fallback,
    refreshHours: env.fxRefreshHours,
  };
}

async function fetchRatesFromProvider() {
  const response = await axios.get(env.fxProviderUrl, {
    params: {
      base: BASE_CURRENCY.toLowerCase(),
      quotes: "usd,eur,gbp",
      ...(env.fxProvider ? { providers: env.fxProvider } : {}),
    },
    timeout: env.fxRequestTimeoutMs,
    headers: { Accept: "application/json" },
  });

  const rows = Array.isArray(response.data) ? response.data : [];
  const rates = { EGP: 1 };
  let sourceDate = "";

  for (const row of rows) {
    const quote = String(row?.quote || "").toUpperCase();
    const rate = Number(row?.rate);
    if (["USD", "EUR", "GBP"].includes(quote) && Number.isFinite(rate) && rate > 0) {
      rates[quote] = rate;
      sourceDate = sourceDate || String(row?.date || "");
    }
  }

  if (!isUsableRateSet(rates)) {
    throw new Error("FX provider returned an incomplete EGP rate set");
  }

  return { rates, sourceDate };
}

export async function refreshFxRates() {
  const now = new Date();
  try {
    const { rates, sourceDate } = await fetchRatesFromProvider();
    const document = await FxRate.findOneAndUpdate(
      { key: CACHE_KEY },
      {
        $set: {
          baseCurrency: BASE_CURRENCY,
          rates,
          provider: env.fxProvider || "frankfurter-blend",
          sourceDate,
          sourceUpdatedAt: now,
          lastAttemptAt: now,
          lastError: "",
        },
        $setOnInsert: { key: CACHE_KEY },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return publicSnapshot(document);
  } catch (error) {
    await FxRate.findOneAndUpdate(
      { key: CACHE_KEY },
      {
        $set: {
          baseCurrency: BASE_CURRENCY,
          provider: env.fxProvider || "frankfurter-blend",
          lastAttemptAt: now,
          lastError: String(error?.message || "Unable to refresh FX rates").slice(0, 500),
        },
        $setOnInsert: { key: CACHE_KEY, rates: { EGP: 1 } },
      },
      { upsert: true, setDefaultsOnInsert: true },
    ).catch(() => {});
    throw error;
  }
}

export async function getFxSnapshot({ forceRefresh = false } = {}) {
  const cached = await FxRate.findOne({ key: CACHE_KEY });
  const cachedRates = rateObject(cached);

  if (!forceRefresh && cached && isFresh(cached) && isUsableRateSet(cachedRates)) {
    return publicSnapshot(cached);
  }

  try {
    return await refreshFxRates();
  } catch (error) {
    if (cached && isUsableRateSet(cachedRates)) {
      console.warn("FX refresh failed; using last successful rates:", error.message);
      return publicSnapshot(cached, { stale: true });
    }

    console.warn("FX rates unavailable; EGP prices remain available:", error.message);
    return {
      baseCurrency: BASE_CURRENCY,
      rates: { EGP: 1 },
      supportedCurrencies: DISPLAY_CURRENCIES,
      provider: env.fxProvider || "frankfurter-cbe",
      sourceDate: "",
      updatedAt: null,
      stale: true,
      fallback: true,
      refreshHours: env.fxRefreshHours,
    };
  }
}

export function convertFromEgp(amount, currency, snapshot) {
  const code = String(currency || "EGP").toUpperCase();
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  if (code === "EGP") return value;
  const rate = Number(snapshot?.rates?.[code]);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(value * rate * 100) / 100;
}

export function startFxRateScheduler() {
  let stopped = false;

  const refresh = async () => {
    if (stopped) return;
    try {
      const result = await getFxSnapshot();
      if (!result.fallback) {
        console.log(
          `FX rates ready: EGP base (${result.provider}), updated ${result.updatedAt || "from cache"}`,
        );
      }
    } catch (error) {
      console.warn("FX scheduler refresh failed:", error.message);
    }
  };

  const initialTimer = setTimeout(refresh, 5000);
  initialTimer.unref?.();
  const interval = setInterval(refresh, env.fxRefreshMs);
  interval.unref?.();

  return () => {
    stopped = true;
    clearTimeout(initialTimer);
    clearInterval(interval);
  };
}
