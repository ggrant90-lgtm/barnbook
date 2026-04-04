import type { Metadata } from "next";
import { Fraunces, Instrument_Serif } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-barn-serif",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-barn-quote",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "BarnBook — Every horse. Every professional. One book.",
  description:
    "Every horse. Every professional. One book. BarnBook puts your horse's full history at your team's fingertips — trainers, vets, farriers, and grooms, all on the same record.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
