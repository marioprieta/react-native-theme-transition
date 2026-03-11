---
"react-native-theme-transition": patch
---

Fix three engine bugs in the transition state machine:

- Clear deferred system restore when exiting system mode, preventing stale color scheme restoration
- Lift explicit Appearance override when entering system mode during an active transition
- Always return `true` from `setTheme('system')` when entering system mode from a different theme
