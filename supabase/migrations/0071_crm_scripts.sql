-- 0071_crm_scripts.sql
-- Biblioteca EDITÁVEL de scripts/roteiros do Comercial (Camada 4 · Configurações).
-- Fecha o loop da Ficha do Lead (§3.4): o comando `/` na caixa de nota injeta um
-- TEMPLATE DE TEXTO editável; a gestão da biblioteca vive em Configurações.

create table if not exists public.crm_scripts (
  id          uuid primary key default gen_random_uuid(),
  command     text,                       -- comando slash (ex.: /bant); opcional
  title       text not null,
  hint        text,                       -- descrição curta
  stage_hint  text,                       -- key do estágio sugerido (cadeia de funis)
  body        text not null,              -- template injetável (texto editável)
  position    int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.crm_scripts enable row level security;
drop policy if exists "gerencial gerencia crm_scripts" on public.crm_scripts;
create policy "gerencial gerencia crm_scripts" on public.crm_scripts
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

-- Seed dos 4 roteiros padrão (só quando a tabela está vazia — idempotente).
insert into public.crm_scripts (command, title, hint, stage_hint, body, position)
select v.command, v.title, v.hint, v.stage_hint, v.body, v.position
from (values
  ('/bant', 'Roteiro BANT (qualificação)', 'Não saia da call sem validar', 'sdr_reuniao_realizada',
   $bant$📋 QUALIFICAÇÃO BANT — não saia da call sem validar:

SÓCIOS & DECISÃO
• Sócios: quantos são e quem são?
• Decisor: quem dá o "ok" final no marketing?
• Gatekeeper: tem secretária/gerente no meio?

NÚMEROS & FINANCEIRO
• Faturamento mensal médio atual?
• Ticket médio da venda/serviço?
• Investe quanto hoje em tráfego (Meta/Google)?
• CAC: sabe o custo por cliente novo?
• LTV: o cliente volta a comprar? Tempo de vida?

OPERAÇÃO & VENDAS
• Time comercial: dono atende ou tem vendedores? Quantos?
• Volume de leads/mês hoje?
• Taxa de conversão (de 10 leads, quantos fecham)?
• Gargalo: atração ou conversão?

ESTRATÉGIA & MOMENTO
• Já trabalha com agência ou in-house?
• Carro-chefe de maior margem?
• Meta de faturamento nos próximos 6 meses?
• Urgência: por que resolver agora e não em 3 meses?$bant$, 1),

  ('/script-1aligacao', 'Script — 1ª ligação', 'Abertura do primeiro contato', 'sdr_tentativa_contato',
   $s1$📞 1ª LIGAÇÃO — abertura:

"Oi, [nome]! Aqui é [seu nome], da Viofilme. Tudo bem?
Vi que a [empresa] atua com [segmento] — a gente ajuda negócios como o seu a [resultado].
Você é a pessoa que cuida do marketing aí?

[Se sim] Tenho 2 minutos pra te fazer 3 perguntas rápidas e ver se faz sentido a gente conversar melhor. Pode ser?"

• Objetivo da call: agendar a reunião de diagnóstico.
• Se objeção "manda por e-mail": "Claro! Mas me diz só uma coisa antes…"$s1$, 2),

  ('/whatsapp-followup', 'Follow-up de WhatsApp', 'Reengajar sem sumir', 'sdr_contactado',
   $wf$💬 FOLLOW-UP (WhatsApp):

"Oi, [nome]! Passando aqui pra retomar nossa conversa sobre [tema].
Consegui pensar em [ideia/insight rápido pro negócio dele].
Faz sentido marcarmos 15 min essa semana? Tenho [dia] de manhã ou [dia] à tarde — qual fica melhor?"$wf$, 3),

  ('/remarcacao', 'Remarcação de reunião', 'Após um no-show', 'sdr_reuniao_agendada',
   $rm$🔁 REMARCAÇÃO (pós no-show):

"Oi, [nome]! Acho que não conseguimos nos falar no horário combinado — acontece!
Bora remarcar? Consigo [dia] às [hora] ou [dia] às [hora]. Qual encaixa melhor na sua agenda?"$rm$, 4)
) as v(command, title, hint, stage_hint, body, position)
where not exists (select 1 from public.crm_scripts);

notify pgrst, 'reload schema';
