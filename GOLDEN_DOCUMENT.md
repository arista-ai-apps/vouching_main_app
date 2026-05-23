# Arista AI — SV-CIE Vouching Platform: Golden Reference Document

> **Purpose**: This document is the single source of truth for any AI agent working on this codebase. It covers what the app does, how data flows, the full tech stack, every module, and deployment config.

---

## 1. What This Application Does

**Arista AI SV-CIE** is a CA (Chartered Accountant) audit automation platform for **Purchase and Sales Vouching** under Indian GST compliance.

### Business Context
In Indian CA audits, auditors must verify that:
1. Every purchase **invoice PDF** (voucher) in a company's records matches an entry in the **Purchase Register** (Excel) and in **GSTR-2B** (government GST portal data).
2. Every **Bill of Sale PDF** (sales voucher) matches a corresponding entry in the **Sales Register** (Excel).
3. All **HSN codes** on invoices are correct per the government master list.
4. Tax types (CGST/SGST for intra-state, IGST for inter-state) are correctly applied based on supplier location.

### What the App Automates
| Manual Task | Automated By |
|---|---|
| Reading invoice PDFs to extract data | GPT-4o-mini OCR + structured JSON extraction |
| Cross-referencing invoices with Excel registers | Python fuzzy matching reconciliation engine |
| Flagging GST mismatches (ITC issues) | 3-way match against Purchase Register + GSTR-2B |
| Identifying missing/wrong HSN codes | TF-IDF + GPT-4o-mini HSN recommendation engine |
| Validating tax type (CGST vs IGST) | Place-of-supply logic validator |
| Generating audit exception reports | Auto-generated from `ReconciliationResult` table |

---

## 2. Repository Structure

```
vouching_v2/                        ← Production folder (clean, no test data)
├── .gitignore
├── HSN/                            ← HSN master data CSVs (8-digit codes)
│
├── frontend/                       ← Next.js 16 app (React 19, Tailwind CSS)
│   ├── .env                        ← TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, NEXT_PUBLIC_API_BASE
│   ├── netlify.toml
│   ├── prisma/
│   │   └── schema.prisma           ← Full DB schema (mirrors Python models)
│   └── src/
│       ├── config.ts               ← API_BASE export (centralized)
│       ├── lib/prisma.ts           ← Prisma singleton with libsql adapter
│       ├── components/
│       │   ├── DashboardLayout.tsx ← Auth guard + sidebar + logout
│       │   └── Sidebar.tsx         ← Navigation sidebar
│       └── app/
│           ├── login/page.tsx      ← Auth gate (admin/admin@aristaai)
│           ├── page.tsx            ← Client selection (auth-guarded)
│           ├── vouching/           ← Purchase Invoice Inbox (main workflow)
│           ├── bill-of-sale/       ← Sales voucher inbox
│           ├── uploads/            ← Registry upload portal (3 registers)
│           ├── purchase-registry/  ← View Purchase Register rows
│           ├── sales-registry/     ← View Sales Register rows
│           ├── gstr2b/             ← View GSTR-2B register rows
│           ├── reconciliation/     ← Trigger manual reconciliation
│           ├── reports/            ← Verification report dashboard
│           ├── exceptions/         ← Exception log viewer
│           ├── clients/            ← Client management
│           └── engagements/        ← Engagement management
│
└── backend/                        ← FastAPI (Python 3.10+)
    ├── .env                        ← DATABASE_URL, OPENAI_API_KEY, CORS_ORIGINS
    ├── requirements.txt
    └── app/
        ├── main.py                 ← FastAPI app, CORS, route registration
        ├── core/
        │   ├── config.py           ← Pydantic settings (reads .env)
        │   └── database.py         ← SQLAlchemy engine (SQLite dev / Turso prod)
        ├── models/
        │   └── models.py           ← All 12 SQLAlchemy ORM models
        ├── schemas/
        │   └── schemas.py          ← Pydantic response schemas
        ├── api/
        │   ├── clients.py          ← CRUD for Client entities
        │   ├── engagements.py      ← CRUD for Engagement entities
        │   ├── files.py            ← Invoice upload, processing, summary
        │   ├── registers.py        ← Purchase / Sales / GSTR-2B register upload
        │   ├── bill_of_sale.py     ← Bill of Sale upload, retry, summary
        │   ├── reconciliation.py   ← Manual reconciliation trigger
        │   ├── exceptions.py       ← Exception log CRUD
        │   └── hsn.py              ← HSN recommendation endpoints
        └── services/
            ├── extraction.py       ← GPT-4o-mini invoice & BOS data extraction
            ├── reconciliation.py   ← 3-way match engine
            ├── hsn_recommender.py  ← TF-IDF + GPT HSN classification
            └── tax_validator.py    ← CGST/SGST vs IGST validator
```

