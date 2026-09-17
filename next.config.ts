import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // Campanhas foi absorvida pela Gestão à Vista. A página fazia isto com
        // `redirect()` de dentro do componente, que em contexto de streaming
        // vira uma meta tag executada pelo navegador: a resposta saía 200 com
        // corpo vazio e só redirecionava com JS ligado. No roteador, é um 308
        // de verdade — vale para favorito, link colado e crawler.
        source: "/gerencial/campanhas",
        destination: "/gerencial/gestao-a-vista",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Service worker sempre atualizado (sem cache) e com o MIME certo.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
