import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative flex flex-col items-center justify-center flex-1 px-4 py-16 gap-12">
      {/* Subtle accent gradient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 20%, rgba(0,122,255,0.06) 0%, transparent 50%)',
        }}
      />

      <section className="relative z-10 flex flex-col items-center gap-10 max-w-2xl text-center">
        {/* Title */}
        <div className="flex flex-col items-center gap-5">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            React Native Theme Transition
          </h1>
          <p className="text-lg text-fd-muted-foreground max-w-lg">
            Smooth, animated theme transitions for React Native. Expo Go
            compatible, 100% JS, powered by Reanimated.
          </p>
        </div>

        {/* Install snippet */}
        <div className="w-full max-w-md">
          <pre className="rounded-xl border border-fd-border bg-fd-card px-5 py-4 text-sm font-mono text-left overflow-x-auto">
            <span className="text-fd-muted-foreground select-none">$ </span>
            <span>npx expo install react-native-theme-transition react-native-worklets</span>
          </pre>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            'Cross-fade transitions',
            'Expo Go compatible',
            'System theme sync',
            'TypeScript generics',
            'React Compiler ready',
            '~13 kB',
          ].map((feature) => (
            <span
              key={feature}
              className="inline-flex items-center rounded-full border border-fd-border px-3 py-1.5 text-sm text-fd-muted-foreground"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-row gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-full bg-fd-primary px-7 py-3 text-base font-medium text-fd-primary-foreground hover:bg-fd-primary/90 transition-colors"
          >
            Documentation
          </Link>
          <a
            href="https://github.com/marioprieta/react-native-theme-transition"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-fd-border px-7 py-3 text-base font-medium hover:bg-fd-accent transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-label="GitHub"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </section>
    </main>
  );
}
