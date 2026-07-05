/**
 * Playbooks — central de documentos por setor (Markdown/HTML).
 * Client-safe: só tipos + mock. Leitura real em supabase.ts; delegação em queries.ts.
 */
export type PlaybookFormat = "md" | "html";

export type Playbook = {
  id: string;
  sectorId: string;
  title: string;
  content: string;
  format: PlaybookFormat;
  position: number;
  updatedAt: string;
};

export type PlaybookSector = {
  id: string;
  name: string;
  position: number;
  playbooks: Playbook[];
};

export const MOCK_PLAYBOOK_SECTORS: PlaybookSector[] = [
  {
    id: "sec-ops",
    name: "Operações",
    position: 1,
    playbooks: [
      {
        id: "pb-onboarding",
        sectorId: "sec-ops",
        title: "Onboarding de cliente",
        format: "md",
        position: 1,
        updatedAt: new Date().toISOString(),
        content: `# Onboarding de cliente

Passo a passo para iniciar um novo cliente na Viofilme.

## 1. Kickoff
- Reunião de alinhamento (objetivos, acessos, cronograma)
- Coletar acessos (Meta, Google, site)

## 2. Setup
- Criar projeto no painel
- Configurar integrações (Meta, WhatsApp)

## 3. Primeira entrega
- Linha editorial aprovada
- Primeira leva de criativos

> Dica: registre tudo no CRM e no Painel de Entregas.`,
      },
    ],
  },
];
