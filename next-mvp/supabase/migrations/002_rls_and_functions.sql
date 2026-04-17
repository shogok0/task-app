-- =====================================================================
-- 002_rls_and_functions.sql
-- Runs AFTER 001_init_schema.sql. Tables exist, RLS already enabled,
-- but no policies or functions have been created yet.
--
-- Contents:
--   1) Private schema + updated_at trigger function
--   2) Helper functions (is_group_member / is_group_admin / shares_group_with)
--   3) Invite code generation
--   4) Triggers (updated_at, invite code, auto-admin, submissions fan-out, auth.users)
--   5) RPCs (leave_group, create_group, join_group_by_code)
--   6) RLS policies
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) private schema for internal helpers
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ---------------------------------------------------------------------
-- 1) updated_at trigger function + attach to tables
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_groups_updated_at ON public.groups;
CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_task_submissions_updated_at ON public.task_submissions;
CREATE TRIGGER trg_task_submissions_updated_at
  BEFORE UPDATE ON public.task_submissions
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ---------------------------------------------------------------------
-- 2) Helper functions used by RLS policies
--    SECURITY DEFINER + STABLE so RLS checks are cheap & bypass recursion.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_group_member(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_memberships gm
    WHERE gm.group_id = gid
      AND gm.user_id  = (select auth.uid())
      AND gm.left_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION private.is_group_admin(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_memberships gm
    WHERE gm.group_id = gid
      AND gm.user_id  = (select auth.uid())
      AND gm.left_at IS NULL
      AND gm.role    = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION private.shares_group_with(other uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_memberships m1
    JOIN public.group_memberships m2
      ON m1.group_id = m2.group_id
    WHERE m1.user_id = (select auth.uid())
      AND m1.left_at IS NULL
      AND m2.user_id = other
      AND m2.left_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION private.is_group_member(uuid)    FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_group_admin(uuid)     FROM PUBLIC;
REVOKE ALL ON FUNCTION private.shares_group_with(uuid)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_group_member(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_group_admin(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_group_with(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 3) Invite code generation
--    Charset excludes visually ambiguous chars (I, L, O, 0, 1).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  charset  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  charset_len int := length(charset);
  candidate text;
  i int;
  attempt int := 0;
  max_attempts int := 20;
BEGIN
  LOOP
    attempt := attempt + 1;
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(charset, 1 + floor(random() * charset_len)::int, 1);
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM public.groups WHERE invite_code = candidate) THEN
      RETURN candidate;
    END IF;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'INVITE_CODE_GENERATION_FAILED'
        USING HINT = 'Exceeded max attempts while generating unique invite_code';
    END IF;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated;

-- ---------------------------------------------------------------------
-- 4) Triggers
-- ---------------------------------------------------------------------

-- 4.1 BEFORE INSERT on groups: auto-fill invite_code if missing
CREATE OR REPLACE FUNCTION private.groups_set_invite_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.invite_code IS NULL OR length(btrim(NEW.invite_code)) = 0 THEN
    NEW.invite_code := public.generate_invite_code();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_groups_set_invite_code ON public.groups;
CREATE TRIGGER trg_groups_set_invite_code
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION private.groups_set_invite_code();

-- 4.2 AFTER INSERT on groups: creator becomes ADMIN
CREATE OR REPLACE FUNCTION private.groups_add_creator_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.group_memberships (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'ADMIN')
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET role    = 'ADMIN',
        left_at = NULL;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_groups_add_creator_admin ON public.groups;
CREATE TRIGGER trg_groups_add_creator_admin
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION private.groups_add_creator_as_admin();

-- 4.3 AFTER INSERT on tasks: fan-out PENDING submissions for GROUP tasks
CREATE OR REPLACE FUNCTION private.tasks_fanout_submissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.scope_type = 'GROUP' AND NEW.group_id IS NOT NULL THEN
    INSERT INTO public.task_submissions (task_id, user_id, status)
    SELECT NEW.id, gm.user_id, 'PENDING'
    FROM public.group_memberships gm
    WHERE gm.group_id = NEW.group_id
      AND gm.left_at IS NULL
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_tasks_fanout_submissions ON public.tasks;
CREATE TRIGGER trg_tasks_fanout_submissions
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION private.tasks_fanout_submissions();

-- 4.4 AFTER INSERT on auth.users: provision profile + notification_settings
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_settings (user_id, email_address)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_auth_users_handle_new ON auth.users;
CREATE TRIGGER trg_auth_users_handle_new
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- 5) RPCs exposed to the client
-- ---------------------------------------------------------------------

-- 5.1 leave_group: honors last-admin protection
CREATE OR REPLACE FUNCTION public.leave_group(gid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  my_role text;
  other_admin_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT role INTO my_role
  FROM public.group_memberships
  WHERE group_id = gid
    AND user_id  = uid
    AND left_at IS NULL;

  IF my_role IS NULL THEN
    RAISE EXCEPTION 'NOT_A_MEMBER';
  END IF;

  IF my_role = 'ADMIN' THEN
    SELECT count(*) INTO other_admin_count
    FROM public.group_memberships
    WHERE group_id = gid
      AND user_id <> uid
      AND left_at IS NULL
      AND role    = 'ADMIN';

    IF other_admin_count = 0 THEN
      RAISE EXCEPTION 'LAST_ADMIN';
    END IF;
  END IF;

  UPDATE public.group_memberships
     SET left_at = now()
   WHERE group_id = gid
     AND user_id  = uid
     AND left_at IS NULL;
END
$$;

-- 5.2 create_group: creates a group; AFTER INSERT trigger adds creator as ADMIN
CREATE OR REPLACE FUNCTION public.create_group(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  INSERT INTO public.groups (name, created_by)
  VALUES (btrim(p_name), uid)
  RETURNING id INTO new_id;

  RETURN new_id;
END
$$;

-- 5.3 join_group_by_code: join active group by invite_code; re-joins if previously left
CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  target_group uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_code IS NULL OR length(btrim(p_code)) = 0 THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  SELECT id INTO target_group
  FROM public.groups
  WHERE invite_code = btrim(p_code)
    AND status = 'ACTIVE';

  IF target_group IS NULL THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  INSERT INTO public.group_memberships (group_id, user_id, role)
  VALUES (target_group, uid, 'MEMBER')
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET left_at = NULL;

  RETURN target_group;
END
$$;

REVOKE ALL ON FUNCTION public.leave_group(uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group(text)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_group_by_code(text)   FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_group(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 6) RLS policies
--    NOTE: RLS is assumed to have been enabled in 001_init_schema.sql.
--    All policies target the `authenticated` role and wrap auth.uid()
--    in `(select auth.uid())` per Supabase perf guidance.
-- ---------------------------------------------------------------------

-- 6.1 profiles ---------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_self_or_group ON public.profiles;
CREATE POLICY profiles_select_self_or_group
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid())
    OR private.shares_group_with(id)
  );
COMMENT ON POLICY profiles_select_self_or_group ON public.profiles IS
  'A user can read their own profile and profiles of fellow active group members.';

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));
COMMENT ON POLICY profiles_update_self ON public.profiles IS
  'A user can only update their own profile row.';

-- No INSERT / DELETE policies: profile rows are provisioned by the
-- auth.users trigger and are never deleted through the client.

-- 6.2 groups -----------------------------------------------------------
DROP POLICY IF EXISTS groups_select_members ON public.groups;
CREATE POLICY groups_select_members
  ON public.groups
  FOR SELECT
  TO authenticated
  USING (private.is_group_member(id));
COMMENT ON POLICY groups_select_members ON public.groups IS
  'Only active members of a group can see the group row.';

DROP POLICY IF EXISTS groups_insert_self ON public.groups;
CREATE POLICY groups_insert_self
  ON public.groups
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));
COMMENT ON POLICY groups_insert_self ON public.groups IS
  'Direct inserts require created_by = self. The create_group RPC is preferred.';

