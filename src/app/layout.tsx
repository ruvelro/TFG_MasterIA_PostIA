import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PostIA — Generador de artículos con IA",
  description:
    "Genera artículos de blog con un pipeline de IA multi-etapa: research, esquema, redacción, validación y SEO.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `lang="es"` porque la interfaz y el contenido por defecto están en español.
  // `suppressHydrationWarning` en <html>: extensiones del navegador (p. ej. LanguageTool)
  // inyectan atributos como `data-lt-installed` antes de hidratar; sin esto, React avisaría
  // de un desajuste de hidratación ajeno a nuestro código.
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">{children}</body>
    </html>
  );
}
