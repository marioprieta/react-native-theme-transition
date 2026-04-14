---
"react-native-theme-transition": major
---

**v2: Skia engine rewrite, 9 transition styles, richer per-call options.**

The engine now snapshots the inner tree into a Skia Canvas and animates the
captured image away with one of nine styles: `fade`, `circularReveal`,
`wipe`, `slide`, `split`, `heart`, `star`, `pixelize`, `dissolve`. Every
reveal and shape transition accepts an `inverted` flag; strip transitions
accept `direction` / `axis`; shaders accept `blockSize` / `grainSize`.
`SetThemeOptions` is now a discriminated union — TypeScript only allows
fields valid for the picked transition.

### Breaking — peer dependency

`react-native-view-shot` is replaced by `@shopify/react-native-skia`
(>= 2.0.0). Update your install:

```bash
npm uninstall react-native-view-shot
npm install @shopify/react-native-skia
```

No code changes required if you don't set `transition` explicitly — the
default remains `'fade'` and every call site keeps compiling.

### New features

- **`transition`** per call, 9 values: `fade`, `circularReveal`, `wipe`,
  `slide`, `split`, `heart`, `star`, `pixelize`, `dissolve`.
- **`origin`** accepts a point `{ x, y }` or a `React.RefObject<View>` —
  the library measures the ref's center at press time so reveals start
  from exactly where the user tapped.
- **`inverted`** on `circularReveal`, `heart`, `star`, `split` — flips the
  animation direction (shape shrinks, strips close inward, etc.).
- **`direction`** (`'left' | 'right' | 'up' | 'down'`) on `wipe` and `slide`.
- **`axis`** (`'horizontal' | 'vertical'`) on `split`.
- **`blockSize`** on `pixelize`, **`grainSize`** on `dissolve`.
- **`easing`** per call — any Reanimated `EasingFunction`.
- **Config `backgroundColor`**: `(colors) => string` picker for the root
  background color. Prevents the Activity's default window color from
  leaking through any transparent region the Skia snapshot path leaves
  (notably the area below a scrolled `ScrollView` on Android).
- **Config `animated`**: global opt-out for apps that prefer instant
  switches by default.
- **`useReducedMotion()`** hook — read the OS "Reduce Motion" setting for
  your own UI. The library already honors it automatically when
  `reduceMotion` (config) is `true`.
- **`TRANSITION_TYPES`** and **`TRANSITION_META`** runtime exports — the
  canonical list of transitions and their metadata (`kind`, `needsOrigin`,
  `invertible`, `capturesNew`, `defaultDuration`). Use them to build
  transition pickers that adapt their options to the selected style
  without hardcoding a list.

### Behavior changes

- **`select()` no longer reverts `selected` on rejection.** When a call
  is rejected (mid-transition, same theme, etc.) the optimistic selection
  is left in place; the mid-tap flicker back to the previous pill is
  gone. Any real mismatch is corrected on the next successful tap.
- **`useTheme` is a single signature** — always returns the full shape
  including `selected` and `select`. The v1 overload split and
  `ThemeSelectionResult` type are removed; `UseThemeResult` now contains
  everything.
- **Per-kind duration defaults**: 350ms for `fade` / `circularReveal` /
  `wipe` / `slide` / `split`, 800ms for `heart` / `star`, 750ms for
  `pixelize` / `dissolve`. Explicit `duration` (per call or at config
  level) overrides all of them.
- **Faster transitions**: direct `SkImage` capture replaces the v1
  view-shot → URI → RN `<Image>` decode pipeline, shaving roughly 30ms
  off every swap.

### Migration

For a step-by-step upgrade guide see the
[Migration recipe](https://react-native-theme-transition.vercel.app/docs/recipes/migration).
