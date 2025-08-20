import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '小朋友知識卡片',
  description: 'GLM 卡片/海報生成器',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
