-- 0067_editorial_reference_month.sql
-- LE (A2): mês vira dado estruturado 'AAAA-MM' (ordenação/dedupe reais), no lugar
-- do texto livre ("Julho/2026"). Unique por (cliente, mês) evita LE duplicada.
-- Índice parcial (só quando preenchido) para não conflitar com linhas antigas nulas.

alter table public.editorial_lines add column if not exists reference_month text;  -- 'AAAA-MM'

create unique index if not exists editorial_lines_client_month_uidx
  on public.editorial_lines (client_id, reference_month)
  where reference_month is not null;
