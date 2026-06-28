"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string };

export function SyncButton({ clientId }: { clientId: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/meta/sync?client=${clientId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      const r = json.result ?? {};
      setState({
        kind: "ok",
        text: `${r.posts ?? 0} posts · ${r.followers ?? 0} seguidores${
          r.campaigns ? ` · ${r.campaigns} campanhas` : ""
        }`,
      });
    } catch (e) {
      setState({
        kind: "error",
        text: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" size="sm" onClick={run} disabled={state.kind === "loading"}>
        {state.kind === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Sincronizar
      </Button>
      {state.kind === "ok" && (
        <span className="text-[11px] text-emerald-600">{state.text}</span>
      )}
      {state.kind === "error" && (
        <span className="max-w-[180px] text-right text-[11px] text-amber-600">
          {state.text}
        </span>
      )}
    </div>
  );
}
