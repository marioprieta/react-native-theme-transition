# Contributing to react-native-theme-transition

Thanks for your interest in contributing! Here's how to get started.

## Getting started

1. Fork the repository
2. Clone your fork and install dependencies:
   ```bash
   git clone https://github.com/<your-username>/react-native-theme-transition.git
   cd react-native-theme-transition
   npm install
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feat/my-feature
   ```

## Development

The library source lives in `src/`. To build:

```bash
npm run build
```

### Testing locally

> **Note:** `npm link` does not work with Metro (it doesn't follow symlinks). Use one of these approaches instead:

**Option A — Local path (simplest):**

In your test project's `package.json`:

```json
{
  "dependencies": {
    "react-native-theme-transition": "file:../path-to/react-native-theme-transition"
  }
}
```

Then run `npm install` and restart Metro with cache cleared: `npx expo start -c`.

**Option B — yalc (recommended for frequent iteration):**

```bash
# Install yalc globally
npm i -g yalc

# In this repo — publish locally
yalc publish

# In your test project — add local version
yalc add react-native-theme-transition
npx expo start -c
```

After making changes, run `yalc push` to update all linked projects automatically.

## Pull requests

- Open an issue first to discuss non-trivial changes
- Keep PRs focused — one feature or fix per PR
- Ensure TypeScript compiles without errors (`npm run build`)
- Test on both iOS and Android when possible
- Fill out the PR template

## Commit messages

Use clear, descriptive commit messages:

```
fix: prevent double transition when setTheme called rapidly
feat: add onTransitionStart callback
docs: clarify useSystemTheme mapping parameter
```

## Code style

- TypeScript strict mode
- No default exports
- Prefer explicit types over `any`

## Reporting bugs

Use the [bug report template](https://github.com/marioprieta/react-native-theme-transition/issues/new?template=bug_report.yml) and include:

- Library version
- React Native / Expo version
- Platform (iOS/Android)
- Minimal reproduction steps

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
