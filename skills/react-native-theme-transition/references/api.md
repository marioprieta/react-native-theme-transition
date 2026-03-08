# API Reference

## Table of contents

1. [createThemeTransition](#createthemetransitionconfig)
2. [ThemeTransitionProvider](#themetransitionprovider)
3. [useTheme](#usetheme)
4. [useTheme({ initialSelection })](#usetheme-initialselection-)
5. [setTheme](#setthemename-options)
6. [Callback ordering](#callback-ordering)
7. [Exported types](#exported-types)

---

## `createThemeTransition(config)`

Factory function. Validates configuration at initialization and returns a self-contained
`{ ThemeTransitionProvider, useTheme }` API. No singletons — multiple
theme scopes can coexist.

TypeScript infers theme names and color tokens from the `themes` object. No manual
generics needed.

### Config

```ts
interface ThemeTransitionConfig<T> {
  themes: T;                                    // required
  duration?: number;                            // default: 350
  systemThemeMap?: { light: Name, dark: Name }; // required for custom names + system
  onTransitionStart?: (name: Name) => void;     // animated only
  onTransitionEnd?: (name: Name) => void;       // animated only
  onThemeChange?: (name: Name) => void;         // all changes
}
```

### `themes`

Object of theme definitions keyed by name. Every theme must share the exact same
token keys. Mismatched keys throw at initialization.

```ts
const light = { bg: '#fff', text: '#000', primary: '#007AFF' };

// Type-safe enforcement of matching keys on secondary themes:
const dark: Record<keyof typeof light, string> = {
  bg: '#000', text: '#fff', primary: '#0A84FF',
};
```

Rules:
- At least one theme required
- `'system'` is reserved — cannot be a theme key
- Keys must be identical across all themes (order doesn't matter)

### `duration`

Cross-fade animation duration in milliseconds. Default `350`. Must be a non-negative
number.

### `systemThemeMap`

Maps OS appearance (`'light'` / `'dark'`) to your theme names. Required when themes
aren't named `'light'`/`'dark'` and you want system mode.

```ts
createThemeTransition({
  themes: { sunrise, midnight, ocean },
  systemThemeMap: { light: 'sunrise', dark: 'midnight' },
});
```

Both `light` and `dark` must be provided. Values must reference existing theme names.

### `onTransitionStart`

Called when an animated transition begins, before the screenshot capture.
Does NOT fire for instant switches (`animated: false`).
Fires for system-driven transitions too.

### `onTransitionEnd`

Called after an animated transition completes and the overlay is removed.
Does NOT fire for instant switches.
Does NOT fire if screenshot capture fails mid-transition (the library falls back to
instant switch and only `onThemeChange` fires).

### `onThemeChange`

Called whenever the active theme changes — animated, instant, or system-driven.
For animated transitions, fires after `onTransitionEnd`. This is the only callback
guaranteed to fire for every theme change.

---

## `ThemeTransitionProvider`

React component. Wraps your app tree and provides theme context.

```tsx
<ThemeTransitionProvider initialTheme="system">
  <App />
</ThemeTransitionProvider>
```

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `children` | `ReactNode` | yes | Your application tree |
| `initialTheme` | `ThemeName \| 'system'` | yes | Theme for the first frame |

### `initialTheme` behavior

- Read once in a lazy `useState` initializer — subsequent prop changes are ignored
- `'system'` reads OS appearance synchronously (zero flash) and subscribes to changes
- With custom names: requires `systemThemeMap` in config, otherwise throws
- An explicit theme name (e.g. `'dark'`) does not subscribe to OS changes

### Placement

Place as high as possible in the component tree — above navigation, above modals.
The screenshot captures everything inside the provider's root `View`. Content outside
won't be included in the transition.

```tsx
// Correct — navigation inside provider
<ThemeTransitionProvider initialTheme="system">
  <NavigationContainer>
    ...
  </NavigationContainer>
</ThemeTransitionProvider>

// Wrong — provider inside navigation, only captures current screen
<NavigationContainer>
  <ThemeTransitionProvider initialTheme="system">
    ...
  </ThemeTransitionProvider>
</NavigationContainer>
```

---

## `useTheme()`

Hook. Returns current theme state and controls. Throws if called outside a
`ThemeTransitionProvider`.

```ts
const { colors, name, setTheme, isTransitioning } = useTheme();
```

| Field | Type | Description |
|---|---|---|
| `colors` | `{ [token]: string }` | Current theme's color values, typed to your tokens |
| `name` | `ThemeName` | Active theme name (resolved, never `'system'`) |
| `setTheme` | `(name \| 'system', opts?) => boolean` | Trigger transition or enter system mode. Returns `true` if accepted, `false` if rejected (same theme or already transitioning). |
| `isTransitioning` | `boolean` | `true` while cross-fade overlay is visible |

### `colors`

Fully typed to your token names. TypeScript provides autocomplete:

```ts
colors.background  // ✅ autocomplete works
colors.foo         // ❌ TypeScript error
```

### `name`

Always the resolved theme name, never `'system'`. Even in system mode, `name` returns
the actual theme (`'light'` or `'dark'`, or whatever `systemThemeMap` resolves to).

### `isTransitioning`

`true` from after the screenshot is captured until the fade completes. Touch input
is blocked immediately when `setTheme` is called, regardless of this flag.
Use it to:
- Disable toggle buttons (`disabled={isTransitioning}`)
- Defer expensive renders
- Show loading indicators

---

## `useTheme({ initialSelection })`

Overloaded form of `useTheme`. Passing an options object activates selection tracking
with iOS-safe timing. Returns all base `useTheme()` fields plus `selected` and `select`.
Throws if called outside a `ThemeTransitionProvider`.

```ts
const { selected, select, colors, name, setTheme, isTransitioning } = useTheme({ initialSelection: 'system' });
```

| Field | Type | Description |
|---|---|---|
| `colors` | `{ [token]: string }` | Current theme's color values, typed to your tokens |
| `name` | `ThemeName` | Active theme name (resolved, never `'system'`) |
| `setTheme` | `(name \| 'system', opts?) => boolean` | Trigger transition or enter system mode |
| `isTransitioning` | `boolean` | `true` while cross-fade overlay is visible |
| `selected` | `ThemeName \| 'system'` | Currently selected option (may be `'system'`) |
| `select` | `(option: ThemeName \| 'system') => void` | Select a theme with safe timing |

### The `initialSelection` option

| Option | Type | Default | Description |
|---|---|---|---|
| `initialSelection` | `ThemeName \| 'system'` | current theme name | Starting value for `selected` (read once) |

`initialSelection` seeds the initial `selected` state. When omitted, defaults to the
current theme name from context. It is read once — subsequent changes to the argument
are ignored (same lazy-init pattern as `initialTheme`).

### How `select` works

On iOS 120Hz displays, calling `setSelected()` and `setTheme()` in the same event
handler doesn't give React enough time to paint the selection before the library
captures the screenshot. The cross-fade then blends both old and new selection
positions, causing visible flickering.

`select` solves this by:

1. Updating the selection state immediately (`setSelected`)
2. Deferring `setTheme` by one `requestAnimationFrame`
3. Using an internal press lock ref to prevent rapid presses during transitions

This guarantees the selection highlight is painted before the screenshot capture.

### Example

```tsx
function ThemePicker() {
  const { selected, select, colors, isTransitioning } = useTheme({ initialSelection: 'system' });
  const options = ['system', 'light', 'dark'] as const;

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

### Caveat: `selected` is local state

`selected` is managed locally inside the hook. If the theme changes externally — via a bridge
component calling `setTheme`, or a system appearance change — the context `name` updates but
`selected` does not. This means the picker UI can show a stale selection until the user
interacts with it again.

If you need the picker to stay in sync with external changes, use `name` for display and
`selected` only for the highlight state, or re-mount the picker when the theme changes
externally.

---

## `setTheme(name, options?)`

### Parameters

| Param | Type | Description |
|---|---|---|
| `name` | `ThemeName \| 'system'` | Target theme or system mode |
| `options` | `SetThemeOptions` | Optional transition configuration |

### Options

```ts
interface SetThemeOptions {
  animated?: boolean;                      // default: true
  onTransitionStart?: (name: Name) => void;
  onTransitionEnd?: (name: Name) => void;
}
```

| Option | Default | Description |
|---|---|---|
| `animated` | `true` | `false` → instant switch, no screenshot or animation |
| `onTransitionStart` | — | Fires after config-level callback, animated only |
| `onTransitionEnd` | — | Fires after config-level callback, animated only |

### Behavior rules

1. **Same theme** → returns `false` (if target equals current, nothing happens)
2. **During transition** → returns `false` (no queue, no error). System mode is **not** activated even if `'system'` was passed — retry after `isTransitioning` becomes `false`
3. **`'system'`** → enters system-following mode, subscribes to OS changes
4. **Explicit name** → exits system-following mode
5. **`animated: false`** → instant switch, only `onThemeChange` fires
6. **Capture failure** → falls back to instant switch, `onTransitionEnd` skipped

### System mode

When `setTheme('system')` is called:
1. Reads current OS appearance
2. Resolves to a theme name (via `systemThemeMap` or direct match)
3. Subscribes to OS appearance changes
4. Animated transitions on foreground changes, instant on background

Calling `setTheme('dark')` (or any explicit name) exits system mode.

---

## Callback ordering

### Animated transition

```
1. Touch blocking starts (shared value, instant)
2. Config onTransitionStart(name)
3. Per-call onTransitionStart(name)
4. Screenshot captured
5. Overlay mounted
6. Image onLoad (bitmap decoded)
7. Overlay paints (1 frame)
8. Colors switched underneath
9. React commits new theme (1 frame)
10. Fade animation starts (duration ms)
11. Transition guards reset, touch unblocked
12. Config onTransitionEnd(name)
13. Per-call onTransitionEnd(name)
14. Config onThemeChange(name)
15. Next render: isTransitioning → false, overlay unmounted
```

### Instant switch (`animated: false`)

```
1. Colors switched immediately
2. Config onThemeChange(name)
```

No `onTransitionStart`, no `onTransitionEnd`, no touch blocking, no screenshot.

### Capture failure during animated transition

```
1. Touch blocking starts              ← already active
2. Config onTransitionStart(name)     ← already fired
3. Per-call onTransitionStart(name)   ← already fired
4. Screenshot FAILS
5. Colors switched immediately (fallback)
6. Touch blocking ends
7. Config onThemeChange(name)
```

`onTransitionEnd` does NOT fire. Design `onTransitionStart` handlers to be resilient
to a missing matching `onTransitionEnd`.

### System-driven change (OS appearance changes)

Uses the same animated or instant paths above. In foreground: animated. In background
or returning to foreground: instant (`animated: false`).

---

## Exported types

```ts
import type {
  ThemeDefinition,       // Record<string, string> — single theme shape
  ThemeTransitionConfig, // Config for createThemeTransition
  ThemeTransitionAPI,    // Return type: { ThemeTransitionProvider, useTheme }
  UseThemeResult,        // Return type of useTheme()
  ThemeSelectionResult,  // Selection fields from useTheme({ initialSelection })
  SystemThemeMap,        // { light: ThemeName, dark: ThemeName }
  SetThemeOptions,       // Options for setTheme()
  ThemeNames,            // Union of theme name strings (keyof themes & string)
  TokenNames,            // Union of token name strings (keyof theme values & string)
} from 'react-native-theme-transition';
```

### Type inference examples

```ts
const light = { bg: '#fff', text: '#000' };
const dark  = { bg: '#000', text: '#fff' };

const api = createThemeTransition({ themes: { light, dark } });

// In any component:
const { colors, name, setTheme } = api.useTheme();

colors.bg         // type: string, autocomplete: 'bg' | 'text'
colors.foo        // ❌ TypeScript error
name              // type: 'light' | 'dark'
setTheme('dark')  // ✅
setTheme('ocean') // ❌ TypeScript error
setTheme('system')// ✅ always valid
```
