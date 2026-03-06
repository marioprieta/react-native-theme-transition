# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-06

### Added

- `createThemeTransition` factory function with full TypeScript generic inference
- `ThemeTransitionProvider` component with screenshot-overlay transition mechanism
- `useTheme` hook returning `colors`, `name`, `setTheme`, and `isTransitioning`
- `initialTheme="system"` and `setTheme('system')` for zero-flash OS appearance tracking
- `systemThemeMap` config option for mapping OS schemes to custom theme names
- `setTheme` options with `onCaptured` callback for haptic feedback integration
- Touch-blocking layer via Reanimated shared values to prevent interaction during transitions
- `onTransitionEnd` configuration callback
- Configurable fade `duration` (default 350ms)
- React Compiler compatibility (no manual memoization required)

[1.0.0]: https://github.com/marioprieta/react-native-theme-transition/releases/tag/v1.0.0
