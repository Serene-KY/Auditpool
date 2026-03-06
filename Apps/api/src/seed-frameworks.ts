import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

type ScopeDef = {
  name: string;
  risks: Array<{
    title: string;
    assertion?: string;
    rmmLevel?: string;
    controls: Array<{
      controlCode: string;
      frequency: string;
      controlType: string;
      description: string;
    }>;
  }>;
};

type FrameworkDef = {
  name: string;
  description: string;
  scopes: ScopeDef[];
};

async function ensureSystemTenant(client: Client): Promise<void> {
  const existing = await client.query('SELECT id FROM tenants WHERE id = $1', [SYSTEM_TENANT_ID]);
  if (existing.rows.length > 0) {
    console.log('[framework-seed] SYSTEM tenant already exists');
    return;
  }
  await client.query("INSERT INTO tenants (id, name) VALUES ($1, 'SYSTEM')", [SYSTEM_TENANT_ID]);
  console.log('[framework-seed] inserted SYSTEM tenant');
}

async function upsertFramework(
  client: Client,
  tenantId: string,
  name: string,
  description: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM frameworks WHERE tenant_id = $1 AND name = $2',
    [tenantId, name]
  );
  if (existing.rows.length > 0) {
    console.log('[framework-seed] framework already exists:', { id: existing.rows[0].id, name });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO frameworks (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id',
    [tenantId, name, description]
  );
  console.log('[framework-seed] inserted framework:', { id: ins.rows[0].id, name });
  return ins.rows[0].id;
}

async function upsertAuditScope(
  client: Client,
  tenantId: string,
  frameworkId: string,
  name: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2 AND name = $3',
    [tenantId, frameworkId, name]
  );
  if (existing.rows.length > 0) {
    console.log('[framework-seed] audit_scope already exists:', { id: existing.rows[0].id, name });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO audit_scopes (tenant_id, framework_id, name) VALUES ($1, $2, $3) RETURNING id',
    [tenantId, frameworkId, name]
  );
  console.log('[framework-seed] inserted audit_scope:', { id: ins.rows[0].id, name });
  return ins.rows[0].id;
}

async function upsertRisk(
  client: Client,
  tenantId: string,
  scopeId: string,
  title: string,
  assertion?: string,
  rmmLevel?: string
): Promise<string> {
  const colCheck = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'risks' AND column_name IN ('scope_id', 'audit_scope_id')`
  );
  const scopeCol = colCheck.rows.some((r) => r.column_name === 'scope_id') ? 'scope_id' : 'audit_scope_id';

  const existing = await client.query(
    `SELECT id FROM risks WHERE tenant_id = $1 AND ${scopeCol} = $2 AND title = $3`,
    [tenantId, scopeId, title]
  );
  if (existing.rows.length > 0) {
    console.log('[framework-seed] risk already exists:', { id: existing.rows[0].id, title });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    `INSERT INTO risks (tenant_id, ${scopeCol}, title, assertion, rmm_level) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, scopeId, title, assertion ?? null, rmmLevel ?? null]
  );
  console.log('[framework-seed] inserted risk:', { id: ins.rows[0].id, title });
  return ins.rows[0].id;
}

async function upsertControl(
  client: Client,
  tenantId: string,
  riskId: string,
  frameworkPrefix: string,
  controlCode: string,
  frequency: string,
  controlType: string,
  description: string
): Promise<string> {
  const fullCode = `${frameworkPrefix}-${controlCode}`;
  const existing = await client.query(
    'SELECT id FROM controls WHERE tenant_id = $1 AND control_code = $2',
    [tenantId, fullCode]
  );
  if (existing.rows.length > 0) {
    const descCheck = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'controls' AND column_name = 'description'`
    );
    if (descCheck.rows.length > 0) {
      await client.query('UPDATE controls SET description = $1 WHERE id = $2', [description, existing.rows[0].id]);
    }
    console.log('[framework-seed] control already exists, updated:', { id: existing.rows[0].id, controlCode: fullCode });
    return existing.rows[0].id;
  }

  const descCheck = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'controls' AND column_name = 'description'`
  );
  const hasDesc = descCheck.rows.length > 0;

  if (hasDesc) {
    const ins = await client.query(
      `INSERT INTO controls (tenant_id, risk_id, control_code, frequency, control_type, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [tenantId, riskId, fullCode, frequency, controlType, description]
    );
    console.log('[framework-seed] inserted control:', { id: ins.rows[0].id, controlCode: fullCode });
    return ins.rows[0].id;
  } else {
    // No description column: store type + description as JSON in control_type
    const controlTypeValue = JSON.stringify({ type: controlType, description });
    const ins = await client.query(
      `INSERT INTO controls (tenant_id, risk_id, control_code, frequency, control_type) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, riskId, fullCode, frequency, controlTypeValue]
    );
    console.log('[framework-seed] inserted control (desc in control_type):', { id: ins.rows[0].id, controlCode: fullCode });
    return ins.rows[0].id;
  }
}

