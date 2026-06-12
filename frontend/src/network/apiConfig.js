const DEFAULT_API_BASE = "http://localhost:3000";
const DEFAULT_SOCKET_BASE = "http://localhost:3000";

/**
 * Reads an optional browser-global URL override.
 */
function getOverrideFromWindow(key, fallback) {
  try {
    const value = window[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  } catch {
    return fallback;
  }
}

export const API_BASE = getOverrideFromWindow("ROOKS_API_BASE", DEFAULT_API_BASE);
export const SOCKET_BASE = getOverrideFromWindow(
  "ROOKS_SOCKET_BASE",
  DEFAULT_SOCKET_BASE
);
