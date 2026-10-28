import type { Metadata, Viewport } from "next";
import { Caveat, IBM_Plex_Mono, Manrope, Montserrat } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "cyrillic"] });
// Form headings, typed fields and handwritten notes for the case-file look.
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin", "cyrillic"], weight: ["600", "700", "800"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin", "cyrillic"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "MyKoll",
  description: "MyKoll: a Telegram bot that keeps receipts on your group chat's crypto and CS2 calls.",
};

export const viewport: Viewport = {
  themeColor: "#0b0e15",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${montserrat.variable} ${plexMono.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
