import {atomic,signal} from '../services/marketplace.service.js';
import {PaymentAttempt} from '../models/paymentAttempt.model.js';
import {OperationalCase} from '../models/operationalCase.model.js';
import crypto from "crypto";

import { env, getPaymobWebhookUrl } from "../config/env.js";
import { Booking } from "../models/booking.model.js";
import { BookingSeat } from "../models/bookingSeat.model.js";
import { Notification } from "../models/notification.model.js";
import { PaymentMethod } from "../models/paymentMethod.model.js";
import { TouristProfile } from "../models/tourist.model.js";
import { User } from "../models/user.model.js";
import { expirePendingBookings } from "../services/Booking.service.js";
import { convertFromEgp, getFxSnapshot } from "../services/fxRate.service.js";
import {
  createPaymobIntention,
  inquirePaymobTransactionByOrderId,
} from "../services/paymob.service.js";
import {
  decryptPaymentToken,
  encryptPaymentToken,
  isPaymentTokenStorageConfigured,
} from "../services/paymentToken.service.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const TRANSACTION_HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
];

const CARD_TOKEN_HMAC_FIELDS = [
  "card_subtype",
  "created_at",
  "email",
  "id",
  "masked_pan",
  "merchant_id",
  "order_id",
  "token",
];

function requirePaymob() {
  const webhookUrl = getPaymobWebhookUrl();
  const missing = [];
  if (!env.paymobSecretKey) missing.push("PAYMOB_SECRET_KEY");
  if (!env.paymobPublicKey) missing.push("PAYMOB_PUBLIC_KEY");
  if (!env.paymobHmacSecret) missing.push("PAYMOB_HMAC_SECRET");
  if (!env.paymobIntegrationIds.length) missing.push("PAYMOB_INTEGRATION_IDS");
  if (env.nodeEnv === "production" && !webhookUrl) {
    missing.push("BACKEND_PUBLIC_URL or PAYMOB_WEBHOOK_URL");
  }

  if (missing.length) {
    throw new AppError(
      `Paymob is not configured. Missing: ${missing.join(", ")}`,
      503,
      "PAYMOB_NOT_CONFIGURED",
    );
  }

  return { webhookUrl, webhookConfigured: Boolean(webhookUrl) };
}

function nestedValue(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function normalizeHmacValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function verifyHmac(object, fields, receivedHmac) {
  if (!receivedHmac || !env.paymobHmacSecret) return false;
  const source = fields
    .map((field) => normalizeHmacValue(nestedValue(object, field)))
    .join("");
  const calculated = crypto
    .createHmac("sha512", env.paymobHmacSecret)
    .update(source)
    .digest("hex");

  const expected = Buffer.from(calculated, "utf8");
  const received = Buffer.from(String(receivedHmac), "utf8");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function splitName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Nefru",
    lastName: parts.slice(1).join(" ") || "Traveler",
  };
}

async function getPayableBooking(bookingId, touristId) {
  await expirePendingBookings({ _id: bookingId });
  const booking = await Booking.findOne({
    _id: bookingId,
    tourist: touristId,
    status: "pending_payment",
    paymentStatus: { $in: ["unpaid", "failed"] },
  })
    .select("+paymobClientSecret")
    .populate("trip");

  if (!booking) {
    throw new AppError("Active payment booking not found", 404, "BOOKING_NOT_PAYABLE");
  }

  const seat = await BookingSeat.findOne({ booking: booking._id });
  if (!seat || (seat.expiresAt && seat.expiresAt <= new Date())) {
    throw new AppError("Your booking hold expired", 409, "HOLD_EXPIRED");
  }

  return { booking, seat };
}

async function getBillingData(userId) {
  const [user, profile] = await Promise.all([
    User.findById(userId).lean(),
    TouristProfile.findOne({ user: userId }).lean(),
  ]);

  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  const phone = String(profile?.phoneNumber || "").trim();
  if (!phone) {
    throw new AppError(
      "Add a phone number to your profile before starting payment.",
      409,
      "PAYMENT_PHONE_REQUIRED",
    );
  }

  const { firstName, lastName } = splitName(profile?.fullName || user.email);
  return {
    apartment: "NA",
    first_name: firstName,
    last_name: lastName,
    street: "NA",
    building: "NA",
    phone_number: phone,
    city: "NA",
    country: "EG",
    email: user.email,
    floor: "NA",
    state: "NA",
    postal_code: "NA",
    shipping_method: "NA",
  };
}

