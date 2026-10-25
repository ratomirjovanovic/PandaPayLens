-- Audit log is append-only at the database level. Application roles cannot
-- change history; only a database owner who drops the trigger could.
CREATE OR REPLACE FUNCTION audit_logs_reject_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_change();
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_reject_change();
--> statement-breakpoint
INSERT INTO roles (code, description) VALUES
  ('admin', 'Manage rule drafts and view limited audit history'),
  ('superadmin', 'Manage administrators, security settings, approvals and releases')
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
INSERT INTO provider_catalog (provider_code, display_name, status, supported_formats, documentation_url) VALUES
  ('stripe', 'Stripe', 'active', '["stripe.api_error","stripe.payment_intent","stripe.event.snapshot"]', 'https://docs.stripe.com/error-codes'),
  ('adyen', 'Adyen', 'active', '["adyen.webhook.standard","adyen.payment_response","adyen.api_error"]', 'https://docs.adyen.com/development-resources/webhooks/webhook-types')
ON CONFLICT (provider_code) DO NOTHING;
