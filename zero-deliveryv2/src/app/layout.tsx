import type { Metadata } from "next";
import "./globals.css";
import { ES_PE } from "@/shared/i18n/es-PE";

export const metadata: Metadata = {
  title: `${ES_PE.app.name} — ${ES_PE.app.tagline}`,
  description: ES_PE.app.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-PE">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
