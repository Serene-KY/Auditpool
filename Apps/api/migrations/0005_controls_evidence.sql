-- Evidence table
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  engagement_id uuid NOT NULL REFERENCES engagements(id),
  sha256 text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_tenant_rls ON evidence
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Unique index
CREATE UNIQUE INDEX idx_evidence_tenant_engagement_sha256
ON evidence (tenant_id, engagement_id, sha256);