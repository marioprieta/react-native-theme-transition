# react-native-theme-transition

[![npm version](https://img.shields.io/npm/v/react-native-theme-transition.svg)](https://www.npmjs.com/package/react-native-theme-transition)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-native-theme-transition)](https://bundlephobia.com/package/react-native-theme-transition)
![expo compatible](https://img.shields.io/badge/Expo_Go-compatible-000.svg?logo=expo&logoColor=white)
![react compiler](https://img.shields.io/badge/React_Compiler-compatible-blue.svg)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/marioprieta/react-native-theme-transition/blob/main/LICENSE)

Smooth, animated theme transitions for React Native. Expo Go compatible, 100% JS, 60 FPS.

<!-- TODO: Replace with actual demo GIF (600x1300px, 30fps, <5MB) -->
<!-- <p align="center">
  <img src=".github/assets/demo.gif" alt="react-native-theme-transition demo" width="300" />
</p> -->

<!-- TODO: Add Expo Snack link -->
<!-- [![Try on Expo Snack](https://img.shields.io/badge/Try_it-Expo_Snack-blue.svg?logo=expo&logoColor=white)](https://snack.expo.dev/...) -->

## Motivation

Theme transitions in React Native have always needed custom native modules. That means no Expo Go, no OTA updates, and extra maintenance for each platform.

This library takes a different approach: capture a screenshot, overlay it, switch colors underneath, and fade out. The result is a 60 FPS cross-fade that works everywhere, no native code needed. All peer dependencies are already included in Expo SDK 54+.

## Features

- **Expo Go compatible.** No native code, no prebuilds.
- **Full theme management.** Provider, typed hooks, and deep generic inference out of the box.
- **60 FPS animations.** The fade runs entirely on the UI thread via Reanimated.
- **System theme sync.** Transitions automatically when the OS appearance changes.
- **React Compiler ready.** All hooks follow the [Rules of React](https://react.dev/reference/rules). Works with and without the compiler.
- **Transition guard.** Blocks concurrent transitions and exposes `isTransitioning`.
- **Tiny footprint.** ~12 kB compressed, zero runtime dependencies.

## Comparison

| Feature | react-native-theme-transition | react-native-theme-switch-animation |
|---|:---:|:---:|
| Expo Go support | ✅ | ❌ Requires prebuild |
| Execution | Pure JS / Reanimated + Worklets | Native modules (Java/ObjC) |
| Theme state management | ✅ Provider + typed hooks | ❌ Bring your own |
| TypeScript generics | ✅ Deep inference for tokens | ⚠️ Basic typings |
| System theme listener | ✅ Built-in (`useSystemTheme`) | ❌ Not included |
| React Compiler | ✅ Compatible | ❌ |
| New Architecture (Fabric) | ✅ | ✅ |

## Installation

```bash
# Expo (recommended)
npx expo install react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets

# React Native CLI
yarn add react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets
```

> **Already using Expo SDK 54+?** `react-native-reanimated`, `react-native-view-shot`, and `react-native-worklets` are already included. Just install `react-native-theme-transition`.

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
};

const dark = {
  background: '#000000',
  card:       '#1c1c1e',
  text:       '#ffffff',
  primary:    '#0A84FF',
};

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

Creates a Provider and hooks from your theme definitions. Validates that all themes share the same token keys at initialization, so mismatches are caught immediately during development.

```ts
const { AnimatedThemeProvider, useTheme, useSystemTheme } =
  createAnimatedTheme({
    themes: { light, dark },
    defaultTheme: 'light',
    duration: 350,
    onTransitionEnd: (name) => console.log(`Switched to ${name}`),
  });
```

#### Config options

| Option | Type | Default | Description |
|---|---|---|---|
| `themes` | `Record<string, ThemeDefinition>` | *required* | Object of theme definitions. All themes must share the same color token keys. |
| `defaultTheme` | `keyof themes` | *required* | Theme used on first render. |
| `duration` | `number` | `350` | Fade-out animation duration in milliseconds. |
| `onTransitionEnd` | `(name: string) => void` | | Called after the fade animation completes. |

#### Type inference

You never need to pass generic types manually. TypeScript infers theme names and color tokens directly from your `themes` object:

```ts
const light = { background: '#fff', text: '#000', primary: '#007AFF' };
const dark  = { background: '#000', text: '#fff', primary: '#0A84FF' };

const { useTheme } = createAnimatedTheme({
  themes: { light, dark },
  defaultTheme: 'light',
});

// In any component:
const { colors, name, setTheme } = useTheme();

colors.background // ✅ autocomplete: 'background' | 'text' | 'primary'
colors.foo        // ❌ TypeScript error: Property 'foo' does not exist
name              // type: 'light' | 'dark'
setTheme('dark')  // ✅
setTheme('ocean') // ❌ TypeScript error: Argument not assignable
```

---

### `AnimatedThemeProvider`

Wraps your app tree and provides the theme context.

```tsx
<AnimatedThemeProvider initialTheme="dark">
  <App />
</AnimatedThemeProvider>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | *required* | Your application tree. |
| `initialTheme` | `ThemeName` | Value of `defaultTheme` | Override the starting theme. Useful for restoring a persisted preference on app launch. |

---

### `useTheme()`

Returns the current theme state and a function to trigger transitions.

```ts
const { colors, name, setTheme, isTransitioning } = useTheme();
```

| Property | Type | Description |
|---|---|---|
| `colors` | `{ [token]: string }` | Current theme's color values, fully typed to your token names. |
| `name` | `ThemeName` | Active theme identifier (e.g. `'light'`, `'dark'`). |
| `setTheme` | `(name, options?) => void` | Triggers a screenshot-overlay transition to the given theme. |
| `isTransitioning` | `boolean` | `true` from when `setTheme` is called until the fade animation ends. |

**Behavior:**
- Calling `setTheme` with the **current** theme name is a no-op.
- Calling it **during** an ongoing transition is silently ignored.
- Use `isTransitioning` to disable toggle buttons or defer expensive renders.

#### `setTheme` options

| Option | Type | Default | Description |
|---|---|---|---|
| `animated` | `boolean` | `true` | When `false`, switches the theme instantly without screenshot or fade. Useful for background system theme changes. |
| `onCaptured` | `() => void` | | Called after the screenshot is captured, just before the theme switch is applied. Only called when `animated` is `true`. |

```ts
setTheme('dark', {
  onCaptured: () => {
    // Screenshot captured. Safe to trigger side effects.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
});
```

---

### `useSystemTheme(enabled?, mapping?)`

Subscribes to OS appearance changes and triggers theme transitions automatically. Animates when the app is in the foreground (e.g. Control Center toggle) and switches instantly when the app returns from the background, matching native platform behavior.

```ts
// Follow system theme (assumes your themes are named 'light' and 'dark')
useSystemTheme(true);

// Conditionally enable based on user preference
useSystemTheme(colorMode === 'system');

// Map OS schemes to custom theme names
useSystemTheme(true, { light: 'sunrise', dark: 'midnight' });
```

| Param | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | When `true` or omitted, subscribes to `Appearance` changes. Pass `false` explicitly to deactivate the listener. |
| `mapping` | `{ light?: ThemeName, dark?: ThemeName }` | | Maps OS color schemes to your theme names. If omitted, assumes your themes are named `'light'` and `'dark'`. |

> Must be called inside `AnimatedThemeProvider`. Calls `setTheme` internally with animated transitions in the foreground and instant switches when returning from background.

### Exported types

For advanced TypeScript usage, these types are available as named imports:

```ts
import type {
  ThemeDefinition,       // Record<string, string> — shape of a single theme
  AnimatedThemeConfig,   // Config object for createAnimatedTheme
  AnimatedThemeAPI,      // Return type of createAnimatedTheme
  SetThemeOptions,       // Options for setTheme ({ animated, onCaptured })
  ThemeNames,            // Union of theme name strings
  TokenNames,            // Union of color token strings
} from 'react-native-theme-transition';
```

---

## Recipes

### Start with the system theme

`useSystemTheme` listens for **changes** but doesn't set the initial theme. Pass `initialTheme` to match the system on launch so there's no transition flash:

```tsx
import { Appearance } from 'react-native';
import { AnimatedThemeProvider, useSystemTheme } from './theme';

function SystemThemeListener() {
  useSystemTheme(true);
  return null;
}

export default function App() {
  return (
    <AnimatedThemeProvider initialTheme={Appearance.getColorScheme() ?? 'light'}>
      <SystemThemeListener />
      <MyApp />
    </AnimatedThemeProvider>
  );
}
```

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
      border: colors.card,
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
    Hook->>UI: Block touches (shared value → pointerEvents)
    Hook->>Shot: Wait 1 frame, capture screen
    Shot-->>Hook: Return image URI
    Hook->>UI: Mount opaque overlay (screenshot)
    Hook->>React: Update color tokens
    React-->>React: Re-render with new theme (~2 frames)
    Hook->>UI: Fade overlay out (350ms via Reanimated)
    UI-->>Hook: Animation complete (worklet callback)
    Hook->>UI: Unblock touches, remove overlay
    UI-->>User: Smooth cross-fade complete
```

1. `setTheme('dark')` is called
2. Touches blocked instantly via a Reanimated shared value (no React re-render needed)
3. One frame wait for pending renders to commit
4. Full-screen screenshot captured via `react-native-view-shot`
5. Screenshot displayed as an opaque overlay
6. Color tokens switched instantly underneath
7. Two more frames for React to re-render with new colors
8. Overlay fades out on the UI thread via `react-native-reanimated`
9. Touches unblocked and overlay removed once the fade completes via a worklet callback (`react-native-worklets`)

The screenshot is captured **before** the color switch, so the overlay looks identical to the current screen. When it fades, it reveals the fully re-rendered new theme. No partial states, no flashes.

## Trade-offs

- **No interaction during transitions.** Touches, scrolls, and additional `setTheme` calls are blocked while the fade is running. Use `isTransitioning` to disable buttons or show loading states.

- **Static overlay.** The transition uses a screenshot, so dynamic content (videos, animations, live counters) will appear frozen for the duration of the fade.

## Requirements

- React Native >= 0.76
- react-native-reanimated >= 4.0.0
- react-native-view-shot >= 3.0.0
- react-native-worklets >= 0.5.0

## Contributing

Contributions are welcome! Please read the [contributing guide](./CONTRIBUTING.md) and open an issue first to discuss what you'd like to change.

## License

react-native-theme-transition is licensed under [The MIT License](LICENSE).
