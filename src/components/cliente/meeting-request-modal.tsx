"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, SendHorizontal } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const AREAS = [
  "Social Media",
  "Tráfego/Campanhas",
  "Financeiro e contratos",
  "Estratégia e planejamento",
  "Outro",
];

const URGENCIES = [
  "Pode aguardar a agenda normal",
  "Precisa ser essa semana",
  "Urgente — precisa de atenção hoje",
];

const MIN_DETAIL = 30;

export function MeetingRequestModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [area, setArea] = useState("");
  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");
  const [urgency, setUrgency] = useState("");
  const [slot, setSlot] = useState("");
  const [sent, setSent] = useState(false);

  const detailOk = detail.trim().length >= MIN_DETAIL;
  const valid =
    area && subject.trim() && detailOk && urgency && slot.trim();

  function submit() {
    if (!valid) return;
    // Rota stub (modo híbrido): registra + notifica; persistência real depois.
    void fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "meeting",
        payload: { area, subject, detail, urgency, slot },
      }),
    }).catch(() => {});
    setSent(true);
  }

  function close() {
    onClose();
    // reset após fechar
    setTimeout(() => {
      setSent(false);
      setArea("");
      setSubject("");
      setDetail("");
      setUrgency("");
      setSlot("");
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
            Nossa equipe vai confirmar o horário em até 24 horas.
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
      title="Solicitar reunião"
      size="md"
      footer={
        <>
          <button
            disabled={!valid}
            onClick={submit}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" /> Enviar solicitação
          </button>
          <button
            onClick={close}
            className="rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm font-medium text-ink hover:bg-subtle-strong"
          >
            Cancelar
          </button>
        </>
      }
    >
      <p className="mb-4 rounded-xl bg-subtle p-3 text-xs text-muted">
        Use este formulário para solicitar uma reunião formal — quando o assunto
        precisa de mais atenção do que uma mensagem ou ligação rápida. Para
        dúvidas simples e alinhamentos do dia a dia, fale com a equipe pelo grupo
        do WhatsApp.
      </p>

      <div className="space-y-3">
        <Field label="Área da solicitação">
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="">Selecione…</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assunto">
          <input
            value={subject}
            maxLength={120}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Resumo do que você quer tratar"
            className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </Field>

        <Field label="Conte um pouco mais">
          <textarea
            value={detail}
            rows={3}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="O que está acontecendo? Quanto mais contexto você der, melhor a equipe vai chegar preparada."
            className="w-full resize-none rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          />
          {detail.length > 0 && !detailOk && (
            <p className="mt-1 text-xs text-rose-400">
              Nos conta um pouco mais — isso ajuda a equipe a se preparar melhor.
            </p>
          )}
        </Field>

        <Field label="Nível de urgência">
          <div className="space-y-1.5">
            {URGENCIES.map((u) => (
              <label
                key={u}
                className="flex cursor-pointer items-center gap-2 text-sm text-ink"
              >
                <input
                  type="radio"
                  name="urgency"
                  checked={urgency === u}
                  onChange={() => setUrgency(u)}
                  className="accent-brand-500"
                />
                {u}
              </label>
            ))}
            {urgency === URGENCIES[2] && (
              <p className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Para situações de urgência máxima, você também pode acionar
                diretamente pelo grupo do WhatsApp.
              </p>
            )}
          </div>
        </Field>

        <Field label="Quando você tem disponibilidade?">
          <input
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            placeholder="Ex.: terça e quarta de manhã, ou após as 16h"
            className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={cn("mb-1 block text-sm font-medium text-ink")}>
        {label}
      </label>
      {children}
    </div>
  );
}