---

## 3. Database Models (SQLAlchemy / Prisma)

All models live in `backend/app/models/models.py` and mirrored in `frontend/prisma/schema.prisma`.

### Entity Relationship

```
Client (1) ──────── (N) Engagement
Engagement (1) ─┬── (N) UploadedFile
                ├── (N) BillOfSaleFile
                ├── (N) PurchaseRegister
                ├── (N) SalesRegister
                └── (N) GstRegister

UploadedFile (1) ──── (1) ExtractedInvoice
                           └── (1) ReconciliationResult
                           └── (1) TaxTypeMismatch
                           └── (1) HsnRecommendation

BillOfSaleFile (1) ── (1) ExtractedBillOfSale
                           └── (1) ReconciliationResult

PurchaseRegister (1) ─ (N) PurchaseRegisterRow
SalesRegister (1) ──── (N) SalesRegisterRow
GstRegister (1) ─────── (N) GstRegisterRow
```

### Key Models

#### `UploadedFile`
Tracks each invoice PDF uploaded. Status lifecycle: `uploaded → processing → extracted | failed`

| Column | Type | Purpose |
|---|---|---|
| id | Integer PK | |
| engagement_id | FK → Engagement | Scopes data to a client audit |
| filename | String | Original PDF filename |
| file_path | String | Absolute path on server disk |
| status | String | `uploaded`, `processing`, `extracted`, `failed` |

#### `ExtractedInvoice`
AI-extracted data from invoice PDFs.

| Column | Type | Purpose |
|---|---|---|
| file_id | FK → UploadedFile | 1:1 relationship |
| invoice_number | String | Tax invoice number |
| invoice_date | Date | |
| vendor_name | String | Seller entity |
| vendor_gstin | String | Seller GST registration number |
| buyer_name | String | Purchaser entity |
| buyer_gstin | String | Buyer GSTIN |
| hsn_code | String | Harmonized System Nomenclature code |
| description_of_goods | String | Line item description |
| taxable_value | Float | Base amount before GST |
| cgst / sgst / igst | Float | Tax components |
| cgst_rate / sgst_rate / igst_rate | Float | Tax rate % |
| total_value | Float | Grand total |
| place_of_supply | String | GST state code |
| confidence_score | Float | AI extraction confidence 0–1 |

#### `ReconciliationResult`
Stores the 3-way match verdict for each invoice or bill of sale.

| Column | Type | Purpose |
|---|---|---|
| invoice_id | FK → ExtractedInvoice (nullable) | For purchase invoices |
| bill_of_sale_id | FK → ExtractedBillOfSale (nullable) | For sales bills |
| match_status | String | Verdict (see match statuses below) |
| register_row_id | Integer | Matched row in purchase/sales register |
| matched_gst_row_id | Integer | Matched row in GSTR-2B |

**Match Status Values:**
- `matched` — Found in Purchase Register AND GSTR-2B
- `missing_in_2b_itc_review` — In PR but missing from GSTR-2B (ITC risk)
- `missing_only_from_pr` — Not in PR but exists in GSTR-2B
- `missing_in_2b_and_pr` — Not found anywhere (major exception)
- `not_in_sales_register` — Bill of Sale not found in Sales Register

#### `HsnRecommendation`
AI-generated HSN code suggestions for invoices missing an HSN code.

| Column | Type | Purpose |
|---|---|---|
| file_id | FK → UploadedFile | |
| recommended_hsn | String | 4 or 8-digit HSN code |
| confidence_score | Float | |
| status | String | `HIGH_CONFIDENCE`, `NEEDS_REVIEW`, `MANUAL_REQUIRED` |
| top_alternatives | JSON string | Array of alternative codes |
| accepted_hsn | String | Final auditor-approved code |

#### `TaxTypeMismatch`
Flags invoices where CGST/SGST was charged instead of IGST or vice versa.

| Column | Type | Purpose |
|---|---|---|
| invoice_id | FK → ExtractedInvoice | |
| determined_supply_type | String | `intra_state` or `inter_state` |
| expected_tax_type | String | `CGST+SGST` or `IGST` |
| actual_tax_type | String | What was actually charged |
| reason | String | Explanation |
| suggestion | String | Recommended correction |

---