DROP POLICY IF EXISTS groups_update_admin ON public.groups;
CREATE POLICY groups_update_admin
  ON public.groups
  FOR UPDATE
  TO authenticated
  USING (private.is_group_admin(id))
  WITH CHECK (private.is_group_admin(id));
COMMENT ON POLICY groups_update_admin ON public.groups IS
  'Only active ADMINs of the group can update it.';

DROP POLICY IF EXISTS groups_delete_admin ON public.groups;
CREATE POLICY groups_delete_admin
  ON public.groups
  FOR DELETE
  TO authenticated
  USING (private.is_group_admin(id));
COMMENT ON POLICY groups_delete_admin ON public.groups IS
  'Only active ADMINs of the group can delete it.';

-- 6.3 group_memberships -----------------------------------------------
DROP POLICY IF EXISTS group_memberships_select ON public.group_memberships;
CREATE POLICY group_memberships_select
  ON public.group_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR private.is_group_member(group_id)
  );
COMMENT ON POLICY group_memberships_select ON public.group_memberships IS
  'A user sees their own memberships and those of fellow active group members.';

DROP POLICY IF EXISTS group_memberships_insert_self ON public.group_memberships;
CREATE POLICY group_memberships_insert_self
  ON public.group_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
COMMENT ON POLICY group_memberships_insert_self ON public.group_memberships IS
  'A user can only insert membership rows for themselves; use join_group_by_code in practice.';

DROP POLICY IF EXISTS group_memberships_update_self ON public.group_memberships;
CREATE POLICY group_memberships_update_self
  ON public.group_memberships
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
COMMENT ON POLICY group_memberships_update_self ON public.group_memberships IS
  'Self can update their own membership (e.g. left_at via leave_group RPC). Admin role changes go through a separate RPC.';

