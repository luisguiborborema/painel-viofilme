"use client";

import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { PlaybookFormat } from "@/lib/data/playbooks";

/** Renderiza um playbook (Markdown ou HTML) já sanitizado. */
export function PlaybookViewer({
  content,
  format,
}: {
  content: string;
  format: PlaybookFormat;
}) {
  const html = useMemo(() => {
    const raw =
      format === "html" ? content : (marked.parse(content, { async: false }) as string);
    return DOMPurify.sanitize(String(raw), { ADD_ATTR: ["target"] });
  }, [content, format]);

  return <div className="playbook-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
