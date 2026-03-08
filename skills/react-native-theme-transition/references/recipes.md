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
10. [Theme toggle](#theme-toggle)
11. [Instant switches (no animation)](#instant-switches)
12. [Bottom sheets and modals](#bottom-sheets-and-modals)
13. [Conditional assets per theme](#conditional-assets-per-theme)
14. [Themed StyleSheet factory](#themed-stylesheet-factory)
15. [Checkmark list picker](#checkmark-list-picker)

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

### Theme picker (with selection tracking)

Use `useTheme({ initialSelection })` for a flicker-free picker that handles
iOS 120Hz timing and rapid-press protection:

```tsx
function ThemePicker() {
  const { selected, select, colors, isTransitioning } = useTheme({ initialSelection: 'system' });
  const options = ['system', 'sunrise', 'midnight', 'ocean'] as const;

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => select(option)}
          disabled={isTransitioning}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: option === selected ? colors.primary : 'transparent',
          }}
        >
          <Text style={{ color: option === selected ? '#fff' : colors.text }}>
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
```

### Theme picker (manual, without selection tracking)

If you need full control over the selection state, use `setTheme` directly
with `requestAnimationFrame` to avoid iOS flickering:

```tsx
function ThemePicker() {
  const { colors, setTheme, isTransitioning } = useTheme();
  type Option = 'system' | 'sunrise' | 'midnight' | 'ocean';
  const [selected, setSelected] = useState<Option>('system');
  const lockRef = useRef(false);
  const options: readonly Option[] = ['system', 'sunrise', 'midnight', 'ocean'];

  useEffect(() => {
    if (!isTransitioning) lockRef.current = false;
  }, [isTransitioning]);

  const onSelect = useCallback(
    (option: Option) => {
      if (lockRef.current) return;
      lockRef.current = true;
      // Update selection BEFORE setTheme so it's painted before capture.
      setSelected(option);
      requestAnimationFrame(() => {
        if (setTheme(option)) return;
        lockRef.current = false;
      });
    },
    [setTheme],
  );

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onSelect(option)}
          disabled={isTransitioning}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: option === selected ? colors.primary : 'transparent',
          }}
        >
          <Text style={{ color: option === selected ? '#fff' : colors.text }}>
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
```

> **Why `requestAnimationFrame`?** On iOS 120Hz, calling `setSelected` and
> `setTheme` in the same event handler doesn't give React enough time to
> paint the selection change before the library captures the screenshot.
> Deferring `setTheme` by one frame guarantees the new highlight is visible
> in the screenshot, so the cross-fade only blends colors — not selection
> position. `useTheme({ initialSelection })` handles this automatically. See
> [Troubleshooting: iOS picker flickering](troubleshooting.md#ios-picker-flickering-during-transition).

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

## Theme toggle

> **Do not use the native `<Switch>` for theme toggling.** iOS's UISwitch runs
> a ~250ms Core Animation with no completion callback. The screenshot captures
> the thumb mid-slide, causing a visible flicker during the cross-fade. No
> production app or library combines native Switch with screenshot-based
> transitions. See [Troubleshooting: Native Switch flickers](troubleshooting.md#native-switch-flickers-during-theme-transition).

Use `useTheme({})` — not plain `useTheme()` — because the toggle thumb is a
selection indicator (just like a picker highlight). `useTheme({})` returns
`selected` (defaulting to the current theme) and `select`, which updates
`selected` **before** the screenshot capture, so the overlay and real UI show
the same thumb position. Without it, the overlay shows the old position and the
real UI shows the new one, causing both to blend during the cross-fade.

> **Rule of thumb:** any component whose visual state changes on theme switch
> needs `useTheme({})`. The only component that can use `setTheme` directly is
> a button whose content doesn't change (e.g., a plain "Switch theme" label).

```tsx
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/lib/theme';

const TRACK_W = 50;
const TRACK_H = 30;
const THUMB = 26;
const PAD = 2;
const MAX_TX = TRACK_W - THUMB - PAD * 2;

export function ThemeToggle() {
  const { selected, select, colors, isTransitioning } = useTheme({});
  const isDark = selected === 'dark';

  return (
    <Pressable
      onPress={() => select(isDark ? 'light' : 'dark')}
      disabled={isTransitioning}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 16, color: colors.text }}>Dark Mode</Text>
      <View
        style={{
          width: TRACK_W, height: TRACK_H,
          borderRadius: TRACK_H / 2, padding: PAD,
          justifyContent: 'center',
          backgroundColor: isDark ? colors.primary : colors.border,
        }}
      >
        <View
          style={{
            width: THUMB, height: THUMB, borderRadius: THUMB / 2,
            backgroundColor: '#fff',
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
            transform: [{ translateX: isDark ? MAX_TX : 0 }],
          }}
        />
      </View>
    </Pressable>
  );
}
```

> **Why plain styles, not Reanimated?** The visual state must update in React's
> commit cycle — the same cycle that `useTheme({})` triggers.
> Reanimated's `useAnimatedStyle` + `useEffect` → `sharedValue` adds 1+ extra
> frames of latency (JS → UI thread), and the capture can happen before the
> native view is updated. Plain styles update in the same React commit, matching
> the pattern that works for the pill picker.

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

---

## Checkmark list picker

An iOS Settings-style list where the selected theme shows a checkmark.
Uses `useTheme({ initialSelection })` for flicker-free selection and system mode support:

```tsx
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/lib/theme';

const OPTIONS = ['system', 'light', 'dark'] as const;
const LABELS = { system: 'System', light: 'Light', dark: 'Dark' };

export function ThemeList() {
  const { selected, select, colors, isTransitioning } = useTheme({ initialSelection: 'system' });

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {OPTIONS.map((option, i) => (
        <Pressable
          key={option}
          onPress={() => select(option)}
          disabled={isTransitioning}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 13,
            paddingHorizontal: 16,
            borderBottomWidth: i < OPTIONS.length - 1 ? 1 : 0,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 16, color: colors.text }}>
            {LABELS[option]}
          </Text>
          {option === selected && (
            <Text style={{ fontSize: 17, color: colors.primary, fontWeight: '600' }}>
              ✓
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
```
