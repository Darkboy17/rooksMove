import { API_BASE, buildApiUrl } from "../network/apiConfig";

let accessToken = null;
let currentUser = null;
let refreshTimer = null;
let refreshPromise = null;
let callbacks = {};
let authMode = "login";
const SESSION_HINT_KEY = "rooks_move_session_hint";

/**
 * Returns the DOM nodes used by the auth flow.
 */
function getElements() {
  return {
    authCheckPage: document.getElementById("auth-check-page"),
    authPage: document.getElementById("auth-page"),
    form: document.getElementById("auth-form"),
    error: document.getElementById("auth-error"),
    submit: document.getElementById("auth-submit"),
    nameGroup: document.getElementById("name-group"),
    name: document.getElementById("auth-name"),
    email: document.getElementById("auth-email"),
    password: document.getElementById("auth-password"),
    tabs: document.querySelectorAll("#auth-mode-tabs [data-mode]"),
    userBar: document.getElementById("user-bar"),
    userLabel: document.getElementById("user-label"),
    logoutButton: document.getElementById("logout-button"),
    logoutConfirm: document.getElementById("logout-confirm"),
    logoutCancelButton: document.getElementById("logout-cancel-button"),
    logoutConfirmButton: document.getElementById("logout-confirm-button"),
  };
}

let logoutDialogResolver = null;

/**
 * Shows the temporary auth-checking screen.
 */
function showAuthChecking() {
  const { authCheckPage, authPage, userBar } = getElements();
  authCheckPage.style.display = "flex";
  authPage.style.display = "none";
  userBar.style.display = "none";
}

/**
 * Checks whether the browser has a prior-session hint.
 */
function hasSessionHint() {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch (error) {
    return false;
  }
}

/**
 * Persists or clears the prior-session hint.
 */
function setSessionHint(enabled) {
  try {
    if (enabled) {
      window.localStorage.setItem(SESSION_HINT_KEY, "1");
      document.documentElement.classList.add("has-session-hint");
    } else {
      window.localStorage.removeItem(SESSION_HINT_KEY);
      document.documentElement.classList.remove("has-session-hint");
    }
  } catch (error) {
    // Storage can be unavailable in private or restricted browser modes.
  }
}

/**
 * Hides the temporary auth-checking screen.
 */
function hideAuthChecking() {
  const { authCheckPage } = getElements();
  authCheckPage.style.display = "none";
}

/**
 * Displays an auth error message.
 */
function showError(message) {
  const { error } = getElements();
  error.textContent = message;
  error.style.display = message ? "block" : "none";
}

/**
 * Switches the auth form between login and registration.
 */
function setAuthMode(mode) {
  authMode = mode;
  const { tabs, submit, nameGroup, password } = getElements();

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });

  nameGroup.style.display = mode === "register" ? "block" : "none";
  password.setAttribute(
    "autocomplete",
    mode === "register" ? "new-password" : "current-password"
  );
  submit.textContent = mode === "register" ? "Create account" : "Sign in";
  showError("");
}

/**
 * Sends a credential or session request to the backend auth API.
 */
async function authRequest(path, body) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });

  const data =
    response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Authentication failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

/**
 * Decodes the JWT payload without validating the signature.
 */
function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(atob(padded));
  } catch (error) {
    return {};
  }
}

/**
 * Schedules token refresh shortly before the access token expires.
 */
function scheduleSilentRefresh(token) {
  clearTimeout(refreshTimer);
  const payload = decodeJwtPayload(token);
  if (!payload.exp) return;

  const expiresAtMs = payload.exp * 1000;
  const tokenLifetimeMs = Math.max(expiresAtMs - (payload.iat || 0) * 1000, 0);
  const refreshLeadMs = Math.min(60000, Math.max(10000, tokenLifetimeMs * 0.25));
  const refreshInMs = Math.max(expiresAtMs - Date.now() - refreshLeadMs, 1000);

  refreshTimer = setTimeout(() => {
    refreshSession({ silent: true });
  }, refreshInMs);
}

/**
 * Checks whether the current access token is close to expiry.
 */
function shouldRefreshSoon(token) {
  const payload = decodeJwtPayload(token);
  if (!payload.exp) return true;

  return payload.exp * 1000 - Date.now() < 60000;
}

/**
 * Refreshes the session when focus returns and the token is stale.
 */
function refreshSessionIfNeeded() {
  if (!currentUser) return;
  if (!accessToken || shouldRefreshSoon(accessToken)) {
    refreshSession({ silent: true });
  }
}

/**
 * Shows authenticated UI and user metadata.
 */
