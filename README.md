# Auditpool

API en backend voor Auditpool: multi-tenant audit/framework-app met Supabase.

---

## Wat is er gebouwd

- **Node.js API** (Fastify) in `apps/api`
- **Supabase** als backend (REST, geen directe Postgres-DNS nodig)
- **Multi-tenant** via header `x-tenant-id`
- **Endpoints:** health, tenant(s), frameworks (GET + POST)
- **Migrations-map** voor database-migraties: `apps/api/migrations`

---

## Projectstructuur

```
Auditpool/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── server.ts    # Fastify-server en routes
│       │   ├── db.ts        # Supabase-client
│       │   └── tenant.ts    # Tenant-helpers (getTenantFromHeader, requireTenant, setTenantContext)
│       ├── migrations/      # SQL-migraties (zie Migration Plan)
│       ├── .env             # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (niet committen)
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
├── .vscode/
│   └── settings.json       # Terminal opent standaard in apps/api
└── README.md
```

---

## Snel starten

### Vereisten

- Node.js (LTS)
- Supabase-project (dashboard op [supabase.com](https://supabase.com))

### 1. Dependencies installeren

```bash
cd apps/api
npm install
```

### 2. Omgeving (.env)

Kopieer `.env.example` naar `.env` en vul in:

- **SUPABASE_URL** – Project-URL (bijv. `https://xxxxx.supabase.co`)
- **SUPABASE_SERVICE_ROLE_KEY** – Service role key uit Project Settings → API

Optioneel: **PORT** (standaard 3001).

### 3. API starten

```bash
cd apps/api
npm run dev
```

Server draait op **http://localhost:3001**.

---

## API-endpoints

| Method | Pad         | Header           | Beschrijving                    |
|--------|-------------|------------------|----------------------------------|
| GET    | /health     | —                | Health check (`{ "ok": true }`)  |
| GET    | /tenant     | —                | Tenant uit header (`{ "tenant": "..." \| null }`) |
| GET    | /tenants    | x-tenant-id      | Lijst tenants (id, name)        |
| GET    | /framework  | x-tenant-id      | Lijst frameworks                |
| GET    | /frameworks | x-tenant-id      | Zelfde als /framework            |
| POST   | /frameworks | x-tenant-id      | Framework aanmaken (body: name, description) |

Alle routes behalve `/health` en `/tenant` vereisen **x-tenant-id** voor tenant-context.

---

## Testen (PowerShell)

```powershell
# Health
Invoke-RestMethod -Uri "http://localhost:3001/health"

# Tenants (met tenant-id)
$result = Invoke-RestMethod -Uri "http://localhost:3001/tenants" -Headers @{ "x-tenant-id" = "JOUW-TENANT-UUID" }
$result

# Frameworks ophalen
Invoke-RestMethod -Uri "http://localhost:3001/frameworks" -Headers @{ "x-tenant-id" = "JOUW-TENANT-UUID" }

# Framework aanmaken
Invoke-RestMethod -Uri "http://localhost:3001/frameworks" -Method POST `
  -Headers @{ "x-tenant-id" = "JOUW-TENANT-UUID"; "Content-Type" = "application/json" } `
  -Body '{"name":"Mijn Framework","description":"Omschrijving"}'
```

---

## Migration Plan

Database-migraties staan in **apps/api/migrations/** en worden in deze volgorde uitgevoerd:

| #   | Bestand                      | Inhoud                                      |
|-----|------------------------------|---------------------------------------------|
| 1   | `0001_extensions.sql`         | pgcrypto extension                          |
| 2   | `0002_tenants.sql`            | Tabel `tenants` + RLS                        |
| 3   | `0003_users_roles.sql`        | Tabellen `users`, `roles`, `user_roles`     |
| 4   | `0004_engagements.sql`        | Tabel `engagements` + gerelateerde tabellen |
| 5   | `0005_controls_evidence.sql` | Tabellen `controls`, `evidence`, `evidence_links` + indexes |
| 6   | `0006_audit_ai_logs.sql`      | Tabellen `audit_logs`, `ai_logs` + indexes  |
| 7   | `0007_set_tenant_context.sql`| Functie `set_tenant_context`                |

Migraties handmatig uitvoeren via Supabase Dashboard → SQL Editor, of via een migratie-tool die je later toevoegt.

---

## Technische notities

- **Supabase:** verbinding via REST (Supabase JS client), geen directe Postgres-connection string nodig; voorkomt DNS-problemen met `db.xxx.supabase.co`.
- **Tenant:** ontbrekende header `x-tenant-id` geeft **400** met `Tenant header required` (geen 500).
- **Poort in gebruik:** als poort 3001 al in gebruik is, stop het andere proces of zet `PORT` in `.env` op een andere poort.
