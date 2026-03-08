'use client';

import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';
import {
  AnimatedSidebarFolder,
  AnimatedSidebarItem,
  AnimatedSidebarSeparator,
  SidebarHoverProvider,
} from '@/components/sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarHoverProvider>
      <DocsLayout
        tree={source.getPageTree()}
        {...baseOptions}
        sidebar={{
          components: {
            Item: AnimatedSidebarItem,
            Separator: AnimatedSidebarSeparator,
            Folder: AnimatedSidebarFolder,
          },
        }}
      >
        {children}
      </DocsLayout>
    </SidebarHoverProvider>
  );
}
