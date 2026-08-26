import "server-only";
import { gzipSync } from "node:zlib";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getValidAccess } from "@/lib/google/client";
import { getDriveRoot } from "@/lib/google/drive-root";
import { driveEnsureChildFolder, driveListChildren, driveTrash, driveUploadFile } from "@/lib/google/drive";

/**
 * Backup diário do banco para o Google Drive da agência.
 *
 * Exporta as tabelas de dados em um único JSON comprimido (gzip) e sobe para a
 * pasta "Backups do Painel". Complementa — não substitui — o backup gerenciado
 * do Supabase: protege contra perder o próprio projeto Supabase, porque fica em
 * outra conta, com outras credenciais.
 *
 * Best-effort e observável: o resultado vai para os Logs de API (cron:backup).
 */
const PASTA_BACKUP = "Backups do Painel";
const RETENCAO_DIAS = 30;
const MAX_LINHAS_POR_TABELA = 50_000;
const PAGINA = 1_000;
/** Quantas tabelas ler em paralelo (equilibra tempo x carga no banco). */
const LOTE = 8;

/** Colunas que NÃO vão para o backup — credenciais reconquistáveis com 1 clique. */
const REDIGIR: Record<string, string[]> = {
  google_connections: ["access_token", "refresh_token"],
  meta_connections: ["access_token"],
};

/**
 * Tabelas de dados. Fora: logs com purga própria (`api_logs`, `wa_webhook_log`)
 * e filas efêmeras.
 *
 * Esta lista é verificada contra as migrações pelo teste `backup.test.ts` —
 * criar tabela nova sem incluí-la aqui quebra o teste de propósito. Faltavam
 * dez, entre elas TODA a configuração financeira (contas, categorias, régua,
 * orçamentos): restaurar sem elas devolveria um DRE errado sem avisar.
 */
export const TABELAS_BACKUP = [
  "account_metrics", "account_transfers", "asaas_subscriptions", "asaas_webhook_events", "audit_events", "bank_entries",
  "bank_statements", "broadcast_recipients", "broadcasts", "budgets", "calendar_events", "campaign_metrics",
  "campaigns", "client_accesses", "client_contacts", "client_deliverables", "client_documents", "client_goals",
  "client_services", "clients", "collaborators", "commercial_board", "content_posts", "content_requests",
  "crm_capture_forms", "crm_card_layout", "crm_comments", "crm_companies", "crm_contacts", "crm_deal_contacts",
  "crm_document_templates", "crm_documents", "crm_form_fields", "crm_form_submissions", "crm_freeze_reasons", "crm_goals",
  "crm_interactions", "crm_leads", "crm_lost_reasons", "crm_pipelines", "crm_properties", "crm_property_groups",
  "crm_sales_materials", "crm_scripts", "crm_settings", "crm_stage_history", "crm_stages", "crm_tags",
  "crm_task_flow_steps", "crm_task_flows", "crm_tasks", "crm_workflow_action_logs", "crm_workflow_actions", "crm_workflow_enrollments",
  "crm_workflows", "delivery_form_fields", "delivery_settings", "delivery_task_status_history", "delivery_tasks", "diagnostic_config",
  "diagnostic_templates", "diagnostics", "editorial_lines", "editorial_posts", "expense_categories", "expenses",
  "finance_settings", "financial_accounts", "google_connections",
  "hour_entries", "inspiration_quotes", "knowledge_attachments", "knowledge_categories", "knowledge_pages", "mediaday_items",
  "mediaday_sessions", "meeting_requests", "meeting_survey_config", "meeting_surveys", "meetings", "meta_connections",
  "notification_preferences", "nps_config", "nps_surveys", "package_items", "packages", "payments",
  "playbook_sectors", "playbooks", "profiles", "push_subscriptions", "recurring_update_logs", "recurring_updates", "report_sends",
  "rh_announcements", "rh_documents", "rh_pdis", "rh_reviews", "roadmap_blocks", "routine_blocks",
  "routine_templates", "saved_views", "scheduling_links", "service_plans", "services", "squads",
  "suggestions", "task_types", "vioflux_posts", "violaunch_gates", "violaunch_projects", "violaunch_steps",
  "violaunch_substeps", "wa_conversations", "wa_messages",
] as const;

export type BackupResult = {
  ok: boolean;
  motivo?: string;
  arquivo?: string;
  url?: string;
  tabelas: number;
  linhas: number;
  bytes: number;
  vazias: string[];
  falhas: { tabela: string; erro: string }[];
  removidosPorRetencao: number;
};

