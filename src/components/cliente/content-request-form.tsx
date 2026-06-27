"use client";

import { useState } from "react";
import { CheckCircle2, SendHorizontal } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const FORMATS = ["Post feed", "Reels", "Carrossel", "Stories", "Vídeo", "Outro"];
const NETWORKS = ["Instagram", "Facebook", "TikTok", "LinkedIn"];
const TIMES = ["Manhã", "Almoço", "Tarde", "Noite", "Sem preferência"];
const URGENCIES = [
  "Sem pressa — pode entrar no calendário normal",
  "Precisa ser publicado nesta semana",
];
const MAX_DESC = 500;

export function ContentRequestForm({
  open,
  onClose,
  initialDate,
}: {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
}) {
  const [format, setFormat] = useState("");
  const [networks, setNetworks] = useState<string[]>([]);
  const [date, setDate] = useState(initialDate ?? "");
  const [time, setTime] = useState("");
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");
  const [guideline, setGuideline] = useState("");
  const [refs, setRefs] = useState("");
  const [urgency, setUrgency] = useState("");
  const [sent, setSent] = useState(false);

  // pré-preenche a data quando aberto pelo calendário
  const [lastInitial, setLastInitial] = useState(initialDate);
  if (initialDate !== lastInitial) {
    setLastInitial(initialDate);
    if (initialDate) setDate(initialDate);
  }

  const valid =
    format && networks.length > 0 && date && subject.trim() && desc.trim();

  function toggleNetwork(n: string) {
    setNetworks((arr) => (arr.includes(n) ? arr.filter((x) => x !== n) : [...arr, n]));
  }

  function submit() {
    if (!valid) return;
    // TODO: POST → Supabase `content_requests` + notificar Social responsável.
    setSent(true);
  }

  function close() {
    onClose();
    setTimeout(() => {
      setSent(false);
      setFormat("");
      setNetworks([]);
      setDate("");
      setTime("");
      setSubject("");
      setDesc("");
      setGuideline("");
      setRefs("");
      setUrgency("");
    }, 200);
  }

  if (sent) {
    return (
      <Modal open={open} onClose={close} size="md">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="text-base font-semibold text-ink">Solicitação enviada</p>
          <p className="max-w-sm text-sm text-muted">
            O time de Social Media vai analisar e responder. Prazo de entrega: até
            3 dias úteis.
          </p>
          <button
            onClick={close}
            className="mt-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Fechar
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Solicitar conteúdo"
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">
            Prazo de entrega: até 3 dias úteis após a solicitação.
          </span>
          <div className="flex gap-2">
            <button
              onClick={close}
              className="rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm font-medium text-ink hover:bg-subtle-strong"
            >
              Cancelar
            </button>
            <button
              disabled={!valid}
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
            >
              <SendHorizontal className="h-4 w-4" /> Enviar solicitação
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          <div>
            <Label>Formato do conteúdo</Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                    format === f
                      ? "border-brand-400 bg-brand-500/15 text-brand-100"
                      : "border-line bg-subtle text-muted hover:text-ink",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Rede social</Label>
            <div className="flex flex-wrap gap-2">
              {NETWORKS.map((n) => (
                <button
                  key={n}
                  onClick={() => toggleNetwork(n)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-sm transition-colors",
                    networks.includes(n)
                      ? "border-brand-400 bg-brand-500/15 text-brand-100"
                      : "border-line bg-subtle text-muted hover:text-ink",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Data de publicação</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>

          <div>
            <Label>Horário preferido (opcional)</Label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
            >
              <option value="">Sem preferência</option>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">
          <div>
            <Label>Assunto ou tema do post</Label>
            <input
              value={subject}
              maxLength={120}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sobre o que é o post?"
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>

          <div>
            <Label>O que você quer comunicar?</Label>
            <textarea
              value={desc}
              rows={4}
              maxLength={MAX_DESC}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Mensagem principal, oferta, contexto…"
              className="w-full resize-none rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            />
            <p className="mt-1 text-right text-xs text-muted">
              {desc.length} / {MAX_DESC}
            </p>
          </div>

          <div>
            <Label>Há alguma diretriz visual? (opcional)</Label>
            <input
              value={guideline}
              onChange={(e) => setGuideline(e.target.value)}
              placeholder="Cores, estilo, algo a evitar…"
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>

          <div>
            <Label>Referências (opcional)</Label>
            <input
              value={refs}
              onChange={(e) => setRefs(e.target.value)}
              placeholder="Cole links de referência (Instagram, Pinterest…)"
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>

          <div>
            <Label>Urgência</Label>
            <div className="space-y-1.5">
              {URGENCIES.map((u) => (
                <label
                  key={u}
                  className="flex cursor-pointer items-center gap-2 text-sm text-ink"
                >
                  <input
                    type="radio"
                    name="content-urgency"
                    checked={urgency === u}
                    onChange={() => setUrgency(u)}
                    className="accent-brand-500"
                  />
                  {u}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-sm font-medium text-ink">{children}</p>;
}
