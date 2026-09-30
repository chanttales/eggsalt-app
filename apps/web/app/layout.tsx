import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth-gate";
import { ToastProvider } from "@/components/toast";
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
  title: "EggSalt",
  description: "EggSalt: pesanan, stok, dan uang usaha telur asin dalam satu aplikasi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2051e5",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="font-sans">
        <SessionProvider>
          <ToastProvider>
            <DataProvider>
              <AuthGate>{children}</AuthGate>
            </DataProvider>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
