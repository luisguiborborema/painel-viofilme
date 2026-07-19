-- 0062_vioflux_media_approval.sql
-- VioFlux: mídia real no post (FLX04.1 exige mídia hospedada publicamente) e o
-- round-trip de aprovação do cliente no Portal (FLX05) — o cliente aprova/pede
-- ajuste dos próprios posts.

alter table public.vioflux_posts add column if not exists media_url text;

-- Cliente atualiza os próprios posts (aprovar / pedir ajuste). A API valida a
-- transição de estado; a RLS garante que ele só toca nos posts do seu cliente.
drop policy if exists "cliente aprova seus posts vioflux" on public.vioflux_posts;
create policy "cliente aprova seus posts vioflux" on public.vioflux_posts
  for update using (client_id = public.app_client_id())
  with check (client_id = public.app_client_id());
