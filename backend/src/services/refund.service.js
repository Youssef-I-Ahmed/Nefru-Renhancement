import { Booking } from "../models/booking.model.js";
import { BookingSeat } from "../models/bookingSeat.model.js";
import { OperationalCase } from "../models/operationalCase.model.js";
import { PaymentAttempt } from "../models/paymentAttempt.model.js";
import { AppError } from "../utils/AppError.js";
import { demand } from "../domain/policies.js";
import { atomic, audit, enqueue } from "./marketplace.service.js";
import {
  inquirePaymobTransactionByOrderId,
  refundPaymobTransaction,
} from "./paymob.service.js";

const centsFor = (value) => Math.round(Number(value || 0) * 100);

export function isPaymobRefundTransaction(transaction = {}) {
  return (
    transaction.is_refund === true ||
    transaction.is_refunded === true ||
    Number(transaction.refunded_amount_cents || 0) > 0 ||
    Number(transaction.refunded_amount_cents_int || 0) > 0
  );
}

function refundedCents(transaction = {}) {
  if (transaction.is_refund === true) {
    return Number(
      transaction.amount_cents ??
        transaction.amount_cents_int ??
        transaction.data?.amount ??
        0,
    );
  }

  const direct =
    transaction.refunded_amount_cents ??
    transaction.refunded_amount_cents_int ??
    transaction.data?.refunded_amount;
  if (direct !== undefined && direct !== null) return Number(direct || 0);

  const gatewayAmount = Number(
    transaction.data?.migs_order?.totalRefundedAmount || 0,
  );
  return Number.isFinite(gatewayAmount) ? Math.round(gatewayAmount * 100) : 0;
}

function validateRefundTransaction(transaction, booking) {
  const callbackCurrency = String(
    transaction.currency || transaction.order?.currency || booking.currency || "",
  ).toUpperCase();

  demand(
    !callbackCurrency ||
      callbackCurrency === String(booking.currency || "EGP").toUpperCase(),
    "Paymob refund currency mismatch",
    400,
    "PAYMOB_REFUND_CURRENCY_MISMATCH",
  );

  const amount = refundedCents(transaction);
  demand(
    amount > 0 && amount <= centsFor(booking.totalPrice),
    "Paymob refund amount is invalid",
    400,
    "PAYMOB_REFUND_AMOUNT_MISMATCH",
  );

  demand(
    transaction.success !== false && transaction.pending !== true,
    "Paymob refund is not complete",
    409,
    "PAYMOB_REFUND_NOT_COMPLETE",
  );

  return amount;
}

async function queueRefundNotifications(session, booking, eventId) {
  await enqueue(
    session,
    `refund-tourist:${eventId}`,
    "notification",
    {
      user: String(booking.tourist),
      type: "payment",
      title: "Refund completed",
      message: `Your ${booking.currency} ${Number(booking.refundedAmount || 0).toFixed(2)} refund has been completed.`,
      link: "/user/profile/bookings",
      entityType: "booking",
      entityId: String(booking._id),
    },
  );

  await enqueue(
    session,
    `refund-guide:${eventId}`,
    "notification",
    {
      user: String(booking.guide),
      type: "payment",
      title: "Booking refunded",
      message: "A booking was refunded and its unsettled guide earnings were adjusted.",
      link: "/guide/earnings",
      entityType: "booking",
      entityId: String(booking._id),
    },
  );
}

