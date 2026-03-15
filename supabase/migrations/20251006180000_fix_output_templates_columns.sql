-- Add missing columns to output_templates if table exists with partial schema.
-- Run in Supabase SQL Editor if you get PGRST204 "Could not find the 'output_format' column".

ALTER TABLE public.output_templates ADD COLUMN IF NOT EXISTS output_format text NOT NULL DEFAULT 'json' CHECK (output_format IN ('text', 'json', 'excel'));
ALTER TABLE public.output_templates ADD COLUMN IF NOT EXISTS schema jsonb NOT NULL DEFAULT '{}'::jsonb;