function getFrameworkPrefix(name: string): string {
  const map: Record<string, string> = {
    'ISO 27001:2022': 'ISO27001',
    'SOC 2 Type II': 'SOC2',
    SOX: 'SOX',
    'GDPR/AVG': 'GDPR',
    BIO: 'BIO',
    'NEN 7510': 'NEN7510',
    'PCI DSS v4.0': 'PCIDSS',
  };
  return map[name] ?? name.replace(/\s+/g, '');
}

async function seedFramework(client: Client, def: FrameworkDef): Promise<void> {
  const frameworkId = await upsertFramework(client, SYSTEM_TENANT_ID, def.name, def.description);
  const prefix = getFrameworkPrefix(def.name);

  for (const scope of def.scopes) {
    const scopeId = await upsertAuditScope(client, SYSTEM_TENANT_ID, frameworkId, scope.name);

    for (const risk of scope.risks) {
      const riskId = await upsertRisk(
        client,
        SYSTEM_TENANT_ID,
        scopeId,
        risk.title,
        risk.assertion,
        risk.rmmLevel
      );

      for (const ctrl of risk.controls) {
        await upsertControl(
          client,
          SYSTEM_TENANT_ID,
          riskId,
          prefix,
          ctrl.controlCode,
          ctrl.frequency,
          ctrl.controlType,
          ctrl.description
        );
      }
    }
  }
}

