/**
 * `useTheme` hook factory. Produces a hook bound to a specific theme
 * transition context so multiple theme scopes can coexist without sharing
 * state.
 *
 * @module
 * @internal
 */

import type { Context } from 'react'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { TAG } from '../constants'
import { isOriginRef, measureCenter } from '../overlay/resolveOrigin'
import type {
  OriginSpec,
  SelectOptions,
  SetThemeOptions,
  ThemeContextValue,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
  UseThemeOptions,
  UseThemeResult,
} from '../types'

/**
 * Factory that produces the `useTheme` hook bound to a specific context.
 *
 * @internal Used by {@link createThemeTransition}; not part of the public API.
 */
export function createUseTheme<T extends Record<string, ThemeDefinition>>(
  Ctx: Context<ThemeContextValue<TokenNames<T>, ThemeNames<T>> | null>,
) {
  type Tokens = TokenNames<T>
  type Names = ThemeNames<T>

  /**
   * Read the active theme, change it, and drive theme-picker UIs.
   *
   * @param options - Optional seed for `selected`. Read once on mount — like
   *                  the initializer of `useState`. Defaults to the currently
   *                  active theme name.
   * @returns Current `colors`, `name`, `isTransitioning`, plus `setTheme`,
   *          `select`, and the tracked `selected` value.
   *
   * @remarks
   * Use `select()` for user-driven picker UIs — it updates the tracked
   * selection synchronously so the pressed highlight is painted before the
   * snapshot is captured, then defers `setTheme` by one animation frame.
   * Use `setTheme()` directly for programmatic changes where no picker UI
   * is involved.
   *
   * @throws If called outside a `ThemeTransitionProvider`.
   */
  function useTheme(options?: UseThemeOptions<Names>): UseThemeResult<Tokens, Names> {
    const ctx = useContext(Ctx)
    if (!ctx) {
      throw new Error(`${TAG} \`useTheme\` must be used inside a \`ThemeTransitionProvider\`.`)
    }

    const { setTheme, isTransitioning } = ctx

    const [selected, setSelected] = useState<Names | 'system'>(
      () => options?.initialSelection ?? ctx.name,
    )
    // Guards against rapid double-taps firing two `select` calls in the
    // same frame (and therefore two optimistic `setSelected` updates).
    // Released at the end of the rAF callback — the native transition
    // blocker overlay (`isBlocking`) handles real mid-transition touch
    // prevention at the UI thread level.
    const pressLockRef = useRef(false)

    useEffect(() => {
      if (!isTransitioning) pressLockRef.current = false
    }, [isTransitioning])

    const select = useCallback(
      (option: Names | 'system', selectOptions?: SelectOptions<Names>) => {
        if (pressLockRef.current) return
        pressLockRef.current = true

        // Capture ref coordinates NOW, before the next animation frame
        // shifts layout.
        const rawOrigin: OriginSpec | undefined =
          selectOptions && 'origin' in selectOptions ? selectOptions.origin : undefined
        const capturedOrigin =
          rawOrigin && isOriginRef(rawOrigin) ? (measureCenter(rawOrigin) ?? undefined) : rawOrigin

        // Paint highlight first — the deferred `setTheme` lets React commit
        // the pressed state before the snapshot is taken.
        setSelected(option)
        requestAnimationFrame(() => {
          const nextOptions = selectOptions
            ? ({ ...selectOptions, origin: capturedOrigin } as SetThemeOptions<Names>)
            : undefined
          // Deliberately do NOT revert `selected` on rejection. A rejection
          // means either (a) the user tapped the active theme — in which
          // case the optimistic set was a no-op — or (b) the engine was
          // mid-transition — in which case reverting causes a one-frame
          // flash from the user's intent back to the previous state, which
          // is more jarring than a brief visual mismatch that the next
          // successful tap corrects.
          setTheme(option, nextOptions)
          pressLockRef.current = false
        })
      },
      [setTheme],
    )

    return useMemo(() => ({ ...ctx, selected, select }), [ctx, selected, select])
  }

  return useTheme
}
