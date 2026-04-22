---
"react-native-theme-transition": patch
---

Documentation-only release. Two fixes:

- **Hero demo GIF URL.** Switched from GitHub's `user-attachments` CDN to `raw.githubusercontent.com`. The former requires authentication and returned 404 to npm's image proxy, so the demo was invisible on the npm package page.
- **Minimum Expo SDK clarified to 55+.** Earlier docs listed SDK 54+, but Expo Go on SDK 54 bundles older Skia and Reanimated native modules that are incompatible with v2 at runtime (tested: freeze on Android, silent instant swap on iOS). Upgrade with `npx expo install expo@latest --fix` before installing the library.
