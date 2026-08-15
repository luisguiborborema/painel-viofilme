-- 0107_notification_type.sql
-- Tipo da notificação (ex.: 'mention') para filtrar no "Meu dia".
-- Opcional/nullable — notificações antigas ficam com type null. Idempotente.

alter table public.notifications add column if not exists type text;
create index if not exists notifications_user_type_idx
  on public.notifications (user_id, type, created_at desc);
