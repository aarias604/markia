import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CookieNotice } from "@/components/legal/CookieNotice";
import { RefCapture } from "@/components/legal/RefCapture";

export const metadata: Metadata = {
  title: "Markia · Tu marca en redes, en piloto automático",
  description: "Crea, diseña y programa publicaciones para Instagram con inteligencia artificial.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        {children}
        <CookieNotice />
        <RefCapture />
      </body>
    </html>
  );
}