const FRAMEWORKS: FrameworkDef[] = [
  {
    name: 'ISO 27001:2022',
    description: 'Information Security Management System - Annex A controls',
    scopes: [
      {
        name: 'Information Security Policies',
        risks: [{ title: 'Lack of documented security policies', assertion: 'Policies defined and communicated', rmmLevel: 'medium', controls: [
          { controlCode: 'A.5.1', frequency: 'annual', controlType: 'preventive', description: 'Policies for information security - define, approve, publish and communicate to employees and relevant external parties' },
          { controlCode: 'A.5.2', frequency: 'continuous', controlType: 'preventive', description: 'Information security roles and responsibilities - allocate and communicate in accordance with organizational policies' },
          { controlCode: 'A.5.3-POL', frequency: 'annual', controlType: 'preventive', description: 'Segregation of duties - conflicting duties and conflicting areas of responsibility shall be segregated' },
        ]}],
      },
      {
        name: 'Organization of Information Security',
        risks: [{ title: 'Unclear security responsibilities', assertion: 'Roles and responsibilities defined', rmmLevel: 'medium', controls: [
          { controlCode: 'A.5.2-ORG', frequency: 'continuous', controlType: 'preventive', description: 'Information security roles and responsibilities' },
          { controlCode: 'A.5.3', frequency: 'continuous', controlType: 'preventive', description: 'Segregation of duties - conflicting duties shall be segregated' },
          { controlCode: 'A.5.5', frequency: 'continuous', controlType: 'preventive', description: 'Contact with authorities - maintain relationships with relevant authorities' },
        ]}],
      },
      {
        name: 'Human Resource Security',
        risks: [{ title: 'Insider threat from untrained staff', assertion: 'Security screening and training', rmmLevel: 'high', controls: [
          { controlCode: 'A.6.1', frequency: 'onboarding', controlType: 'preventive', description: 'Screening - background verification on candidates for employment' },
          { controlCode: 'A.6.2', frequency: 'onboarding', controlType: 'preventive', description: 'Terms and conditions of employment - contractual agreements on information security' },
          { controlCode: 'A.6.3', frequency: 'annual', controlType: 'preventive', description: 'Awareness, education and training - information security awareness and training' },
        ]}],
      },
      {
        name: 'Asset Management',
        risks: [{ title: 'Unmanaged information assets', assertion: 'Assets identified and protected', rmmLevel: 'medium', controls: [
          { controlCode: 'A.5.9', frequency: 'quarterly', controlType: 'detective', description: 'Inventory of information and other associated assets' },
          { controlCode: 'A.5.10', frequency: 'continuous', controlType: 'preventive', description: 'Acceptable use of information and other associated assets' },
          { controlCode: 'A.5.12', frequency: 'continuous', controlType: 'preventive', description: 'Classification of information - procedures for labeling and handling' },
        ]}],
      },
      {
        name: 'Access Control',
        risks: [{ title: 'Unauthorized access to systems', assertion: 'Access restricted by need-to-know', rmmLevel: 'high', controls: [
          { controlCode: 'A.8.2', frequency: 'continuous', controlType: 'preventive', description: 'Privileged access rights - managed and limited' },
          { controlCode: 'A.8.3', frequency: 'continuous', controlType: 'preventive', description: 'Information access restriction - access shall be restricted' },
          { controlCode: 'A.8.4', frequency: 'continuous', controlType: 'preventive', description: 'Access to source code - restricted and managed' },
        ]}],
      },
      {
        name: 'Cryptography',
        risks: [{ title: 'Weak or missing encryption', assertion: 'Cryptography properly used', rmmLevel: 'high',         controls: [
          { controlCode: 'A.8.24', frequency: 'continuous', controlType: 'preventive', description: 'Use of cryptography - rules for effective use defined and implemented' },
          { controlCode: 'A.8.31', frequency: 'continuous', controlType: 'preventive', description: 'Segregation of environments - development, testing and production shall be segregated' },
        ]}],
      },
      {
        name: 'Physical Security',
        risks: [{ title: 'Physical unauthorized access', assertion: 'Physical security perimeters', rmmLevel: 'medium', controls: [
          { controlCode: 'A.7.1', frequency: 'continuous', controlType: 'preventive', description: 'Physical security perimeters - secure areas protected' },
          { controlCode: 'A.7.2', frequency: 'continuous', controlType: 'preventive', description: 'Physical entry - secure areas protected by entry controls' },
          { controlCode: 'A.7.4', frequency: 'continuous', controlType: 'detective', description: 'Physical security monitoring - premises and supporting utilities monitored' },
        ]}],
      },
      {
        name: 'Operations Security',
        risks: [{ title: 'Operational security failures', assertion: 'Operations procedures documented', rmmLevel: 'medium', controls: [
          { controlCode: 'A.5.37', frequency: 'continuous', controlType: 'preventive', description: 'Documented operating procedures - prepared, approved and available' },
          { controlCode: 'A.8.9', frequency: 'quarterly', controlType: 'preventive', description: 'Configuration management - hardware and software configurations controlled' },
          { controlCode: 'A.8.16', frequency: 'continuous', controlType: 'detective', description: 'Monitoring activities - systems monitored for anomalies' },
        ]}],
      },
      {
        name: 'Communications Security',
        risks: [{ title: 'Network security weaknesses', assertion: 'Communications protected', rmmLevel: 'high', controls: [
          { controlCode: 'A.8.20', frequency: 'continuous', controlType: 'preventive', description: 'Networks security - networks managed and controlled' },
          { controlCode: 'A.8.21', frequency: 'continuous', controlType: 'preventive', description: 'Security of network services - service agreements include security' },
          { controlCode: 'A.8.23', frequency: 'continuous', controlType: 'preventive', description: 'Web filtering - access to external websites restricted' },
        ]}],
      },
      {
        name: 'System Acquisition',
        risks: [{ title: 'Insecure system acquisition', assertion: 'Security in acquisition', rmmLevel: 'medium', controls: [
          { controlCode: 'A.8.25', frequency: 'per-project', controlType: 'preventive', description: 'Secure development life cycle' },
          { controlCode: 'A.8.26', frequency: 'per-project', controlType: 'preventive', description: 'Application security requirements - security requirements in development' },
          { controlCode: 'A.8.28', frequency: 'per-project', controlType: 'preventive', description: 'Secure coding - secure development practices' },
        ]}],
      },
      {
        name: 'Supplier Relationships',
        risks: [{ title: 'Third-party security failures', assertion: 'Supplier agreements include security', rmmLevel: 'high', controls: [
          { controlCode: 'A.5.19', frequency: 'per-contract', controlType: 'preventive', description: 'Information and other assets in supplier agreements' },
          { controlCode: 'A.5.20', frequency: 'annual', controlType: 'detective', description: 'Addressing security when dealing with customers' },
          { controlCode: 'A.5.23', frequency: 'continuous', controlType: 'preventive', description: 'Information security for use of cloud services' },
        ]}],
      },
      {
        name: 'Incident Management',
        risks: [{ title: 'Delayed incident response', assertion: 'Incidents detected and managed', rmmLevel: 'high', controls: [
          { controlCode: 'A.5.24', frequency: 'continuous', controlType: 'detective', description: 'Information security incident management planning' },
          { controlCode: 'A.5.25', frequency: 'continuous', controlType: 'corrective', description: 'Assessment and decision on information security events' },
          { controlCode: 'A.5.26', frequency: 'continuous', controlType: 'corrective', description: 'Response to information security incidents' },
        ]}],
      },
      {
        name: 'Business Continuity',
        risks: [{ title: 'Business disruption', assertion: 'Continuity arrangements in place', rmmLevel: 'high', controls: [
          { controlCode: 'A.5.29', frequency: 'annual', controlType: 'preventive', description: 'Information security during disruption' },
          { controlCode: 'A.5.30', frequency: 'annual', controlType: 'preventive', description: 'ICT readiness for business continuity' },
        ]}],
      },
      {
        name: 'Compliance',
        risks: [{ title: 'Regulatory non-compliance', assertion: 'Compliance with legal requirements', rmmLevel: 'high', controls: [
          { controlCode: 'A.5.31', frequency: 'annual', controlType: 'detective', description: 'Legal, statutory, regulatory and contractual requirements' },
          { controlCode: 'A.5.32', frequency: 'annual', controlType: 'detective', description: 'Intellectual property rights' },
          { controlCode: 'A.5.33', frequency: 'annual', controlType: 'detective', description: 'Protection of records' },
        ]}],
      },
    ],
  },
  {
    name: 'SOC 2 Type II',
    description: 'Trust Service Criteria for Service Organizations',
    scopes: [
      {
        name: 'Security (CC)',
        risks: [{ title: 'Inadequate access controls', assertion: 'Logical and physical access protected', rmmLevel: 'high', controls: [
          { controlCode: 'CC6.1', frequency: 'continuous', controlType: 'preventive', description: 'Logical and physical access controls - entity implements logical access security measures to protect against threats' },
          { controlCode: 'CC6.2', frequency: 'quarterly', controlType: 'detective', description: 'Prior to issuing credentials, entity registers and authorizes new internal and external users' },
          { controlCode: 'CC6.3', frequency: 'quarterly', controlType: 'detective', description: 'Entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets' },
          { controlCode: 'CC6.6', frequency: 'continuous', controlType: 'preventive', description: 'Entity implements logical access security software, infrastructure, and architectures' },
        ]}],
      },
      {
        name: 'Availability (A)',
        risks: [{ title: 'System unavailability', assertion: 'System available for operation', rmmLevel: 'high', controls: [
          { controlCode: 'A1.1', frequency: 'continuous', controlType: 'preventive', description: 'Entity maintains, monitors, and evaluates current processing capacity and use of system components' },
          { controlCode: 'A1.2', frequency: 'annual', controlType: 'preventive', description: 'Entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors environmental protections' },
        ]}],
      },
      {
        name: 'Confidentiality (C)',
        risks: [{ title: 'Unauthorized disclosure', assertion: 'Confidential information protected', rmmLevel: 'high', controls: [
          { controlCode: 'C1.1', frequency: 'continuous', controlType: 'preventive', description: 'Entity identifies and maintains confidential information' },
          { controlCode: 'C1.2', frequency: 'continuous', controlType: 'preventive', description: 'Entity discloses confidential information only to meet the entity\'s objectives' },
        ]}],
      },
      {
        name: 'Processing Integrity (PI)',
        risks: [{ title: 'Data processing errors', assertion: 'Processing complete and accurate', rmmLevel: 'medium', controls: [
          { controlCode: 'PI1.1', frequency: 'continuous', controlType: 'preventive', description: 'Entity obtains or generates, uses, and communicates relevant, quality information to support the use of its system' },
          { controlCode: 'PI1.2', frequency: 'continuous', controlType: 'detective', description: 'Entity designs, develops, and performs ongoing evaluations to verify that system processing is complete, accurate, timely, and authorized' },
        ]}],
      },
      {
        name: 'Privacy (P)',
        risks: [{ title: 'Personal information mishandling', assertion: 'Personal information managed per notice', rmmLevel: 'high', controls: [
          { controlCode: 'P1.1', frequency: 'continuous', controlType: 'preventive', description: 'Entity provides notice about its privacy practices' },
          { controlCode: 'P2.1', frequency: 'continuous', controlType: 'preventive', description: 'Entity communicates choices available regarding the collection, use, retention, disclosure, and disposal of personal information' },
        ]}],
      },
    ],
  },
  {
    name: 'SOX',
    description: 'Sarbanes-Oxley Financial Controls - COSO/PCAOB',
    scopes: [
      {
        name: 'Financial Reporting',
        risks: [{ title: 'Material misstatement in financial reports', assertion: 'Financial statements fairly presented', rmmLevel: 'high', controls: [
          { controlCode: 'COSO-1', frequency: 'monthly', controlType: 'detective', description: 'Management review of financial statements and reconciliations' },
          { controlCode: 'COSO-2', frequency: 'quarterly', controlType: 'preventive', description: 'Segregation of duties in financial reporting process' },
          { controlCode: 'COSO-3', frequency: 'quarterly', controlType: 'preventive', description: 'Journal entry and approval controls' },
        ]}],
      },
      {
        name: 'IT General Controls',
        risks: [{ title: 'IT controls failure impacting financial data', assertion: 'IT supports financial reporting integrity', rmmLevel: 'high', controls: [
          { controlCode: 'ITGC-1', frequency: 'quarterly', controlType: 'detective', description: 'Review of system access and privileges for financial systems' },
          { controlCode: 'ITGC-2', frequency: 'quarterly', controlType: 'preventive', description: 'Change management controls for financial systems' },
          { controlCode: 'ITGC-3', frequency: 'annual', controlType: 'detective', description: 'IT general controls audit' },
        ]}],
      },
      {
        name: 'Change Management',
        risks: [{ title: 'Unauthorized system changes', assertion: 'Changes approved and tested', rmmLevel: 'high', controls: [
          { controlCode: 'CHG-1', frequency: 'continuous', controlType: 'preventive', description: 'Change approval and testing prior to production deployment' },
          { controlCode: 'CHG-2', frequency: 'continuous', controlType: 'preventive', description: 'Change Advisory Board review for significant changes' },
        ]}],
      },
      {
        name: 'Access Controls',
        risks: [{ title: 'Excessive or inappropriate access', assertion: 'Access restricted and reviewed', rmmLevel: 'high', controls: [
          { controlCode: 'ACC-1', frequency: 'quarterly', controlType: 'detective', description: 'User access recertification for financial systems' },
          { controlCode: 'ACC-2', frequency: 'onboarding', controlType: 'preventive', description: 'Role-based access provisioning' },
        ]}],
      },
      {
        name: 'Operations',
        risks: [{ title: 'Operational breakdown affecting financial reporting', assertion: 'Operations support accurate reporting', rmmLevel: 'medium', controls: [
          { controlCode: 'OPS-1', frequency: 'monthly', controlType: 'detective', description: 'Reconciliation and exception review' },
          { controlCode: 'OPS-2', frequency: 'quarterly', controlType: 'preventive', description: 'Backup and recovery verification for financial systems' },
        ]}],
      },
    ],
  },
  {
    name: 'GDPR/AVG',
    description: 'General Data Protection Regulation - Algemene Verordening Gegevensbescherming',
    scopes: [
      {
        name: 'Lawful Processing',
        risks: [{ title: 'Unlawful processing of personal data', assertion: 'Lawful basis for all processing', rmmLevel: 'high', controls: [
          { controlCode: 'Art.6', frequency: 'continuous', controlType: 'preventive', description: 'Legal basis for processing - consent, contract, legal obligation, vital interests, public task, legitimate interests' },
          { controlCode: 'Art.7', frequency: 'continuous', controlType: 'preventive', description: 'Conditions for consent - demonstrable, easily withdrawable' },
        ]}],
      },
      {
        name: 'Data Subject Rights',
        risks: [{ title: 'Failure to fulfil data subject requests', assertion: 'Rights exercised without undue delay', rmmLevel: 'high', controls: [
          { controlCode: 'Art.12', frequency: 'on-demand', controlType: 'corrective', description: 'Transparent information and communication - concise, transparent, intelligible' },
          { controlCode: 'Art.15', frequency: 'on-demand', controlType: 'corrective', description: 'Right of access - confirm processing and provide copy' },
          { controlCode: 'Art.16-20', frequency: 'on-demand', controlType: 'corrective', description: 'Rectification, erasure, restriction, portability, objection' },
        ]}],
      },
      {
        name: 'Data Protection by Design',
        risks: [{ title: 'Privacy not built into systems', assertion: 'Privacy by design and default', rmmLevel: 'medium', controls: [
          { controlCode: 'Art.25', frequency: 'per-project', controlType: 'preventive', description: 'Data protection by design and by default - technical and organizational measures' },
          { controlCode: 'Art.32', frequency: 'continuous', controlType: 'preventive', description: 'Security of processing - appropriate technical and organizational measures' },
        ]}],
      },
      {
        name: 'Data Breach Notification',
        risks: [{ title: 'Delayed breach notification', assertion: 'Breaches reported within 72h', rmmLevel: 'high', controls: [
          { controlCode: 'Art.33', frequency: 'on-demand', controlType: 'corrective', description: 'Notification of breach to supervisory authority - without undue delay and within 72 hours' },
          { controlCode: 'Art.34', frequency: 'on-demand', controlType: 'corrective', description: 'Communication of breach to data subjects when high risk' },
        ]}],
      },
      {
        name: 'Data Transfers',
        risks: [{ title: 'Unlawful transfer outside EEA', assertion: 'Transfers meet adequacy or safeguards', rmmLevel: 'high', controls: [
          { controlCode: 'Art.44-49', frequency: 'per-transfer', controlType: 'preventive', description: 'Transfers subject to appropriate safeguards - adequacy decisions, SCCs, BCRs' },
        ]}],
      },
      {
        name: 'DPO Requirements',
        risks: [{ title: 'No designated DPO where required', assertion: 'DPO designated and involved', rmmLevel: 'medium', controls: [
          { controlCode: 'Art.37', frequency: 'continuous', controlType: 'preventive', description: 'Designation of data protection officer - when required' },
          { controlCode: 'Art.38-39', frequency: 'continuous', controlType: 'preventive', description: 'Position of DPO - involved in all issues relating to personal data' },
        ]}],
      },
      {
        name: 'Consent Management',
        risks: [{ title: 'Invalid or inadequate consent', assertion: 'Consent freely given and documented', rmmLevel: 'high', controls: [
          { controlCode: 'Art.7', frequency: 'continuous', controlType: 'preventive', description: 'Conditions for consent - demonstrable, specific, informed, unambiguous' },
          { controlCode: 'Art.8', frequency: 'continuous', controlType: 'preventive', description: 'Conditions applicable to child\'s consent - parental consent for under 16' },
        ]}],
      },
    ],
  },
  {
    name: 'BIO',
    description: 'Baseline Informatiebeveiliging Overheid - Dutch government security baseline',
    scopes: [
      { name: 'Beleid', risks: [{ title: 'Geen structureel beleid', assertion: 'Beleid vastgesteld', rmmLevel: 'medium', controls: [
        { controlCode: 'BI.1.1', frequency: 'annual', controlType: 'preventive', description: 'Informatiebeveiligingsbeleid vastgesteld en gecommuniceerd' },
        { controlCode: 'BI.1.2', frequency: 'annual', controlType: 'preventive', description: 'Beleid periodiek geëvalueerd en bijgewerkt' },
      ]}]},
      { name: 'Organisatie', risks: [{ title: 'Onvoldoende organisatie', assertion: 'Rollen en verantwoordelijkheden vastgelegd', rmmLevel: 'medium', controls: [
        { controlCode: 'BI.2.1', frequency: 'continuous', controlType: 'preventive', description: 'Rollen en verantwoordelijkheden informatiebeveiliging' },
        { controlCode: 'BI.2.2', frequency: 'continuous', controlType: 'preventive', description: 'Scheiding van taken' },
      ]}]},
      { name: 'Personeel', risks: [{ title: 'Personeelsgerelateerde risico\'s', assertion: 'Achtergrondonderzoek en bewustwording', rmmLevel: 'medium', controls: [
        { controlCode: 'BI.3.1', frequency: 'onboarding', controlType: 'preventive', description: 'Achtergrondonderzoek bij indiensttreding' },
        { controlCode: 'BI.3.2', frequency: 'annual', controlType: 'preventive', description: 'Bewustwording en training informatiebeveiliging' },
      ]}]},
      { name: 'Fysieke beveiliging', risks: [{ title: 'Fysieke inbraak of schade', assertion: 'Fysieke toegangsbeperking', rmmLevel: 'medium', controls: [
        { controlCode: 'BI.4.1', frequency: 'continuous', controlType: 'preventive', description: 'Beveiligde gebieden' },
        { controlCode: 'BI.4.2', frequency: 'continuous', controlType: 'preventive', description: 'Toegangsbeheer beveiligde gebieden' },
      ]}]},
      { name: 'Toegangsbeveiliging', risks: [{ title: 'Ongeautoriseerde toegang', assertion: 'Toegang beperkt en gecontroleerd', rmmLevel: 'high', controls: [
        { controlCode: 'BI.5.1', frequency: 'continuous', controlType: 'preventive', description: 'Toegangsrechten beheerd en beperkt volgens need-to-know' },
        { controlCode: 'BI.5.2', frequency: 'quarterly', controlType: 'detective', description: 'Periodieke toegangsrechtenreview' },
      ]}]},
      { name: 'Cryptografie', risks: [{ title: 'Onvoldoende cryptografie', assertion: 'Cryptografie correct toegepast', rmmLevel: 'high', controls: [
        { controlCode: 'BI.6.1', frequency: 'continuous', controlType: 'preventive', description: 'Beleid voor cryptografische beheersmaatregelen' },
      ]}]},
      { name: 'Operationele beveiliging', risks: [{ title: 'Operationele fouten', assertion: 'Procedures gedocumenteerd', rmmLevel: 'medium', controls: [
        { controlCode: 'BI.7.1', frequency: 'continuous', controlType: 'preventive', description: 'Documentatie van operationele procedures' },
        { controlCode: 'BI.7.2', frequency: 'quarterly', controlType: 'detective', description: 'Capaciteitsbeheer' },
      ]}]},
      { name: 'Communicatiebeveiliging', risks: [{ title: 'Onbeveiligde communicatie', assertion: 'Netwerken beveiligd', rmmLevel: 'high', controls: [
        { controlCode: 'BI.8.1', frequency: 'continuous', controlType: 'preventive', description: 'Beveiliging van netwerken' },
      ]}]},
      { name: 'Systeemontwikkeling', risks: [{ title: 'Kwetsbaarheden in systemen', assertion: 'Secure development', rmmLevel: 'high', controls: [
        { controlCode: 'BI.9.1', frequency: 'per-project', controlType: 'preventive', description: 'Beveiligingsvereisten in ontwikkeling' },
      ]}]},
      { name: 'Leveranciers', risks: [{ title: 'Risico\'s via leveranciers', assertion: 'Leveranciersovereenkomsten met beveiliging', rmmLevel: 'high', controls: [
        { controlCode: 'BI.10.1', frequency: 'per-contract', controlType: 'preventive', description: 'Beveiliging in leveranciersovereenkomsten' },
      ]}]},
      { name: 'Incidentbeheer', risks: [{ title: 'Trage incidentafhandeling', assertion: 'Incidenten snel gedetecteerd en afgehandeld', rmmLevel: 'high', controls: [
        { controlCode: 'BI.11.1', frequency: 'continuous', controlType: 'detective', description: 'Incidentbeheer procedures' },
      ]}]},
      { name: 'Bedrijfscontinuïteit', risks: [{ title: 'Verstoring van dienstverlening', assertion: 'Continuïteitsmaatregelen getroffen', rmmLevel: 'high', controls: [
        { controlCode: 'BI.12.1', frequency: 'annual', controlType: 'preventive', description: 'Bedrijfscontinuïteitsplanning' },
      ]}]},
      { name: 'Compliance', risks: [{ title: 'Niet-naleving wet- en regelgeving', assertion: 'Relevante wetgeving nageleefd', rmmLevel: 'high', controls: [
        { controlCode: 'BI.13.1', frequency: 'annual', controlType: 'detective', description: 'Compliance met wet- en regelgeving' },
      ]}]},
    ],
  },
  {
    name: 'NEN 7510',
    description: 'Informatiebeveiliging in de zorg - Dutch healthcare information security',
    scopes: [
      {
        name: 'Informatiebeveiliging in de zorg',
        risks: [{ title: 'Onvoldoende informatiebeveiliging', assertion: 'Zorgspecifieke beveiliging toegepast', rmmLevel: 'high', controls: [
          { controlCode: 'NEN-1.1', frequency: 'annual', controlType: 'preventive', description: 'Beleid informatiebeveiliging in de zorg' },
          { controlCode: 'NEN-1.2', frequency: 'continuous', controlType: 'preventive', description: 'Risicoanalyse en -beheersing' },
        ]}],
      },
      {
        name: 'Patiëntgegevens',
        risks: [{ title: 'Lekkage van patiëntgegevens', assertion: 'Patiëntgegevens beschermd conform AVG', rmmLevel: 'high', controls: [
          { controlCode: 'NEN-2.1', frequency: 'continuous', controlType: 'preventive', description: 'Beveiliging van patiëntgegevens conform AVG en zorgspecifieke eisen' },
          { controlCode: 'NEN-2.2', frequency: 'continuous', controlType: 'preventive', description: 'Classificatie en labeling van patiëntgegevens' },
        ]}],
      },
      {
        name: 'Toegangsbeheer',
        risks: [{ title: 'Ongeautoriseerde toegang tot medische gegevens', assertion: 'Toegang beperkt tot geautoriseerd personeel', rmmLevel: 'high', controls: [
          { controlCode: 'NEN-3.1', frequency: 'quarterly', controlType: 'detective', description: 'Periodieke toegangsrechtenreview voor medische systemen' },
          { controlCode: 'NEN-3.2', frequency: 'continuous', controlType: 'preventive', description: 'Automatische accountvergrendeling' },
        ]}],
      },
      {
        name: 'Logging en monitoring',
        risks: [{ title: 'Geen traceerbaarheid van toegang', assertion: 'Alle relevante toegang gelogd', rmmLevel: 'medium', controls: [
          { controlCode: 'NEN-4.1', frequency: 'continuous', controlType: 'detective', description: 'Logging van toegang tot patiëntgegevens' },
          { controlCode: 'NEN-4.2', frequency: 'continuous', controlType: 'detective', description: 'Bewaring en bescherming van logs' },
        ]}],
      },
      {
        name: 'Medische apparatuur',
        risks: [{ title: 'Kwetsbare medische apparatuur', assertion: 'Apparatuur beveiligd en beheerd', rmmLevel: 'high', controls: [
          { controlCode: 'NEN-5.1', frequency: 'continuous', controlType: 'preventive', description: 'Beveiliging van medische apparatuur' },
        ]}],
      },
      {
        name: 'Continuïteit van zorg',
        risks: [{ title: 'Verstoring van zorgverlening', assertion: 'Continuïteitsmaatregelen getroffen', rmmLevel: 'high', controls: [
          { controlCode: 'NEN-6.1', frequency: 'annual', controlType: 'preventive', description: 'Plan voor continuïteit van zorg' },
        ]}],
      },
    ],
  },
  {
    name: 'PCI DSS v4.0',
    description: 'Payment Card Industry Data Security Standard',
    scopes: [
      {
        name: 'Network Security',
        risks: [{ title: 'Unsecured network boundary', assertion: 'Networks segmented and protected', rmmLevel: 'high', controls: [
          { controlCode: 'Req.1.1', frequency: 'quarterly', controlType: 'preventive', description: 'Firewall configuration and network diagrams maintained' },
          { controlCode: 'Req.1.2', frequency: 'continuous', controlType: 'preventive', description: 'Firewall rules restrict traffic between untrusted and cardholder data environment' },
          { controlCode: 'Req.1.3', frequency: 'quarterly', controlType: 'preventive', description: 'Prohibit direct public access between internet and cardholder data environment' },
        ]}],
      },
      {
        name: 'Cardholder Data Protection',
        risks: [{ title: 'Storage of sensitive authentication data', assertion: 'PAN protected at rest and in transit', rmmLevel: 'high', controls: [
          { controlCode: 'Req.3.4', frequency: 'continuous', controlType: 'preventive', description: 'PAN rendered unreadable (encryption, hashing, truncation)' },
          { controlCode: 'Req.3.5', frequency: 'continuous', controlType: 'preventive', description: 'Document and implement key management processes' },
        ]}],
      },
      {
        name: 'Vulnerability Management',
        risks: [{ title: 'Unpatched systems', assertion: 'Systems protected against known threats', rmmLevel: 'high', controls: [
          { controlCode: 'Req.6.1', frequency: 'quarterly', controlType: 'preventive', description: 'Security patches applied within required timeframes' },
          { controlCode: 'Req.6.2', frequency: 'annual', controlType: 'preventive', description: 'Software development follows secure coding practices' },
        ]}],
      },
      {
        name: 'Access Control',
        risks: [{ title: 'Excessive access privileges', assertion: 'Access restricted by need-to-know', rmmLevel: 'high', controls: [
          { controlCode: 'Req.7.1', frequency: 'quarterly', controlType: 'preventive', description: 'Access to system components restricted by need-to-know' },
          { controlCode: 'Req.7.2', frequency: 'onboarding', controlType: 'preventive', description: 'Access control system for system components' },
        ]}],
      },
      {
        name: 'Monitoring',
        risks: [{ title: 'Undetected malicious activity', assertion: 'Systems monitored and logs reviewed', rmmLevel: 'high', controls: [
          { controlCode: 'Req.10.1', frequency: 'continuous', controlType: 'detective', description: 'Audit trail mechanisms for access to cardholder data' },
          { controlCode: 'Req.10.2', frequency: 'daily', controlType: 'detective', description: 'Automated audit trails for reconstructing events' },
        ]}],
      },
      {
        name: 'Security Testing',
        risks: [{ title: 'Undetected vulnerabilities', assertion: 'Regular security testing performed', rmmLevel: 'high', controls: [
          { controlCode: 'Req.11.1', frequency: 'quarterly', controlType: 'detective', description: 'External and internal vulnerability scans' },
          { controlCode: 'Req.11.2', frequency: 'annual', controlType: 'detective', description: 'External penetration testing' },
        ]}],
      },
      {
        name: 'Security Policy',
        risks: [{ title: 'No documented security program', assertion: 'Security policy maintained', rmmLevel: 'medium', controls: [
          { controlCode: 'Req.12.1', frequency: 'annual', controlType: 'preventive', description: 'Formal security policy established' },
          { controlCode: 'Req.12.2', frequency: 'annual', controlType: 'preventive', description: 'Annual risk assessment' },
        ]}],
      },
    ],
  },
];

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [SYSTEM_TENANT_ID]);

    await ensureSystemTenant(client);

    for (const framework of FRAMEWORKS) {
      console.log('[framework-seed] seeding framework:', framework.name);
      await seedFramework(client, framework);
    }

    await client.query('COMMIT');
    console.log('[framework-seed] done');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('[framework-seed] failed:', err);
  process.exit(1);
});
