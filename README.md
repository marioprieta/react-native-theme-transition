# react-native-theme-transition

[![npm version](https://img.shields.io/npm/v/react-native-theme-transition.svg)](https://www.npmjs.com/package/react-native-theme-transition)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-native-theme-transition)](https://bundlephobia.com/package/react-native-theme-transition)
![expo compatible](https://img.shields.io/badge/Expo_Go-compatible-000.svg?logo=expo&logoColor=white)
![react compiler](https://img.shields.io/badge/React_Compiler-compatible-blue.svg)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/marioprieta/react-native-theme-transition/blob/main/LICENSE)

Smooth, animated theme transitions for React Native. Expo Go compatible, 100% JS, powered by Reanimated.

<!-- TODO: Replace with actual demo GIF (600x1300px, 30fps, <5MB) -->
<!-- <p align="center">
  <img src=".github/assets/demo.gif" alt="react-native-theme-transition demo" width="300" />
</p> -->

<!-- TODO: Add Expo Snack link -->
<!-- [![Try on Expo Snack](https://img.shields.io/badge/Try_it-Expo_Snack-blue.svg?logo=expo&logoColor=white)](https://snack.expo.dev/...) -->

## Motivation

Theme transitions in React Native have always needed custom native modules. That means no Expo Go, no OTA updates, and extra maintenance for each platform.

This library takes a different approach: capture a screenshot, overlay it, switch colors underneath, and fade out. The result is a smooth cross-fade that works everywhere, no native code needed. All peer dependencies are already included in Expo SDK 54+.

## Features

- **Smooth cross-fade transitions.** Screenshot-overlay technique powered by Reanimated on the native UI thread, matching your display's refresh rate (60–120 FPS).
- **Expo Go compatible.** No native code, no prebuilds.
- **Built-in theme management.** Provider, typed hooks, and deep generic inference out of the box.
- **System theme sync.** `initialTheme="system"` and `setTheme('system')` for zero-flash OS appearance tracking at startup and runtime.
- **Transition guard.** Blocks concurrent transitions and exposes `isTransitioning`.
- **React Compiler ready.** All hooks follow the [Rules of React](https://react.dev/reference/rules). Works with and without the compiler.
- **Tiny footprint.** ~12 kB compressed, zero runtime dependencies.

## Comparison

| Feature | react-native-theme-transition | react-native-theme-switch-animation | No library (manual) |
|---|:---:|:---:|:---:|
| Animated transition | ✅ Cross-fade | ✅ Circle/slide reveal | ❌ Instant flash |
| Expo Go support | ✅ | ❌ Requires prebuild | ✅ |
| Execution | Pure JS / Reanimated + Worklets | Native modules (Java/ObjC) | JS thread |
| Theme state management | ✅ Provider + typed hooks | ❌ Bring your own | ❌ Bring your own |
| TypeScript generics | ✅ Deep inference for tokens | ⚠️ Basic typings | ❌ Manual |
| System theme listener | ✅ Built-in (`initialTheme="system"`) | ❌ Not included | ❌ Manual |
| React Compiler | ✅ | ❌ | Depends on code |
| New Architecture (Fabric) | ✅ | ✅ | ✅ |

## Installation

```bash
# Expo (recommended)
npx expo install react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets

# React Native CLI
npm install react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets
```

> **Already using Expo SDK 54+?** `react-native-reanimated`, `react-native-view-shot`, and `react-native-worklets` are already included. Just install `react-native-theme-transition`.

> **CLI users:** Add `react-native-worklets/plugin` as the **last plugin** in your `babel.config.js` and run `npx pod-install` for iOS.

## Quick start

### 1. Define your themes

```ts
// theme.ts
import { createThemeTransition } from 'react-native-theme-transition';

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

export const { ThemeTransitionProvider, useTheme } =
  createThemeTransition({
    themes: { light, dark },
    defaultTheme: 'light',
  });

// TypeScript infers everything:
// - Theme names: 'light' | 'dark'
// - Color tokens: 'background' | 'card' | 'text' | 'primary'
```

### 2. Wrap your app

```tsx
import { ThemeTransitionProvider } from './theme';

export default function App() {
  return (
    <ThemeTransitionProvider>
      <MyApp />
    </ThemeTransitionProvider>
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

### `createThemeTransition(config)`

Creates a Provider and hooks from your theme definitions. Validates that all themes share the same token keys at initialization, so mismatches are caught immediately during development.

```ts
const { ThemeTransitionProvider, useTheme } =
  createThemeTransition({
    themes: { light, dark },
    defaultTheme: 'light',
    duration: 350,
    onTransitionEnd: (name) => analytics.track('theme_switch', { theme: name }),
  });
```

#### Config options

| Option | Type | Default | Description |
|---|---|---|---|
| `themes` | `Record<string, ThemeDefinition>` | *required* | Object of theme definitions. All themes must share the same color token keys. The name `'system'` is reserved. |
| `defaultTheme` | `keyof themes` | *required* | Theme used on first render. |
| `duration` | `number` | `350` | Fade-out animation duration in milliseconds. |
| `systemThemeMap` | `{ light?: ThemeName, dark?: ThemeName }` | | Maps OS appearance to theme names. Required when your themes are not named `'light'` and `'dark'` and you want to use system mode. |
| `onTransitionEnd` | `(name: string) => void` | | Called after the fade completes and the overlay is removed. |

#### Type inference

You never need to pass generic types manually. TypeScript infers theme names and color tokens directly from your `themes` object:

```ts
const light = { background: '#fff', text: '#000', primary: '#007AFF' };
const dark  = { background: '#000', text: '#fff', primary: '#0A84FF' };

const { useTheme } = createThemeTransition({
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

### `ThemeTransitionProvider`

Wraps your app tree and provides the theme context.

```tsx
<ThemeTransitionProvider initialTheme="system">
  <App />
</ThemeTransitionProvider>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | *required* | Your application tree. |
| `initialTheme` | `ThemeName \| 'system'` | Value of `defaultTheme` | Starting theme or `'system'` to follow the OS appearance. When `'system'`, reads `Appearance.getColorScheme()` synchronously on the first frame (zero-flash) and subscribes to system changes. For custom theme names, provide `systemThemeMap` in the config. |

---

### `useTheme()`

Returns the current theme state and a function to trigger transitions.

```ts
const { colors, name, setTheme, isTransitioning } = useTheme();
```

| Property | Type | Description |
|---|---|---|
| `colors` | `{ [token]: string }` | Current theme's color values, fully typed to your token names. |
| `name` | `ThemeName` | Active theme identifier (e.g. `'light'`, `'dark'`). Always the resolved name, never `'system'`. |
| `setTheme` | `(name, options?) => void` | Triggers a transition to the given theme, or pass `'system'` to follow the OS appearance. |
| `isTransitioning` | `boolean` | `true` from when `setTheme` is called until the fade animation ends. |

**Behavior:**
- Calling `setTheme` with the **current** theme name is a no-op.
- Calling it **during** an ongoing transition is silently ignored.
- `setTheme('system')` enters system mode — the provider subscribes to OS appearance changes.
- `setTheme('dark')` (or any theme name) exits system mode.
- Use `isTransitioning` to disable toggle buttons or defer expensive renders.

#### `setTheme` options

| Option | Type | Default | Description |
|---|---|---|---|
| `animated` | `boolean` | `true` | When `false`, switches instantly without animation. |
| `onCaptured` | `() => void` | | Called after the screenshot is captured, just before the theme switch is applied. Only called when `animated` is `true`. |

```ts
setTheme('dark', {
  onCaptured: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
});
```

---

### Exported types

For advanced TypeScript usage, these types are available as named imports:

```ts
import type {
  ThemeDefinition,         // Record<string, string> — shape of a single theme
  ThemeTransitionConfig,   // Config object for createThemeTransition
  ThemeTransitionAPI,      // Return type of createThemeTransition
  SystemThemeMap,          // systemThemeMap type ({ light?: ThemeName, dark?: ThemeName })
  SetThemeOptions,         // Options for setTheme ({ animated, onCaptured })
  ThemeNames,              // Union of theme name strings
  TokenNames,              // Union of color token strings
} from 'react-native-theme-transition';
```

---

## Recipes

### Start with the system theme

```tsx
<ThemeTransitionProvider initialTheme="system">
  <MyApp />
</ThemeTransitionProvider>
```

With custom theme names, add `systemThemeMap` to the config:

```ts
export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { sunrise, midnight, ocean },
  defaultTheme: 'sunrise',
  systemThemeMap: { light: 'sunrise', dark: 'midnight' },
});
```

### Persisted preference with system option

Store the user's preference as `'light' | 'dark' | 'system'` and pass it directly:

```tsx
export default function App() {
  const stored = useStoredPreference(); // 'light' | 'dark' | 'system'

  return (
    <ThemeTransitionProvider initialTheme={stored}>
      <MyApp />
    </ThemeTransitionProvider>
  );
}
```

In a settings screen:

```tsx
function ThemeSettings() {
  const { setTheme } = useTheme();

  const handleSelect = (preference: 'light' | 'dark' | 'system') => {
    setTheme(preference);
    AsyncStorage.setItem('theme', preference);
  };

  return (
    <>
      <Button title="Light" onPress={() => handleSelect('light')} />
      <Button title="Dark" onPress={() => handleSelect('dark')} />
      <Button title="System" onPress={() => handleSelect('system')} />
    </>
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
  const colorMode = useThemeStore((s) => s.colorMode); // 'light' | 'dark' | 'system'
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(colorMode);
  }, [colorMode, setTheme]);

  return null;
}
```

### React Navigation theme sync

Map your color tokens to React Navigation's theme shape:

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

The library captures a full-screen screenshot of the current UI, displays it as an opaque overlay, switches all color tokens underneath, then fades the overlay out on the native UI thread via Reanimated. The screenshot is taken **before** the color switch, so the transition is seamless — no partial states, no flashes.

For the full step-by-step breakdown and sequence diagram, see [docs/how-it-works.md](docs/how-it-works.md).

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
