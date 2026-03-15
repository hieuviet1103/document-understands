-- Add missing columns to documents if table exists with partial schema.
-- Run in Supabase SQL Editor if you get PGRST204 "Could not find the 'file_type' column".

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_type text NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_size bigint NOT NULL DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS storage_path text NOT NULL DEFAULT '';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed'));
