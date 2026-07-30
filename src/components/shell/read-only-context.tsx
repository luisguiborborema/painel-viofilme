"use client";

import { createContext, useContext } from "react";

/** Modo somente-leitura (perfil viewer). Client-safe. */
const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

/** true quando o usuário é somente-leitura → esconder/desabilitar ações de escrita. */
export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
