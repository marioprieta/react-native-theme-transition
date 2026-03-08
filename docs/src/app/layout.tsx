import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './global.css';

export const metadata: Metadata = {
  title: {
    default: 'React Native Theme Transition',
    template: '%s | React Native Theme Transition',
  },
  description:
    'Smooth, animated theme transitions for React Native. Expo Go compatible, 100% JS, powered by Reanimated.',
};

const inter = Inter({ subsets: ['latin'] });

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
