*** Begin Patch
*** Update File: tailwind.config.js
 module.exports = {
-  content: [],
+  content: [
+    './app/**/*.{js,ts,jsx,tsx}',
+    './components/**/*.{js,ts,jsx,tsx}',
+  ],
   theme: { extend: {} },
   plugins: [],
 }
*** End Patch
