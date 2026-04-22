# Changelog

## 2.0.1

### Patch Changes

- 7588dfa: Documentation-only release. Two fixes:

  - **Hero demo GIF URL.** Switched from GitHub's `user-attachments` CDN to `raw.githubusercontent.com`. The former requires authentication and returned 404 to npm's image proxy, so the demo was invisible on the npm package page.
  - **Minimum Expo SDK clarified to 55+.** Earlier docs listed SDK 54+, but Expo Go on SDK 54 bundles older Skia and Reanimated native modules that are incompatible with v2 at runtime (tested: freeze on Android, silent instant swap on iOS). Upgrade with `npx expo install expo@latest --fix` before installing the library.

## 2.0.0

### Major Changes

- 390a887: **v2: Skia engine, 9 transitions, radically simpler API.**

  The engine was rebuilt on top of `@shopify/react-native-skia`. The provider
  now snapshots the inner tree into a pre-mounted Skia Canvas, swaps the theme
  underneath, and animates the captured frame away with one of nine transition
  styles. The public API was re-shaped around a four-field hook and a
  discriminated options union.

  The hook now splits two orthogonal concepts: `theme` is always concrete
  (the theme currently painted on screen), and `preference` is the user's
  raw pick (which can be `'system'`). No more `isSystemMode` flags, no
  more "picker state vs active theme" duality.

  ### Breaking: peer dependencies

  `react-native-view-shot` is replaced by `@shopify/react-native-skia` (>= 2.0.0):

  ```bash
  npm uninstall react-native-view-shot
  npm install @shopify/react-native-skia
  ```

  Minimum versions for the surrounding stack were also raised:

  | Peer                         | v1 minimum | v2 minimum  |
  | ---------------------------- | ---------- | ----------- |
  | `react`                      | `>=18.0.0` | `>=19.0.0`  |
  | `react-native`               | `>=0.76.0` | `>=0.78.0`  |
  | `react-native-reanimated`    | `>=4.0.0`  | `>=4.0.0`   |
  | `react-native-worklets`      | `>=0.5.0`  | `>=0.5.0`   |
  | `react-native-view-shot`     | `>=3.0.0`  | **removed** |
  | `@shopify/react-native-skia` | **new**    | `>=2.0.0`   |

  React 19 and React Native 0.78 are hard requirements: v2 reads context
  via React 19's `use()` hook, and `@shopify/react-native-skia` 2.0 itself
  declares `react: ">=19.0"` and `react-native: ">=0.78"` as peer
  dependencies. Apps on older React or React Native versions need to
  upgrade before installing v2.

  ### Breaking: `useTheme` return shape

  ```ts
  // v1
  const { colors, name, setTheme, isTransitioning, selected, select } =
    useTheme();

  // v2
  const { theme, preference, setTheme, isTransitioning } = useTheme();
  // theme.name: Names  (always concrete, never 'system')
  // theme.colors: Record<Tokens, string>
  // theme.scheme: 'light' | 'dark'
  // preference: Names | 'system'  (the user's raw pick)
  ```

  `colors` and `name` moved under `theme`, and `theme.scheme` is a new
  binary `'light' | 'dark'` classifier derived from `darkThemes`.
  `preference` is a brand-new top-level field that mirrors the user's
  raw pick (including `'system'`) and updates synchronously inside
  `setTheme` so pickers can drop their optimistic local state. `selected`,
  `select`, `initialSelection`, `SelectOptions`, `UseThemeOptions`, and
  `useReducedMotion` are gone. The engine's internal `SETTLE.beforeCapture`
  wait gives React batching time to paint before the snapshot is taken, so
  no hook magic is needed. See the [Migration guide](https://react-native-theme-transition.vercel.app/docs/recipes/migration).

  ### Breaking: `setTheme` return type

  ```ts
  // v1
  setTheme('dark'): boolean

  // v2
  setTheme('dark'): 'accepted' | 'ignored'
  ```

  `'accepted'` means the library will apply the change (instantly or via an
  animated transition). `'ignored'` means nothing will happen (already
  transitioning, or same theme in the same mode). Most callers don't need
  the return value; reactive state (`isTransitioning`, callbacks) is
  usually enough.

  ### Breaking: removed config options

  - **`reduceMotion`**: removed. The library no longer honors OS Reduce
    Motion: these are brief color transitions, not spatial motion, and instant
    swaps are arguably more jarring than a 350ms fade. Consumers who want
    to honor the OS setting write their own `AccessibilityInfo` listener
    and pass `animated: false` per call.
  - **`duration`**: removed from config. Each transition family has its own
    calibrated default (350ms fade / reveal / strip, 800ms shape, 750ms
    shader). A global override would flatten that calibration. Override
    per call with `setTheme(name, { duration: 400 })` when you need it.
  - **`backgroundColor`**: removed. The library no longer paints a
    root background behind the inner tree. Set `backgroundColor` on
    your own root `View` as with any standard React Native app.

  ### Breaking: renamed option fields

  | v1                                            | v2                                                 |
  | --------------------------------------------- | -------------------------------------------------- |
  | `{ transition: 'split', axis: 'horizontal' }` | `{ transition: 'split', mode: 'top-bottom' }`      |
  | `{ transition: 'split', axis: 'vertical' }`   | `{ transition: 'split', mode: 'left-right' }`      |
  | `{ transition: 'dissolve', grainSize: 5 }`    | `{ transition: 'dissolve', noiseSize: 5 }`         |
  | `{ transition: 'invertedCircularReveal' }`    | `{ transition: 'circularReveal', inverted: true }` |

  The `diamond` transition proposed in early v2 work was removed before
  shipping; only the 9 below are supported.

  ### Breaking: `direction` semantics unified (wipe + slide)

  In v1, `direction: 'right'` meant "sweep rightward" on `wipe` but "new
  enters from the right" on `slide`: two opposite visual meanings for the
  same string. In v2 both transitions share the same rule: `direction: 'right'`
  is the direction the motion is heading, so the new theme enters from the
  LEFT edge and sweeps rightward. Default is `'right'`.

  ### New transitions

  On top of v1's `fade`, v2 adds eight new styles:

  - **`circularReveal`**: expanding circle from any origin (point or ref).
  - **`heart`**: a heart-shaped clip grows from the origin.
  - **`star`**: a 5-point star clip grows from the origin.
  - **`wipe`**: a directional edge sweeps across the screen.
  - **`slide`**: both old and new slide across like a carousel.
  - **`split`**: the screen parts or shutters along `mode`.
  - **`pixelize`**: shader crossfade through a shared pixel grid.
  - **`dissolve`**: noise-threshold disintegration.

  Every reveal / shape transition accepts `inverted`. `SetThemeOptions` is a
  discriminated union: TypeScript only accepts the extra fields valid for
  the chosen `transition`.

  ### New: `TRANSITION_META` runtime export

  The same table that drives the type union is exported so consumers can
  build transition pickers that adapt their UI without hardcoding the list:

  ```ts
  import {
    TRANSITION_META,
    TRANSITION_TYPES,
  } from "react-native-theme-transition";

  const meta = TRANSITION_META[transition];
  // meta.kind           : 'fade' | 'reveal' | 'shape' | 'strip' | 'shader'
  // meta.needsOrigin    : whether to show an origin picker
  // meta.invertible     : whether to show an "inverted" toggle
  // meta.capturesNew    : whether the engine needs a second snapshot (slide / pixelize)
  // meta.defaultDuration
  ```

  ### Internal changes worth noting

  - Cleanup timer was tightened from `setTimeout(finish, duration + 50)`
    to `setTimeout(finish, duration)`, removing v1's safety buffer that
    stacked latency on fast devices. Reanimated 4's worklet completion
    callback would be cleaner, but it doesn't reliably fire for the
    nested-async closures the engine creates — see the comment on
    `finishTimerRef`.
  - `SETTLE.treeRepaint` is gated to reveal / shape / capturesNew transitions
    so fade / wipe / split / dissolve save a frame of start latency.
  - `OverlayParams` and the `DEFAULT_*` constants live in
    `src/overlay/types.ts` as a single source of truth for the engine and
    the overlay.
  - `darkThemes` config is now validated at init (unknown names throw).
  - Faster transitions: direct `SkImage` capture replaces the v1
    view-shot to URI to RN `<Image>` decode pipeline, shaving roughly
    30ms off every swap.

  ### Migration

  Full walkthrough at
  [recipes/migration](https://react-native-theme-transition.vercel.app/docs/recipes/migration).

## 1.0.7

### Patch Changes

- bf50b17: Fix three engine bugs in the transition state machine:

  - Clear deferred system restore when exiting system mode, preventing stale color scheme restoration
  - Lift explicit Appearance override when entering system mode during an active transition
  - Always return `true` from `setTheme('system')` when entering system mode from a different theme

## 1.0.6

### Patch Changes

- 5450c49: Add CI workflow (lint, typecheck, build), Biome linter, and simplify release pipeline to use changeset publish

## 1.0.5

### Patch Changes

- 2243758: Restructure agent skill for cleaner skills.sh URL, update READMEs with GIF demos and correct bundle size, add OIDC-based release workflow with automatic git tags and GitHub Releases.

## 1.0.3

### Patch Changes

- 55b4744: Initial release — smooth animated theme transitions for React Native via screenshot-overlay.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-06

### Added

- `createThemeTransition` factory function with full TypeScript generic inference
- `ThemeTransitionProvider` component with screenshot-overlay transition mechanism
- `useTheme` hook returning `colors`, `name`, `setTheme`, and `isTransitioning`
- Built-in system theme support via `initialTheme="system"` and `setTheme('system')`
- `systemThemeMap` config option for mapping OS appearance to custom theme names
- `setTheme` options: `animated`, `onTransitionStart`, and `onTransitionEnd`
- Touch-blocking layer via Reanimated shared values to prevent interaction during transitions
- Config-level `onTransitionStart` and `onTransitionEnd` for animated transitions
- `onThemeChange` configuration callback for all theme changes (animated, instant, and system-driven)
- Configurable fade `duration` (default 350ms)
- React Compiler compatibility (no manual memoization required)

[1.0.0]: https://github.com/marioprieta/react-native-theme-transition/releases/tag/v1.0.0
