# How it works

## Sequence diagram

```mermaid
sequenceDiagram
    participant User
    participant Hook as setTheme()
    participant Shot as ViewShot
    participant React as React Tree
    participant UI as UI Thread

    User->>Hook: setTheme('dark')
    Hook->>UI: Block touches (shared value → pointerEvents)
    Hook->>Shot: Wait 1 frame, capture screen
    Shot-->>Hook: Return image URI
    Hook->>UI: Mount opaque overlay (screenshot)
    Note over Hook,UI: 1 frame — overlay paints on screen
    Hook->>React: Update color tokens
    React-->>React: Re-render with new theme (~3 frames)
    Hook->>UI: Fade overlay out (350ms via Reanimated)
    UI-->>Hook: Animation complete (worklet callback)
    Hook->>UI: Unblock touches, remove overlay
    UI-->>User: Smooth cross-fade complete
```

## Step by step

1. `setTheme('dark')` is called
2. Touches blocked instantly via a Reanimated shared value (no React re-render needed)
3. One frame wait for pending renders to commit
4. Full-screen screenshot captured via `react-native-view-shot`
5. Screenshot displayed as an opaque overlay
6. One frame wait for the overlay to paint on the native UI thread
7. Color tokens switched underneath
8. Three more frames for React to re-render with new colors
9. Overlay fades out on the UI thread via `react-native-reanimated`
10. Touches unblocked and overlay removed once the fade completes via a worklet callback (`react-native-worklets`)

The screenshot is captured **before** the color switch, so the overlay looks identical to the current screen. When it fades, it reveals the fully re-rendered new theme. No partial states, no flashes.
