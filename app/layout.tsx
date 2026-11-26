import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { PwaRegistrar } from "@/components/shared/PwaRegistrar";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JagaMedis | Hospital Information System",
  description:
    "Web-based Hospital Information System dengan Cryptographic Offline-First Resilience dan Zero-Trust Patient Data Sovereignty.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${montserrat.className} antialiased bg-[#F8FAFC] text-neutral-800`}>
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
