import { Router } from "express";
import mongoose from 'mongoose';
import userRouter from "./user.routes.js";
import tripRouter from "./trip.routes.js";
import bookingRouter from "./booking.routes.js";
import guideRouter from "./guide.routes.js";
import authUserRoutes from "./authUser.routes.js";
import adminRoutes from "./admin.routes.js";
import homeRouter from "./home.routes.js";
import paymentRouter from "./payment.routes.js";
import guideVerificationRouter from "./guideVerification.routes.js";
import notificationRouter from "./notification.routes.js";
import reviewRouter from "./review.routes.js";
import fxRouter from "./fx.routes.js";

import marketplaceRouter from './marketplace.routes.js';
const apiRouter = Router();
apiRouter.use('/marketplace', marketplaceRouter);

apiRouter.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "NEFRU API is running",
  });
});
apiRouter.get('/ready', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('Disconnected');
    await mongoose.connection.db.command({ ping: 1 }, { maxTimeMS: 2000 });
    res.json({ success: true });
  } catch { res.status(503).json({ success: false, message: 'Database unavailable' }); }
});

apiRouter.use("/auth", authUserRoutes);
apiRouter.use("/users", userRouter);
apiRouter.use("/trips", tripRouter);
apiRouter.use("/bookings", bookingRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/home", homeRouter);
apiRouter.use("/guides", guideRouter);
apiRouter.use("/guide-verification", guideVerificationRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/fx", fxRouter);

export default apiRouter;
