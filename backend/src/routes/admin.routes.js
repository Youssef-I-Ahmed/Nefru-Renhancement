import express from "express";

import {
  banUserById,
  deleteUserById,
  getBookings,
  getAllTours,
  getAllUsers,
  getDashboard,
  getTourById,
  getUserById,
  guideActivation,
  unbanUserById,
  updateUserById,
  updateTripStatus,
} from "../controllers/Admin/Admin.controller.js";
import {
  getAdminAccountReview,
  listAdminAccounts,
  reviewAdminGuideVerification,
} from "../controllers/Admin/accountReview.controller.js";
import {
  getTourModeration,
  listTourModeration,
  reviewTourModeration,
} from "../controllers/Admin/tourModeration.controller.js";
import {
  getAdminAnalytics,
  getAdminBookingOperation,
  listAdminBookingOperations,
} from "../controllers/Admin/bookingAnalytics.controller.js";
import { authorizeRoles, protect } from "../middlewares/authMiddleware.js";
import { createRateLimiter } from "../utils/rateLimiter.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin"));

const adminLimiter = createRateLimiter({
  name: "admin-api",
  windowMs: 60 * 1000,
  max: 120,
});

router.use(adminLimiter);

// Dashboard
router.get("/dashboard", getDashboard);

// Account management v2. Kept alongside legacy /user routes for compatibility.
router.get("/accounts", listAdminAccounts);
router.get("/accounts/:id", getAdminAccountReview);
router.patch("/accounts/:id/verification", reviewAdminGuideVerification);

// User Management (legacy-compatible endpoints)
router.get("/user", getAllUsers);
router.get("/user/:id", getUserById);
router.patch("/user/:id", updateUserById);
router.patch("/user/:id/ban", banUserById);
router.patch("/user/:id/unban", unbanUserById);
router.delete("/user/:id", deleteUserById);

// Guide verification review legacy actions
router.patch("/guide/:id/approve", guideActivation("approve"));
router.patch("/guide/:id/reject", guideActivation("reject"));
router.patch("/guide/:id/suspend", guideActivation("suspend"));


// Tour moderation v2
router.get("/tour-reviews", listTourModeration);
router.get("/tour-reviews/:id", getTourModeration);
router.patch("/tour-reviews/:id", reviewTourModeration);

// Tours created by guides
router.get("/tours/:page", getAllTours);
router.get("/trip/:id", getTourById);
router.patch("/trip/:id/status", updateTripStatus);

// Booking & Paymob operations v2. Legacy paginated endpoint remains below.
router.get("/booking-operations", listAdminBookingOperations);
router.get("/booking-operations/:id", getAdminBookingOperation);
router.get("/analytics", getAdminAnalytics);

// Bookings (legacy read-only)
router.get("/bookings/:page", getBookings);

export default router;
