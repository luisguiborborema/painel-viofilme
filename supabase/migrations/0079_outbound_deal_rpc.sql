-- 0079_outbound_deal_rpc.sql
-- Criação transacional de um negócio outbound (empresa + contato + deal +
-- vínculo) numa única função — cada linha do "Novo negócio" nasce atômica
-- (spec §4). SECURITY INVOKER: roda com o usuário (RLS gerencial se aplica).

create or replace function public.crm_create_outbound_deal(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
  v_contact uuid;
  v_deal uuid;
  v_props jsonb := '{}'::jsonb;
  v_owner text := nullif(p->>'owner', '');
  v_tags text[] := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(coalesce(p->'tag_ids', '[]'::jsonb)) x),
    '{}'::text[]);
begin
  if coalesce(p->>'cnpj', '') <> '' then
    v_props := v_props || jsonb_build_object('cnpj', p->>'cnpj');
  end if;
  if coalesce(p->>'instagram', '') <> '' then
    v_props := v_props || jsonb_build_object('instagram', p->>'instagram');
  end if;

  -- 1) Empresa
  insert into public.crm_companies (name, segment, website, city, owner, properties)
  values (
    p->>'empresa',
    nullif(p->>'segmento', ''),
    nullif(p->>'site', ''),
    nullif(p->>'cidade_uf', ''),
    v_owner,
    v_props
  )
  returning id into v_company;

  -- 2) Contato (opcional)
  if coalesce(p->>'contato', '') <> '' then
    insert into public.crm_contacts (company_id, name, title, phone, email, is_primary, owner)
    values (
      v_company,
      p->>'contato',
      nullif(p->>'cargo', ''),
      nullif(p->>'whatsapp', ''),
      nullif(p->>'email', ''),
      true,
      v_owner
    )
    returning id into v_contact;
  end if;

  -- 3) Negócio cru no reservatório
  insert into public.crm_leads (
    name, stage, stage_id, pipeline_id, origin_kind, source, prospecting_notes, segment,
    owner, assignees, company_id, primary_contact_id, contact_name, contact_phone, contact_email,
    probability, monthly_value, media_budget, bant, tags, stage_changed_at
  ) values (
    coalesce(nullif(p->>'titulo', ''), p->>'empresa'),
    p->>'stage_key',
    nullif(p->>'stage_id', '')::uuid,
    (p->>'pipeline_id')::uuid,
    'outbound',
    coalesce(nullif(p->>'source', ''), 'Outbound (prospecção)'),
    nullif(p->>'anotacao', ''),
    nullif(p->>'segmento', ''),
    v_owner,
    case when v_owner is not null then array[v_owner] else '{}'::text[] end,
    v_company,
    v_contact,
    nullif(p->>'contato', ''),
    nullif(p->>'whatsapp', ''),
    nullif(p->>'email', ''),
    10, 0, 0, '{}'::jsonb, v_tags, now()
  )
  returning id into v_deal;

  -- 4) Vínculo deal ↔ contato
  if v_contact is not null then
    insert into public.crm_deal_contacts (deal_id, contact_id, is_primary)
    values (v_deal, v_contact, true);
  end if;

  return v_deal;
end;
$$;

notify pgrst, 'reload schema';
