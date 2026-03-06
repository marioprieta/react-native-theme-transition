# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-06

### Added

- `createAnimatedTheme` factory function with full TypeScript generic inference
- `AnimatedThemeProvider` component with screenshot-overlay transition mechanism
- `useTheme` hook returning `colors`, `name`, `setTheme`, and `isTransitioning`
- `useSystemTheme` hook for automatic OS appearance following
- `setTheme` options with `onCaptured` callback for haptic feedback integration
- Touch-blocking layer via Reanimated shared values to prevent interaction during transitions
- `onTransitionEnd` configuration callback
- Configurable fade `duration` (default 350ms)
- React Compiler compatibility (no manual memoization required)

[1.0.0]: https://github.com/marioprieta/react-native-theme-transition/releases/tag/v1.0.0
