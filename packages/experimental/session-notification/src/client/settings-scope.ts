/**
 * Preferences-scope contract for a browser-local settings owner.
 *
 * `dsh-client-runtime` first defined a settings scope (snapshot +
 * subscribe + mutate/set/unset); `dsh-client-ui-settings` re-exported the
 * types until upstream dissolved the client contract. This plugin owns its
 * browser-local scope (`createLocalSettingsScope`) end to end, so the two
 * types it implements live here rather than in a host settings package.
 */

import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'

/** One accepted snapshot of a settings scope. */
export interface SettingsScopeSnapshot<T> {
  /** Scope readiness (`unavailable` = no accepted snapshot — defaults apply). */
  status: 'loading' | 'ready' | 'unavailable'
  /** Current durable value. */
  value: T
  /** Composition base layer (schema defaults). */
  base: T
  /** Raw user layer, when one exists. */
  user?: unknown
  /** Monotonic revision; send it back as `expectedRevision` on a write. */
  revision: number
  /** Whether the scope accepts writes. */
  writable: boolean
  /** Persistence mode. */
  mode: 'memory' | 'host'
}

/** A settings scope: a subscribable snapshot source with path-addressed writes. */
export interface SettingsScope<T> {
  /** Read the current snapshot. */
  getSnapshot(): SettingsScopeSnapshot<T>
  /** Subscribe to snapshot changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** Fold the operations over the current value and commit. */
  mutate(ops: readonly SettingsPathOpView[], expectedRevision?: number): Promise<void>
  /** Set one top-level field and commit. */
  set(field: string, fieldValue: unknown): Promise<void>
  /** Reset one top-level field to its default and commit. */
  unset(field: string): Promise<void>
}
