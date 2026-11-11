import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Postventa Agéntica · Consola del asesor",
  description:
    "Consola del asesor de servicio: el agente de postventa atiende por WhatsApp y le pasa a usted los casos que necesitan una persona.",
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
