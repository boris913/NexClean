-- M1-AUD-01 : le journal d'audit est en ajout seul.
-- Un déclencheur rejette toute modification ou suppression, quel que soit le rôle applicatif.
CREATE OR REPLACE FUNCTION journal_audit_interdire_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'journal_audit est en ajout seul (% interdit)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER journal_audit_sans_update_delete
  BEFORE UPDATE OR DELETE ON journal_audit
  FOR EACH ROW EXECUTE FUNCTION journal_audit_interdire_modification();
--> statement-breakpoint
CREATE TRIGGER journal_audit_sans_truncate
  BEFORE TRUNCATE ON journal_audit
  FOR EACH STATEMENT EXECUTE FUNCTION journal_audit_interdire_modification();
