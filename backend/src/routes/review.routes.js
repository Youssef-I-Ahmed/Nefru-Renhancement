import { Router } from "express";

import {
  createReview,
  deleteReview,
  getGuideReviews,
  getMyReviews,
  getTripReviews,
  updateGuideResponse,
  updateReview,
} from "../controllers/review.controller.js";
import { authorizeRoles, protect } from "../middlewares/authMiddleware.js";

const reviewRouter = Router();

reviewRouter.get("/trip/:tripId", getTripReviews);
reviewRouter.get("/guide/me", protect, authorizeRoles("guide"), getGuideReviews);
reviewRouter.patch(
  "/guide/:id/response",
  protect,
  authorizeRoles("guide"),
  updateGuideResponse,
);
reviewRouter.get("/me", protect, authorizeRoles("tourist"), getMyReviews);
reviewRouter.post("/", protect, authorizeRoles("tourist"), createReview);
reviewRouter.patch("/:id", protect, authorizeRoles("tourist"), updateReview);
reviewRouter.delete("/:id", protect, authorizeRoles("tourist"), deleteReview);

export default reviewRouter;
