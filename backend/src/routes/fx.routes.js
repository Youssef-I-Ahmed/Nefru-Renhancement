import { Router } from "express";

import { getFxRates } from "../controllers/fx.controller.js";

const router = Router();
router.get("/rates", getFxRates);

export default router;
