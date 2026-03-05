/**
 * Overlink — Auth Bridge Content Script
 *
 * Runs on the web app domain. Reads the Supabase session token from
 * localStorage and forwards it to the background service worker so the
 * extension can make authenticated API calls.
 */

const LOG = "[Overlink AuthBridge]";

interface AuthSession {
  token: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // unix seconds
  supabaseUrl: string | null;
  email: string | null;
}

function getSupabaseSession(): AuthSession {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { token: null, refreshToken: null, expiresAt: null, supabaseUrl: null, email: null };
        const parsed = JSON.parse(raw);
        // Derive Supabase project URL from the localStorage key: sb-{ref}-auth-token
        const projectRef = key.slice(3, key.length - 11); // strip "sb-" prefix and "-auth-token" suffix
        const supabaseUrl = `https://${projectRef}.supabase.co`;
        return {
          token: parsed?.access_token ?? null,
          refreshToken: parsed?.refresh_token ?? null,
          expiresAt: parsed?.expires_at ?? null,
          supabaseUrl,
          email: parsed?.user?.email ?? null,
        };
      } catch {
        return { token: null, refreshToken: null, expiresAt: null, supabaseUrl: null, email: null };
      }
    }
  }
  return { token: null, refreshToken: null, expiresAt: null, supabaseUrl: null, email: null };
}

function sendSession(session: AuthSession): void {
  chrome.runtime.sendMessage({
    type: "SET_AUTH_TOKEN",
    token: session.token,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    supabaseUrl: session.supabaseUrl,
    email: session.email,
  }, () => {
    if (chrome.runtime.lastError) {
      // Extension may not be ready — safe to ignore
    }
  });
}

// Send on load
const initialSession = getSupabaseSession();
console.log(`${LOG} Initial session: ${initialSession.token ? "present" : "none"}`);
sendSession(initialSession);

// Intercept localStorage.removeItem to catch sign-out in the same tab.
const _origRemoveItem = localStorage.removeItem.bind(localStorage);
localStorage.removeItem = function (key: string) {
  _origRemoveItem(key);
  if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
    console.log(`${LOG} Token removed (sign-out)`);
    sendSession({ token: null, refreshToken: null, expiresAt: null, supabaseUrl: null, email: null });
  }
};

// Intercept localStorage.setItem to catch same-tab token refreshes.
// Supabase silently refreshes the access token in the same tab —
// the native `storage` event only fires for OTHER tabs, so we miss it without this.
const _origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key: string, value: string) {
  _origSetItem(key, value);
  if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
    try {
      const parsed = JSON.parse(value);
      const session: AuthSession = {
        token: parsed?.access_token ?? null,
        email: parsed?.user?.email ?? null,
      };
      console.log(`${LOG} Token refreshed (setItem): ${session.token ? "present" : "none"}`);
      sendSession(session);
    } catch { /* ignore parse errors */ }
  }
};

// Cross-tab changes (login / logout from another tab)
window.addEventListener("storage", (e) => {
  if (e.key && e.key.startsWith("sb-") && e.key.endsWith("-auth-token")) {
    const session: AuthSession = e.newValue
      ? (() => {
          try {
            const parsed = JSON.parse(e.newValue);
            return { token: parsed?.access_token ?? null, email: parsed?.user?.email ?? null };
          } catch {
            return { token: null, email: null };
          }
        })()
      : { token: null, email: null };
    console.log(`${LOG} Session changed (cross-tab): ${session.token ? "present" : "none"}`);
    sendSession(session);
  }
});

// Periodic re-read as a safety net (catches any missed updates)
setInterval(() => {
  const session = getSupabaseSession();
  if (session.token) sendSession(session);
}, 4 * 60 * 1000); // every 4 minutes (access tokens expire after 60 min)
