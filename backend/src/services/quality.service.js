import { PrivateExperienceSurvey } from "../models/privateExperienceSurvey.model.js";
import { Booking } from "../models/booking.model.js";

// Version 1: an understandable survey average, independent of public star ratings.
// Incidents/cancellations remain separate evidence, never automatic penalties.
export async function qualityMetrics(
  guideId,
  { includePrivate = false, session = null } = {},
) {
  const fields = [
    "overall",
    "knowledge",
    "communication",
    "punctuality",
    "safety",
    "value",
    "matchedListing",
  ];
  const surveys = await PrivateExperienceSurvey.find({ guide: guideId })
    .select(fields.join(" "))
    .session(session)
    .lean();
  const averages = Object.fromEntries(
    fields.map((field) => {
      const values = surveys.map((s) => s[field]).filter(Number.isFinite);
      return [
        field,
        values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : null,
      ];
    }),
  );
  const evidence = Object.values(averages).filter(Number.isFinite);
  const score = evidence.length
    ? Math.round((evidence.reduce((a, b) => a + b, 0) / evidence.length) * 20)
    : null;
  if (!includePrivate)
    return {
      surveyCount: surveys.length,
      metrics:
        surveys.length >= 5
          ? Object.fromEntries(
              [
                "overall",
                "knowledge",
                "communication",
                "punctuality",
                "value",
              ].map((f) => [f, averages[f]]),
            )
          : null,
    };
  const bookings = await Booking.find({
    guide: guideId,
    bookingSource: { $ne: "seed" },
  })
    .select("status cancelledBy")
    .session(session)
    .lean();
  return {
    surveyCount: surveys.length,
    metrics: averages,
    internalQualityScore: score,
    formulaVersion: "survey-mean-v1",
    completedBookings: bookings.filter((b) => b.status === "completed").length,
    guideCancellations: bookings.filter(
      (b) => b.status === "cancelled" && b.cancelledBy === "guide",
    ).length,
  };
}
