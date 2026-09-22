import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import CheckoutWizard from "../../../../../../components/Checkout/CheckoutWizard";
import { apiRequest } from "../../../../../../services/api";

export default function Status() {
  const { bookingId: bookingIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const bookingId = bookingIdParam || searchParams.get("bookingId");
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(bookingId ? "" : "Missing booking reference.");

  useEffect(() => {
    if (!bookingId) return undefined;
    let active = true;

    apiRequest(`/bookings/${bookingId}`)
      .then((response) => active && setBooking(response?.data?.booking))
      .catch((requestError) => active && setError(requestError.message || "Unable to load checkout."));

    return () => {
      active = false;
    };
  }, [bookingId]);

  if (error) {
    return <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", background: "#fbfaf7", color: "#16233f" }}>{error}</main>;
  }

  if (!booking) {
    return <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", background: "#fbfaf7", color: "#16233f" }}>Loading secure checkout…</main>;
  }

  return <CheckoutWizard initialData={booking} />;
}