export async function finalizePaymobRefund(
  transaction,
  bookingId,
  actor = null,
  reason = "Paymob refund confirmed",
) {
  return atomic(async (session) => {
    const booking = await Booking.findById(bookingId).session(session);
    demand(booking, "Booking not found", 404, "BOOKING_NOT_FOUND");

    const amountCents = validateRefundTransaction(transaction, booking);
    const totalCents = centsFor(booking.totalPrice);
    const amount = Math.min(Number(booking.totalPrice), amountCents / 100);
    const fullRefund = amountCents >= totalCents;

    if (
      fullRefund &&
      booking.paymentStatus === "refunded" &&
      booking.refundStatus === "refunded"
    ) {
      return booking;
    }

    const before = {
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      refundStatus: booking.refundStatus,
      refundedAmount: booking.refundedAmount,
      platformFee: booking.platformFee,
      guideEarnings: booking.guideEarnings,
      settlementStatus: booking.settlementStatus,
    };

    if (booking.refundOriginalGuideEarnings == null) {
      booking.refundOriginalGuideEarnings = Number(booking.guideEarnings || 0);
    }
    if (booking.refundOriginalPlatformFee == null) {
      booking.refundOriginalPlatformFee = Number(booking.platformFee || 0);
    }

    booking.refundedAmount = Math.max(Number(booking.refundedAmount || 0), amount);
    booking.refundStatus = fullRefund ? "refunded" : "partially_refunded";
    booking.paymentStatus = fullRefund ? "refunded" : "partially_refunded";
    booking.refundCompletedAt = new Date();
    booking.refundFailureReason = "";
    booking.refundProviderReference = String(
      transaction.id || booking.refundProviderReference || "",
    );
    booking.lastPaymentSyncAt = new Date();

    const refundRatio = Math.min(
      1,
      Number(booking.refundedAmount || 0) / Math.max(Number(booking.totalPrice || 0), 0.01),
    );

    if (booking.settlementStatus !== "settled") {
      booking.platformFee = Math.max(
        0,
        Number(booking.refundOriginalPlatformFee || 0) * (1 - refundRatio),
      );
      booking.guideEarnings = Math.max(
        0,
        Number(booking.refundOriginalGuideEarnings || 0) * (1 - refundRatio),
      );
    }

    if (fullRefund) {
      booking.status = "refunded";
      booking.earningsAvailableAt = null;
      booking.refundEntitlement = "not_applicable";
      await BookingSeat.deleteOne({ booking: booking._id }, { session });
    }

    if (booking.settlementStatus === "settled") {
      await OperationalCase.updateOne(
        { key: `refund-settlement-recovery:${booking._id}` },
        {
          $setOnInsert: {
            key: `refund-settlement-recovery:${booking._id}`,
            type: "refund_review",
            booking: booking._id,
            report:
              "Paymob refund was recorded after guide earnings were already settled. Manual finance recovery is required.",
          },
        },
        { upsert: true, session },
      );
    }

    await booking.save({ session });

    const transactionId = String(transaction.id || "");
    if (
      transaction.is_refund === true &&
      transactionId &&
      transactionId !== String(booking.paymobTransactionId || "")
    ) {
      await PaymentAttempt.updateOne(
        { transactionId },
        {
          $set: {
            booking: booking._id,
            orderId: String(transaction.order?.id || booking.paymobOrderId || ""),
            outcome: "refunded",
            amountCents,
            currency: "EGP",
          },
        },
        { upsert: true, session, runValidators: true },
      );
    }

    await OperationalCase.updateMany(
      {
        booking: booking._id,
        type: "refund_review",
        status: "open",
      },
      {
        $set: {
          status: "resolved",
          resolution: String(reason || "Refund completed").slice(0, 4000),
          resolvedBy: actor?._id || null,
          resolvedAt: new Date(),
        },
      },
      { session },
    );

    const event = await audit(
      session,
      actor,
      fullRefund ? "refund_completed" : "partial_refund_completed",
      "Booking",
      booking,
      before,
      reason,
    );

    await queueRefundNotifications(session, booking, event._id);
    return booking;
  });
}

async function markRefundFailed(bookingId, error) {
  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        refundStatus: "failed",
        refundFailureReason: String(
          error?.message || "Paymob refund request failed",
        ).slice(0, 500),
        lastPaymentSyncAt: new Date(),
      },
    },
  );
}

