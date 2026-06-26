import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";

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

// Aplica o tema antes do primeiro paint (evita flash).
// Preferência: 'light' | 'dark' | 'system'. Padrão: 'system' (segue o SO).
const themeScript = `(function(){try{var t=localStorage.getItem('vio-theme');var sd=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||((t==='system'||!t)&&sd)){document.documentElement.classList.add('theme-dark');}}catch(e){document.documentElement.classList.add('theme-dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${barlow.variable} min-h-screen antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
