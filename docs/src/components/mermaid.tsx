'use client';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';

let mermaidPromise: Promise<typeof import('mermaid')> | undefined;

export function Mermaid({
  chart,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !ref.current) return;

    mermaidPromise ??= import('mermaid');
    void mermaidPromise.then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        fontFamily: 'inherit',
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      });

      const { svg } = await mermaid.render(`mermaid-${Date.now()}`, chart);
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [chart, mounted, resolvedTheme]);

  if (!mounted) return null;
  return <div ref={ref} className="my-6 flex justify-center" {...rest} />;
}
