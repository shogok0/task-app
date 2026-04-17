"use client";
import * as React from "react";

type Ctx = {
  isOpen: boolean;
  open: (presetGroupId?: string | null) => void;
  close: () => void;
  presetGroupId: string | null;
};

const QuickAddContext = React.createContext<Ctx | null>(null);

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [presetGroupId, setPresetGroupId] = React.useState<string | null>(null);

  const value = React.useMemo<Ctx>(() => ({
    isOpen,
    open: (id = null) => { setPresetGroupId(id); setIsOpen(true); },
    close: () => setIsOpen(false),
    presetGroupId,
  }), [isOpen, presetGroupId]);

  return <QuickAddContext.Provider value={value}>{children}</QuickAddContext.Provider>;
}

export function useQuickAdd() {
  const ctx = React.useContext(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd must be used inside QuickAddProvider");
  return ctx;
}
