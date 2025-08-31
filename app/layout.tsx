*** Begin Patch
*** Update File: app/layout.tsx
+import './globals.css';
+
 export const metadata = {
   title: '小朋友知識卡片',
   description: '用自然語言學新知，創建有趣學習卡片！',
 };
 
 export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
     <html lang="zh-Hant">
-      <body>{children}</body>
+      <body>{children}</body>
     </html>
   );
 }
*** End Patch
