-- Aprovação da linha editorial pelo cliente via link público.
-- Token compartilhável na linha + status/feedback de aprovação por post.

alter table public.editorial_lines
  add column if not exists public_approval_token uuid not null default gen_random_uuid(),
  add column if not exists client_shared_at timestamptz;

create unique index if not exists editorial_lines_approval_token_idx
  on public.editorial_lines (public_approval_token);

-- Decisão do cliente por post: pending (padrão) | approved | changes.
alter table public.editorial_posts
  add column if not exists client_status text not null default 'pending',
  add column if not exists client_feedback text,
  add column if not exists client_reviewed_at timestamptz;
