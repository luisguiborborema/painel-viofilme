/**
 * Base de conhecimento — regras puras.
 *
 * Mural de processos e playbooks. O que se valida aqui é o mínimo para a página
 * ser útil a quem for ler depois: título que identifique e conteúdo que exista.
 */

export const MAX_TITULO = 200;
export const MAX_RESUMO = 400;
export const MAX_CONTEUDO = 100_000;
export const MAX_TAGS = 12;

export type PaginaSaneada = {
  title: string;
  summary: string | null;
  content: string | null;
  tags: string[];
  videoUrl: string | null;
};

export function paginaValida(
  entrada: { title?: string; summary?: string; content?: string; tags?: string[]; videoUrl?: string },
): { ok: true; pagina: PaginaSaneada } | { ok: false; erro: string } {
  const title = String(entrada.title ?? "").trim();
  if (title.length < 3) return { ok: false, erro: "Dê um título de ao menos 3 caracteres." };
  if (title.length > MAX_TITULO) return { ok: false, erro: `Título acima de ${MAX_TITULO} caracteres.` };

  const content = String(entrada.content ?? "").trim();
  if (content.length > MAX_CONTEUDO) {
    return { ok: false, erro: `Conteúdo acima do limite (${MAX_CONTEUDO} caracteres).` };
  }

  // Tags repetidas e vazias só poluem o filtro.
  const tags = [...new Set((entrada.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))]
    .slice(0, MAX_TAGS);

  const video = String(entrada.videoUrl ?? "").trim();
  return {
    ok: true,
    pagina: {
      title,
      summary: String(entrada.summary ?? "").trim().slice(0, MAX_RESUMO) || null,
      content: content || null,
      tags,
      videoUrl: /^https?:\/\//i.test(video) ? video.slice(0, 500) : null,
    },
  };
}

const COR = /^#[0-9a-f]{6}$/i;

export function categoriaValida(
  nome: unknown,
  cor: unknown,
): { ok: true; nome: string; cor: string } | { ok: false; erro: string } {
  const n = String(nome ?? "").trim();
  if (n.length < 2) return { ok: false, erro: "Dê um nome de ao menos 2 caracteres." };
  if (n.length > 60) return { ok: false, erro: "Nome acima de 60 caracteres." };
  const c = String(cor ?? "").trim();
  return { ok: true, nome: n, cor: COR.test(c) ? c : "#2a63c9" };
}
