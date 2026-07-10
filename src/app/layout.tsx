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

// La CSP con nonce por petición (ver `proxy.ts`) solo funciona con render DINÁMICO: Next
// inyecta el nonce en sus scripts durante el SSR a partir de la cabecera de la petición, y
// una página estática se genera en build (sin petición, sin nonce) → con `strict-dynamic`
// el navegador bloquearía todos sus scripts y no habría hidratación. Forzarlo en el layout
// raíz cubre todas las rutas; las de `(app)` ya eran dinámicas por usar la sesión, así que el
// coste real recae solo en login/registro/landing, irrelevante para esta app.
export const dynamic = "force-dynamic";

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
