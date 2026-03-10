# Adding to an Existing Project

Migration guides for different state management approaches.

## Table of contents

1. [General strategy](#general-strategy)
2. [From plain Context / useState](#from-plain-context--usestate)
3. [From Zustand](#from-zustand)
4. [From Redux / Redux Toolkit](#from-redux--redux-toolkit)
5. [From MMKV direct](#from-mmkv-direct)
6. [From React Navigation theming only](#from-react-navigation-theming-only)
7. [Preserving an existing useTheme hook](#preserving-an-existing-usetheme-hook)

---

## General strategy

The migration follows the same pattern regardless of your current approach:

1. **Install** the library and peer dependencies
2. **Create the theme file** — define tokens, call `createThemeTransition`
3. **Wrap with provider** — add `ThemeTransitionProvider` at the root
4. **Bridge** your existing state to the provider via a bridge component
5. **Replace** color references from your old system to `useTheme().colors`
6. **Remove** the old theme context/provider once fully migrated

The bridge pattern is the key concept. The library owns the animated transition
state internally. Your external state manager (Zustand, Redux, etc.) drives it
via `setTheme` calls from a bridge component.

### The bridge pattern

```tsx
function ThemeBridge() {
  const externalTheme = /* read from your state manager */;
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(externalTheme); // 'light' | 'dark' | 'system'
  }, [externalTheme, setTheme]);

  return null;
}
```

Place this inside the `ThemeTransitionProvider`, before any other children.
The bridge reacts to external state changes and drives the animated provider.

---

## From plain Context / useState

### Before

```tsx
// ThemeContext.tsx
const ThemeContext = createContext({ theme: 'light', colors: lightColors, toggle: () => {} });

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const colors = theme === 'light' ? lightColors : darkColors;
  return (
    <ThemeContext.Provider value={{ theme, colors, toggle: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### After

This is the simplest migration — you can fully replace the old context.

**Step 1:** Create the theme file:

```ts
// src/lib/theme.ts
import { createThemeTransition } from 'react-native-theme-transition';

// Reuse your existing color objects
export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { light: lightColors, dark: darkColors },
});
```

**Step 2:** Replace the old provider in your root layout:

```tsx
// Before:
<ThemeProvider>
  <App />
</ThemeProvider>

// After:
<ThemeTransitionProvider initialTheme="light">
  <App />
</ThemeTransitionProvider>
```

**Step 3:** Update components — replace `useContext(ThemeContext)` with `useTheme()`:

```tsx
// Before:
const { colors, toggle } = useContext(ThemeContext);

// After:
const { colors, name, setTheme } = useTheme();
const toggle = () => setTheme(name === 'light' ? 'dark' : 'light');
```

**Step 4:** Delete the old `ThemeContext.tsx`.

---

## From Zustand

Keep Zustand as the source of truth for persisted preference. Add a bridge component
that syncs the Zustand store to the animated provider.

### Theme store (keep as-is or simplify)

```ts
// src/stores/theme-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      setThemePreference: (pref) => set({ themePreference: pref }),
    }),
    {
      name: 'theme-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

### Theme file

```ts
// src/lib/theme.ts
import { createThemeTransition } from 'react-native-theme-transition';

const light = { /* your tokens */ };
const dark = { /* your tokens */ };

export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { light, dark },
});
```

### Bridge component

```tsx
// In your root layout file
import { useThemeStore } from '@/stores/theme-store';
import { useTheme } from '@/lib/theme';

function ThemeBridge() {
  const themePreference = useThemeStore((s) => s.themePreference);
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(themePreference);
  }, [themePreference, setTheme]);

  return null;
}
```

### Root layout

```tsx
export default function RootLayout() {
  const themePreference = useThemeStore((s) => s.themePreference);

  return (
    <ThemeTransitionProvider initialTheme={themePreference}>
      <ThemeBridge />
      {/* rest of app */}
    </ThemeTransitionProvider>
  );
}
```

Note: `initialTheme={themePreference}` reads the Zustand value for the first frame.
If Zustand hydrates asynchronously, the initial value is the default ('system').
The bridge then syncs once hydration completes.

### Settings screen

```tsx
import { useThemeStore } from '@/stores/theme-store';

function ThemeSettings() {
  const setThemePreference = useThemeStore((s) => s.setThemePreference);

  // Change Zustand → bridge fires → animated transition
  return (
    <>
      <Button title="Light" onPress={() => setThemePreference('light')} />
      <Button title="Dark" onPress={() => setThemePreference('dark')} />
      <Button title="System" onPress={() => setThemePreference('system')} />
    </>
  );
}
```

---

## From Redux / Redux Toolkit

Same bridge pattern, different selector.

### Slice (keep as-is)

```ts
// src/store/themeSlice.ts
const themeSlice = createSlice({
  name: 'theme',
  initialState: { themePreference: 'system' as 'system' | 'light' | 'dark' },
  reducers: {
    setThemePreference: (state, action) => { state.themePreference = action.payload; },
  },
});
```

### Bridge

```tsx
function ThemeBridge() {
  const themePreference = useSelector((state: RootState) => state.theme.themePreference);
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(themePreference);
  }, [themePreference, setTheme]);

  return null;
}
```

### Root — provider order

```tsx
<Provider store={store}>
  <ThemeTransitionProvider initialTheme={store.getState().theme.themePreference}>
    <ThemeBridge />
    <App />
  </ThemeTransitionProvider>
</Provider>
```

Redux Provider must wrap `ThemeTransitionProvider` so the bridge can read the store.

---

## From MMKV direct

If you use MMKV directly (not through Zustand), create a small hook to read the
persisted value and drive the bridge.

```ts
// src/hooks/useStoredTheme.ts
import { useMMKVString } from 'react-native-mmkv';

export function useStoredTheme() {
  const [value, setValue] = useMMKVString('themePreference');
  const themePreference = (value ?? 'system') as 'system' | 'light' | 'dark';
  return { themePreference, setThemePreference: setValue };
}
```

### Bridge

```tsx
function ThemeBridge() {
  const { themePreference } = useStoredTheme();
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(themePreference);
  }, [themePreference, setTheme]);

  return null;
}
```

---

## From React Navigation theming only

If your only theme system is `NavigationContainer`'s `theme` prop with
`DefaultTheme` / `DarkTheme`, the migration adds the animation layer on top.

### Before

```tsx
<NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
```

### After

**Step 1:** Define themes matching Navigation's token structure:

```ts
// src/lib/theme.ts
import { createThemeTransition } from 'react-native-theme-transition';

const light = {
  primary: '#007AFF',
  background: '#ffffff',
  card: '#ffffff',
  text: '#000000',
  border: '#d8d8d8',
  notification: '#ff3b30',
};

const dark: Record<keyof typeof light, string> = {
  primary: '#0A84FF',
  background: '#000000',
  card: '#1c1c1e',
  text: '#ffffff',
  border: '#333333',
  notification: '#ff453a',
};

export const { ThemeTransitionProvider, useTheme } = createThemeTransition({
  themes: { light, dark },
});
```

**Step 2:** Bridge to NavigationContainer:

```tsx
function AppWithNavigation() {
  const { colors, name } = useTheme();

  const navTheme = {
    dark: name === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.notification,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <AppNavigator />
    </NavigationContainer>
  );
}

// Root:
<ThemeTransitionProvider initialTheme="system">
  <AppWithNavigation />
</ThemeTransitionProvider>
```

---

## Preserving an existing useTheme hook

If your codebase already has a `useTheme` hook with a different return shape and you
can't rename all call sites at once, re-export with an adapter:

```ts
// src/lib/theme.ts
import { createThemeTransition } from 'react-native-theme-transition';

const api = createThemeTransition({ themes: { light, dark } });

export const ThemeTransitionProvider = api.ThemeTransitionProvider;

// Adapter: match your old hook's return shape
export function useTheme() {
  const { colors, name, setTheme, isTransitioning } = api.useTheme();
  return {
    colors,
    theme: name,         // your old code used 'theme' not 'name'
    isDark: name === 'dark',
    toggle: () => setTheme(name === 'light' ? 'dark' : 'light'),
    setTheme,
    isTransitioning,
  };
}
```

This lets you migrate incrementally — old components keep working while you
update them one by one to use the new API shape.
