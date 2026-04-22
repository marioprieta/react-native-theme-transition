<h1 align="center">React Native Theme Transition</h1>

<p align="center">
  Nine animated theme transitions for React Native. Skia-powered, runs in Expo Go.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-theme-transition"><img src="https://img.shields.io/npm/v/react-native-theme-transition.svg?t=1" alt="npm version" /></a>
  <a href="https://bundlephobia.com/package/react-native-theme-transition"><img src="https://img.shields.io/bundlephobia/minzip/react-native-theme-transition" alt="bundle size" /></a>
  <img src="https://img.shields.io/badge/Expo_Go-compatible-000.svg?logo=expo&logoColor=white" alt="expo compatible" />
  <img src="https://img.shields.io/badge/React_Compiler-compatible-blueviolet.svg" alt="react compiler" />
  <a href="https://github.com/marioprieta/react-native-theme-transition/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-theme-transition?t=1" alt="license" /></a>
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/32cdd33a-2c79-42f6-b70a-4a4644100683" width="400" alt="React Native Theme Transition demo" />
</p>

## Features

- **Nine transition styles.** `fade`, `circularReveal`, `heart`, `star`, `wipe`, `slide`, `split`, `pixelize`, `dissolve`.
- **Expo Go ready.** Works on Expo SDK 54+ out of the box. Bare React Native CLI also supported.
- **Full TypeScript inference.** `useTheme()` and `setTheme()` know your theme names and color tokens without manual generics.
- **System theme built in.** Follows OS appearance with zero-flash startup.
- **Strict runtime validation.** Invalid options throw immediately with clear error messages.
- **React Compiler compatible.** All hooks follow the [Rules of React](https://react.dev/reference/rules).

## Requirements

- React **19.0.0+** and React Native **0.78.0+**
- `@shopify/react-native-skia` **2.0.0+**
- `react-native-reanimated` **4.0.0+**
- `react-native-worklets` **0.5.0+**

## Try it

- [Snack](https://snack.expo.dev/@mariops03/react-native-theme-transition) Live playground with the 9 transitions in a browser phone preview.
- [Docs](https://react-native-theme-transition.vercel.app) API reference, recipes, migration guide.

## Installation

```bash
# Expo (SDK 54+)
npx expo install react-native-theme-transition @shopify/react-native-skia react-native-worklets

# React Native CLI
npm install react-native-theme-transition @shopify/react-native-skia react-native-reanimated react-native-worklets
```

Add `react-native-worklets/plugin` as the **last plugin** in your `babel.config.js`. On Expo SDK 55+, do NOT add `react-native-reanimated/plugin`, since `babel-preset-expo` already includes it.

> Using Claude Code, Cursor, or Codex? Install the [AI-assisted setup](#ai-assisted-setup) skill first and the agent can run the installation from the v2 API reference.

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
        onPress={() => setTheme(theme.name === 'dark' ? 'light' : 'dark', { transition: 'circularReveal' })}
        disabled={isTransitioning}
      >
        <Text style={{ color: theme.colors.primary }}>Toggle</Text>
      </Pressable>
    </View>
  )
}
```

`useTheme()` returns `theme`, `preference`, `setTheme`, and `isTransitioning`. See the [useTheme reference](https://react-native-theme-transition.vercel.app/docs/api/use-theme) for the full API.

> Want the agent to write all three files? With the [AI-assisted setup](#ai-assisted-setup) skill installed, Claude Code or Cursor has these steps as a recipe and applies them to your project directly.

## AI-assisted setup

For agentic coding with Claude Code, Cursor, or Codex, the library ships a skill:

```bash
npx skills add https://skills.sh/marioprieta/skills/react-native-theme-transition
```

It's the same content as the docs site, split into files so the agent can pull the relevant one (api, guides, recipes, examples) instead of loading everything.

## Contributing

Contributions are welcome. Please read the [contributing guide](./CONTRIBUTING.md) and open an issue first to discuss what you'd like to change.

## License

MIT
