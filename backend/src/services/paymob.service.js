import axios from "axios";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

function providerMessage(error, fallback) {
  const data = error?.response?.data;
  return (
    data?.detail ||
    data?.message ||
    data?.error ||
    (typeof data === "string" ? data : "") ||
    fallback
  );
}

export async function createPaymobIntention(payload) {
  try {
    const response = await axios.post(`${env.paymobBaseUrl}/v1/intention/`, payload, {
      headers: {
        Authorization: `Token ${env.paymobSecretKey}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });
    return response.data || {};
  } catch (error) {
    throw new AppError(
      providerMessage(error, "Unable to start Paymob checkout"),
      502,
      "PAYMOB_INTENTION_FAILED",
    );
  }
}

export async function createPaymobInquiryAuthToken() {
  if (!env.paymobApiKey) {
    throw new AppError(
      "Paymob reconciliation is not configured. Add PAYMOB_API_KEY to the backend environment.",
      503,
      "PAYMOB_INQUIRY_NOT_CONFIGURED",
    );
  }

  try {
    const response = await axios.post(
      `${env.paymobBaseUrl}/api/auth/tokens`,
      { api_key: env.paymobApiKey },
      { headers: { "Content-Type": "application/json" }, timeout: 12000 },
    );
    const token = response.data?.token;
    if (!token) {
      throw new Error("Paymob did not return an inquiry auth token");
    }
    return token;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      providerMessage(error, "Unable to authenticate Paymob transaction inquiry"),
      502,
      "PAYMOB_INQUIRY_AUTH_FAILED",
    );
  }
}

export async function inquirePaymobTransactionByOrderId(orderId) {
  if (!orderId) {
    throw new AppError(
      "This booking does not have a Paymob order ID yet.",
      409,
      "PAYMOB_ORDER_ID_MISSING",
    );
  }

  const authToken = await createPaymobInquiryAuthToken();
  try {
    const response = await axios.post(
      `${env.paymobBaseUrl}/api/ecommerce/orders/transaction_inquiry`,
      {
        auth_token: authToken,
        order_id: String(orderId),
        merchant_order_id: "",
      },
      { headers: { "Content-Type": "application/json" }, timeout: 12000 },
    );
    return response.data || null;
  } catch (error) {
    throw new AppError(
      providerMessage(error, "Unable to retrieve the Paymob transaction status"),
      502,
      "PAYMOB_INQUIRY_FAILED",
    );
  }
}
