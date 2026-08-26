"use client";

import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { PlaybookFormat } from "@/lib/data/playbooks";

/**
 * Renderiza um playbook (Markdown ou HTML) já sanitizado.
 *
 * A sanitização só acontece no navegador: sem `window`, o export padrão do
 * DOMPurify é a FÁBRICA (`createDOMPurify(window)`), não a instância — chamar
 * `.sanitize` ali estoura `is not a function` e derruba a renderização.
 *
 * Por isso o primeiro render (servidor e hidratação) sai vazio e o conteúdo
 * entra depois que o componente monta. É o que mantém servidor e cliente
 * idênticos na hidratação; sanitizar em um lado só produziria divergência.
 */
export function PlaybookViewer({
  content,
  format,
}: {
  content: string;
  format: PlaybookFormat;
}) {
  const [montado, setMontado] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- marcar a montagem é o ponto: só depois dela existe window para o DOMPurify
  useEffect(() => setMontado(true), []);

  const html = useMemo(() => {
    if (!montado) return "";
    const raw =
      format === "html" ? content : (marked.parse(content, { async: false }) as string);
    return DOMPurify.sanitize(String(raw), { ADD_ATTR: ["target"] });
  }, [content, format, montado]);

  // Sem conteúdo sanitizado ainda: reserva o espaço para não haver salto.
  if (!montado) return <div className="playbook-prose" aria-busy="true" />;

  return <div className="playbook-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
