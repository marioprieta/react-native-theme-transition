import type { Context } from 'react'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { TAG } from '../constants'
import type {
  ThemeDefinition,
  ThemeNames,
  ThemeSelectionResult,
  TokenNames,
  UseThemeResult,
} from '../types'

/**
 * Factory that produces the `useTheme` hook bound to a specific context.
 *
 * @internal Used by {@link createThemeTransition}; not part of the public API.
 */
export function createUseTheme<T extends Record<string, ThemeDefinition>>(
  Ctx: Context<UseThemeResult<TokenNames<T>, ThemeNames<T>> | null>,
) {
  type Tokens = TokenNames<T>
  type Names = ThemeNames<T>
  type BaseResult = UseThemeResult<Tokens, Names>
  type FullResult = BaseResult & ThemeSelectionResult<Names>

  function useTheme(): BaseResult
  function useTheme(options: { initialSelection?: Names | 'system' }): FullResult
  function useTheme(options?: { initialSelection?: Names | 'system' }): BaseResult | FullResult {
    const ctx = useContext(Ctx)
    if (!ctx) {
      throw new Error(`${TAG} \`useTheme\` must be used inside a \`ThemeTransitionProvider\`.`)
    }

    const { setTheme, isTransitioning } = ctx

    // Always called (rules of hooks) — only exposed when options are provided.
    const [selected, setSelected] = useState<Names | 'system'>(
      () => options?.initialSelection ?? ctx.name,
    )
    const pressLockRef = useRef(false)
    // Ref avoids `selected` as a dependency — keeps `select` stable across renders.
    const selectedRef = useRef(selected)
    selectedRef.current = selected

    useEffect(() => {
      if (!isTransitioning) pressLockRef.current = false
    }, [isTransitioning])

    const select = useCallback(
      (option: Names | 'system') => {
        if (pressLockRef.current) return
        pressLockRef.current = true
        const previousSelected = selectedRef.current
        // Paint highlight first — deferred setTheme lets React commit before capture.
        setSelected(option)
        requestAnimationFrame(() => {
          if (!setTheme(option)) setSelected(previousSelected)
          pressLockRef.current = false
        })
      },
      [setTheme],
    )

    const selectionResult = useMemo(() => ({ ...ctx, selected, select }), [ctx, selected, select])

    if (options != null) {
      return selectionResult
    }
    return ctx
  }

  return useTheme
}
