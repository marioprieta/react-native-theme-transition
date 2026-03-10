---
name: react-native-theme-transition
description: "Animated dark mode and theme transitions for React Native via screenshot-overlay. TRIGGER when: code imports react-native-theme-transition, user works with createThemeTransition/ThemeTransitionProvider/useTheme, implements dark mode toggling with animation, system theme following, theme persistence, React Navigation or expo-router theme integration, or debugs transition issues (stuck overlay, flash, touch blocking). DO NOT TRIGGER when: general React Native styling, non-animated theme switching, or web-only theming."
license: MIT
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

Expo (SDK 54+): `npx expo install react-native-theme-transition react-native-worklets`

Add `react-native-worklets/plugin` as the **last plugin** in `babel.config.js`.
On SDK 55+, do NOT add `react-native-reanimated/plugin` — `babel-preset-expo` already includes it.

## Key rules

1. All themes must share identical token keys — use `Record<keyof typeof light, string>`.
2. `'system'` is reserved — cannot be a theme key.
3. Provider wraps everything — content outside won't be in the screenshot.
4. `initialTheme` is read once — use a bridge component for external stores.
5. `setTheme` during a transition returns `false` — use `isTransitioning` to disable buttons.
6. `onThemeChange` is the only guaranteed callback — `onTransitionEnd` skips on capture failure.
7. Don't change styles based on `isTransitioning` — the screenshot captures current visuals.
8. No native `<Switch>` — use a custom toggle with `useTheme({})` and plain React styles.
9. No `style={({ pressed }) => (...)}` — use static `style={{...}}`.
10. Selection tracking: any component whose visual state changes on theme switch must use `useTheme({})` or `useTheme({ initialSelection })`.

## Reference guides

| You need to... | Read |
|---|---|
| Full API details, all options, callback ordering, exported types | [references/api.md](references/api.md) |
| Set up a new project from scratch (Expo or CLI) | [references/new-project.md](references/new-project.md) |
| Migrate from Context, Zustand, Redux, etc. | [references/existing-project.md](references/existing-project.md) |
| Recipes: system theme, persistence, haptics, React Navigation, Expo Router, modals, multi-theme, StatusBar, analytics | [references/recipes.md](references/recipes.md) |
| Debug issues: stuck overlay, flash, type errors, system theme not working | [references/troubleshooting.md](references/troubleshooting.md) |