function checkoutUrl(clientSecret) {
  const publicKey = encodeURIComponent(env.paymobPublicKey);
  const secret = encodeURIComponent(clientSecret);
  return `${env.paymobBaseUrl}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${secret}`;
}

function paymentMethodFromTransaction(transaction) {
  const type = String(transaction?.source_data?.type || "").toLowerCase();
  if (type.includes("wallet")) return "wallet";
  if (type.includes("card")) return "card";
  if (type.includes("kiosk")) return "kiosk";
  if (type.includes("bank")) return "bank";
  return "paymob";
}

function callbackBookingId(transaction) {
  return (
    transaction?.payment_key_claims?.extra?.bookingId ||
    transaction?.payment_key_claims?.extra?.booking_id ||
    transaction?.order?.merchant_order_id?.replace(/^NEFRU-/, "").split("-")[0] ||
    ""
  );
}

async function findBookingForTransaction(transaction) {
  const embeddedId = callbackBookingId(transaction);
  if (embeddedId) {
    const byId = await Booking.findById(embeddedId).populate("trip");
    if (byId) return byId;
  }

  const orderId = transaction?.order?.id;
  if (orderId !== undefined && orderId !== null) {
    const direct=await Booking.findOne({paymobOrderId:String(orderId)}).populate('trip');if(direct)return direct;const attempt=await PaymentAttempt.findOne({orderId:String(orderId)});return attempt?Booking.findById(attempt.booking).populate('trip'):null;
  }

  return null;
}

async function findBookingForToken(tokenObject) {
  const orderId = tokenObject?.order_id;
  if (orderId === undefined || orderId === null) return null;
  return Booking.findOne({ paymobOrderId: String(orderId) });
}

function validateTransactionAgainstBooking(transaction, booking) {
  const amountCents = Math.round(Number(booking.totalPrice) * 100);
  const callbackAmount = Number(transaction.amount_cents ?? transaction.amount_cents_int);
  const callbackCurrency = String(
    transaction.currency || transaction.order?.currency || "",
  ).toUpperCase();
  const integrationId = Number(transaction.integration_id);

  if (callbackAmount !== amountCents) {
    throw new AppError("Paymob callback amount mismatch", 400, "PAYMOB_AMOUNT_MISMATCH");
  }
  if (callbackCurrency !== String(booking.currency).toUpperCase()) {
    throw new AppError("Paymob callback currency mismatch", 400, "PAYMOB_CURRENCY_MISMATCH");
  }
  if (!env.paymobIntegrationIds.includes(integrationId)) {
    throw new AppError(
      "Paymob callback integration mismatch",
      400,
      "PAYMOB_INTEGRATION_MISMATCH",
    );
  }
}

function paymentFailureReason(transaction) {
  const value =
    transaction?.data?.message ||
    transaction?.data?.response_message ||
    transaction?.data?.message_from_processor ||
    transaction?.data?.txn_response_code ||
    transaction?.message ||
    "The payment was declined or could not be completed.";
  return String(value).slice(0, 500);
}

async function markFailedPayment(transaction,booking){validateTransactionAgainstBooking(transaction,booking);return atomic(async session=>{const current=await Booking.findById(booking._id).session(session);if(['paid','refunded','partially_refunded'].includes(current.paymentStatus))return current;current.paymentProvider='paymob';current.paymentStatus='failed';current.paymentFailureReason=paymentFailureReason(transaction);current.lastPaymentSyncAt=new Date();await current.save({session});if(transaction.id)await PaymentAttempt.updateOne({transactionId:String(transaction.id)},{$setOnInsert:{booking:current._id,outcome:'failed',amountCents:Math.round(current.totalPrice*100),currency:'EGP'}},{upsert:true,session});return current;});}