export async function requestFullPaymobRefund(
  bookingId,
  actor,
  reason = "",
) {
  demand(actor?.role === "admin", "Admin required", 403, "ADMIN_REQUIRED");
  demand(
    String(reason).trim().length >= 3,
    "Refund reason is required",
    400,
    "REFUND_REASON_REQUIRED",
  );

  const booking = await Booking.findById(bookingId);
  demand(booking, "Booking not found", 404, "BOOKING_NOT_FOUND");
  demand(
    booking.paymentProvider === "paymob",
    "Only Paymob bookings can be refunded through this workflow",
    409,
    "REFUND_PROVIDER_UNSUPPORTED",
  );
  demand(
    ["paid", "partially_refunded"].includes(booking.paymentStatus),
    "This booking has no refundable captured payment",
    409,
    "BOOKING_NOT_REFUNDABLE",
  );
  demand(
    booking.settlementStatus !== "settled",
    "Guide earnings are already settled. Use a manual finance recovery workflow.",
    409,
    "GUIDE_SETTLEMENT_ALREADY_PAID",
  );
  demand(
    booking.paymobTransactionId,
    "Paymob transaction ID is missing",
    409,
    "PAYMOB_TRANSACTION_ID_MISSING",
  );
  demand(
    booking.refundStatus !== "processing",
    "A refund is already being processed",
    409,
    "REFUND_ALREADY_PROCESSING",
  );

  const remainingCents = Math.max(
    0,
    centsFor(booking.totalPrice) - centsFor(booking.refundedAmount),
  );
  demand(
    remainingCents > 0,
    "This booking is already fully refunded",
    409,
    "BOOKING_ALREADY_REFUNDED",
  );

  await atomic(async (session) => {
    const current = await Booking.findById(booking._id).session(session);
    demand(current, "Booking not found", 404, "BOOKING_NOT_FOUND");
    demand(
      current.refundStatus !== "processing",
      "A refund is already being processed",
      409,
      "REFUND_ALREADY_PROCESSING",
    );

    if (current.refundOriginalGuideEarnings == null) {
      current.refundOriginalGuideEarnings = Number(current.guideEarnings || 0);
    }
    if (current.refundOriginalPlatformFee == null) {
      current.refundOriginalPlatformFee = Number(current.platformFee || 0);
    }

    current.refundStatus = "processing";
    current.refundRequestedAmount = remainingCents / 100;
    current.refundReason = String(reason).trim().slice(0, 1000);
    current.refundRequestedAt = new Date();
    current.refundRequestedBy = actor._id;
    current.refundFailureReason = "";
    await current.save({ session });

    await audit(
      session,
      actor,
      "refund_requested",
      "Booking",
      current,
      {
        paymentStatus: booking.paymentStatus,
        refundStatus: booking.refundStatus,
        refundedAmount: booking.refundedAmount,
      },
      reason,
    );
  });

  try {
    const transaction = await refundPaymobTransaction(
      booking.paymobTransactionId,
      remainingCents,
    );

    if (transaction?.success === true && transaction?.pending !== true) {
      await finalizePaymobRefund(
        transaction,
        booking._id,
        actor,
        String(reason).trim(),
      );
    }

    return Booking.findById(booking._id).lean();
  } catch (error) {
    // A network timeout can happen after Paymob accepted the refund.
    // Reconcile before marking the request failed to avoid a duplicate retry.
    try {
      const transaction = await inquirePaymobTransactionByOrderId(
        booking.paymobOrderId,
      );

      if (isPaymobRefundTransaction(transaction)) {
        await finalizePaymobRefund(
          transaction,
          booking._id,
          actor,
          String(reason).trim(),
        );
        return Booking.findById(booking._id).lean();
      }
    } catch {
      // Preserve the original provider error below.
    }

    await markRefundFailed(booking._id, error);
    throw error instanceof AppError
      ? error
      : new AppError(
          "Unable to complete the Paymob refund",
          502,
          "PAYMOB_REFUND_FAILED",
        );
  }
}
