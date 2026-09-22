import { useCurrency } from "../../../state/currencyContext";
import styles from "./PriceDisplay.module.css";

export default function PriceDisplay({
  amount,
  currency = "EGP",
  suffix = "",
  className = "",
  primaryClassName = "",
  approxClassName = "",
  showApprox = true,
}) {
  const { displayCurrency, formatEgp, formatDisplay, ratesStale } = useCurrency();
  const sourceCurrency = String(currency || "EGP").toUpperCase();
  const numericAmount = Number(amount || 0);
  const isEgp = sourceCurrency === "EGP";
  const primary = isEgp
    ? formatEgp(numericAmount)
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: sourceCurrency,
        maximumFractionDigits: 2,
      }).format(numericAmount);
  const approx = isEgp && displayCurrency !== "EGP" && showApprox
    ? formatDisplay(numericAmount, displayCurrency)
    : null;

  return (
    <span className={`${styles.wrap} ${className}`.trim()}>
      <strong className={`${styles.primary} ${primaryClassName}`.trim()}>
        {primary}
      </strong>
      {approx ? (
        <small className={`${styles.approx} ${approxClassName}`.trim()}>
          ≈ {approx} {displayCurrency}{ratesStale ? "*" : ""}
        </small>
      ) : null}
      {suffix ? <small className={styles.suffix}>{suffix}</small> : null}
    </span>
  );
}
