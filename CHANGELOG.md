# Changelog

## 2.0.0

### Major Changes

- 1b72a5a: Initial release — smooth animated theme transitions for React Native via screenshot-overlay.

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
