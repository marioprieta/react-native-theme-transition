import Image from 'next/image';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="flex items-center gap-2">
        <Image
          src="/logo.png"
          alt="React Native Theme Transition"
          width={42}
          height={28}
          className="h-7 w-auto object-contain"
          priority
        />
        <span>React Native Theme Transition</span>
      </span>
    ),
  },
  links: [
    {
      type: 'icon',
      text: 'npm',
      label: 'npm',
      url: 'https://www.npmjs.com/package/react-native-theme-transition',
      icon: (
        <svg role="img" aria-label="npm" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
        </svg>
      ),
      external: true,
    },
  ],
  githubUrl: 'https://github.com/marioprieta/react-native-theme-transition',
};