## 4. API Endpoints

Base URL: `http://localhost:8000/api/v1`

### `/files` — Invoice (Purchase Voucher) Management
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/files/upload/{engagement_id}` | Upload invoice PDF → triggers background processing |
| `GET` | `/files/{engagement_id}` | List all invoices with extracted data + match status |
| `DELETE` | `/files/{file_id}` | Delete file, extracted data, reconciliation results |
| `POST` | `/files/{file_id}/reprocess` | Retry failed extraction |
| `POST` | `/files/reconcile/{engagement_id}` | Manually trigger reconciliation for all invoices |
| `GET` | `/files/summary/{engagement_id}` | Aggregated stats for reports page |
| `GET` | `/files/tax-mismatches/{engagement_id}` | Tax type violation list |

### `/bill-of-sale` — Sales Voucher Management
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/bill-of-sale/upload/{engagement_id}` | Upload BOS PDF → triggers background processing |
| `GET` | `/bill-of-sale/{engagement_id}` | List all bills with extracted data + match status |
| `DELETE` | `/bill-of-sale/{file_id}` | Delete bill and extracted data |
| `POST` | `/bill-of-sale/retry/{file_id}` | Retry single failed BOS |
| `POST` | `/bill-of-sale/retry-all/{engagement_id}` | Retry all failed BOS |
| `GET` | `/bill-of-sale/summary/{engagement_id}` | BOS summary stats |

### `/registers` — Excel Register Management
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/registers/upload/{engagement_id}` | Upload Purchase Register Excel |
| `POST` | `/registers/upload-sales/{engagement_id}` | Upload Sales Register Excel |
| `POST` | `/registers/upload-gstr2b/{engagement_id}` | Upload GSTR-2B Excel |
| `GET` | `/registers/{engagement_id}` | Get Purchase Register metadata |
| `GET` | `/registers/{engagement_id}/rows` | Get Purchase Register rows |
| `GET` | `/registers/sales/{engagement_id}` | Get Sales Register metadata |
| `GET` | `/registers/sales/{engagement_id}/rows` | Get Sales Register rows |
| `GET` | `/registers/gstr2b/{engagement_id}` | Get GSTR-2B metadata |
| `GET` | `/registers/gstr2b/{engagement_id}/rows` | Get GSTR-2B rows |

### `/hsn` — HSN Code Recommendation
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/hsn/status/{engagement_id}` | List invoices missing HSN + recommendations |
| `POST` | `/hsn/recommend/{engagement_id}` | Generate HSN recommendations for all missing |
| `POST` | `/hsn/recommend/single/{file_id}` | Generate for one file |
| `PATCH` | `/hsn/accept/{file_id}` | Accept/override an HSN recommendation |

### Other Routers
- `/clients` — CRUD for Client records
- `/engagements` — CRUD for Engagement records (scoped to client)
- `/exceptions` — Exception log read/update
- `/reconcile/{engagement_id}` — POST to trigger full reconciliation run

---

## 5. Background Processing Pipeline

### Purchase Invoice Pipeline (triggered on every PDF upload)

```
POST /files/upload/{engagement_id}
     │
     ├─ Save PDF to disk → storage/{engagement_id}/{filename}
     ├─ Create UploadedFile record (status: "uploaded")
     └─ BackgroundTasks.add_task(process_uploaded_file, file_id)
                │
                ▼
        [Background Task]
        1. Update status → "processing"
        2. extraction.extract_invoice_data()
           ├─ Convert PDF pages to base64 images (PyMuPDF)
           ├─ Call GPT-4o-mini with vision prompt
           ├─ Parse structured JSON response
           ├─ Save ExtractedInvoice to DB
           └─ Update UploadedFile status → "extracted" | "failed"
        3. reconciliation.reconcile_single_invoice()
           ├─ Fuzzy-match invoice_number against PurchaseRegisterRow
           ├─ Fuzzy-match against GstRegisterRow (GSTR-2B)
           └─ Write ReconciliationResult with match_status
        4. tax_validator.validate_tax_type()
           ├─ Compare vendor_gstin state code vs buyer GSTIN state code
           ├─ Determine intra-state vs inter-state supply
           └─ If mismatch: write TaxTypeMismatch record
```

### Bill of Sale Pipeline (same pattern)
```
POST /bill-of-sale/upload/{engagement_id}
     └─ BackgroundTasks → process_bill_of_sale()
           1. extraction.extract_bill_of_sale_data() [GPT-4o-mini]
           2. reconciliation.reconcile_single_bill_of_sale()
              └─ Match sale_number against SalesRegisterRow
```

