---
name: react-native-theme-transition
description: "Animated dark mode and theme transitions for React Native via screenshot-overlay. TRIGGER when: code imports react-native-theme-transition, user works with createThemeTransition/ThemeTransitionProvider/useTheme, implements dark mode toggling with animation, system theme following, theme persistence, React Navigation or expo-router theme integration, or debugs transition issues (stuck overlay, flash, touch blocking). DO NOT TRIGGER when: general React Native styling, non-animated theme switching, or web-only theming."
license: MIT. See LICENSE.txt
compatibility: "react >= 18.0.0, react-native >= 0.76.0, react-native-reanimated >= 4.0.0, react-native-view-shot >= 3.0.0, react-native-worklets >= 0.5.0. Designed for Expo SDK 54+ or bare workflow."
metadata:
  author: marioprieta
  version: "1.0.0"
  tags: react-native, theme, dark-mode, animation, transition, expo, reanimated, screenshot-overlay
---

# react-native-theme-transition

Smooth, animated theme transitions for React Native. Captures a screenshot,
overlays it, switches colors underneath, and fades out — all in JS via
Reanimated. Expo Go compatible. No native code required.

## Installation

```bash
# Expo (SDK 54+ already has reanimated and view-shot)
npx expo install react-native-theme-transition react-native-worklets

# Expo SDK 55+ — the template no longer bundles babel-preset-expo, install it:
npx expo install babel-preset-expo

# React Native CLI
npm install react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets
cd ios && pod install
```

**All users** (Expo and CLI): add `react-native-worklets/plugin` as the **last plugin**
in `babel.config.js`. On **SDK 55+**, do NOT add `react-native-reanimated/plugin` —
`babel-preset-expo` already includes it from SDK 55 onwards and duplicating it causes
a `Duplicate plugin/preset detected` build error. On SDK 54 and below you still need it.

## Quick reference

```ts
// lib/theme.ts
import { createThemeTransition } from 'react-native-theme-transition';

const light = { bg: '#fff', text: '#000', primary: '#007AFF', card: '#f5f5f5' };
const dark: Record<keyof typeof light, string> = { bg: '#000', text: '#fff', primary: '#0A84FF', card: '#1c1c1e' };

// 1. Define themes and create the API
export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { light, dark },    // all must share same token keys
  duration: 350,               // fade duration in ms (default 350)
  darkThemes: ['dark'],        // which themes use dark scheme (for native UI sync)
  systemThemeMap: { ... },     // required for system mode with custom theme names
  onTransitionStart: (n) => {},// animated only, before screenshot
  onTransitionEnd: (n) => {},  // animated only, after fade completes
  onThemeChange: (n) => {},    // ALL changes (animated, instant, system)
});

// 2. Wrap your app (as high as possible — above navigation, above modals)
<ThemeTransitionProvider initialTheme="system">
  <App />
</ThemeTransitionProvider>

// 3. Use in any component
const { colors, name, setTheme, isTransitioning } = useTheme();
colors.bg              // fully typed token autocomplete
setTheme('dark')       // animated transition
setTheme('system')     // follow OS appearance
setTheme('dark', { animated: false }) // instant, no animation
```

### Selection tracking (pickers & toggles)

Any component whose visual state changes on theme switch must use `useTheme({})`
or `useTheme({ initialSelection })` — never raw `setTheme`:

```tsx
// Picker with system option
const { selected, select, colors, isTransitioning } = useTheme({ initialSelection: 'system' });

// Toggle (defaults to current theme)
const { selected, select, colors, isTransitioning } = useTheme({});
const isDark = selected === 'dark';
```

`select()` updates the visual state before the screenshot capture, preventing
flickering. Plain `setTheme` is only safe for buttons with no visual change.

## Key rules

1. **All themes must share identical token keys.** Use `Record<keyof typeof light, string>`.
2. **`'system'` is reserved** — cannot be a theme key.
3. **Provider wraps everything** — content outside won't be in the screenshot.
4. **`initialTheme` is read once** — use a bridge component for external stores.
5. **`setTheme` during a transition returns `false`** — use `isTransitioning` to disable buttons.
6. **`onThemeChange` is the only guaranteed callback** — `onTransitionEnd` skips on capture failure.
7. **Peer dependencies.** `react-native-reanimated >= 4.0.0`, `react-native-view-shot >= 3.0.0`, `react-native-worklets >= 0.5.0`. Expo SDK 54+ includes reanimated and view-shot; only worklets needs installing.
8. **Don't change styles based on `isTransitioning`** (e.g., dimming opacity). The screenshot captures current visuals — if a button is dimmed when captured, the cross-fade blends the dimmed state with the new theme, producing a visible flash.
9. **No native `<Switch>`** — use a custom toggle with `useTheme({})` and plain React styles.
10. **No `style={({ pressed }) => (...)}`** — use static `style={{...}}`.

## Reference guides

| You need to... | Read |
|---|---|
| Full API details, all options, callback ordering, exported types | [references/api.md](references/api.md) |
| Set up a new project from scratch (Expo or CLI) | [references/new-project.md](references/new-project.md) |
| Migrate from Context, Zustand, Redux, etc. | [references/existing-project.md](references/existing-project.md) |
| Recipes: system theme, persistence, haptics, React Navigation, Expo Router, modals, multi-theme, StatusBar, analytics | [references/recipes.md](references/recipes.md) |
| Debug issues: stuck overlay, flash, type errors, system theme not working | [references/troubleshooting.md](references/troubleshooting.md) |
