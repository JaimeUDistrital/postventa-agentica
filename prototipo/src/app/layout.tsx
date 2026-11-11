import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Postventa Agéntica · Rayos X",
  description: "Prototipo de postventa automotriz con agente de IA visible, guardrails y handoff humano.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
