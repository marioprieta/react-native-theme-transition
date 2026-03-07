---
name: react-native-theme-transition
description: "Animated dark mode and theme transitions for React Native via screenshot-overlay. TRIGGER when: code imports react-native-theme-transition, user works with createThemeTransition/ThemeTransitionProvider/useTheme, implements dark mode toggling with animation, system theme following, theme persistence, React Navigation or expo-router theme integration, or debugs transition issues (stuck overlay, flash, touch blocking). DO NOT TRIGGER when: general React Native styling, non-animated theme switching, or web-only theming."
license: MIT
compatibility: "react >= 18.0.0, react-native >= 0.76, react-native-reanimated >= 4.0.0, react-native-view-shot >= 3.0.0, react-native-worklets >= 0.5.0"
metadata:
  author: marioprieta
  version: "1.0.0"
  tags: react-native, theme, dark-mode, animation, transition, expo, reanimated, screenshot-overlay
---

# react-native-theme-transition

Smooth, animated theme transitions for React Native via screenshot-overlay.
Expo Go compatible, 100% JS, powered by Reanimated.

## How it works

1. Block touches instantly via Reanimated shared value (no React render needed)
2. Wait 1 frame for pending React state to flush
3. Capture full-screen screenshot via `react-native-view-shot`
4. Mount screenshot as opaque overlay
5. Wait 1 frame for the overlay to paint on the native UI thread
6. Switch color tokens underneath
7. Wait 3 frames for native UI thread to repaint with new colors
8. Fade overlay out on the UI thread via Reanimated
9. Remove overlay, unblock touches, fire completion callbacks

The screenshot is captured BEFORE the color switch — the overlay is identical to
what was on screen. When it fades, it reveals the fully rendered new theme.

## Quick reference

```ts
// 1. Define themes and create the API
const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { light, dark },    // all must share same token keys
  duration: 350,               // fade duration in ms (default 350)
  systemThemeMap: { ... },     // required for system mode with custom theme names
  onTransitionStart: (n) => {},// animated only, before screenshot
  onTransitionEnd: (n) => {},  // animated only, after fade completes
  onThemeChange: (n) => {},    // ALL changes (animated, instant, system)
});

// 2. Wrap your app (as high as possible)
<ThemeTransitionProvider initialTheme="system">

// 3. Use in any component
const { colors, name, setTheme, isTransitioning } = useTheme();
colors.background    // fully typed token autocomplete
setTheme('dark')     // animated transition
setTheme('system')   // follow OS appearance
setTheme('dark', { animated: false }) // instant, no animation
```

## When to read which reference

| You need to... | Read |
|---|---|
| See full API details, all options, callback ordering, exported types | [references/api.md](references/api.md) |
| Set up a new project from scratch (Expo or CLI) | [references/new-project.md](references/new-project.md) |
| Add to an existing project (migrate from Context, Zustand, Redux, etc.) | [references/existing-project.md](references/existing-project.md) |
| Implement specific features (system theme, persistence, haptics, React Navigation, modals, multi-theme, StatusBar, analytics) | [references/recipes.md](references/recipes.md) |
| Debug issues (stuck overlay, flash, system theme not working, type errors) | [references/troubleshooting.md](references/troubleshooting.md) |

## Critical rules

These are the non-negotiable constraints to always keep in mind:

1. **All themes must share identical token keys.** Mismatched keys → runtime error.
   Type-enforce with `Record<keyof typeof primaryTheme, string>` on secondary themes.

2. **`'system'` is a reserved name.** Cannot be used as a theme key.

3. **Provider placement matters.** Place `ThemeTransitionProvider` as high as possible
   (above navigation) so the screenshot captures the entire screen.

4. **`initialTheme` is read once.** The provider uses a lazy `useState` initializer.
   Subsequent theme changes come through `setTheme` calls, not prop changes.
   This is why the bridge pattern exists for external state managers.

5. **`setTheme` during a transition is silently ignored.** Use `isTransitioning`
   to disable toggle buttons and prevent user frustration.

6. **`onTransitionEnd` is not guaranteed.** If screenshot capture fails, the library
   falls back to instant switch — `onTransitionStart` fires but `onTransitionEnd`
   does not. Only `onThemeChange` is guaranteed for every theme change.

7. **Peer dependencies.** `react-native-reanimated >= 4.0.0`,
   `react-native-view-shot >= 3.0.0`, `react-native-worklets >= 0.5.0`.
   Expo SDK 54+ includes reanimated by default; view-shot and worklets need installing.

## Peer dependency setup

```bash
# Expo (SDK 54+ already has reanimated)
npx expo install react-native-theme-transition react-native-view-shot react-native-worklets

# Expo (explicit — installs all peer deps)
npx expo install react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets

# React Native CLI
npm install react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets
cd ios && pod install
```

CLI users: add `react-native-worklets/plugin` as the **last plugin** in `babel.config.js`.
