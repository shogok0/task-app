import { redirect } from "next/navigation";
import { createSupabaseServerClient, getCurrentUserId } from "@/lib/supabase/server";
import { TabBar } from "@/components/app/tab-bar";
import { AppShellFab } from "@/components/app/app-shell-fab";
import { QuickAddProvider } from "@/components/app/quick-add-provider";
import { QuickAddSheet } from "@/components/app/quick-add-sheet";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: groupRows } = await supabase
    .from("group_memberships")
    .select("role, groups:groups(id, name)")
    .is("left_at", null);
  const groups = (groupRows ?? [])
    .filter((g: any) => g.groups)
    .map((g: any) => ({
      id: g.groups.id as string,
      name: g.groups.name as string,
      role: (g.role as "MEMBER" | "ADMIN") ?? "MEMBER",
    }));

  return (
    <ToastProvider>
      <QuickAddProvider>
        <div className="min-h-dvh pb-[calc(49px+var(--sa-bottom))]">
          {children}
        </div>
        <AppShellFab />
        <TabBar />
        <QuickAddSheet groups={groups} />
      </QuickAddProvider>
    </ToastProvider>
  );
}
