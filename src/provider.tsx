import { createContext, useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import type {
  AnimatedThemeConfig,
  AnimatedThemeContextValue,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from './types';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
const ROOT_STYLE = { flex: 1 } as const;

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = n;
    const tick = () => {
      if (--remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** @internal */
export function createProviderAndContext<
  T extends Record<string, ThemeDefinition>,
>(config: AnimatedThemeConfig<T>) {
  const { themes, defaultTheme, duration = 350, onTransitionEnd } = config;

  type Names = ThemeNames<T>;
  type Tokens = TokenNames<T>;

  const Context = createContext<AnimatedThemeContextValue<Tokens, Names> | null>(null);

  function AnimatedThemeProvider({
    children,
    initialTheme,
  }: {
    children: React.ReactNode;
    initialTheme?: Names;
  }) {
    const startTheme = initialTheme ?? defaultTheme;

    const [resolved, setResolved] = useState(() => ({
      colors: { ...themes[startTheme] } as Record<Tokens, string>,
      name: startTheme,
    }));

    const targetRef = useRef(startTheme);
    const rootRef = useRef<View>(null);
    const transitioningRef = useRef(false);
    const mountedRef = useRef(true);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const blockGesture = Gesture.Pan();

    const [overlayUri, setOverlayUri] = useState<string | null>(null);
    const overlayOpacity = useSharedValue(0);
    const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.get() }));

    useEffect(() => {
      return () => {
        mountedRef.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);

    async function transition(name: Names, onCaptured?: () => void) {
      try {
        await waitFrames(1);
        if (!mountedRef.current) return;

        const uri = await captureRef(rootRef, { format: 'png', quality: 0.9 });
        if (!mountedRef.current) return;

        overlayOpacity.set(1);
        setOverlayUri(uri);
        onCaptured?.();
        setResolved({ colors: { ...themes[name] } as Record<Tokens, string>, name });

        await waitFrames(2);
        if (!mountedRef.current) return;

        overlayOpacity.set(withTiming(0, { duration }));
        timeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setOverlayUri(null);
          transitioningRef.current = false;
    
          setIsTransitioning(false);
          onTransitionEnd?.(name);
        }, duration);
      } catch {
        if (!mountedRef.current) return;
        setResolved({ colors: { ...themes[name] } as Record<Tokens, string>, name });
        onCaptured?.();
        transitioningRef.current = false;
  
        setIsTransitioning(false);
      }
    }

    function setTheme(name: Names, options?: { onCaptured?: () => void }) {
      if (name === targetRef.current) {
        options?.onCaptured?.();
        return;
      }
      if (transitioningRef.current) return;

      targetRef.current = name;
      transitioningRef.current = true;

      setIsTransitioning(true);
      transition(name, options?.onCaptured);
    }

    const value = { colors: resolved.colors, name: resolved.name, setTheme, isTransitioning };

    return (
      <Context.Provider value={value}>
        <View ref={rootRef} style={ROOT_STYLE} collapsable={false}>
          {children}
          <GestureDetector gesture={blockGesture}>
            <View style={FILL} pointerEvents={isTransitioning ? 'auto' : 'none'} />
          </GestureDetector>
          {overlayUri != null ? (
            <Animated.View style={[FILL, overlayStyle]} pointerEvents="none">
              <Image source={{ uri: overlayUri }} style={FILL} resizeMode="cover" />
            </Animated.View>
          ) : null}
        </View>
      </Context.Provider>
    );
  }

  return { Context, AnimatedThemeProvider };
}
