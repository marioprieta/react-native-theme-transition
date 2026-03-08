import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Context } from 'react';
import type {
  UseThemeResult,
  ThemeSelectionResult,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from '../types';

/**
 * Factory that produces the `useTheme` hook bound to a specific context.
 *
 * @internal Used by {@link createThemeTransition}; not part of the public API.
 */
export function createUseTheme<T extends Record<string, ThemeDefinition>>(
  Ctx: Context<UseThemeResult<TokenNames<T>, ThemeNames<T>> | null>,
) {
  type Tokens = TokenNames<T>;
  type Names = ThemeNames<T>;
  type BaseResult = UseThemeResult<Tokens, Names>;
  type FullResult = BaseResult & ThemeSelectionResult<Names>;

  function useTheme(): BaseResult;
  function useTheme(options: { initialSelection?: Names | 'system' }): FullResult;
  function useTheme(options?: { initialSelection?: Names | 'system' }): BaseResult | FullResult {
    const ctx = useContext(Ctx);
    if (!ctx) {
      throw new Error(
        '[react-native-theme-transition] `useTheme` must be used inside a `ThemeTransitionProvider`.',
      );
    }

    const { setTheme, isTransitioning } = ctx;

    // Selection state — hooks are always called to satisfy React's rules of hooks.
    // Only exposed in the return value when options are provided.
    const [selected, setSelected] = useState<Names | 'system'>(
      () => options?.initialSelection ?? ctx.name,
    );
    const pressLockRef = useRef(false);
    // Ref tracks latest `selected` so the callback can read it without
    // `selected` being a dependency — avoids recreating `select` on every change.
    const selectedRef = useRef(selected);
    selectedRef.current = selected;

    useEffect(() => {
      if (!isTransitioning) pressLockRef.current = false;
    }, [isTransitioning]);

    const select = useCallback(
      (option: Names | 'system') => {
        if (pressLockRef.current) return;
        pressLockRef.current = true;
        const previousSelected = selectedRef.current;
        // Paint the new highlight FIRST. Deferring setTheme to the next frame
        // guarantees React commits + native paint before the library captures.
        setSelected(option);
        requestAnimationFrame(() => {
          if (setTheme(option)) return;
          // Rejected (same theme or already transitioning) — restore the prior selection.
          setSelected(previousSelected);
          pressLockRef.current = false;
        });
      },
      [setTheme],
    );

    if (options != null) {
      return { ...ctx, selected, select };
    }
    return ctx;
  }

  return useTheme;
}
