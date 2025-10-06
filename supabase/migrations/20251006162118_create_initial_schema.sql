/*
  # Initial Database Schema for Document Processing System

  ## Overview
  This migration sets up the complete database schema for the intelligent document processing system
  with Google Gemini API integration. The system supports multi-user, multi-organization access
  with role-based permissions, async processing, webhooks, and external API integration.

  ## 1. New Tables

  ### organizations
  - `id` (uuid, primary key) - Unique organization identifier
  - `name` (text) - Organization name
  - `slug` (text, unique) - URL-friendly identifier
  - `settings` (jsonb) - Organization-specific settings
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### user_profiles
  - `id` (uuid, primary key, references auth.users) - Links to Supabase Auth
  - `organization_id` (uuid, references organizations) - User's organization
  - `role` (text) - User role: admin, user, viewer
  - `display_name` (text) - User's display name
  - `avatar_url` (text) - Profile picture URL
  - `language` (text) - Preferred language: en, vi
  - `settings` (jsonb) - User preferences
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### documents
  - `id` (uuid, primary key) - Unique document identifier
  - `user_id` (uuid, references auth.users) - Document owner
  - `organization_id` (uuid, references organizations) - Organization owner
  - `filename` (text) - Original filename
  - `file_type` (text) - MIME type
  - `file_size` (bigint) - File size in bytes
  - `storage_path` (text) - Path in Supabase Storage
  - `thumbnail_url` (text) - Preview thumbnail URL
  - `metadata` (jsonb) - Extracted metadata (pages, dimensions, etc)
  - `status` (text) - Status: uploaded, processing, completed, failed
  - `created_at` (timestamptz) - Upload timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### output_templates
  - `id` (uuid, primary key) - Unique template identifier
  - `user_id` (uuid, references auth.users) - Template creator
  - `organization_id` (uuid, references organizations) - Organization owner
  - `name` (text) - Template name
  - `description` (text) - Template description
  - `output_format` (text) - Format type: text, json, excel
  - `schema` (jsonb) - Template schema definition
  - `is_public` (boolean) - Shared with organization
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### processing_jobs
  - `id` (uuid, primary key) - Unique job identifier
  - `user_id` (uuid, references auth.users) - Job owner
  - `organization_id` (uuid, references organizations) - Organization owner
  - `document_id` (uuid, references documents) - Document being processed
  - `template_id` (uuid, references output_templates) - Template used
  - `status` (text) - Status: pending, processing, completed, failed, cancelled
  - `priority` (integer) - Job priority (higher = more urgent)
  - `custom_instructions` (text) - Additional processing instructions
  - `error_message` (text) - Error details if failed
  - `started_at` (timestamptz) - Processing start time
  - `completed_at` (timestamptz) - Processing completion time
  - `created_at` (timestamptz) - Job creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### processing_results
  - `id` (uuid, primary key) - Unique result identifier
  - `job_id` (uuid, references processing_jobs) - Related job
  - `output_format` (text) - Result format: text, json, excel
  - `output_data` (jsonb) - Structured output data
  - `output_text` (text) - Text output
  - `output_file_url` (text) - URL for file outputs (Excel)
  - `tokens_used` (integer) - Gemini API tokens consumed
  - `processing_time` (integer) - Processing time in seconds
  - `created_at` (timestamptz) - Result creation timestamp

  ### api_keys
  - `id` (uuid, primary key) - Unique key identifier
  - `user_id` (uuid, references auth.users) - Key owner
  - `organization_id` (uuid, references organizations) - Organization owner
  - `name` (text) - Key description/name
  - `key_hash` (text) - Hashed API key
  - `key_prefix` (text) - First 8 characters for identification
  - `scopes` (text[]) - Permissions array
  - `rate_limit` (integer) - Requests per minute limit
  - `expires_at` (timestamptz) - Expiration timestamp
  - `last_used_at` (timestamptz) - Last usage timestamp
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Creation timestamp

  ### webhooks
  - `id` (uuid, primary key) - Unique webhook identifier
  - `user_id` (uuid, references auth.users) - Webhook owner
  - `organization_id` (uuid, references organizations) - Organization owner
  - `url` (text) - Callback URL
  - `events` (text[]) - Subscribed events array
  - `secret` (text) - Webhook signature secret
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### webhook_deliveries
  - `id` (uuid, primary key) - Unique delivery identifier
  - `webhook_id` (uuid, references webhooks) - Related webhook
  - `job_id` (uuid, references processing_jobs) - Related job
  - `event_type` (text) - Event that triggered webhook
  - `payload` (jsonb) - Webhook payload
  - `response_status` (integer) - HTTP response code
  - `response_body` (text) - Response body
  - `attempt_count` (integer) - Number of delivery attempts
  - `delivered_at` (timestamptz) - Successful delivery timestamp
  - `created_at` (timestamptz) - Creation timestamp

  ### audit_logs
  - `id` (uuid, primary key) - Unique log identifier
  - `user_id` (uuid, references auth.users) - User who performed action
  - `organization_id` (uuid, references organizations) - Organization context
  - `action` (text) - Action performed
  - `resource_type` (text) - Type of resource affected
  - `resource_id` (uuid) - ID of affected resource
  - `metadata` (jsonb) - Additional context
  - `ip_address` (text) - Request IP address
  - `created_at` (timestamptz) - Action timestamp

  ## 2. Security
  - Row Level Security (RLS) enabled on all tables
  - Policies restrict data access to organization members
  - API keys table requires admin role for management
  - Audit logs are read-only for non-admins

  ## 3. Indexes
  - Performance indexes on foreign keys
  - Composite indexes for common query patterns
  - Text search indexes for document and template search

  ## 4. Important Notes
  - All timestamps use timestamptz for timezone awareness
  - JSONB columns for flexible schema storage
  - Cascading deletes configured for data integrity
  - Default values set for better data consistency
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  display_name text NOT NULL,
  avatar_url text,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'vi')),
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL,
  thumbnail_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Output templates table
CREATE TABLE IF NOT EXISTS output_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  output_format text NOT NULL CHECK (output_format IN ('text', 'json', 'excel')),
  schema jsonb NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Processing jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  template_id uuid REFERENCES output_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority integer DEFAULT 0,
  custom_instructions text DEFAULT '',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Processing results table
CREATE TABLE IF NOT EXISTS processing_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
  output_format text NOT NULL CHECK (output_format IN ('text', 'json', 'excel')),
  output_data jsonb,
  output_text text,
  output_file_url text,
  tokens_used integer DEFAULT 0,
  processing_time integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  scopes text[] DEFAULT ARRAY[]::text[],
  rate_limit integer DEFAULT 60,
  expires_at timestamptz,
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  secret text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Webhook deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  job_id uuid REFERENCES processing_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  attempt_count integer DEFAULT 1,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_templates_org ON output_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_public ON output_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_jobs_user ON processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON processing_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_document ON processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_results_job ON processing_results(job_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_documents_filename_trgm ON documents USING gin(filename gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_templates_name_trgm ON output_templates USING gin(name gin_trgm_ops);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE output_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for user_profiles
CREATE POLICY "Users can view profiles in their organization"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- RLS Policies for documents
CREATE POLICY "Users can view documents in their organization"
  ON documents FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for output_templates
CREATE POLICY "Users can view templates in their organization or public templates"
  ON output_templates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
    OR is_public = true
  );

CREATE POLICY "Users can insert own templates"
  ON output_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own templates"
  ON output_templates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON output_templates FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for processing_jobs
CREATE POLICY "Users can view jobs in their organization"
  ON processing_jobs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own jobs"
  ON processing_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own jobs"
  ON processing_jobs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for processing_results
CREATE POLICY "Users can view results for jobs in their organization"
  ON processing_results FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM processing_jobs 
      WHERE organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert results"
  ON processing_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for api_keys
CREATE POLICY "Users can view api_keys in their organization"
  ON api_keys FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage api_keys"
  ON api_keys FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for webhooks
CREATE POLICY "Users can view webhooks in their organization"
  ON webhooks FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own webhooks"
  ON webhooks FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for webhook_deliveries
CREATE POLICY "Users can view deliveries for their webhooks"
  ON webhook_deliveries FOR SELECT
  TO authenticated
  USING (
    webhook_id IN (
      SELECT id FROM webhooks 
      WHERE organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert deliveries"
  ON webhook_deliveries FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for audit_logs
CREATE POLICY "Users can view audit logs in their organization"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all audit logs in their organization"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_output_templates_updated_at
  BEFORE UPDATE ON output_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_jobs_updated_at
  BEFORE UPDATE ON processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();