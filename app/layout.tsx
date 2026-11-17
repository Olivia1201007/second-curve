import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
export const metadata: Metadata = {
  title: 'SECOND CURVE｜第二曲线AI',
  description: '面向35—55岁求职者的再就业助手，帮助整理经历、准备求职材料和规划下一步。',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
