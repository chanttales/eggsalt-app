import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth-gate";
import { DataProvider } from "@/lib/data";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

// Bundled from npm rather than fetched from Google Fonts, so builds don't depend on that download.
const jakarta = localFont({
  src: "../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Papan",
  description: "Papan usaha: pesanan, stok dan uang dalam satu alur.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1412" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="font-sans">
        <SessionProvider>
          <DataProvider>
            <AuthGate>{children}</AuthGate>
          </DataProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
