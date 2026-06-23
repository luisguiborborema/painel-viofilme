import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Painel Viofilme",
  description:
    "Painel da Viofilme — acompanhe campanhas, conteúdo e resultados de Instagram e Facebook.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
