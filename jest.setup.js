// Mock react-native core APIs used by transitionEngine.tsx
jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    setColorScheme: jest.fn(),
    addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  View: 'View',
  Image: 'Image',
}))

// Mock reanimated — only useSharedValue and withTiming are used in the state machine
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  useSharedValue: (initial) => ({ value: initial, set: jest.fn() }),
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedProps: (fn) => fn(),
  withTiming: (_val, _config, cb) => cb,
}))

jest.mock('@shopify/react-native-skia', () => {
  const mockPath = () => ({
    addCircle: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    cubicTo: jest.fn(),
    close: jest.fn(),
  })
  return {
    Canvas: 'Canvas',
    Image: 'SkiaImage',
    Group: 'Group',
    Circle: 'Circle',
    Rect: 'Rect',
    Fill: 'Fill',
    Shader: 'Shader',
    ImageShader: 'ImageShader',
    usePathInterpolation: () => ({ value: mockPath() }),
    Skia: {
      Path: { Make: mockPath },
      RuntimeEffect: { Make: jest.fn(() => ({})) },
    },
    makeImageFromView: jest.fn(() => {
      const mockCpuImage = {
        dispose: jest.fn(),
        encodeToBase64: () => 'mockBase64',
        width: () => 390,
        height: () => 844,
      }
      const mockGpuImage = { makeNonTextureImage: () => mockCpuImage, dispose: jest.fn() }
      return Promise.resolve(mockGpuImage)
    }),
  }
})

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
