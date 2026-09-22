import { apiFileRequest, apiRequest } from "../../services/api";

async function request(endpoint, options, fallbackMessage) {
  try {
    return await apiRequest(endpoint, options);
  } catch (error) {
    return {
      error: error?.message || fallbackMessage,
      status: error?.status,
      code: error?.code,
    };
  }
}

export const getDashboard = () =>
  request("/admin/dashboard", undefined, "Failed to load dashboard data");

// Legacy-compatible list API, retained for old components.
export const getAccount = (accountType = "tourist", page = 1) =>
  request(
    `/admin/user?role=${encodeURIComponent(accountType)}&page=${page}`,
    undefined,
    "Failed to load accounts",
  );

// Accounts v2: server-side search/status/verification filtering.
export const getAccounts = ({
  role = "tourist",
  page = 1,
  query = "",
  status = "all",
  verification = "all",
} = {}) => {
  const params = new URLSearchParams({
    role,
    page: String(page),
    status,
  });
  if (query.trim()) params.set("q", query.trim());
  if (role === "guide") params.set("verification", verification);

  return request(
    `/admin/accounts?${params.toString()}`,
    undefined,
    "Failed to load accounts",
  );
};

export const getAccountReview = (id) =>
  request(`/admin/accounts/${id}`, undefined, "Failed to load account details");

export const reviewGuideVerification = (id, payload) =>
  request(
    `/admin/accounts/${id}/verification`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "Failed to review guide verification",
  );

export const getVerificationDocument = (documentId) =>
  apiFileRequest(`/guide-verification/documents/${documentId}/file`);

// state: "all" | "published" | "unpublished"
export const getTrips = (page = 1, state = "all") =>
  request(
    `/admin/tours/${page}?state=${encodeURIComponent(state || "all")}`,
    undefined,
    "Failed to load trips",
  );

export const getBookings = (page = 1) =>
  request(`/admin/bookings/${page}`, undefined, "Failed to load bookings");

// Booking & Paymob operations v2. Sensitive Paymob secrets are never returned.
export const getBookingOperations = ({
  page = 1,
  query = "",
  bookingStatus = "all",
  paymentStatus = "all",
  provider = "all",
} = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    bookingStatus,
    paymentStatus,
    provider,
  });
  if (query.trim()) params.set("q", query.trim());
  return request(
    `/admin/booking-operations?${params.toString()}`,
    undefined,
    "Failed to load booking operations",
  );
};

export const getBookingOperation = (id) =>
  request(
    `/admin/booking-operations/${id}`,
    undefined,
    "Failed to load booking details",
  );

export const getAdminAnalytics = (days = 30) =>
  request(
    `/admin/analytics?days=${encodeURIComponent(days)}`,
    undefined,
    "Failed to load analytics",
  );

export const banUser = (id) =>
  request(`/admin/user/${id}/ban`, { method: "PATCH" }, "Failed to suspend user");

export const unbanUser = (id) =>
  request(`/admin/user/${id}/unban`, { method: "PATCH" }, "Failed to reactivate user");

export const deleteUser = (id) =>
  request(`/admin/user/${id}`, { method: "DELETE" }, "Failed to delete user");

// Legacy guide review API retained for old callers.
export const reviewGuide = (id, action, rejectionReason) =>
  request(
    `/admin/guide/${id}/${action}`,
    {
      method: "PATCH",
      body: JSON.stringify(rejectionReason ? { rejectionReason } : {}),
    },
    `Failed to ${action} guide`,
  );

export const setTripStatus = (id, action) =>
  request(
    `/admin/trip/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ action }) },
    `Failed to ${action} trip`,
  );

// Tour moderation v2
export const getTourModerationList = ({ page = 1, status = "all", query = "" } = {}) => {
  const params = new URLSearchParams({ page: String(page), status });
  if (query.trim()) params.set("q", query.trim());
  return request(
    `/admin/tour-reviews?${params.toString()}`,
    undefined,
    "Failed to load tour moderation queue",
  );
};

export const getTourModerationDetail = (id) =>
  request(
    `/admin/tour-reviews/${id}`,
    undefined,
    "Failed to load tour review details",
  );

export const moderateTour = (id, action, reason = "") =>
  request(
    `/admin/tour-reviews/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ action, reason }),
    },
    "Failed to update tour moderation status",
  );