// Internal finalizer: callers must first authenticate the webhook or provider inquiry.
export async function finalizeSuccessfulPayment(transaction, booking) {
 validateTransactionAgainstBooking(transaction,booking);
 return atomic(async session=>{
  const current=await Booking.findById(booking._id).populate('trip').session(session);validateTransactionAgainstBooking(transaction,current);
  const transactionId=String(transaction.id||'');if(!transactionId)throw new AppError('Transaction ID required',400);
  const previous=await PaymentAttempt.findOne({transactionId}).session(session);
  if(previous&&String(previous.booking)!==String(current._id))throw new AppError('Transaction already assigned',409);
  if(previous?.outcome==='paid')return current;
  await PaymentAttempt.updateOne({transactionId},{$set:{booking:current._id,orderId:String(transaction.order?.id||''),outcome:'paid',amountCents:Math.round(current.totalPrice*100),currency:'EGP'}},{upsert:true,session});
  // Completed/refunded bookings are historical; duplicate success cannot reopen them.
  if(['paid','refunded','partially_refunded'].includes(current.paymentStatus)) {
    if(current.paymobTransactionId && current.paymobTransactionId!==transactionId)await OperationalCase.updateOne({key:'extra-payment:'+transactionId},{$setOnInsert:{key:'extra-payment:'+transactionId,type:'refund_review',booking:current._id,report:'Additional verified payment requires admin review'}},{upsert:true,session});
    return current;
  }
  current.paymentStatus='paid';current.paymentProvider='paymob';current.paymentMethod=paymentMethodFromTransaction(transaction);current.paymentReference=transactionId;current.paymobTransactionId=transactionId;current.paymentFailureReason='';current.lastPaymentSyncAt=new Date();
  const seat=await BookingSeat.findOne({booking:current._id}).session(session);
  const active=current.status==='pending_payment'&&current.holdExpiresAt&&current.holdExpiresAt>new Date()&&seat;
  if(active){current.status='confirmed';current.holdExpiresAt=null;seat.expiresAt=null;await seat.save({session});}
  else {
    if(current.status==='pending_payment')current.status='expired';
    current.refundEntitlement='admin_review';current.holdExpiresAt=null;await BookingSeat.deleteOne({booking:current._id},{session});
    await OperationalCase.updateOne({key:'late-payment:'+transactionId},{$setOnInsert:{key:'late-payment:'+transactionId,type:'refund_review',booking:current._id,report:'Verified payment arrived after the booking hold or booking lifecycle ended'}},{upsert:true,session});
  }
  await current.save({session});await signal(session,null,active?'payment_confirmed':'payment_requires_review','Booking',current,current.tourist);
  return current;
 });
}

async function getSavedCardTokens(userId) {
  if (!isPaymentTokenStorageConfigured()) return [];

  const methods = await PaymentMethod.find({
    user: userId,
    provider: "paymob",
    isActive: true,
  })
    .select("+tokenCiphertext +tokenIv +tokenAuthTag")
    .sort({ lastUsedAt: -1, createdAt: -1 })
    .limit(3);

  const result = [];
  for (const method of methods) {
    try {
      const token = decryptPaymentToken(method);
      if (token) result.push({ method, token });
    } catch (error) {
      console.warn("Skipping an unreadable saved Paymob card token", {
        paymentMethodId: String(method._id),
        message: error.message,
      });
    }
  }
  return result;
}

