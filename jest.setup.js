// Mocks the `react-native` core APIs consumed by `src/transitionEngine.tsx`.
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
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  Platform: {
    OS: 'ios',
    select: (obj) => (obj.ios !== undefined ? obj.ios : obj.default),
  },
  View: 'View',
  Image: 'Image',
}))

// Mocks every symbol imported from `react-native-reanimated` in the src tree.
// The current suite only covers config validation and never mounts the
// provider, so a partial mock would not fail it. Any test that renders
// `ThemeTransitionProvider` destructures these symbols at module load, so a
// missing export crashes before the first assertion runs. Keep this list in
// sync with the imports in `src/transitionEngine.tsx` and
// `src/overlay/SkiaOverlay.tsx`.
jest.mock('react-native-reanimated', () => {
  const noopEasing = () => 0
  const curriedEasing = () => noopEasing
  return {
    __esModule: true,
    default: { View: 'Animated.View' },
    useSharedValue: (initial) => ({ value: initial, set: jest.fn() }),
    useDerivedValue: (fn) => ({ value: fn() }),
    useAnimatedProps: (fn) => fn(),
    useAnimatedStyle: (fn) => fn(),
    withTiming: (_val, _config, cb) => cb,
    Easing: {
      linear: noopEasing,
      cubic: noopEasing,
      in: curriedEasing,
      out: curriedEasing,
      inOut: curriedEasing,
    },
  }
})

jest.mock('@shopify/react-native-skia', () => {
  const mockPath = () => ({
    // Immutable SkPath surface as of Skia 2.14: no moveTo/lineTo/cubicTo.
    countPoints: jest.fn(() => 0),
    isInterpolatable: jest.fn(() => true),
    interpolate: jest.fn(),
    dispose: jest.fn(),
  })
  const makeFromCmds = jest.fn((_cmds) => mockPath())
  return {
    Canvas: 'Canvas',
    Image: 'SkiaImage',
    Group: 'Group',
    Circle: 'Circle',
    Rect: 'Rect',
    Fill: 'Fill',
    Shader: 'Shader',
    ImageShader: 'ImageShader',
    PathVerb: { Move: 0, Line: 1, Quad: 2, Conic: 3, Cubic: 4, Close: 5 },
    interpolatePaths: jest.fn((_val, _input, outputRange) => outputRange[0]),
    usePathInterpolation: () => ({ value: mockPath() }),
    Skia: {
      Path: { MakeFromCmds: makeFromCmds },
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

// Re-exports the real React apart from pinning `createContext`. The engine's
// hooks run only at render time, and the current suite tests config validation
// at module load, so no hook mocks are needed.
jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    createContext: actual.createContext,
  }
})
