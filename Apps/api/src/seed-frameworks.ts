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
    const ins = await client.query(
      `INSERT INTO controls (tenant_id, risk_id, control_code, frequency, control_type) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, riskId, fullCode, frequency, controlType]
    );
    console.log('[framework-seed] inserted control (no description col):', { id: ins.rows[0].id, controlCode: fullCode });
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
        risks: [
          {
            title: 'Lack of documented security policies',
            assertion: 'Policies are defined, approved and communicated',
            rmmLevel: 'medium',
            controls: [
              { controlCode: 'A.5.1', frequency: 'annual', controlType: 'preventive', description: 'Policies for information security - define, approve, publish and communicate to employees and relevant external parties' },
              { controlCode: 'A.5.2', frequency: 'continuous', controlType: 'preventive', description: 'Information security roles and responsibilities - allocate and communicate in accordance with organizational policies' },
            ],
          },
        ],
      },
      {
        name: 'Organization of Information Security',
        risks: [
          {
            title: 'Unclear security responsibilities',
            controls: [
              { controlCode: 'A.5.2', frequency: 'continuous', controlType: 'preventive', description: 'Information security roles and responsibilities' },
              { controlCode: 'A.5.3', frequency: 'continuous', controlType: 'preventive', description: 'Segregation of duties - conflicting duties and conflicting areas of responsibility shall be segregated' },
            ],
          },
        ],
      },
      {
        name: 'Access Control',
        risks: [
          {
            title: 'Unauthorized access to systems',
            controls: [
              { controlCode: 'A.8.2', frequency: 'continuous', controlType: 'preventive', description: 'Privileged access rights - managed and limited' },
              { controlCode: 'A.8.3', frequency: 'continuous', controlType: 'preventive', description: 'Information access restriction - access to information and other assets shall be restricted' },
            ],
          },
        ],
      },
      {
        name: 'Cryptography',
        risks: [
          {
            title: 'Weak or missing encryption',
            controls: [
              { controlCode: 'A.8.24', frequency: 'continuous', controlType: 'preventive', description: 'Use of cryptography - rules for the effective use of cryptography shall be defined and implemented' },
            ],
          },
        ],
      },
      {
        name: 'Incident Management',
        risks: [
          {
            title: 'Delayed incident response',
            controls: [
              { controlCode: 'A.5.24', frequency: 'continuous', controlType: 'detective', description: 'Information security incident management planning' },
              { controlCode: 'A.5.25', frequency: 'continuous', controlType: 'corrective', description: 'Assessment and decision on information security events' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'SOC 2 Type II',
    description: 'Trust Service Criteria for Service Organizations',
    scopes: [
      {
        name: 'Security (CC)',
        risks: [
          {
            title: 'Inadequate access controls',
            controls: [
              { controlCode: 'CC6.1', frequency: 'continuous', controlType: 'preventive', description: 'Logical and physical access controls - the entity implements logical access security measures to protect against threats' },
              { controlCode: 'CC6.2', frequency: 'quarterly', controlType: 'detective', description: 'Prior to issuing system credentials, the entity registers and authorizes new internal and external users' },
            ],
          },
        ],
      },
      {
        name: 'Availability (A)',
        risks: [
          {
            title: 'System unavailability',
            controls: [
              { controlCode: 'A1.1', frequency: 'continuous', controlType: 'preventive', description: 'The entity maintains, monitors, and evaluates current processing capacity and use of system components' },
            ],
          },
        ],
      },
      {
        name: 'Confidentiality (C)',
        risks: [
          {
            title: 'Unauthorized disclosure',
            controls: [
              { controlCode: 'C1.1', frequency: 'continuous', controlType: 'preventive', description: 'The entity identifies and maintains confidential information' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'SOX',
    description: 'Sarbanes-Oxley Financial Controls - COSO/PCAOB',
    scopes: [
      {
        name: 'Financial Reporting',
        risks: [
          {
            title: 'Material misstatement in financial reports',
            controls: [
              { controlCode: 'COSO-1', frequency: 'monthly', controlType: 'detective', description: 'Management review of financial statements and reconciliations' },
              { controlCode: 'COSO-2', frequency: 'quarterly', controlType: 'preventive', description: 'Segregation of duties in financial reporting process' },
            ],
          },
        ],
      },
      {
        name: 'IT General Controls',
        risks: [
          {
            title: 'IT controls failure impacting financial data',
            controls: [
              { controlCode: 'ITGC-1', frequency: 'quarterly', controlType: 'detective', description: 'Review of system access and privileges' },
              { controlCode: 'ITGC-2', frequency: 'quarterly', controlType: 'preventive', description: 'Change management controls for financial systems' },
            ],
          },
        ],
      },
      {
        name: 'Change Management',
        risks: [
          {
            title: 'Unauthorized system changes',
            controls: [
              { controlCode: 'CHG-1', frequency: 'continuous', controlType: 'preventive', description: 'Change approval and testing prior to production deployment' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'GDPR/AVG',
    description: 'General Data Protection Regulation - Algemene Verordening Gegevensbescherming',
    scopes: [
      {
        name: 'Lawful Processing',
        risks: [
          {
            title: 'Unlawful processing of personal data',
            controls: [
              { controlCode: 'Art.6', frequency: 'continuous', controlType: 'preventive', description: 'Legal basis for processing - ensure one of the lawful bases applies (consent, contract, legal obligation, etc.)' },
            ],
          },
        ],
      },
      {
        name: 'Data Subject Rights',
        risks: [
          {
            title: 'Failure to fulfil data subject requests',
            controls: [
              { controlCode: 'Art.12-23', frequency: 'on-demand', controlType: 'corrective', description: 'Rights of access, rectification, erasure, restriction, portability, objection' },
            ],
          },
        ],
      },
      {
        name: 'Data Breach Notification',
        risks: [
          {
            title: 'Delayed breach notification',
            controls: [
              { controlCode: 'Art.33', frequency: 'on-demand', controlType: 'corrective', description: '72-hour notification to supervisory authority of personal data breach' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'BIO',
    description: 'Baseline Informatiebeveiliging Overheid - Dutch government security baseline',
    scopes: [
      {
        name: 'Beleid',
        risks: [
          {
            title: 'Geen structureel beleid',
            controls: [
              { controlCode: 'BIO-1', frequency: 'annual', controlType: 'preventive', description: 'Informatiebeveiligingsbeleid vastgesteld en gecommuniceerd' },
            ],
          },
        ],
      },
      {
        name: 'Toegangsbeveiliging',
        risks: [
          {
            title: 'Ongeautoriseerde toegang',
            controls: [
              { controlCode: 'BIO-2', frequency: 'continuous', controlType: 'preventive', description: 'Toegangsrechten beheerd en beperkt volgens need-to-know' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'NEN 7510',
    description: 'Informatiebeveiliging in de zorg - Dutch healthcare information security',
    scopes: [
      {
        name: 'Patiëntgegevens',
        risks: [
          {
            title: 'Lekkage van patiëntgegevens',
            controls: [
              { controlCode: 'NEN-1', frequency: 'continuous', controlType: 'preventive', description: 'Beveiliging van patiëntgegevens conform AVG en zorgspecifieke eisen' },
            ],
          },
        ],
      },
      {
        name: 'Toegangsbeheer',
        risks: [
          {
            title: 'Ongeautoriseerde toegang tot medische gegevens',
            controls: [
              { controlCode: 'NEN-2', frequency: 'quarterly', controlType: 'detective', description: 'Periodieke toegangsrechtenreview voor medische systemen' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'PCI DSS v4.0',
    description: 'Payment Card Industry Data Security Standard',
    scopes: [
      {
        name: 'Network Security',
        risks: [
          {
            title: 'Unsecured network boundary',
            controls: [
              { controlCode: 'Req.1.1', frequency: 'quarterly', controlType: 'preventive', description: 'Firewall configuration and network diagrams maintained' },
              { controlCode: 'Req.1.2', frequency: 'continuous', controlType: 'preventive', description: 'Firewall rules restrict traffic between untrusted and cardholder data environment' },
            ],
          },
        ],
      },
      {
        name: 'Cardholder Data Protection',
        risks: [
          {
            title: 'Storage of sensitive authentication data',
            controls: [
              { controlCode: 'Req.3.4', frequency: 'continuous', controlType: 'preventive', description: 'PAN rendered unreadable (encryption, hashing, truncation)' },
            ],
          },
        ],
      },
      {
        name: 'Vulnerability Management',
        risks: [
          {
            title: 'Unpatched systems',
            controls: [
              { controlCode: 'Req.6.1', frequency: 'quarterly', controlType: 'preventive', description: 'Security patches applied within required timeframes' },
            ],
          },
        ],
      },
      {
        name: 'Access Control',
        risks: [
          {
            title: 'Excessive access privileges',
            controls: [
              { controlCode: 'Req.7.1', frequency: 'quarterly', controlType: 'preventive', description: 'Access to system components restricted by need-to-know' },
            ],
          },
        ],
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
