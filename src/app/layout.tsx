import type { Metadata } from "next";
import {
  Caveat,
  Geist,
  Geist_Mono,
  Instrument_Serif,
  Inter,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mymo - AI UGC Video Ad Generator | Create Scroll-Stopping Ads",
  description:
    "Create AI-generated UGC video ads in minutes. Browse templates, customize with your product, and generate realistic creator-style ads that convert.",
  keywords: [
    "ai ugc generator",
    "ai ugc video generator",
    "ugc ad creator",
    "ai video ads",
    "ugc ads maker",
    "ai ugc tool",
    "tiktok ad creator",
    "instagram reels ads",
  ],
  openGraph: {
    title: "Mymo - AI UGC Video Ad Generator | Create Scroll-Stopping Ads",
    description:
      "Create AI-generated UGC video ads in minutes. Browse templates, customize with your product, and generate realistic creator-style ads that convert.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700&f[]=gambarino@400&display=swap"
        />
        <link rel="icon" href="/logo.jpeg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${instrumentSerif.variable} ${caveat.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
