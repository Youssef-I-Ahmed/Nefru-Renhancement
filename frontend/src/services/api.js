import { DEV_AUTH_BYPASS, getDevelopmentRole } from "../config/devAccess";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
})();

function withDevAuth(headers = {}) {
  const nextHeaders = { ...headers };
  if (DEV_AUTH_BYPASS && !nextHeaders["X-Dev-Auth-Role"]) {
    nextHeaders["X-Dev-Auth-Role"] = getDevelopmentRole();
  }
  return nextHeaders;
}

async function readError(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.message || data?.msg || "Something went wrong");
    error.status = response.status;
    error.code = data?.error?.code;
    error.data = data;
    return error;
  }
  const text = await response.text().catch(() => "");
  const error = new Error(text || "Something went wrong");
  error.status = response.status;
  return error;
}

export async function apiRequest(endpoint, options = {}) {
  const headers = withDevAuth(options.headers);

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.msg || "Something went wrong",
    );
    error.status = response.status;
    error.code = data?.error?.code;
    error.data = data;
    throw error;
  }

  return data;
}

// For protected binary responses such as private guide verification documents.
// This uses the same cookie/dev-auth behavior as apiRequest without trying to
// parse the response as JSON.
export async function apiFileRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: withDevAuth(options.headers),
    credentials: "include",
  });

  if (!response.ok) throw await readError(response);
  return response.blob();
}

export { API_BASE_URL };

export function resolveMediaUrl(value) {
  if (!value || typeof value !== "string") return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${API_ORIGIN}${value.startsWith("/") ? value : `/${value}`}`;
}

export function resolveUploadsUrl(value) {
  if (!value || typeof value !== "string") return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.startsWith("/") ? value : `/uploads/${value}`;
  return `${API_ORIGIN}${path}`;
}
