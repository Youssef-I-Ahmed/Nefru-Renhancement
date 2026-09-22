import { getFxSnapshot } from "../services/fxRate.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getFxRates = asyncHandler(async (req, res) => {
  const snapshot = await getFxSnapshot();
  res.status(200).json({
    success: true,
    data: snapshot,
  });
});
