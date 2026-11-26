import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "إدارة جذرة",
  description: "لوحة إدارة جذرة: المحادثات وحجوزات الرش",
  applicationName: "إدارة جذرة",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "إدارة جذرة",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/app-192.png",
    apple: "/icons/apple-touch-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b2e1f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Script src="/pwa-register.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}