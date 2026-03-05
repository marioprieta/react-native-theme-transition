export type ThemeDefinition = Record<string, string>;

export type ThemeNames<T extends Record<string, ThemeDefinition>> =
  keyof T & string;

export type TokenNames<T extends Record<string, ThemeDefinition>> =
  keyof T[ThemeNames<T>] & string;

export interface AnimatedThemeConfig<T extends Record<string, ThemeDefinition>> {
  themes: T;
  defaultTheme: ThemeNames<T>;
  /** Fade duration in ms. Default: 350 */
  duration?: number;
  /** Called when a transition finishes. */
  onTransitionEnd?: (themeName: string) => void;
}

export interface SetThemeOptions {
  /** Called after the screenshot overlay is visible. */
  onCaptured?: () => void;
}

/** @internal */
export interface AnimatedThemeContextValue<
  Tokens extends string,
  Names extends string,
> {
  colors: Record<Tokens, string>;
  name: Names;
  setTheme: (name: Names, options?: SetThemeOptions) => void;
  isTransitioning: boolean;
}

export interface AnimatedThemeAPI<T extends Record<string, ThemeDefinition>> {
  AnimatedThemeProvider: React.FC<{
    children: React.ReactNode;
    initialTheme?: ThemeNames<T>;
  }>;
  useTheme: () => {
    colors: { [K in TokenNames<T>]: string };
    name: ThemeNames<T>;
    setTheme: (name: ThemeNames<T>, options?: SetThemeOptions) => void;
    isTransitioning: boolean;
  };
  useSystemTheme: (
    enabled?: boolean,
    mapping?: Partial<Record<'light' | 'dark', ThemeNames<T>>>,
  ) => void;
}