type Admin = ReturnType<typeof createAdminClient>;

/** Lê uma tabela inteira, paginando; redige colunas sensíveis. */
async function lerTabela(admin: Admin, tabela: string): Promise<unknown[]> {
  const linhas: Record<string, unknown>[] = [];
  for (let de = 0; de < MAX_LINHAS_POR_TABELA; de += PAGINA) {
    const { data, error } = await admin.from(tabela).select("*").range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as Record<string, unknown>[];
    linhas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  const redigir = REDIGIR[tabela];
  if (redigir) {
    for (const l of linhas) for (const c of redigir) if (c in l) l[c] = "[redigido no backup]";
  }
  return linhas;
}

/** Remove backups mais antigos que RETENCAO_DIAS. Best-effort. */
async function aplicarRetencao(token: string, pastaId: string): Promise<number> {
  try {
    const filhos = await driveListChildren(token, pastaId);
    const limite = Date.now() - RETENCAO_DIAS * 86_400_000;
    let removidos = 0;
    for (const f of filhos) {
      const m = f.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (!m) continue;
      if (new Date(`${m[1]}T00:00:00Z`).getTime() < limite) {
        await driveTrash(token, f.id).then(() => { removidos++; }, () => {});
      }
    }
    return removidos;
  } catch {
    return 0;
  }
}

export async function runBackup(): Promise<BackupResult> {
  const vazio: BackupResult = { ok: false, tabelas: 0, linhas: 0, bytes: 0, vazias: [], falhas: [], removidosPorRetencao: 0 };
  if (!isSupabaseConfigured() || !hasServiceRole()) return { ...vazio, motivo: "sem service role" };

  const access = await getValidAccess();
  if (!access?.token) return { ...vazio, motivo: "Google não conectado — não há onde guardar o backup" };

  const admin = createAdminClient();

  // 1) Lê as tabelas em lotes paralelos.
  const dados: Record<string, unknown[]> = {};
  const falhas: { tabela: string; erro: string }[] = [];
  const vazias: string[] = [];
  let linhas = 0;

  for (let i = 0; i < TABELAS_BACKUP.length; i += LOTE) {
    const lote = TABELAS_BACKUP.slice(i, i + LOTE);
    const res = await Promise.all(
      lote.map(async (t) => {
        try {
          return { t, linhas: await lerTabela(admin, t) };
        } catch (e) {
          return { t, erro: e instanceof Error ? e.message : "erro" };
        }
      }),
    );
    for (const r of res) {
      if ("erro" in r && r.erro) {
        // Tabela ausente (migração não rodada) não é falha de backup.
        if (/does not exist|42P01/i.test(r.erro)) vazias.push(r.t);
        else falhas.push({ tabela: r.t, erro: r.erro });
        continue;
      }
      const rows = r.linhas ?? [];
      if (rows.length === 0) vazias.push(r.t);
      else {
        dados[r.t] = rows;
        linhas += rows.length;
      }
    }
  }

  // 2) Empacota (gzip — sem dependência nova, zlib é do Node).
  const hoje = new Date().toISOString().slice(0, 10);
  const payload = {
    gerado_em: new Date().toISOString(),
    origem: process.env.NEXT_PUBLIC_APP_URL ?? "painel-viofilme",
    aviso: "Tokens de integração foram redigidos. Reconecte Google/Meta após restaurar.",
    tabelas: Object.keys(dados).length,
    linhas,
    dados,
  };
  const gz = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });

  // 3) Sobe para o Drive, dentro da pasta-mãe configurada.
  const root = await getDriveRoot(admin);
  const paiId = root.id ?? (await driveEnsureChildFolder(access.token, "root", PASTA_BACKUP));
  const pastaId = root.id ? await driveEnsureChildFolder(access.token, root.id, PASTA_BACKUP) : paiId;

  const nome = `painel-${hoje}.json.gz`;
  const enviado = await driveUploadFile(access.token, {
    name: nome,
    mimeType: "application/gzip",
    bytes: gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) as ArrayBuffer,
    parentId: pastaId,
  });

  // 4) Retenção.
  const removidos = await aplicarRetencao(access.token, pastaId);

  return {
    ok: true,
    arquivo: enviado.name,
    url: enviado.url,
    tabelas: Object.keys(dados).length,
    linhas,
    bytes: gz.byteLength,
    vazias,
    falhas,
    removidosPorRetencao: removidos,
  };
}
