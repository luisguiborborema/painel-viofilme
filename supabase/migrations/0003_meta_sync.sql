-- ============================================================================
-- PAINEL VIOFILME — Sincronização com a Meta
-- Restrições e colunas necessárias para o upsert idempotente do sync
-- (Meta Graph API → Supabase). Mantém o padrão de RLS dos arquivos anteriores.
-- ============================================================================

-- Conta de anúncio + carimbo da última sincronização por conexão ------------
alter table public.meta_connections
  add column if not exists ad_account_id text,
  add column if not exists last_synced_at timestamptz;

-- Chaves naturais para upsert idempotente (id externo da Meta por cliente).
-- external_id nulo (post/campanha criados manualmente) não conflita: o
-- Postgres trata NULLs como distintos numa UNIQUE comum.
create unique index if not exists content_posts_client_external_idx
  on public.content_posts (client_id, external_id);

create unique index if not exists campaigns_client_external_idx
  on public.campaigns (client_id, external_id);

-- Idempotência das métricas diárias de campanha já garantida por
-- campaign_metrics (campaign_id, date) na 0001.