### HSN Recommendation Pipeline
```
POST /hsn/recommend/{engagement_id}
     └─ BackgroundTasks → generate_recommendations_for_engagement()
           For each invoice with missing/null HSN:
           1. Build item_description from description_of_goods + vendor_name
           2. hsn_recommender.get_recommendation(description, vendor)
              ├─ Step 1: TF-IDF search against HSN master CSV
              │         (scikit-learn TfidfVectorizer + cosine similarity)
              ├─ Step 2: If confidence < 0.8, call GPT-4o-mini for refinement
              └─ Step 3: Return top HSN code + alternatives + confidence
           3. Save HsnRecommendation to DB
```

---

## 6. Reconciliation Logic (3-Way Match)

File: `backend/app/services/reconciliation.py`

```
reconcile_single_invoice(invoice, db):
  1. Look up PurchaseRegisterRow by fuzzy matching invoice_number
     - Normalize: strip spaces, uppercase, remove special chars
     - Direct match first → fallback to partial match
  2. If PR match found:
     a. Look up GstRegisterRow (GSTR-2B) by same invoice_number
     b. If GSTR-2B match found → status = "matched"
     c. If GSTR-2B missing → status = "missing_in_2b_itc_review"
  3. If PR match NOT found:
     a. Check GSTR-2B anyway
     b. If in GSTR-2B → status = "missing_only_from_pr"
     c. If nowhere → status = "missing_in_2b_and_pr"
  4. Write ReconciliationResult record
```

---

## 7. Frontend Pages and Their Role

All pages import `API_BASE` from `src/config.ts` which reads `NEXT_PUBLIC_API_BASE` env var.

| Route | Component | Role |
|---|---|---|
| `/login` | LoginPage | Auth gate. Validates admin/admin@aristaai, sets `localStorage.isLoggedIn = "true"` |
| `/` | CompanySelection | Pick client → sets `localStorage.engagementId` → go to `/reports` |
| `/vouching` | InvoiceInbox | Upload invoice PDFs, view extracted data, trigger HSN, view match status |
| `/bill-of-sale` | BillOfSaleInbox | Upload BOS PDFs, view extraction + match status, retry/delete |
| `/uploads` | UploadsPortal | Upload Purchase / Sales / GSTR-2B Excel registers |
| `/purchase-registry` | PurchaseRegistry | View parsed rows from Purchase Register |
| `/sales-registry` | SalesRegistry | View parsed rows from Sales Register |
| `/gstr2b` | Gstr2bRegistry | View parsed rows from GSTR-2B register |
| `/reconciliation` | RegisterUpload | Manual trigger for reconciliation run |
| `/reports` | ReportsPage | Full verification report: match rates, vendor breakdown, value reconciled |
| `/exceptions` | ExceptionsPage | Exception log viewer |
| `/clients` | ClientsPage | Client management |
| `/engagements` | EngagementsPage | Engagement management |

### Auth Guard Pattern
Every protected page uses one of two guards:

**DashboardLayout.tsx (wraps all dashboard pages):**
```typescript
useEffect(() => {
  if (localStorage.getItem("isLoggedIn") !== "true") {
    router.replace("/login");
  }
}, []);
```

**Root page.tsx (client selection):**
Same check on mount. If not logged in → `/login`.

**Logout:** Button in DashboardLayout header calls:
```typescript
localStorage.removeItem("isLoggedIn"); router.push("/login");
```

---

## 8. Tech Stack

### Frontend
| Technology | Version | Role |
|---|---|---|
| Next.js | 16.2.1 | React framework, routing, SSR |
| React | 19 | UI library |
| Tailwind CSS | 4 | Styling |
| Prisma | 5.22 | ORM for Turso DB access at runtime |
| @prisma/adapter-libsql | latest | Turso libSQL adapter for Prisma |
| @libsql/client | latest | Turso connection client |
| lucide-react | latest | Icon library |

### Backend
| Technology | Role |
|---|---|
| FastAPI | HTTP framework |
| SQLAlchemy | ORM (sync) |
| Pydantic v2 + pydantic-settings | Request/response validation, config |
| PyMuPDF (fitz) | PDF → image conversion for GPT vision |
| OpenAI SDK | GPT-4o-mini for invoice extraction + HSN refinement |
| scikit-learn | TF-IDF vectorizer for HSN code search |
| pandas + openpyxl | Excel register parsing |
| python-dotenv | .env loading |
| libsql-experimental | Turso/libSQL SQLAlchemy dialect (production) |
| alembic | DB migrations |

