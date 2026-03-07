# New Project Setup

Step-by-step guide to add react-native-theme-transition to a fresh project.

## Table of contents

1. [Expo project (recommended)](#expo-project)
2. [React Native CLI project](#react-native-cli-project)
3. [Theme file structure](#theme-file-structure)
4. [Root layout with expo-router](#root-layout-with-expo-router)
5. [Root layout without expo-router](#root-layout-without-expo-router)
6. [Using in components](#using-in-components)

---

## Expo project

### 1. Install dependencies

```bash
# Expo SDK 54+ (reanimated and view-shot are already included)
npx expo install react-native-theme-transition react-native-worklets

# Expo SDK 55+ — babel-preset-expo is no longer bundled with the template,
# so install it if your project doesn't have a babel.config.js yet:
npx expo install babel-preset-expo

# Expo SDK < 54
npx expo install react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets
```

### 2. Configure babel

Add the worklets plugin as the **last** plugin in `babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // SDK 55+: do NOT add 'react-native-reanimated/plugin' —
      // babel-preset-expo already includes it from SDK 55 onwards.
      // SDK 54 and below: you DO need 'react-native-reanimated/plugin' here.
      'react-native-worklets/plugin', // must be last
    ],
  };
};
```

### 3. Clear cache and restart

```bash
npx expo start -c
```

---

## React Native CLI project

### 1. Install dependencies

```bash
npm install react-native-theme-transition react-native-reanimated react-native-view-shot react-native-worklets
```

### 2. iOS pods

```bash
cd ios && pod install && cd ..
```

### 3. Configure babel

Same as Expo — add `react-native-worklets/plugin` as the last plugin.

### 4. Clean build

```bash
npx react-native start --reset-cache
```

---

## Theme file structure

Create a single file that defines your themes and exports the API.

### Basic light/dark

```ts
// src/lib/theme.ts
import { createThemeTransition } from 'react-native-theme-transition';

const light = {
  background: '#ffffff',
  card: '#f5f5f5',
  text: '#000000',
  textSecondary: '#666666',
  primary: '#007AFF',
  border: '#e0e0e0',
};

// Enforce matching keys at the type level
const dark: Record<keyof typeof light, string> = {
  background: '#000000',
  card: '#1c1c1e',
  text: '#ffffff',
  textSecondary: '#999999',
  primary: '#0A84FF',
  border: '#333333',
};

export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { light, dark },
});

// Optional shorthand hook
export function useColors() {
  return useTheme().colors;
}
```

### Multi-theme with custom names

```ts
// src/lib/theme.ts
import { createThemeTransition } from 'react-native-theme-transition';

const sunrise = {
  background: '#FFF8F0',
  card: '#FFF0E0',
  text: '#3D2B1F',
  primary: '#FF6B35',
};

const midnight: Record<keyof typeof sunrise, string> = {
  background: '#0D1117',
  card: '#161B22',
  text: '#E6EDF3',
  primary: '#58A6FF',
};

const ocean: Record<keyof typeof sunrise, string> = {
  background: '#0A1929',
  card: '#132F4C',
  text: '#B2BAC2',
  primary: '#5090D3',
};

export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { sunrise, midnight, ocean },
  // Required: map OS appearance to your theme names for system mode
  systemThemeMap: { light: 'sunrise', dark: 'midnight' },
});
```

### Extracting a Colors type

If other files need the token shape (e.g., for styled components or utility functions):

```ts
// At the bottom of theme.ts
export type Colors = typeof light;
// or equivalently:
// export type Colors = { background: string; card: string; ... }
```

---

## Root layout with expo-router

```tsx
// src/app/_layout.tsx
import { ThemeTransitionProvider, useTheme } from '@/lib/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function StatusBarSync() {
  const { name } = useTheme();
  return <StatusBar style={name === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeTransitionProvider initialTheme="system">
        <StatusBarSync />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeTransitionProvider>
    </GestureHandlerRootView>
  );
}
```

Key points:
- `ThemeTransitionProvider` inside `GestureHandlerRootView` but wrapping all navigation
- `StatusBarSync` must be inside the provider (it uses `useTheme`)
- `initialTheme="system"` for OS-following by default

---

## Root layout without expo-router

```tsx
// App.tsx
import { ThemeTransitionProvider } from './src/lib/theme';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeTransitionProvider initialTheme="system">
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </ThemeTransitionProvider>
    </GestureHandlerRootView>
  );
}
```

---

## Using in components

### Reading colors

```tsx
import { useTheme } from '@/lib/theme';
// or if you only need colors:
import { useColors } from '@/lib/theme';

function ProfileCard() {
  const { colors } = useTheme();
  // or: const colors = useColors();

  return (
    <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}>
      <Text style={{ color: colors.text }}>Profile</Text>
      <Text style={{ color: colors.textSecondary }}>Settings</Text>
    </View>
  );
}
```

### Theme toggle button

```tsx
import { useTheme } from '@/lib/theme';

function ThemeToggle() {
  const { name, setTheme, isTransitioning } = useTheme();

  return (
    <Pressable
      onPress={() => setTheme(name === 'light' ? 'dark' : 'light')}
      disabled={isTransitioning}
      style={{ opacity: isTransitioning ? 0.5 : 1 }}
    >
      <Text>{name === 'light' ? 'Switch to Dark' : 'Switch to Light'}</Text>
    </Pressable>
  );
}
```

### Three-way selector (Light / Dark / System)

```tsx
import { useTheme } from '@/lib/theme';

function ThemeSelector() {
  const { setTheme, isTransitioning } = useTheme();

  const options = ['light', 'dark', 'system'] as const;

  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => setTheme(option)}
          disabled={isTransitioning}
        >
          <Text>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

### Conditional rendering based on theme

```tsx
function Logo() {
  const { name } = useTheme();

  return (
    <Image
      source={name === 'dark'
        ? require('@/assets/logo-white.png')
        : require('@/assets/logo-dark.png')
      }
    />
  );
}
```