function showAuthenticated(user) {
  const { authPage, userBar, userLabel } = getElements();
  hideAuthChecking();
  authPage.style.display = "none";
  userBar.style.display = "flex";
  userLabel.textContent = user.name || user.email;
}

/**
 * Shows the signed-out auth UI.
 */
function showSignedOut() {
  const { authPage, userBar } = getElements();
  hideAuthChecking();
  authPage.style.display = "flex";
  userBar.style.display = "none";
}

/**
 * Resolves and closes the logout confirmation dialog.
 */
function closeLogoutDialog(confirmed) {
  const { logoutConfirm } = getElements();
  logoutConfirm.style.display = "none";

  if (logoutDialogResolver) {
    logoutDialogResolver(Boolean(confirmed));
    logoutDialogResolver = null;
  }
}

/**
 * Opens the logout confirmation dialog and resolves the user's choice.
 */
function confirmLogout() {
  const { logoutConfirm, logoutCancelButton, logoutConfirmButton } = getElements();

  if (logoutDialogResolver) return Promise.resolve(false);

  logoutConfirm.style.display = "flex";
  logoutConfirmButton.focus();

  return new Promise((resolve) => {
    logoutDialogResolver = resolve;

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        document.removeEventListener("keydown", handleKeydown);
        closeLogoutDialog(false);
      }
    };

    const finish = (confirmed) => {
      document.removeEventListener("keydown", handleKeydown);
      closeLogoutDialog(confirmed);
    };

    logoutCancelButton.onclick = () => finish(false);
    logoutConfirmButton.onclick = () => finish(true);
    logoutConfirm.onclick = (event) => {
      if (event.target === logoutConfirm) finish(false);
    };
    document.addEventListener("keydown", handleKeydown);
  });
}

/**
 * Stores a new authenticated session in memory.
 */
function setSession(session) {
  const wasSignedOut = !currentUser;

  accessToken = session.accessToken;
  currentUser = session.user;
  setSessionHint(true);
  scheduleSilentRefresh(accessToken);
  showAuthenticated(currentUser);

  if (callbacks.onTokenChanged) callbacks.onTokenChanged(accessToken);
  if (wasSignedOut && callbacks.onAuthenticated) {
    callbacks.onAuthenticated({ accessToken, user: currentUser });
  }
}

/**
 * Clears all local session state and returns to signed-out UI.
 */
function clearSession() {
  clearTimeout(refreshTimer);
  refreshTimer = null;
  accessToken = null;
  currentUser = null;
  setSessionHint(false);
  closeLogoutDialog(false);
  showSignedOut();

  if (callbacks.onTokenChanged) callbacks.onTokenChanged(null);
  if (callbacks.onLogout) callbacks.onLogout();
}

/**
 * Refreshes the access token using the HTTP-only refresh cookie.
 */
export async function refreshSession(options = {}) {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const session = await authRequest(`${API_BASE}/api/auth/refresh`);
      setSession(session);
      return true;
    } catch (error) {
      if (!options.silent) showError(error.message);
      if (error.status === 401) {
        clearSession();
        return false;
      } else if (!currentUser) {
        showSignedOut();
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Logs the current user out locally and on the backend.
 */
export async function logout(options = {}) {
  if (!options.skipConfirmation && !(await confirmLogout())) {
    return;
  }

  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
  } finally {
    clearSession();
  }
}

/**
 * Fetches an API resource with bearer auth and one automatic refresh retry.
 */
export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);
  const headers = {
    ...(options.headers || {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  let response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  if (response.status === 401 && (await refreshSession({ silent: true }))) {
    response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  return response;
}

/**
 * Returns the active in-memory access token.
 */
export function getAccessToken() {
  return accessToken;
}

/**
 * Returns the active in-memory user profile.
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Wires auth UI events and attempts silent session restoration.
 */
export function initializeAuth(authCallbacks = {}) {
  callbacks = authCallbacks;
  const { form, tabs, name, email, password, submit, logoutButton } = getElements();

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setAuthMode(tab.dataset.mode));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = authMode === "register" ? "Creating..." : "Signing in...";
    showError("");

    try {
      const session = await authRequest(`${API_BASE}/api/auth/${authMode}`, {
        name: name.value,
        email: email.value,
        password: password.value,
      });
      form.reset();
      setSession(session);
    } catch (error) {
      showError(error.message);
    } finally {
      submit.disabled = false;
      submit.textContent =
        authMode === "register" ? "Create account" : "Sign in";
    }
  });

  logoutButton.addEventListener("click", () => logout());
  window.addEventListener("focus", refreshSessionIfNeeded);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshSessionIfNeeded();
  });

  setAuthMode("login");
  if (hasSessionHint()) {
    showAuthChecking();
  } else {
    showSignedOut();
  }
  refreshSession({ silent: true });
}