-- No DELETE policy: membership removal is modeled via left_at.

-- 6.4 tasks ------------------------------------------------------------
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (scope_type = 'PERSONAL' AND owner_user_id = (select auth.uid()))
      OR
      (scope_type = 'GROUP' AND private.is_group_member(group_id))
    )
  );
COMMENT ON POLICY tasks_select ON public.tasks IS
  'Personal tasks visible to their owner. Group tasks visible to active group members. Soft-deleted rows hidden.';

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (scope_type = 'PERSONAL'
       AND owner_user_id = (select auth.uid())
       AND created_by    = (select auth.uid()))
    OR
    (scope_type = 'GROUP'
       AND private.is_group_admin(group_id)
       AND created_by    = (select auth.uid()))
  );
COMMENT ON POLICY tasks_insert ON public.tasks IS
  'Users create personal tasks for themselves. Only group ADMINs create group tasks.';

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND owner_user_id = (select auth.uid()))
    OR
    (scope_type = 'GROUP'    AND private.is_group_admin(group_id))
  )
  WITH CHECK (
    (scope_type = 'PERSONAL' AND owner_user_id = (select auth.uid()))
    OR
    (scope_type = 'GROUP'    AND private.is_group_admin(group_id))
  );
COMMENT ON POLICY tasks_update ON public.tasks IS
  'Personal task owner may update. Only group ADMINs may update group tasks.';

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND owner_user_id = (select auth.uid()))
    OR
    (scope_type = 'GROUP'    AND private.is_group_admin(group_id))
  );
COMMENT ON POLICY tasks_delete ON public.tasks IS
  'Mirrors UPDATE; prefer soft-delete (deleted_at) at the application layer.';

-- 6.5 task_submissions -------------------------------------------------
DROP POLICY IF EXISTS task_submissions_select ON public.task_submissions;
CREATE POLICY task_submissions_select
  ON public.task_submissions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_submissions.task_id
        AND t.scope_type = 'GROUP'
        AND private.is_group_admin(t.group_id)
    )
  );
COMMENT ON POLICY task_submissions_select ON public.task_submissions IS
  'A user sees their own submissions. Group ADMINs see all submissions for that group''s tasks (teacher dashboard).';

DROP POLICY IF EXISTS task_submissions_insert_self ON public.task_submissions;
CREATE POLICY task_submissions_insert_self
  ON public.task_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
COMMENT ON POLICY task_submissions_insert_self ON public.task_submissions IS
  'Normal flow is via the fan-out trigger; self-insert is allowed as a safety net.';

DROP POLICY IF EXISTS task_submissions_update_self ON public.task_submissions;
CREATE POLICY task_submissions_update_self
  ON public.task_submissions
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
COMMENT ON POLICY task_submissions_update_self ON public.task_submissions IS
  'Only the submission owner can update their own status.';

-- No DELETE policy: submissions are expected to be removed only via
-- ON DELETE CASCADE from tasks.

-- 6.6 notification_settings -------------------------------------------
DROP POLICY IF EXISTS notification_settings_select_self ON public.notification_settings;
CREATE POLICY notification_settings_select_self
  ON public.notification_settings
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));
COMMENT ON POLICY notification_settings_select_self ON public.notification_settings IS
  'Users only see their own notification settings.';

DROP POLICY IF EXISTS notification_settings_insert_self ON public.notification_settings;
CREATE POLICY notification_settings_insert_self
  ON public.notification_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
COMMENT ON POLICY notification_settings_insert_self ON public.notification_settings IS
  'Users only insert their own notification settings row.';

DROP POLICY IF EXISTS notification_settings_update_self ON public.notification_settings;
CREATE POLICY notification_settings_update_self
  ON public.notification_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
COMMENT ON POLICY notification_settings_update_self ON public.notification_settings IS
  'Users only update their own notification settings row.';

DROP POLICY IF EXISTS notification_settings_delete_self ON public.notification_settings;
CREATE POLICY notification_settings_delete_self
  ON public.notification_settings
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
COMMENT ON POLICY notification_settings_delete_self ON public.notification_settings IS
  'Users only delete their own notification settings row.';

-- 6.7 notification_deliveries -----------------------------------------
-- Writes are service_role-only (service_role bypasses RLS automatically).
DROP POLICY IF EXISTS notification_deliveries_select_self ON public.notification_deliveries;
CREATE POLICY notification_deliveries_select_self
  ON public.notification_deliveries
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));
COMMENT ON POLICY notification_deliveries_select_self ON public.notification_deliveries IS
  'Users see only their own delivery history; writes are performed by service_role.';

-- =====================================================================
-- End of 002_rls_and_functions.sql
-- =====================================================================
