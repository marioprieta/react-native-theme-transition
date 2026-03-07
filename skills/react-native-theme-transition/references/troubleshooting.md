# Troubleshooting

Common issues, causes, and solutions.

## Table of contents

1. [Overlay stays visible / app seems frozen](#overlay-stays-visible--app-seems-frozen)
2. [Flash on theme change (no animation)](#flash-on-theme-change-no-animation)
3. [System theme not following OS](#system-theme-not-following-os)
4. [Type errors on colors](#type-errors-on-colors)
5. [Error: themes must contain at least one theme](#error-themes-must-contain-at-least-one-theme)
6. [Error: system is a reserved name](#error-system-is-a-reserved-name)
7. [Error: different token keys](#error-different-token-keys)
8. [Error: systemThemeMap maps to non-existent theme](#error-systemthememap-maps-to-non-existent-theme)
9. [Error: initialTheme resolved to non-existent theme](#error-initialtheme-resolved-to-non-existent-theme)
10. [Error: setTheme('system') resolved to non-existent theme](#error-setthemesystem-resolved-to-non-existent-theme)
11. [Error: useTheme must be used inside a ThemeTransitionProvider](#error-usetheme-must-be-used-inside-a-themetransitionprovider)
12. [Theme changes but no animation plays](#theme-changes-but-no-animation-plays)
13. [setTheme does nothing](#settheme-does-nothing)
14. [Double transition on app start](#double-transition-on-app-start)
15. [Android: capture returns blank or wrong content](#android-capture-returns-blank-or-wrong-content)

---

## Overlay stays visible / app seems frozen

**Symptom:** The screen appears frozen — touches don't work, the UI is stuck showing
the old theme.

**Cause:** The transition state failed to clean up. Most likely `captureRef` threw
and the error wasn't caught, or the component unmounted mid-transition.

**Check:**
- Look for `[react-native-theme-transition] Failed to capture screenshot` in the
  console. If present, the library fell back to instant switch — the overlay should
  have been removed. If it wasn't, check for race conditions with unmounting.
- Verify `react-native-view-shot` is properly installed. Run `npx expo doctor`
  or check native linking.
- Ensure the root `View` inside the provider has `collapsable={false}` (set
  internally — if you've forked the library, verify this).

---

## Flash on theme change (no animation)

**Symptom:** Theme changes instantly with a visible flash instead of a smooth
cross-fade.

**Causes:**

1. **`animated: false`** — Check if you're passing `{ animated: false }` in options.

2. **Provider placement** — If `ThemeTransitionProvider` doesn't wrap the full
   visible tree, the screenshot only captures part of the screen. The transition
   still runs but looks broken.

3. **`react-native-view-shot` not installed** — `captureRef` throws, the library
   falls back to instant switch. Check console for the warning message.

4. **Missing worklets plugin** — `react-native-worklets/plugin` must be the last
   plugin in `babel.config.js`. Without it, the `withTiming` callback can't
   bridge back to the JS thread.

**Fix:** Verify the provider wraps everything (above navigation), all peer
dependencies are installed, and babel is configured correctly. Restart with
cache clear: `npx expo start -c`.

---

## System theme not following OS

**Symptom:** Changing OS appearance (Settings → Dark Mode) doesn't update the app.

**Causes:**

1. **System mode not activated** — Verify you passed `initialTheme="system"` or
   called `setTheme('system')`.

2. **Manual setTheme overrides** — Calling `setTheme('dark')` exits system mode.
   Any subsequent OS changes are ignored until `setTheme('system')` is called again.

3. **Missing `systemThemeMap`** — If themes aren't named `'light'`/`'dark'`, the
   library can't map OS appearance to your themes. Provide `systemThemeMap` in
   the config.

4. **iOS Simulator** — Toggle in Settings → Developer → Appearance, or use
   `Cmd+Shift+A` in the simulator.

---

## Type errors on colors

**Symptom:** `Property 'myToken' does not exist on type '{ ... }'`

**Cause:** The token doesn't exist in your theme definition, or your theme
definitions have mismatched keys.

**Fix:** Ensure all themes share identical keys. Use `Record<keyof typeof light, string>`
on secondary themes:

```ts
const light = { bg: '#fff', text: '#000' };
const dark: Record<keyof typeof light, string> = { bg: '#000', text: '#fff' };
```

---

## Error: themes must contain at least one theme

Pass at least one theme to `createThemeTransition`:

```ts
createThemeTransition({ themes: { light: { bg: '#fff' } } });
```

---

## Error: system is a reserved name

You have a theme named `'system'`. Rename it:

```ts
// Wrong:
themes: { system: { ... }, dark: { ... } }

// Right:
themes: { light: { ... }, dark: { ... } }
```

---

## Error: different token keys

Theme `"dark"` has different keys than `"light"`. Check for typos or missing
tokens. All themes must have the exact same keys.

---

## Error: systemThemeMap maps to non-existent theme

Your `systemThemeMap` references a theme name that doesn't exist in `themes`.
Check for typos:

```ts
// Wrong — 'midnght' is a typo:
systemThemeMap: { light: 'sunrise', dark: 'midnght' }

// Right:
systemThemeMap: { light: 'sunrise', dark: 'midnight' }
```

---

## Error: initialTheme resolved to non-existent theme

`initialTheme="system"` resolved to `'light'` or `'dark'` (from the OS), but no
theme with that name exists. Provide `systemThemeMap`:

```ts
createThemeTransition({
  themes: { sunrise, midnight },
  systemThemeMap: { light: 'sunrise', dark: 'midnight' },
});
```

---

## Error: setTheme('system') resolved to non-existent theme

Same as above but at runtime. Add `systemThemeMap` to your config.

---

## Error: useTheme must be used inside a ThemeTransitionProvider

You're calling `useTheme()` in a component that isn't a descendant of
`ThemeTransitionProvider`. Common causes:

- The provider is missing from the root layout
- The component renders outside the provider tree (e.g., in an error boundary
  above the provider, or in a separate React root)
- Import path mismatch — make sure you import `useTheme` from your theme file,
  not directly from `react-native-theme-transition`

---

## Theme changes but no animation plays

**Symptom:** Colors update correctly but there's no cross-fade effect.

**Causes:**

1. **`duration: 0`** — The animation is instant. Set a positive duration.
2. **`animated: false` in options** — Check all `setTheme` call sites.
3. **System-driven change in background** — Background changes use instant switch
   by design (no visible animation when the app isn't visible).
4. **Bridge calling setTheme on mount** — If the bridge fires an instant `useEffect`
   on first render and the theme is different from `initialTheme`, you get an
   immediate switch. This is normal behavior on first load.

---

## setTheme does nothing

**Symptom:** Calling `setTheme` has no visible effect.

**Causes:**

1. **Same theme** — `setTheme('dark')` when already on `'dark'` is a no-op.
2. **During transition** — `setTheme` during an ongoing transition is silently
   ignored. Wait for `isTransitioning` to become `false`.
3. **System mode dedup** — `setTheme('system')` when the OS-resolved theme matches
   the current theme activates system mode but doesn't trigger a visual change.

---

## Double transition on app start

**Symptom:** The app starts with one theme, then immediately transitions to another.

**Cause:** `initialTheme` resolves to one theme (e.g., `'system'` → `'light'`), then
a bridge component fires `setTheme` with a different stored preference (e.g., `'dark'`),
triggering an animated transition.

**Fixes:**

1. **Pass the stored preference as `initialTheme`:**
   ```tsx
   const colorMode = useThemeStore((s) => s.colorMode);
   <ThemeTransitionProvider initialTheme={colorMode}>
   ```

2. **Use instant switch in bridge for first render:**
   ```tsx
   const isFirstRender = useRef(true);
   useEffect(() => {
     setTheme(colorMode, { animated: !isFirstRender.current });
     isFirstRender.current = false;
   }, [colorMode, setTheme]);
   ```

---

## Android: capture returns blank or wrong content

**Symptom:** The screenshot is blank or shows the wrong content on Android.

**Causes:**

1. **`collapsable` not set** — The root View needs `collapsable={false}` to prevent
   Android from flattening it. The library sets this internally, but if you've
   forked or modified the provider, verify it's there.

2. **Hardware acceleration issues** — Some Android devices have issues with
   `react-native-view-shot`. The library uses `format: 'jpg'` with `quality: 0.8`
   for faster captures. If captures fail, the library falls back to an instant
   theme switch automatically.

3. **View not fully rendered** — If the capture happens before the view is laid out,
   it returns blank. The library waits 1 frame before capture to prevent this.
