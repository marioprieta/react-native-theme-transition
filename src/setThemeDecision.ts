/**
 * Pure decision helper for `setTheme`. Given the current engine state
 * and the requested change, returns what the engine should do: ignore
 * the call, accept it as a no-op mode flip (only `preference` updates,
 * no animated transition), or proceed with a real theme swap.
 * `preferenceWriteTiming` covers the follow-up question: which commit
 * writes the user's pick.
 *
 * Extracted from the `setTheme` closure in `transitionEngine.tsx` so
 * the guard rules can be unit-tested without mounting the provider.
 *
 * @module
 * @internal
 */

/**
 * Outcome of calling `setTheme`. `'ignored'` means the engine should
 * return `'ignored'` without touching any state. `'accepted'` splits
 * into two sub-paths: `'mode-flip-noop'` means the resolved theme did
 * not change but the user's `'system'` pick did (update `preference`
 * and return `'accepted'`), and `'proceed'` means run the full
 * transition pipeline.
 * @internal
 */
export type SetThemeDecision =
  | { status: 'ignored'; reason: 'transitioning' | 'same-theme' }
  | { status: 'accepted'; path: 'mode-flip-noop' | 'proceed' }

/**
 * Pure guard logic for `setTheme`. No side effects, no refs, no React.
 * @internal
 */
export function decideSetTheme(input: {
  /** Whether a transition is currently running. */
  transitioning: boolean
  /** The theme the engine is currently painting or transitioning into. */
  currentIntended: string
  /** The concrete theme the `setTheme` call resolves to. */
  resolvedTarget: string
  /** Whether this call flips the `'system'` mode on or off. */
  modeFlipped: boolean
}): SetThemeDecision {
  if (input.transitioning) return { status: 'ignored', reason: 'transitioning' }
  if (input.resolvedTarget === input.currentIntended) {
    return input.modeFlipped
      ? { status: 'accepted', path: 'mode-flip-noop' }
      : { status: 'ignored', reason: 'same-theme' }
  }
  return { status: 'accepted', path: 'proceed' }
}

/**
 * Which commit writes the user's `preference` for an accepted call.
 * `'deferred'` stashes the pick and applies it in the commit that swaps
 * the colour tokens, avoiding a preference-driven update before the
 * snapshot; other state/callback updates are independent. The
 * `'system'`-mode no-op flip and `animated: false` have nothing to defer
 * to and write immediately.
 * @internal
 */
export function preferenceWriteTiming(
  path: 'mode-flip-noop' | 'proceed',
  animated: boolean,
): 'eager' | 'deferred' {
  return animated && path === 'proceed' ? 'deferred' : 'eager'
}
