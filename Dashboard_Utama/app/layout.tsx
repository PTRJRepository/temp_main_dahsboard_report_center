import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PT Rebinmas Jaya - Perkebunan Kelapa Sawit Berkelanjutan",
  description: "PT Rebinmas Jaya adalah perusahaan perkebunan kelapa sawit yang berkomitmen menghadirkan produk berkualitas tinggi dengan standar operasional terbaik dan kepedulian terhadap masyarakat sekitar di Belitung, Bangka Belitung.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
