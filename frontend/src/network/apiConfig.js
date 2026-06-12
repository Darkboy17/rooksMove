const DEFAULT_API_BASE = process.env.ROOKS_API_BASE || "";
const DEFAULT_SOCKET_BASE = process.env.ROOKS_SOCKET_BASE || "";

/**
 * Normalizes a configured origin so request paths join cleanly.
 */
function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

/**
 * Reads an optional browser-global URL override.
 */
function getOverrideFromWindow(key, fallback) {
  try {
    const value = window[key];
    return typeof value === "string" && value.trim()
      ? normalizeBaseUrl(value)
      : normalizeBaseUrl(fallback);
  } catch {
    return normalizeBaseUrl(fallback);
  }
}

export const API_BASE = getOverrideFromWindow("ROOKS_API_BASE", DEFAULT_API_BASE);
export const SOCKET_BASE = getOverrideFromWindow(
  "ROOKS_SOCKET_BASE",
  DEFAULT_SOCKET_BASE
);
