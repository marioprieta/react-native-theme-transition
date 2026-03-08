<h1 align="center">react-native-theme-transition</h1>

<p align="center">
  Smooth, animated theme transitions for React Native. Expo Go compatible, 100% JS, powered by Reanimated.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-theme-transition"><img src="https://img.shields.io/npm/v/react-native-theme-transition.svg" alt="npm version" /></a>
  <a href="https://bundlephobia.com/package/react-native-theme-transition"><img src="https://img.shields.io/bundlephobia/minzip/react-native-theme-transition" alt="bundle size" /></a>
  <img src="https://img.shields.io/badge/Expo_Go-compatible-000.svg?logo=expo&logoColor=white" alt="expo compatible" />
  <img src="https://img.shields.io/badge/React_Compiler-compatible-blue.svg" alt="react compiler" />
  <a href="https://github.com/marioprieta/react-native-theme-transition/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-theme-transition" alt="license" /></a>
</p>

<!-- TODO: Replace with actual demo GIF -->
<!-- <p align="center">
  <img src=".github/assets/demo.gif" alt="react-native-theme-transition demo" width="300" />
</p> -->

## Features

- **Smooth cross-fade transitions** — screenshot-overlay technique powered by Reanimated on the native UI thread (60-120 FPS)
- **Expo Go compatible** — no native code, no prebuilds
- **Built-in theme management** — provider, typed hooks, and deep generic inference out of the box
- **System theme sync** — follows OS appearance automatically with zero-flash startup
- **Transition guard** — blocks concurrent transitions and exposes `isTransitioning`
- **React Compiler ready** — all hooks follow the [Rules of React](https://react.dev/reference/rules)
- **Tiny footprint** — ~13 kB, zero runtime dependencies

## Documentation

For full docs, API reference, examples, and recipes, visit **[react-native-theme-transition.vercel.app](https://react-native-theme-transition.vercel.app)**.

## Installation

```bash
# Expo (SDK 54+ already has reanimated and view-shot)
npx expo install react-native-theme-transition react-native-worklets

# React Native CLI
npm install react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets
```

Add `react-native-worklets/plugin` as the **last plugin** in your `babel.config.js`.

## Quick start

```ts
// theme.ts
import { createThemeTransition } from 'react-native-theme-transition';

export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: {
    light: { background: '#ffffff', text: '#000000', primary: '#007AFF' },
    dark:  { background: '#000000', text: '#ffffff', primary: '#0A84FF' },
  },
});
```

```tsx
// App.tsx
import { ThemeTransitionProvider } from './theme';

export default function App() {
  return (
    <ThemeTransitionProvider initialTheme="system">
      <MyApp />
    </ThemeTransitionProvider>
  );
}
```

```tsx
// MyScreen.tsx
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

## Contributing

Contributions are welcome! Please read the [contributing guide](./CONTRIBUTING.md) and open an issue first to discuss what you'd like to change.

## License

MIT
