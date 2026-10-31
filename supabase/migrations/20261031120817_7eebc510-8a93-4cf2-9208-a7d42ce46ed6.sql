ALTER TABLE public.conversations ADD COLUMN persona text NOT NULL DEFAULT '' CHECK (char_length(persona) <= 4000);
CREATE TABLE public.chat_snapshots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE, conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE, code_hash text NOT NULL UNIQUE, context jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.chat_snapshots TO authenticated;
GRANT ALL ON public.chat_snapshots TO service_role;
ALTER TABLE public.chat_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_read_own ON public.chat_snapshots FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY snapshots_create_own ON public.chat_snapshots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY snapshots_revoke_own ON public.chat_snapshots FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.touch_chat_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER chat_snapshot_updated BEFORE UPDATE ON public.chat_snapshots FOR EACH ROW EXECUTE FUNCTION public.touch_chat_snapshot();
CREATE FUNCTION public.import_chat_snapshot(payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE cid uuid; msg jsonb; att jsonb; owner_id uuid := auth.uid(); BEGIN
IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
IF jsonb_typeof(payload->'messages') <> 'array' THEN RAISE EXCEPTION 'Invalid snapshot'; END IF;
INSERT INTO public.conversations(user_id,title,persona) VALUES(owner_id, left(payload->>'title',200),coalesce(payload->>'persona','')) RETURNING id INTO cid;
FOR msg IN SELECT value FROM jsonb_array_elements(payload->'messages') LOOP
IF msg->>'role' NOT IN ('user','assistant') THEN RAISE EXCEPTION 'Invalid role'; END IF;
FOR att IN SELECT value FROM jsonb_array_elements(coalesce(msg->'attachments','[]'::jsonb)) LOOP
IF NOT starts_with(att->>'path', owner_id::text || '/') THEN RAISE EXCEPTION 'Invalid file owner'; END IF;
END LOOP;
IF msg->>'image_path' IS NOT NULL AND NOT starts_with(msg->>'image_path',owner_id::text || '/') THEN RAISE EXCEPTION 'Invalid image owner'; END IF;
INSERT INTO public.messages(conversation_id,user_id,role,content,provider,model,attachments,image_path,created_at) VALUES(cid,owner_id,msg->>'role',coalesce(msg->>'content',''),msg->>'provider',msg->>'model',coalesce(msg->'attachments','[]'::jsonb),msg->>'image_path',now() + (coalesce((msg->>'position')::integer,0) * interval '1 microsecond'));
END LOOP;
RETURN cid; END; $$;
REVOKE ALL ON FUNCTION public.import_chat_snapshot(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_chat_snapshot(jsonb) TO authenticated;
