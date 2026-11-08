-- Conversaciones del chat: cada usuario lee y borra solo las suyas. Las escrituras
-- (crear, agregar mensajes, renombrar) las hace únicamente el backend.
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversation_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE NOTICE 'Sin rol authenticated / auth.uid(): se omiten las políticas de conversations';
    RETURN;
  END IF;

  EXECUTE $p$
    CREATE POLICY "conversations_select_own" ON "conversations"
      FOR SELECT TO authenticated
      USING ("user_id" = (SELECT auth.uid()))
  $p$;

  EXECUTE $p$
    CREATE POLICY "conversations_delete_own" ON "conversations"
      FOR DELETE TO authenticated
      USING ("user_id" = (SELECT auth.uid()))
  $p$;

  EXECUTE $p$
    CREATE POLICY "conversation_messages_select_own" ON "conversation_messages"
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM "conversations" c
        WHERE c."id" = "conversation_messages"."conversation_id"
          AND c."user_id" = (SELECT auth.uid())
      ))
  $p$;

  EXECUTE $p$
    CREATE POLICY "conversation_messages_delete_own" ON "conversation_messages"
      FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM "conversations" c
        WHERE c."id" = "conversation_messages"."conversation_id"
          AND c."user_id" = (SELECT auth.uid())
      ))
  $p$;

  GRANT SELECT, DELETE ON "conversations", "conversation_messages" TO authenticated;
END
$$;