async function storePaymobCardToken(tokenObject) {
  if (!isPaymentTokenStorageConfigured()) {
    console.warn(
      "Valid Paymob card-token callback received, but PAYMENT_TOKEN_ENCRYPTION_KEY is not configured. Token was not stored.",
    );
    return null;
  }

  if (!tokenObject?.token || !tokenObject?.id || !tokenObject?.order_id) return null;
  const booking = await findBookingForToken(tokenObject);
  if (!booking) {
    console.warn("Valid Paymob card-token callback received for an unknown order", {
      tokenId: tokenObject.id,
      orderId: tokenObject.order_id,
    });
    return null;
  }

  const encrypted = encryptPaymentToken(tokenObject.token);
  const maskedPan = String(tokenObject.masked_pan || "");
  const brand = String(tokenObject.card_subtype || "Card");
  const tokenId = String(tokenObject.id);

  if (maskedPan) {
    await PaymentMethod.updateMany(
      {
        user: booking.tourist,
        provider: "paymob",
        maskedPan,
        paymobTokenId: { $ne: tokenId },
      },
      { $set: { isActive: false } },
    );
  }

  return PaymentMethod.findOneAndUpdate(
    {
      user: booking.tourist,
      provider: "paymob",
      paymobTokenId: tokenId,
    },
    {
      $set: {
        ...encrypted,
        maskedPan,
        brand,
        expiryMonth: String(tokenObject.expiry_month || ""),
        expiryYear: String(tokenObject.expiry_year || ""),
        cardholderName: String(tokenObject.cardholder_name || "").slice(0, 120),
        providerOrderId: String(tokenObject.order_id),
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function serializePaymentMethod(method) {
  const yearRaw = String(method.expiryYear || "");
  const normalizedYear = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
  const month = Number(method.expiryMonth);
  const now = new Date();
  const expired =
    Number.isFinite(normalizedYear) &&
    Number.isFinite(month) &&
    month >= 1 &&
    month <= 12
      ? normalizedYear < now.getFullYear() ||
        (normalizedYear === now.getFullYear() && month < now.getMonth() + 1)
      : false;

  return {
    id: method._id,
    provider: method.provider,
    brand: method.brand,
    maskedPan: method.maskedPan,
    last4: String(method.maskedPan || "").replace(/\D/g, "").slice(-4),
    expiryMonth: method.expiryMonth,
    expiryYear: method.expiryYear,
    expired,
    createdAt: method.createdAt,
    lastUsedAt: method.lastUsedAt,
  };
}

function serializePaymentStatus(booking) {
  return {
    bookingId: booking._id,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentProvider: booking.paymentProvider,
    paymentMethod: booking.paymentMethod,
    paymentReference: booking.paymentReference,
    paymentFailureReason: booking.paymentFailureReason || "",
    paymobTransactionId: booking.paymobTransactionId || "",
    lastPaymentSyncAt: booking.lastPaymentSyncAt || null,
    confirmed: booking.status === "confirmed" && booking.paymentStatus === "paid",
    reconciliationAvailable: Boolean(env.paymobApiKey && booking.paymobOrderId),
  };
}

export const createPaymobCheckout = asyncHandler(async (req, res) => {
  const { webhookUrl, webhookConfigured } = requirePaymob();
  const { bookingId } = req.body;
  if (!bookingId) {
    throw new AppError("bookingId is required", 400, "BOOKING_ID_REQUIRED");
  }

  const { booking } = await getPayableBooking(bookingId, req.user._id);
  if (String(booking.currency).toUpperCase() !== env.paymobCurrency) {
    throw new AppError(
      `This Paymob configuration accepts ${env.paymobCurrency}, but the booking is priced in ${booking.currency}.`,
      409,
      "PAYMOB_CURRENCY_CONFIGURATION_MISMATCH",
    );
  }

  const billingData = await getBillingData(req.user._id);

  const touristProfile = await TouristProfile.findOne({ user: req.user._id })
    .select("preferredCurrency")
    .lean();
  const preferredCurrency = String(touristProfile?.preferredCurrency || "EGP").toUpperCase();
  const fxSnapshot = await getFxSnapshot();
  const displayAmount = convertFromEgp(booking.totalPrice, preferredCurrency, fxSnapshot);
  const displayRate =
    preferredCurrency === "EGP"
      ? 1
      : Number(fxSnapshot.rates?.[preferredCurrency]) || null;
  booking.displayCurrency = displayAmount === null ? "EGP" : preferredCurrency;
  booking.displayAmount = displayAmount === null ? booking.totalPrice : displayAmount;
  booking.displayFxRate = displayAmount === null ? 1 : displayRate;
  booking.fxRateUpdatedAt = fxSnapshot.updatedAt || null;

  const secondsRemaining = Math.max(
    60,
    Math.floor((new Date(booking.holdExpiresAt).getTime() - Date.now()) / 1000),
  );
  const expiration = Math.min(secondsRemaining, env.paymobCheckoutExpirationSeconds);
  const specialReference = `NEFRU-${booking._id}-${Date.now()}`;
  const redirectUrl = `${env.frontendUrl}/user/trips/${booking.trip._id}/book/status?bookingId=${booking._id}&payment=return`;
  const amount = Math.round(Number(booking.totalPrice) * 100);
  const savedCards = await getSavedCardTokens(req.user._id);
  const canSaveNewCard = isPaymentTokenStorageConfigured() && webhookConfigured;

  const payload = {
    amount,
    currency: booking.currency,
    payment_methods: env.paymobIntegrationIds,
    items: [
      {
        name: String(booking.trip.title || "NEFRU experience").slice(0, 50),
        amount,
        description: `Personal booking for ${booking.slotDate}`.slice(0, 255),
        quantity: 1,
      },
    ],
    billing_data: billingData,
    extras: {
      bookingId: String(booking._id),
      tripId: String(booking.trip._id),
      source: "nefru-web",
    },
    special_reference: specialReference,
    expiration,
    redirection_url: redirectUrl,
  };

  if (webhookUrl) payload.notification_url = webhookUrl;
  if (savedCards.length) payload.card_tokens = savedCards.map((entry) => entry.token);

  const intention = await createPaymobIntention(payload);
  if (!intention.client_secret || !intention.id || !intention.intention_order_id) {
    throw new AppError(
      "Paymob returned an incomplete intention response",
      502,
      "PAYMOB_INVALID_RESPONSE",
    );
  }

  await PaymentAttempt.create({booking:booking._id,orderId:String(intention.intention_order_id),intentionId:String(intention.id),outcome:'created',amountCents:amount,currency:'EGP'});
  booking.paymobIntentionId = String(intention.id);
  booking.paymobOrderId = String(intention.intention_order_id);
  booking.paymobClientSecret = String(intention.client_secret);
  booking.paymentProvider = "paymob";
  booking.paymentStatus = "unpaid";
  booking.paymentFailureReason = "";
  booking.paymentAttemptCount = Number(booking.paymentAttemptCount || 0) + 1;
  booking.lastPaymentAttemptAt = new Date();
  await booking.save();

  if (savedCards.length) {
    await PaymentMethod.updateMany(
      { _id: { $in: savedCards.map((entry) => entry.method._id) } },
      { $set: { lastUsedAt: new Date() } },
    );
  }

  res.status(200).json({
    success: true,
    data: {
      checkoutMode: env.paymobCheckoutMode,
      checkoutUrl: checkoutUrl(intention.client_secret),
      publicKey: env.paymobPublicKey,
      clientSecret: intention.client_secret,
      intentionId: intention.id,
      orderId: intention.intention_order_id,
      amount: booking.totalPrice,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt,
      displayCurrency: booking.displayCurrency,
      displayAmount: booking.displayAmount,
      displayFxRate: booking.displayFxRate,
      fxRateUpdatedAt: booking.fxRateUpdatedAt,
      showSaveCard: canSaveNewCard,
      savedCardsCount: savedCards.length,
      webhookConfigured,
      reconciliationAvailable: Boolean(env.paymobApiKey),
    },
  });
});

export const getPaymobPaymentStatus = asyncHandler(async (req, res) => {
  await expirePendingBookings({ _id: req.params.bookingId });
  const booking = await Booking.findOne({
    _id: req.params.bookingId,
    tourist: req.user._id,
  }).lean();

  if (!booking) {
    throw new AppError("Booking not found", 404, "BOOKING_NOT_FOUND");
  }

  res.status(200).json({ success: true, data: serializePaymentStatus(booking) });
});

export const reconcilePaymobPayment = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({
    _id: req.params.bookingId,
    tourist: req.user._id,
  }).populate("trip");

  if (!booking) {
    throw new AppError("Booking not found", 404, "BOOKING_NOT_FOUND");
  }

  if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
    return res.status(200).json({
      success: true,
      data: serializePaymentStatus(booking),
      message: "Payment is already confirmed.",
    });
  }

  const transaction = await inquirePaymobTransactionByOrderId(booking.paymobOrderId);
  if (!transaction?.id) {
    throw new AppError(
      "Paymob did not return a transaction for this booking yet.",
      404,
      "PAYMOB_TRANSACTION_NOT_FOUND",
    );
  }

  validateTransactionAgainstBooking(transaction, booking);

  if (transaction.success === true && transaction.pending === false) {
    await finalizeSuccessfulPayment(transaction, booking);
  } else if (transaction.pending === false) {
    await markFailedPayment(transaction, booking);
  } else {
    booking.lastPaymentSyncAt = new Date();
    booking.paymobTransactionId = String(transaction.id || booking.paymobTransactionId || "");
    await booking.save();
  }

  if (transaction.success !== true) {
    await expirePendingBookings({ _id: booking._id });
  }

  const refreshed = await Booking.findById(booking._id).lean();
  return res.status(200).json({
    success: true,
    data: serializePaymentStatus(refreshed),
    message:
      transaction.success === true && transaction.pending === false
        ? "Paymob confirmed the payment."
        : transaction.pending
          ? "Paymob still reports this transaction as pending."
          : "Paymob reports that this payment attempt did not succeed.",
  });
});

export const listSavedPaymentMethods = asyncHandler(async (req, res) => {
  const methods = await PaymentMethod.find({
    user: req.user._id,
    provider: "paymob",
    isActive: true,
  }).sort({ lastUsedAt: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      methods: methods.map(serializePaymentMethod),
      savingEnabled: isPaymentTokenStorageConfigured() && Boolean(getPaymobWebhookUrl()),
    },
  });
});

