"use client";

import "./globals.css";
import type { ReactNode } from "react";

const fontClass = "font-inter";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className={fontClass}>
      <body>{children}</body>
    </html>
  );
}
