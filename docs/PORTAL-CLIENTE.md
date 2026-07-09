# Portal do Cliente

O que cada cliente vê ao entrar no painel. Todas as telas são isoladas por `clientId` (RLS + sessão) — o cliente só acessa os próprios dados.

Rotas em [src/app/cliente/](../src/app/cliente/), componentes em [src/components/cliente/](../src/components/cliente/).

---

## Visão geral (Home) — [/cliente](../src/app/cliente/)
Resumo executivo personalizado: KPIs dinâmicos (seguidores, alcance, engajamento, CPL), seletor de métricas com gráficos, e uma coluna direita **condicional** ao tipo de cliente — orçamento de mídia para quem tem tráfego pago, ou desempenho orgânico por formato para quem é só social. Mostra alertas de aprovações pendentes e uma agenda combinada (próximas publicações + reuniões). Inclui o chat com a IA **Bruna**, que responde com o contexto real do cliente.

## Conteúdo — [/cliente/conteudo](../src/app/cliente/conteudo/)
Galeria de peças programadas com status de aprovação (pendente / aprovado / ajustes solicitados), tempo de espera, autor da criação e da revisão. O cliente **aprova** ou **solicita alterações** antes do agendamento, com visualização por post e histórico de revisões.

## Campanhas — [/cliente/campanhas](../src/app/cliente/campanhas/)
Métricas de mídia paga (investimento, leads, CPL, conversões) em carrossel com gráficos, e uma coluna fixa com orçamento gasto, dias restantes, saldo, ritmo diário e desempenho por rede (Meta vs Google). Tabela de campanhas ativas com status e objetivos. Traz **insights por IA** sobre otimização de orçamento e escala (com fallback manual).

## Resultados — [/cliente/resultados](../src/app/cliente/resultados/)
Métricas orgânicas (seguidores, alcance, engajamento) e um carrossel de formatos (Reels, Feed, Stories, Carrossel) com análise e recomendações de distribuição. Cards das redes conectadas (Instagram principal, Facebook secundário) com estatísticas e audiência, **Top 3 posts** expansíveis, análise de padrões pela equipe e insights por IA.

## Financeiro — [/cliente/financeiro](../src/app/cliente/financeiro/)
Status imediato: próximo vencimento, último pagamento e plano contratado. Histórico de faturas filtrável (todas / em aberto / pagas), documentos de contrato e comprovantes, e uma timeline visual de pagamentos no ano. Alimentado pelos pagamentos do **Asaas**.

## Marca & acessos (Central) — [/cliente/central](../src/app/cliente/central/)
Hub da marca em quatro blocos:
- **Cofre de acessos** — credenciais e conexões (Meta, Google, WordPress, e-commerce) com status.
- **Ativos de marca** — drive com logos, manual e fotos, filtrável por categoria.
- **Equipe dedicada** — cards dos profissionais atribuídos (nome, função, WhatsApp).
- **Log de atividades** — histórico de aprovações, envios, ajustes, pagamentos e acessos.

## Configurações — [/configuracoes](../src/app/configuracoes/)
Perfil, tema e notificações push. Tela compartilhada com a área gerencial.

---

## IA Bruna

O chat do cliente é a **Bruna** (na área gerencial, o equivalente interno é o **Cadu**). As respostas passam por [/api/chat](../src/app/api/chat/route.ts) (streaming via OpenAI) usando o contexto real do cliente. Os blocos de **insights** de campanhas/orgânico usam [/api/insights](../src/app/api/insights/route.ts). Sem `OPENAI_API_KEY`, ambos caem em respostas de demonstração. Ver [APIS.md](APIS.md#14-openai-ia-bruna--insights).
