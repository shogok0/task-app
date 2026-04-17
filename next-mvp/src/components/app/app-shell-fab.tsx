"use client";
import { FAB } from "./fab";
import { useQuickAdd } from "./quick-add-provider";

export function AppShellFab() {
  const { open } = useQuickAdd();
  return <FAB onClick={() => open()} />;
}
