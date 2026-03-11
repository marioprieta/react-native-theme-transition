// Mock react-native core APIs used by transitionEngine.tsx
jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    setColorScheme: jest.fn(),
    addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  View: 'View',
  Image: 'Image',
}))

// Mock reanimated — only useSharedValue and withTiming are used in the state machine
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  useSharedValue: (initial) => ({ value: initial, set: jest.fn() }),
  useAnimatedProps: (fn) => fn(),
  withTiming: (_val, _config, cb) => cb,
}))

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(() => Promise.resolve('file:///mock.jpg')),
}))

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn) => fn(),
}))

// Mock react hooks that transitionEngine uses — we test through createThemeTransition
// which calls createProviderAndContext (module-level), but the hooks are only invoked
// at render time. Since we're testing config validation (no rendering), these are fine.
jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    createContext: actual.createContext,
  }
})
