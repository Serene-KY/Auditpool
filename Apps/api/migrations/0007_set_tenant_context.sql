CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tenant_uuid::text, true);
END;
$$ LANGUAGE plpgsql;