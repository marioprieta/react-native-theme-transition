# react-native-theme-transition

[![npm version](https://img.shields.io/npm/v/react-native-theme-transition)](https://www.npmjs.com/package/react-native-theme-transition)
[![npm downloads](https://img.shields.io/npm/dm/react-native-theme-transition)](https://www.npmjs.com/package/react-native-theme-transition)
[![license](https://img.shields.io/npm/l/react-native-theme-transition)](https://github.com/marioprieta/react-native-theme-transition/blob/main/LICENSE)
![expo compatible](https://img.shields.io/badge/Expo_Go-compatible-000.svg?logo=expo&logoColor=white)
![react native](https://img.shields.io/badge/React_Native-0.72+-61DAFB.svg?logo=react&logoColor=white)

Smooth theme transitions for React Native using a screenshot-overlay technique. Captures the current UI, overlays it, switches all colors underneath, then fades out — covering **everything**: native headers, TextInputs, icons, third-party components. No flashes.

Works in **Expo Go**. No native modules required.

<!-- TODO: Add demo GIF/video captured with RocketSim -->
<!-- ![Demo](./assets/demo.gif) -->

## Features

- **Screenshot-overlay transitions** — every pixel transitions smoothly, including native elements
- **Expo Go compatible** — uses `react-native-view-shot` (included in Expo SDK 50+)
- **UI thread animation** — powered by `react-native-reanimated` for 60/120fps fades
- **Full TypeScript** — generic inference for theme names and color tokens
- **React Compiler ready** — clean hooks, no defensive memoization
- **System theme** — built-in hook to follow OS light/dark preference
- **Transition guard** — blocks concurrent transitions, exposes `isTransitioning` for UI control
- **Minimal API** — one factory, one provider, two hooks

## Install

```bash
# Expo (recommended — resolves compatible versions automatically)
npx expo install react-native-theme-transition react-native-reanimated react-native-gesture-handler react-native-view-shot

# React Native CLI
yarn add react-native-theme-transition react-native-reanimated react-native-gesture-handler react-native-view-shot
```

> **Note for CLI users:** Add `react-native-reanimated/plugin` to your `babel.config.js` and run `npx pod-install` for iOS.

## Quick start

### 1. Define your themes

```ts
// theme.ts
import { createAnimatedTheme } from 'react-native-theme-transition';

const light = {
  background: '#ffffff',
  card: '#f5f5f5',
  text: '#000000',
  primary: '#007AFF',
};

const dark = {
  background: '#000000',
  card: '#1c1c1e',
  text: '#ffffff',
  primary: '#0A84FF',
};

export const {
  AnimatedThemeProvider,
  useTheme,
  useSystemTheme,
} = createAnimatedTheme({
  themes: { light, dark },
  defaultTheme: 'light',
});
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
        onPress={() => setTheme('dark')}
        disabled={isTransitioning}
      >
        <Text>Dark mode</Text>
      </Pressable>
    </View>
  );
}
```

## How it works

1. `setTheme('dark')` is called
2. Waits one frame for pending renders to commit
3. Captures a screenshot of the entire view hierarchy via `captureRef`
4. Shows the screenshot as a full-screen overlay (opacity 1)
5. Switches all color tokens instantly underneath
6. Waits for React to re-render with new colors
7. Fades the overlay out (default 350ms) on the UI thread via Reanimated

The screenshot is captured **before** the color switch, so the overlay is visually identical to the current screen. When the overlay fades, it reveals the fully re-rendered new theme underneath — no partial states, no flashes.

If `setTheme` is called during an ongoing transition, the call is **ignored** until the current transition completes. Use `isTransitioning` to disable UI controls during this window.

## Configuration

```ts
createAnimatedTheme({
  themes: { light, dark },        // All themes must have identical keys
  defaultTheme: 'light',
  duration: 350,                   // Fade duration in ms (default: 350)
  onTransitionEnd: (name) => {},   // Called when transition finishes
});
```

## Hooks

### `useTheme()`

Returns everything you need in a single hook.

```ts
const { colors, name, setTheme, isTransitioning } = useTheme();
```

| Property          | Type                                | Description                              |
| ----------------- | ----------------------------------- | ---------------------------------------- |
| `colors`          | `Record<TokenName, string>`         | Current theme's color tokens             |
| `name`            | `ThemeName`                         | Active theme name (`'light'`, `'dark'`)  |
| `setTheme`        | `(name, options?) => void`          | Trigger a theme transition               |
| `isTransitioning` | `boolean`                           | `true` while a transition is in progress |

Use `isTransitioning` to disable UI that triggers theme changes:

```tsx
<Pressable onPress={() => setTheme('dark')} disabled={isTransitioning}>
  <Text>Dark mode</Text>
</Pressable>
```

### `useSystemTheme(enabled?, mapping?)`

Subscribes to OS appearance changes and automatically triggers transitions.

```ts
useSystemTheme(colorMode === 'system');

// Custom mapping
useSystemTheme(true, { light: 'day', dark: 'midnight' });
```

## Integration with Zustand

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

## Comparison

| Feature                    | react-native-theme-transition | react-native-theme-switch-animation |
| -------------------------- | :---------------------------: | :---------------------------------: |
| Expo Go compatible         |               ✓               |                  ✗                  |
| Animates native headers    |               ✓               |                  ✓                  |
| Animates TextInput text    |               ✓               |                  ✓                  |
| Zero native linking        |               ✓               |                  ✗                  |
| Typed color tokens         |               ✓               |                  ✗                  |
| Theme management (hooks)   |               ✓               |                  ✗                  |
| System theme following     |               ✓               |                  ✗                  |
| React Compiler compatible  |               ✓               |                  ✗                  |
| New Architecture (Fabric)  |               ✓               |                  ✓                  |

## Requirements

- React Native >= 0.72
- react-native-reanimated >= 3.0.0
- react-native-gesture-handler >= 2.0.0
- react-native-view-shot >= 3.0.0

## License

MIT
