import { Router } from "express";

import {
  createPaymobCheckout,
  getPaymobPaymentStatus,
  handlePaymobWebhook,
  listSavedPaymentMethods,
  reconcilePaymobPayment,
  removeSavedPaymentMethod,
} from "../controllers/payment.controller.js";
import { authorizeRoles, protect } from "../middlewares/authMiddleware.js";

const paymentRouter = Router();

// Public server-to-server callback. Authenticity is enforced by Paymob HMAC.
paymentRouter.post("/paymob/webhook", handlePaymobWebhook);

paymentRouter.use(protect, authorizeRoles("tourist"));

// Saved-card metadata only. Raw card details never pass through NEFRU.
paymentRouter.get("/methods", listSavedPaymentMethods);
paymentRouter.delete("/methods/:methodId", removeSavedPaymentMethod);

paymentRouter.post("/checkout", createPaymobCheckout);
paymentRouter.post("/:bookingId/reconcile", reconcilePaymobPayment);
paymentRouter.get("/:bookingId/status", getPaymobPaymentStatus);

export default paymentRouter;
