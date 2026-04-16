<h1 align="center">React Native Theme Transition</h1>

<p align="center">
  Animated theme transitions for React Native. Nine styles built on
  Skia, all running in Expo Go.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-theme-transition"><img src="https://img.shields.io/npm/v/react-native-theme-transition.svg?t=1" alt="npm version" /></a>
  <a href="https://bundlephobia.com/package/react-native-theme-transition"><img src="https://img.shields.io/bundlephobia/minzip/react-native-theme-transition" alt="bundle size" /></a>
  <img src="https://img.shields.io/badge/Expo_Go-compatible-000.svg?logo=expo&logoColor=white" alt="expo compatible" />
  <img src="https://img.shields.io/badge/React_Compiler-compatible-blueviolet.svg" alt="react compiler" />
  <a href="https://github.com/marioprieta/react-native-theme-transition/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-theme-transition?t=1" alt="license" /></a>
</p>

<table align="center">
  <tr>
    <td align="center"><b>iOS</b></td>
    <td align="center"><b>Android</b></td>
  </tr>
  <tr>
    <td>
      <img src="https://raw.githubusercontent.com/marioprieta/react-native-theme-transition/main/assets/videos/iOS_demo.gif" width="260" alt="iOS demo" />
    </td>
    <td>
      <img src="https://raw.githubusercontent.com/marioprieta/react-native-theme-transition/main/assets/videos/Android_demo.gif" width="260" alt="Android demo" />
    </td>
  </tr>
</table>

## Features

- **Nine transition styles.** `fade`, `circularReveal`, `heart`, `star`, `wipe`, `slide`, `split`, `pixelize`, `dissolve`.
- **Expo Go ready.** Works with Expo SDK 54+ out of the box. Bare React Native CLI also supported.
- **Full TypeScript inference.** `useTheme()` and `setTheme()` know your theme names and color tokens without manual generics.
- **System theme built in.** Follows OS appearance with zero-flash startup.
- **Strict runtime validation.** Invalid options throw immediately with clear error messages.
- **React Compiler compatible.** All hooks follow the [Rules of React](https://react.dev/reference/rules).

## Documentation

Docs, examples, and migration guide at **[react-native-theme-transition.vercel.app](https://react-native-theme-transition.vercel.app)**.

## Requirements

- React **19.0.0+** and React Native **0.78.0+**
- `@shopify/react-native-skia` **2.0.0+**
- `react-native-reanimated` **4.0.0+**
- `react-native-worklets` **0.5.0+**

## Installation

```bash
# Expo (SDK 54+)
npx expo install react-native-theme-transition @shopify/react-native-skia react-native-worklets

# React Native CLI
npm install react-native-theme-transition @shopify/react-native-skia react-native-reanimated react-native-worklets
```

Add `react-native-worklets/plugin` as the **last plugin** in your `babel.config.js`.

## Quick Start

```ts
// theme.ts
import { createThemeTransition } from 'react-native-theme-transition'

export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: {
    light: { background: '#ffffff', text: '#000000', primary: '#007AFF' },
    dark:  { background: '#000000', text: '#ffffff', primary: '#0A84FF' },
  },
})
```

```tsx
// App.tsx
import { ThemeTransitionProvider } from './theme'

export default function App() {
  return (
    <ThemeTransitionProvider initialTheme="system">
      <MyApp />
    </ThemeTransitionProvider>
  )
}
```

```tsx
// MyScreen.tsx
import { Pressable, Text, View } from 'react-native'
import { useTheme } from './theme'

function MyScreen() {
  const { theme, setTheme, isTransitioning } = useTheme()

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.text }}>Current: {theme.name}</Text>
      <Pressable
        onPress={() => setTheme(theme.name === 'dark' ? 'light' : 'dark')}
        disabled={isTransitioning}
      >
        <Text style={{ color: theme.colors.primary }}>Toggle</Text>
      </Pressable>
    </View>
  )
}
```

The hook returns the current theme, the user's preference (including `'system'`), a `setTheme` function, and an `isTransitioning` flag. See the [useTheme reference](https://react-native-theme-transition.vercel.app/docs/api/use-theme) for the full API.

## Contributing

Contributions are welcome. Please read the [contributing guide](./CONTRIBUTING.md) and open an issue first to discuss what you'd like to change.

## License

MIT
