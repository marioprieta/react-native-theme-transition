# react-native-theme-transition

[![npm version](https://img.shields.io/npm/v/react-native-theme-transition.svg)](https://www.npmjs.com/package/react-native-theme-transition)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-native-theme-transition)](https://bundlephobia.com/package/react-native-theme-transition)
![expo compatible](https://img.shields.io/badge/Expo_Go-compatible-000.svg?logo=expo&logoColor=white)
![react compiler](https://img.shields.io/badge/React_Compiler-compatible-blue.svg)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/marioprieta/react-native-theme-transition/blob/main/LICENSE)

Smooth, animated theme and dark mode transitions for React Native and Expo. 100% JS, 60 FPS, powered by Reanimated.

<!-- TODO: Replace with actual demo GIF (600x1300px, 30fps, <5MB) -->
<!-- <p align="center">
  <img src=".github/assets/demo.gif" alt="react-native-theme-transition demo" width="300" />
</p> -->

<!-- TODO: Add Expo Snack link -->
<!-- [![Try on Expo Snack](https://img.shields.io/badge/Try_it-Expo_Snack-blue.svg?logo=expo&logoColor=white)](https://snack.expo.dev/...) -->

## Motivation

Implementing smooth, app-wide theme transitions in React Native has historically required custom native iOS and Android modules. This approach alienates Expo Go users, breaks Over-The-Air (OTA) update pipelines, and adds significant maintenance overhead.

`react-native-theme-transition` solves this entirely in the JavaScript and UI thread layers. It captures a screenshot of the current UI, overlays it, switches all colors underneath, then fades out the overlay — achieving flawless 60 FPS cross-fades without ever touching native bridges or requiring custom development clients.

All peer dependencies (`react-native-reanimated`, `react-native-gesture-handler`, `react-native-view-shot`) are already included in Expo SDK 50+.

## Features

- **Expo Go compatible** — zero native code or prebuilds required
- **Full theme management** — Provider, typed hooks, and deep generic inference
- **60 FPS animations** — fade runs entirely on the UI thread via Reanimated
- **System theme sync** — automatically transitions when OS appearance changes
- **React Compiler ready** — no manual `useMemo` or `useCallback` needed
- **Transition guard** — blocks concurrent transitions, exposes `isTransitioning`
- **Tiny footprint** — ~12 kB compressed, zero runtime dependencies

## Installation

```bash
# Expo (recommended)
npx expo install react-native-theme-transition react-native-reanimated react-native-gesture-handler react-native-view-shot

# React Native CLI
yarn add react-native-theme-transition react-native-reanimated react-native-gesture-handler react-native-view-shot
```

> **CLI users:** Add `react-native-reanimated/plugin` to your `babel.config.js` and run `npx pod-install` for iOS.

## Quick start

### 1. Define your themes

```ts
// theme.ts
import { createAnimatedTheme } from 'react-native-theme-transition';

const light = {
  background: '#ffffff',
  card:       '#f5f5f5',
  text:       '#000000',
  primary:    '#007AFF',
} as const;

const dark = {
  background: '#000000',
  card:       '#1c1c1e',
  text:       '#ffffff',
  primary:    '#0A84FF',
} as const;

export const { AnimatedThemeProvider, useTheme, useSystemTheme } =
  createAnimatedTheme({
    themes: { light, dark },
    defaultTheme: 'light',
  });

// TypeScript infers everything:
// - Theme names: 'light' | 'dark'
// - Color tokens: 'background' | 'card' | 'text' | 'primary'
```

### 2. Wrap your app

```tsx
import { AnimatedThemeProvider } from './theme';

export default function App() {
  return (
    <AnimatedThemeProvider>
      <MyApp />
    </AnimatedThemeProvider>
  );
}
```

### 3. Use in components

```tsx
import { useTheme } from './theme';

function MyScreen() {
  const { colors, name, setTheme, isTransitioning } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={{ color: colors.text }}>Current: {name}</Text>
      <Pressable
        onPress={() => setTheme(name === 'light' ? 'dark' : 'light')}
        disabled={isTransitioning}
      >
        <Text style={{ color: colors.primary }}>Toggle theme</Text>
      </Pressable>
    </View>
  );
}
```

## API reference

### `createAnimatedTheme(config)`

Factory function that returns a Provider and hooks scoped to your theme definitions.

```ts
createAnimatedTheme({
  themes: { light, dark },      // All themes must have identical keys
  defaultTheme: 'light',
  duration: 350,                 // Fade duration in ms (default: 350)
  onTransitionEnd: (name) => {}, // Called when a transition completes
});
```

Returns `{ AnimatedThemeProvider, useTheme, useSystemTheme }`.

### `useTheme()`

| Property | Type | Description |
|---|---|---|
| `colors` | `Record<TokenName, string>` | Current theme's color tokens, fully typed |
| `name` | `ThemeName` | Active theme name (e.g. `'light'`, `'dark'`) |
| `setTheme` | `(name, options?) => void` | Triggers a theme transition |
| `isTransitioning` | `boolean` | `true` during the animation window |

#### `setTheme` options

```ts
setTheme('dark', {
  onCaptured: () => {
    // Fires after the screenshot overlay is visible.
    // Useful for haptic feedback or analytics.
  },
});
```

### `useSystemTheme(enabled?, mapping?)`

Subscribes to OS appearance changes and triggers transitions automatically.

```ts
// Follow system theme
useSystemTheme(true);

// Custom mapping (e.g. theme names that don't match 'light'/'dark')
useSystemTheme(true, { light: 'sunrise', dark: 'midnight' });
```

## Recipes

### Haptic feedback on theme switch

```tsx
import * as Haptics from 'expo-haptics';

setTheme('dark', {
  onCaptured: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
});
```

### Integration with Zustand

```tsx
function ThemeBridge() {
  const colorMode = useThemeStore((s) => s.colorMode);
  const { setTheme } = useTheme();

  useSystemTheme(colorMode === 'system');

  useEffect(() => {
    if (colorMode !== 'system') setTheme(colorMode);
  }, [colorMode, setTheme]);

  return null;
}
```

### React Navigation theme sync

```tsx
import { useTheme } from './theme';

function App() {
  const { colors, name } = useTheme();

  const navigationTheme = {
    dark: name === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      {/* ... */}
    </NavigationContainer>
  );
}
```

## How it works

```mermaid
sequenceDiagram
    participant User
    participant Hook as setTheme()
    participant Shot as ViewShot
    participant React as React Tree
    participant UI as UI Thread

    User->>Hook: setTheme('dark')
    Hook->>Shot: Wait 1 frame, capture screen
    Shot-->>Hook: Return image URI
    Hook->>UI: Mount opaque overlay (screenshot)
    Hook->>React: Update color tokens
    React-->>React: Re-render with new theme (~2 frames)
    Hook->>UI: Fade overlay out (350ms via Reanimated)
    UI-->>User: Smooth cross-fade complete
```

1. `setTheme('dark')` is called
2. Waits one frame for pending renders to commit
3. Captures a full-screen screenshot via `captureRef`
4. Shows the screenshot as an opaque overlay
5. Switches all color tokens instantly underneath
6. Waits two frames for React to re-render with new colors
7. Fades the overlay out (default 350ms) on the UI thread via Reanimated

The screenshot is captured **before** the color switch, so the overlay is visually identical to the current screen. When it fades, it reveals the fully re-rendered new theme — no partial states, no flashes.

## Comparison

| Feature | react-native-theme-transition | react-native-theme-switch-animation |
|---|:---:|:---:|
| Expo Go support | ✅ | ❌ Requires prebuild |
| Execution | Pure JS / Reanimated UI thread | Native modules (Java/ObjC) |
| Theme state management | ✅ Provider + typed hooks | ❌ Bring your own |
| TypeScript generics | ✅ Deep inference for tokens | ⚠️ Basic typings |
| System theme listener | ✅ Built-in (`useSystemTheme`) | ❌ Not included |
| React Compiler | ✅ Compatible | ❌ |
| New Architecture (Fabric) | ✅ | ✅ |

## Known limitations

- **Gesture blocking during transitions** — During the fade animation (default 350ms), an invisible layer blocks touch and scroll events. This is an intentional architectural decision: since the user sees a static screenshot overlay, allowing scroll would cause the underlying UI to move invisibly, creating visual dissonance when the overlay fades. This brief interruption mirrors standard iOS and Android OS-level transition behavior and is imperceptible in normal usage.

- **Sequential transitions only** — If `setTheme` is called during an ongoing transition, the call is silently ignored. Use `isTransitioning` to disable toggle buttons during this window.

## Requirements

- React Native >= 0.72
- react-native-reanimated >= 3.0.0
- react-native-gesture-handler >= 2.0.0
- react-native-view-shot >= 3.0.0

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

[MIT](./LICENSE) © [Mario Prieta](https://github.com/marioprieta)
