import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-barn-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-barn-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BarnBook",
  description: "Horse identification and management for the barn",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-barn-dark text-parchment font-sans">
        {children}
      </body>
    </html>
  );
}
