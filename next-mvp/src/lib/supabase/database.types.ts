// Placeholder type definitions. Regenerate with `pnpm supabase:types` after
// running `supabase start` locally. Until then this loose shape lets
// supabase-js queries type-check without constraining row/column types.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Permissive shape (any) — replaced by generated types post-`supabase gen types`.
type LooseTable = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Row: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Insert: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Update: Record<string, any>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: LooseTable;
      groups: LooseTable;
      group_memberships: LooseTable;
      tasks: LooseTable;
      task_submissions: LooseTable;
      notification_settings: LooseTable;
      notification_deliveries: LooseTable;
      google_calendar_connections: LooseTable;
      google_calendar_task_syncs: LooseTable;
    };
    Views: Record<string, never>;
    Functions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generate_invite_code: { Args: Record<string, never>; Returns: any };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leave_group: { Args: { gid: string }; Returns: any };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create_group: { Args: { p_name: string }; Returns: any };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      join_group_by_code: { Args: { p_code: string }; Returns: any };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
