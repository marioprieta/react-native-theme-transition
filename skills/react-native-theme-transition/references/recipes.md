# Recipes

Complete examples for every feature and integration pattern.

## Table of contents

1. [System theme following](#system-theme-following)
2. [Persisted preference with system option](#persisted-preference-with-system-option)
3. [Multi-theme (3+ themes)](#multi-theme-3-themes)
4. [React Navigation integration](#react-navigation-integration)
5. [Expo Router with typed colors](#expo-router-with-typed-colors)
6. [StatusBar sync](#statusbar-sync)
7. [Haptic feedback](#haptic-feedback)
8. [Analytics / tracking](#analytics--tracking)
9. [Disable UI during transitions](#disable-ui-during-transitions)
10. [Instant switches (no animation)](#instant-switches)
11. [Bottom sheets and modals](#bottom-sheets-and-modals)
12. [Conditional assets per theme](#conditional-assets-per-theme)
13. [Themed StyleSheet factory](#themed-stylesheet-factory)

---

## System theme following

Pass `initialTheme="system"` to follow OS appearance from the first frame with
zero flash:

```tsx
<ThemeTransitionProvider initialTheme="system">
  <App />
</ThemeTransitionProvider>
```

With custom theme names, add `systemThemeMap`:

```ts
export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { sunrise, midnight },
  systemThemeMap: { light: 'sunrise', dark: 'midnight' },
});
```

### Entering/exiting system mode at runtime

```tsx
setTheme('system');  // enter — subscribes to OS changes
setTheme('dark');    // exit — manual mode, ignores OS
```

### What happens under the hood

- **Foreground**: OS appearance change → animated transition
- **Background**: OS appearance change → instant switch (no visible animation)
- **Returning to foreground**: re-reads OS scheme with instant switch (handles iOS stale
  scheme during background snapshot)

---

## Persisted preference with system option

Store the user's choice as `'light' | 'dark' | 'system'` and pass it directly.

### With AsyncStorage + Zustand

```ts
// stores/theme-store.ts
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorMode: 'system' as 'system' | 'light' | 'dark',
      setColorMode: (mode) => set({ colorMode: mode }),
    }),
    {
      name: 'theme-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

```tsx
// Root layout
function ThemeBridge() {
  const colorMode = useThemeStore((s) => s.colorMode);
  const { setTheme } = useTheme();
  useEffect(() => { setTheme(colorMode); }, [colorMode, setTheme]);
  return null;
}

export default function RootLayout() {
  const colorMode = useThemeStore((s) => s.colorMode);
  return (
    <ThemeTransitionProvider initialTheme={colorMode}>
      <ThemeBridge />
      <App />
    </ThemeTransitionProvider>
  );
}
```

```tsx
// Settings screen
function ThemeSettings() {
  const setColorMode = useThemeStore((s) => s.setColorMode);
  return (
    <>
      <Button title="Light"  onPress={() => setColorMode('light')} />
      <Button title="Dark"   onPress={() => setColorMode('dark')} />
      <Button title="System" onPress={() => setColorMode('system')} />
    </>
  );
}
```

### With plain AsyncStorage (no Zustand)

```tsx
function ThemeSettings() {
  const { setTheme } = useTheme();

  const handleSelect = async (pref: 'light' | 'dark' | 'system') => {
    setTheme(pref);
    await AsyncStorage.setItem('theme-preference', pref);
  };

  return (
    <>
      <Button title="Light"  onPress={() => handleSelect('light')} />
      <Button title="Dark"   onPress={() => handleSelect('dark')} />
      <Button title="System" onPress={() => handleSelect('system')} />
    </>
  );
}
```

Read on app start:

```tsx
export default function RootLayout() {
  const [initial, setInitial] = useState<'light' | 'dark' | 'system' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('theme-preference').then((v) => {
      setInitial((v as 'light' | 'dark' | 'system') ?? 'system');
    });
  }, []);

  if (!initial) return null; // or splash screen

  return (
    <ThemeTransitionProvider initialTheme={initial}>
      <App />
    </ThemeTransitionProvider>
  );
}
```

---

## Multi-theme (3+ themes)

```ts
const sunrise  = { bg: '#FFF8F0', text: '#3D2B1F', primary: '#FF6B35' };
const midnight = { bg: '#0D1117', text: '#E6EDF3', primary: '#58A6FF' };
const ocean    = { bg: '#0A1929', text: '#B2BAC2', primary: '#5090D3' };

export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { sunrise, midnight, ocean },
  systemThemeMap: { light: 'sunrise', dark: 'midnight' },
});
```

### Theme picker

```tsx
function ThemePicker() {
  const { colors, name, setTheme, isTransitioning } = useTheme();
  const themes = ['sunrise', 'midnight', 'ocean', 'system'] as const;

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {themes.map((t) => (
        <Pressable
          key={t}
          onPress={() => setTheme(t)}
          disabled={isTransitioning}
          style={{
            padding: 12,
            borderRadius: 8,
            borderWidth: t === name || (t === 'system') ? 2 : 0,
            borderColor: colors.primary,
          }}
        >
          <Text>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

---

## React Navigation integration

Map your color tokens to React Navigation's theme shape:

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { useTheme } from '@/lib/theme';

function ThemedNavigation({ children }) {
  const { colors, name } = useTheme();

  const navTheme = useMemo(() => ({
    dark: name !== 'light', // or a more specific check for multi-theme
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  }), [colors, name]);

  return <NavigationContainer theme={navTheme}>{children}</NavigationContainer>;
}
```

Place inside the theme provider:

```tsx
<ThemeTransitionProvider initialTheme="system">
  <ThemedNavigation>
    <AppNavigator />
  </ThemedNavigation>
</ThemeTransitionProvider>
```

---

## Expo Router with typed colors

With Expo Router, `ThemeProvider` from `@react-navigation/native` is used under the hood.
Wrap it inside the theme provider and pass colors down:

```tsx
// app/_layout.tsx
import { ThemeProvider } from '@react-navigation/native';
import { ThemeTransitionProvider, useTheme } from '@/lib/theme';
import { Stack } from 'expo-router';

function InnerLayout() {
  const { colors, name } = useTheme();

  return (
    <ThemeProvider value={{
      dark: name === 'dark',
      colors: {
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    }}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeTransitionProvider initialTheme="system">
      <InnerLayout />
    </ThemeTransitionProvider>
  );
}
```

---

## StatusBar sync

The library doesn't manage StatusBar. Sync it manually:

### Simple light/dark

```tsx
import { StatusBar } from 'expo-status-bar';

function StatusBarSync() {
  const { name } = useTheme();
  return <StatusBar style={name === 'dark' ? 'light' : 'dark'} />;
}
```

### With system mode (via external store)

```tsx
function StatusBarSync() {
  const colorMode = useThemeStore((s) => s.colorMode);
  return (
    <StatusBar
      style={
        colorMode === 'dark' ? 'light'
        : colorMode === 'light' ? 'dark'
        : 'auto'
      }
    />
  );
}
```

### With Appearance.setColorScheme (sync native UI elements)

```tsx
function ThemeBridge() {
  const colorMode = useThemeStore((s) => s.colorMode);
  const { setTheme } = useTheme();

  useEffect(() => {
    // Sync native UI elements (alerts, date pickers) with the theme
    Appearance.setColorScheme(colorMode === 'system' ? null : colorMode);
    setTheme(colorMode);
  }, [colorMode, setTheme]);

  return null;
}
```

---

## Haptic feedback

### On every animated transition (config-level)

```ts
import * as Haptics from 'expo-haptics';

export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { light, dark },
  onTransitionStart: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
});
```

### On a specific button only (per-call)

```tsx
function ThemeToggle() {
  const { name, setTheme } = useTheme();

  return (
    <Pressable onPress={() => {
      setTheme(name === 'light' ? 'dark' : 'light', {
        onTransitionStart: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      });
    }}>
      <Text>Toggle</Text>
    </Pressable>
  );
}
```

---

## Analytics / tracking

Use `onThemeChange` to track every theme change (animated, instant, system-driven):

```ts
export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { light, dark },
  onThemeChange: (name) => {
    analytics.track('theme_changed', { theme: name });
  },
});
```

---

## Disable UI during transitions

### Disable a button

```tsx
<Pressable
  onPress={() => setTheme('dark')}
  disabled={isTransitioning}
  style={{ opacity: isTransitioning ? 0.5 : 1 }}
>
  <Text>Switch theme</Text>
</Pressable>
```

### Defer expensive renders

```tsx
function HeavyChart() {
  const { isTransitioning, colors } = useTheme();

  if (isTransitioning) {
    return <View style={{ height: 200, backgroundColor: colors.card }} />;
  }

  return <ExpensiveChartComponent colors={colors} />;
}
```

---

## Instant switches

Skip animation with `animated: false`. Useful for:
- Initial theme load from storage
- Onboarding flows
- Background/foreground syncs

```tsx
// Instant, no screenshot or animation
setTheme('dark', { animated: false });
```

Only `onThemeChange` fires. No `onTransitionStart` or `onTransitionEnd`.

---

## Bottom sheets and modals

Bottom sheets (e.g., `@gorhom/bottom-sheet`) must be inside the provider so
their backdrop is captured in the screenshot:

```tsx
<ThemeTransitionProvider initialTheme="system">
  <BottomSheetModalProvider>
    <App />
  </BottomSheetModalProvider>
</ThemeTransitionProvider>
```

For React Native's built-in `Modal`, the modal content renders in a separate
native window — it won't be captured in the screenshot. Theme changes while a
modal is open will show the transition on the background only. The modal content
re-renders with new colors normally (no animation). This is a platform limitation.

---

## Conditional assets per theme

```tsx
function Logo() {
  const { name } = useTheme();
  return (
    <Image
      source={name === 'dark'
        ? require('@/assets/images/logo-white.png')
        : require('@/assets/images/logo-dark.png')
      }
    />
  );
}
```

For multi-theme:

```tsx
const logos = {
  sunrise: require('@/assets/images/logo-sunrise.png'),
  midnight: require('@/assets/images/logo-midnight.png'),
  ocean: require('@/assets/images/logo-ocean.png'),
};

function Logo() {
  const { name } = useTheme();
  return <Image source={logos[name]} />;
}
```

---

## Themed StyleSheet factory

If you prefer StyleSheet over inline styles, create a factory:

```ts
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: Colors) => T,
) {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
```

Usage:

```tsx
function ProfileScreen() {
  const styles = useThemedStyles((c) => ({
    container: { flex: 1, backgroundColor: c.background },
    title: { fontSize: 24, color: c.text },
    card: { backgroundColor: c.card, borderRadius: 12, padding: 16 },
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>{/* ... */}</View>
    </View>
  );
}
```
