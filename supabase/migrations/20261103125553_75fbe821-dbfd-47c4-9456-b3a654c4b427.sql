CREATE OR REPLACE FUNCTION public.import_chat_snapshot(payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE cid uuid; msg jsonb; att jsonb; owner_id uuid := auth.uid(); BEGIN
IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
IF jsonb_typeof(payload->'messages') IS DISTINCT FROM 'array' OR jsonb_typeof(payload->'title') IS DISTINCT FROM 'string' OR char_length(payload->>'title') > 200 OR jsonb_typeof(payload->'persona') IS DISTINCT FROM 'string' OR char_length(payload->>'persona') > 4000 THEN RAISE EXCEPTION 'Invalid snapshot'; END IF;
FOR msg IN SELECT value FROM jsonb_array_elements(payload->'messages') LOOP
IF jsonb_typeof(msg->'role') IS DISTINCT FROM 'string' OR msg->>'role' NOT IN ('user','assistant') OR jsonb_typeof(msg->'content') IS DISTINCT FROM 'string' OR jsonb_typeof(msg->'attachments') IS DISTINCT FROM 'array' OR jsonb_array_length(msg->'attachments') > 4 OR jsonb_typeof(msg->'position') IS DISTINCT FROM 'number' OR (msg->>'position')::integer < 0 OR (msg->>'position')::integer > 1000000 THEN RAISE EXCEPTION 'Invalid message'; END IF;
FOR att IN SELECT value FROM jsonb_array_elements(msg->'attachments') LOOP
IF jsonb_typeof(att->'path') IS DISTINCT FROM 'string' OR char_length(att->>'path') > 1024 OR NOT starts_with(att->>'path',owner_id::text || '/') OR jsonb_typeof(att->'name') IS DISTINCT FROM 'string' OR char_length(att->>'name') NOT BETWEEN 1 AND 255 OR att->>'type' IS NULL OR att->>'type' NOT IN ('image/png','image/jpeg','image/webp','application/pdf','text/plain') THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
END LOOP;
IF msg->>'image_path' IS NOT NULL AND (char_length(msg->>'image_path') > 1024 OR NOT starts_with(msg->>'image_path',owner_id::text || '/')) THEN RAISE EXCEPTION 'Invalid image owner'; END IF;
END LOOP;
INSERT INTO public.conversations(user_id,title,persona) VALUES(owner_id,payload->>'title',payload->>'persona') RETURNING id INTO cid;
FOR msg IN SELECT value FROM jsonb_array_elements(payload->'messages') ORDER BY (value->>'position')::integer LOOP
INSERT INTO public.messages(conversation_id,user_id,role,content,provider,model,attachments,image_path,created_at) VALUES(cid,owner_id,msg->>'role',msg->>'content',msg->>'provider',msg->>'model',msg->'attachments',msg->>'image_path',now() + ((msg->>'position')::integer * interval '1 microsecond'));
END LOOP;
RETURN cid; END; $$;
REVOKE ALL ON FUNCTION public.import_chat_snapshot(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_chat_snapshot(jsonb) TO authenticated;