export const removeSavedPaymentMethod = asyncHandler(async (req, res) => {
  const method = await PaymentMethod.findOne({
    _id: req.params.methodId,
    user: req.user._id,
    provider: "paymob",
    isActive: true,
  });

  if (!method) {
    throw new AppError("Saved payment method not found", 404, "PAYMENT_METHOD_NOT_FOUND");
  }

  method.isActive = false;
  await method.save();

  res.status(200).json({
    success: true,
    message: "Saved card removed from NEFRU.",
  });
});

export const handlePaymobWebhook = async (req, res, next) => {
  try {
    if (!env.paymobHmacSecret) {
      throw new AppError(
        "PAYMOB_HMAC_SECRET is not configured",
        503,
        "PAYMOB_HMAC_NOT_CONFIGURED",
      );
    }

    const receivedHmac =
      req.query?.hmac || req.body?.hmac || req.get("x-paymob-hmac") || "";
    const callbackType = String(req.body?.type || "").toUpperCase();
    const callbackObject = req.body?.obj || req.body;
    const isCardToken = callbackType === "TOKEN" || Boolean(callbackObject?.token && callbackObject?.masked_pan);

    if (isCardToken) {
      if (!callbackObject || !verifyHmac(callbackObject, CARD_TOKEN_HMAC_FIELDS, receivedHmac)) {
        throw new AppError(
          "Invalid Paymob card-token callback signature",
          401,
          "INVALID_PAYMOB_TOKEN_HMAC",
        );
      }

      await storePaymobCardToken(callbackObject);
      console.info("Paymob card-token callback accepted", {
        tokenId: callbackObject.id,
        orderId: callbackObject.order_id,
      });
      return res.status(200).json({ received: true, type: "TOKEN" });
    }

    const transaction = callbackObject;
    if (!transaction || !verifyHmac(transaction, TRANSACTION_HMAC_FIELDS, receivedHmac)) {
      throw new AppError("Invalid Paymob callback signature", 401, "INVALID_PAYMOB_HMAC");
    }

    const booking = await findBookingForTransaction(transaction);
    if (!booking) {
      console.warn("Valid Paymob callback received for an unknown NEFRU booking", {
        transactionId: transaction.id,
        orderId: transaction.order?.id,
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    validateTransactionAgainstBooking(transaction, booking);

    if (transaction.success === true && transaction.pending === false) {
      await finalizeSuccessfulPayment(transaction, booking);
    } else if (transaction.pending === false) {
      await markFailedPayment(transaction, booking);
    } else {
      booking.lastPaymentSyncAt = new Date();
      await booking.save();
    }

    console.info("Paymob transaction callback accepted", {
      transactionId: transaction.id,
      orderId: transaction.order?.id,
      success: transaction.success,
      pending: transaction.pending,
      bookingId: String(booking._id),
    });

    return res.status(200).json({ received: true, type: "TRANSACTION" });
  } catch (error) {
    next(error);
  }
};
