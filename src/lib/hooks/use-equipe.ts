"use client";

import { useEffect, useState } from "react";

/**
 * A equipe de verdade (perfis gerenciais), para os seletores de responsável.
 *
 * Existe porque vários componentes listavam `OPS_TEAM` — cinco pessoas
 * fictícias dos dados de demonstração. Quem escolhesse ali gravava numa tarefa
 * real um responsável que não existe, e ninguém era notificado.
 *
 * Começa vazio de propósito: melhor um seletor sem opções por um instante do
 * que um seletor com nomes errados.
 */
export type MembroEquipe = { id: string; name: string; avatarUrl: string | null };

export function useEquipe(): { membros: MembroEquipe[]; nomes: string[]; carregando: boolean } {
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetch("/api/gerencial/team", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (Array.isArray(j?.members)) setMembros(j.members as MembroEquipe[]);
        setCarregando(false);
      })
      .catch(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  return { membros, nomes: membros.map((m) => m.name).filter(Boolean), carregando };
}
