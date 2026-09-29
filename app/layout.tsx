import type { Metadata, Viewport } from "next";
import { Manrope, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Cretek Group — Invoicing",
  description: "Invoices, quotations and statements.",
  applicationName: "HSM",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "HSM",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e2a47",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${plexSans.variable} ${plexMono.variable} antialiased`}>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
