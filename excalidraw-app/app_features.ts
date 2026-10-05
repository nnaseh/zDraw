/**
 * zDraw feature flags derived from env config.
 *
 * zDraw ships as a standalone, local-first app. Features that depend on a
 * remote service are only enabled when that service is explicitly configured
 * via env vars (see `.env.development` / `.env.production` in repo root).
 * Leaving a var empty disables the feature and hides its UI entirely, rather
 * than leaving half-wired calls to a backend that doesn't exist.
 */

const isSet = (value: string | undefined | null): value is string =>
  typeof value === "string" && value.trim() !== "";

const hasFirebaseConfig = (() => {
  const raw = import.meta.env.VITE_APP_FIREBASE_CONFIG;
  if (!isSet(raw)) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw);
    return !!parsed && typeof parsed === "object";
  } catch {
    return false;
  }
})();

/**
 * Real-time collaboration needs a socket server (excalidraw-room compatible)
 * for live sync AND Firebase for room persistence + image storage.
 */
export const isCollabEnabled =
  isSet(import.meta.env.VITE_APP_WS_SERVER_URL) && hasFirebaseConfig;

/**
 * Read-only shareable links (`#json=...`) need the JSON backend (GET + POST)
 * for encrypted scene storage AND Firebase for image file storage.
 */
export const isShareLinkEnabled =
  isSet(import.meta.env.VITE_APP_BACKEND_V2_GET_URL) &&
  isSet(import.meta.env.VITE_APP_BACKEND_V2_POST_URL) &&
  hasFirebaseConfig;

/** AI text-to-diagram + diagram-to-code need the AI backend. */
export const isAIEnabled = isSet(import.meta.env.VITE_APP_AI_BACKEND);

/** Any form of sharing (live collab or read-only link) is available. */
export const isShareEnabled = isCollabEnabled || isShareLinkEnabled;
