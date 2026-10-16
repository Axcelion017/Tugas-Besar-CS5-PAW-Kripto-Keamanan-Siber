import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Resilio-Health | Hospital Information System",
  description:
    "Web-based Hospital Information System dengan Cryptographic Offline-First Resilience dan Zero-Trust Patient Data Sovereignty.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${montserrat.className} antialiased bg-[#F8FAFC] text-neutral-800`}>
        {children}
      </body>
    </html>
  );
}