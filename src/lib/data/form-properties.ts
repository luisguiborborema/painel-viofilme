import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Registra as perguntas "custom" de um formulário como DEFINIÇÕES DE PROPRIEDADE
 * no destino: negócio (crm_properties, object_type 'deal') ou tarefa
 * (delivery_form_fields, board 'entregas'). Assim o valor gravado no card
 * (properties / custom_fields) passa a aparecer como propriedade rotulada.
 *
 * Idempotente: insere apenas se ainda não existe (não sobrescreve ajustes
 * manuais feitos nas configurações).
 */
type FieldLike = {
  field_key: string;
  label: string;
  field_type: string;
  options?: unknown;
  map_to: string;
  position?: number;
};

// Tipos aceitos por cada registry (mapeia os do formulário → os do destino).
const CRM_TYPES = new Set([
  "text",
  "number",
  "currency",
  "select",
  "multiselect",
  "date",
  "checkbox",
  "phone",
  "email",
  "url",
]);
const DELIVERY_TYPES = new Set(["text", "textarea", "number", "select", "date", "checkbox", "url"]);
const crmType = (t: string) => (t === "textarea" ? "text" : CRM_TYPES.has(t) ? t : "text");
const deliveryType = (t: string) =>
  t === "email" || t === "phone" ? "text" : DELIVERY_TYPES.has(t) ? t : "text";

export async function registerFormProperties(
  db: SupabaseClient,
  destination: "crm" | "entregas",
  fields: FieldLike[],
): Promise<void> {
  const custom = fields.filter(
    (f) => f.map_to === "custom" && f.field_type !== "section" && f.field_key && f.label,
  );
  if (!custom.length) return;

  if (destination === "entregas") {
    const rows = custom.map((f) => ({
      board: "entregas",
      field_key: f.field_key,
      label: f.label,
      field_type: deliveryType(f.field_type),
      options: Array.isArray(f.options) ? f.options : [],
      required: false,
      position: f.position ?? 0,
      active: true,
    }));
    await db
      .from("delivery_form_fields")
      .upsert(rows, { onConflict: "board,field_key", ignoreDuplicates: true });
    return;
  }

  const rows = custom.map((f) => ({
    object_type: "deal",
    key: f.field_key,
    label: f.label,
    field_type: crmType(f.field_type),
    options: Array.isArray(f.options) ? f.options : [],
  }));
  await db
    .from("crm_properties")
    .upsert(rows, { onConflict: "object_type,key", ignoreDuplicates: true });
}
