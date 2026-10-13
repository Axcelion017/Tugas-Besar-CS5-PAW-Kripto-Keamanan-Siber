import type { Metadata } from "next";
import "./globals.css";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[#F8FAFC] text-neutral-800">
        {children}
      </body>
    </html>
  );
}