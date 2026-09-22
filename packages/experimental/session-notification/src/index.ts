/**
 * Host half for the browser Session-notification plugin. Preferences are
 * browser-local (localStorage), so the Host reserves no settings namespace and
 * the half only anchors the package in the profile composition.
 * @module @deepseek-ai/dsh-experimental-session-notification
 */

/** Host plugin body; notification behavior lives in the browser export. */
export function apply(): void {}