### Database
| Environment | Database | Driver |
|---|---|---|
| Local Development | SQLite (`vouching.db`) | SQLAlchemy sqlite |
| Production | Turso libSQL (cloud) | `libsql-experimental` (backend) + `@prisma/adapter-libsql` (frontend) |

**Turso Config:**
- DB URL: `libsql://vouching-kartikdube.aws-eu-west-1.turso.io`
- Auth token stored in `.env` as `TURSO_AUTH_TOKEN`
- Frontend uses `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` via libsql adapter
- Backend uses `DATABASE_URL=libsql+sqld://...?authToken=...`

---

## 9. Environment Variables

### Frontend (`frontend/.env`)
```env
DATABASE_URL="file:./dev.db"                    # Prisma CLI (local only)
TURSO_DATABASE_URL="libsql://vouching-..."      # Runtime Turso connection
TURSO_AUTH_TOKEN="eyJ..."                       # Turso auth token
NEXT_PUBLIC_API_BASE="http://localhost:8000/api/v1"  # FastAPI backend URL
```

### Backend (`backend/.env`)
```env
DATABASE_URL="libsql+sqld://vouching-kartikdube.aws-eu-west-1.turso.io?authToken=eyJ..."
OPENAI_API_KEY="sk-..."
CORS_ORIGINS="http://localhost:3000,https://your-app.netlify.app"
```

---

## 10. Key Design Decisions

1. **Dual DB access pattern**: Frontend (Next.js) talks to Turso via Prisma for any direct DB reads it needs. Backend (FastAPI) also connects to Turso via `libsql-experimental` SQLAlchemy dialect. Both share the same cloud DB.

2. **Background task processing**: FastAPI's `BackgroundTasks` is used for all AI processing. The endpoint returns immediately with `status: "uploaded"`, and the frontend polls every 3 seconds to detect when status changes to `extracted` or `failed`.

3. **Engagement scoping**: ALL data is scoped by `engagement_id`. This is stored in `localStorage` on the frontend. It represents a single client audit period (e.g., "Acme Corp March 2026").

4. **Auth is intentionally lightweight**: `localStorage.isLoggedIn` is a client-side gate only. There is no JWT or session on the backend. This is suitable for an internal CA tool accessed by a small trusted team.

5. **Fuzzy matching in reconciliation**: Invoice numbers in PDFs often have formatting differences from Excel registers (spaces, dashes, case). The reconciliation service normalizes both strings before matching.

6. **HSN 2-stage pipeline**: First, TF-IDF cosine similarity against the HSN master list gives a fast candidate. If confidence < 80%, GPT-4o-mini refines it using the item description and vendor context.

---

## 11. Deployment Configuration

### Frontend → Netlify
- Config: `frontend/netlify.toml`
- Build command: `npm run build`
- Publish dir: `.next`
- Required env vars on Netlify: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NEXT_PUBLIC_API_BASE`

### Backend → Any Python Host (Render / Railway / Fly.io)
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Required env vars: `DATABASE_URL`, `OPENAI_API_KEY`, `CORS_ORIGINS`
- Storage for PDFs: Either local disk (ephemeral) or mount a persistent volume at the `STORAGE_DIR` path

### Static File Serving
The backend mounts `storage/` as a static directory at `/storage`. Invoice PDFs are served from `http://backend-url/storage/{engagement_id}/{filename}`.

---

## 12. Data Flow Summary (End-to-End)

```
[Auditor] Upload invoice PDFs
         │
         ▼
[Frontend /vouching page]
  POST /api/v1/files/upload/{engagement_id}
         │
         ▼
[Backend - files.py]
  Save to disk → Create DB record → Trigger BackgroundTask
         │
         ▼
[Background: extraction.py]
  PyMuPDF → base64 images → GPT-4o-mini → Parse JSON → Save ExtractedInvoice
         │
         ▼
[Background: reconciliation.py]
  Fuzzy match invoice_number vs PurchaseRegisterRow → vs GstRegisterRow
  → Write ReconciliationResult (match_status)
         │
         ▼
[Background: tax_validator.py]
  Compare GSTIN state codes → Write TaxTypeMismatch if wrong tax type
         │
         ▼
[Frontend polls GET /files/{engagement_id}]
  Shows match_status badge on each invoice row
         │
         ▼
[Frontend /reports page]
  GET /files/summary/{engagement_id} → Shows match rate, quality score, value reconciled
```
