-- Allow multiple group chats per client.
--
-- The partial unique index `conversations_client_group_unique` (added in an
-- earlier migration) restricted each client to exactly one group conversation.
-- Coaches now need to create multiple named groups per client, so we drop it.
--
-- The composite unique constraint `conversations_client_id_coach_id_member_id_key`
-- on (client_id, coach_id, member_id) stays. For groups, member_id is NULL,
-- and Postgres treats distinct NULLs as not-equal in unique indexes, so the
-- composite key does not block multiple groups per client.

DROP INDEX IF EXISTS public.conversations_client_group_unique;
