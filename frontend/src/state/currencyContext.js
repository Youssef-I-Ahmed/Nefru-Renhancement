import { createContext, useContext } from "react";
export const CurrencyContext = createContext(null);
export const DISPLAY_CURRENCIES = ["EGP", "USD", "EUR", "GBP"];
export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value)
    throw new Error("useCurrency must be used inside CurrencyProvider");
  return value;
}
