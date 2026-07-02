import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { PwaProvider } from "@/components/pwa/pwa-provider";

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
  applicationName: "Painel Viofilme",
  appleWebApp: {
    capable: true,
    title: "Viofilme",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2a63c9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
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
        <ThemeProvider>
          {children}
          <PwaProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
