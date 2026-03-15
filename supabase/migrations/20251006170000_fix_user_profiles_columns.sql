-- Add missing columns to user_profiles if table was created without full migration.
-- Run in Supabase Dashboard -> SQL Editor if create_admin.py fails with "Could not find display_name column".

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
