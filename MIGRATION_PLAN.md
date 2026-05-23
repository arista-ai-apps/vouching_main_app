# FastAPI → Next.js API Routes Migration Plan

## Overview
Migrate the Arista AI SV-CIE Vouching Platform backend from a separate FastAPI service to Next.js API routes, keeping everything on free tiers.

## Current Architecture
**FastAPI Backend:**
- Framework: FastAPI (Python)
- Database: Turso (libSQL) cloud database
- ORM: SQLAlchemy
- File Storage: Local filesystem (`backend/storage/`)
- Background Tasks: FastAPI BackgroundTasks
- AI Services: OpenAI GPT-4o for invoice extraction

**Routers/Endpoints:**
1. `/api/v1/clients` - Client CRUD operations
2. `/api/v1/engagements` - Engagement CRUD operations
3. `/api/v1/files` - File upload/processing/listing
4. `/api/v1/registers` - Purchase/Sales register management
5. `/api/v1/reconciliation` - Reconciliation logic
6. `/api/v1/exceptions` - Exception handling
7. `/api/v1/bill_of_sale` - Bill of sale operations
8. `/api/v1/hsn` - HSN code recommendations

## Target Architecture
**Next.js 16 + API Routes:**
- Framework: Next.js with TypeScript
- Database: Turso (same)
- ORM: Prisma (already configured)
- File Storage: **TBD** (Cloudinary free tier or Vercel Blob)
- Background Tasks: **TBD** (Vercel Crons or webhook-based processing)
- AI Services: OpenAI API (same)

---

## Migration Strategy

### Phase 1: Database & ORM Setup
**Status:** ✅ DONE
- Prisma Client configured with libSQL adapter
- Turso credentials in `.env`
- SQLAlchemy models need to be converted to Prisma schema

**Action Items:**
1. ✅ Verify Prisma schema matches SQLAlchemy models
2. ✅ Ensure Turso database tables exist
3. Run `prisma migrate deploy` to sync schema

### Phase 2: File Storage Solution
**Problem:** 
- Netlify doesn't have persistent filesystem storage
- Current implementation stores PDFs in `backend/storage/` directory
- This won't work on Netlify's serverless functions

**Options:**
| Option | Pros | Cons | Free Tier |
|--------|------|------|-----------|
| **Cloudinary** | Easy integration, CDN delivery, transformation APIs | Bandwidth limits | 25 GB/month |
| **Supabase Storage** | SQL DB + storage, good for Postgres users | Not ideal for Turso | 1 GB/month |
| **Vercel Blob** | Native Netlify integration (Vercel Edge) | Requires Vercel deployment | Not available on Netlify |
| **AWS S3** | Industry standard, reliable | Complex setup, costs | 5 GB/month (first year) |
| **Firebase Storage** | Google ecosystem | Firebase dependency | 1 GB/month |

**Recommendation:** **Cloudinary** for maximum free tier (25 GB/month storage + 25 GB/month bandwidth)

**Implementation:**
```typescript
// lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadPDF(fileBuffer: Buffer, filename: string) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: filename,
        folder: 'vouching-pdfs',
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}
```

### Phase 3: Background Task Processing
**Problem:**
- FastAPI uses `BackgroundTasks` for PDF processing
- Next.js API routes are serverless and have execution time limits
- Processing needs to happen asynchronously

**Options:**
| Option | Pros | Cons | Free Tier |
|--------|------|------|-----------|
| **Vercel Crons** | Native integration with Vercel | Not available on Netlify |  100 invocations/month |
| **Webhook-based (Trigger.dev)** | Works on any host, powerful | Another service | 500 tasks/month |
| **Upstash Crons** | Serverless, reliable | Different service | 50 tasks/month |
| **Inngest** | Workflow engine, replay capability | Overkill for this use case | 0-tier limited |
| **Queueing Service (Bull + Redis)** | Industry standard | Redis needed |  Free with Upstash |

**Recommendation:** **Trigger.dev** (500 tasks/month free)
- Decouples file processing from HTTP request
- Supports long-running tasks
- Built-in retry logic and monitoring
- Works with any hosting provider (Netlify)

**Implementation Flow:**
1. User uploads file via `/api/files/upload`
2. Endpoint saves file to Cloudinary
3. Endpoint creates database record
4. Endpoint calls `trigger.sendEvent()` to start background job
5. Trigger.dev runs the extraction/reconciliation pipeline asynchronously

### Phase 4: API Route Migration
**Routes to Create in `app/api/`:**

#### 4.1 Clients
```
POST   /api/v1/clients              - Create client
GET    /api/v1/clients              - List clients
GET    /api/v1/clients/[id]         - Get client details
PUT    /api/v1/clients/[id]         - Update client
DELETE /api/v1/clients/[id]         - Delete client
```

#### 4.2 Engagements
```
POST   /api/v1/engagements          - Create engagement
GET    /api/v1/engagements          - List engagements
GET    /api/v1/engagements/[id]     - Get engagement details
PUT    /api/v1/engagements/[id]     - Update engagement
DELETE /api/v1/engagements/[id]     - Delete engagement
```

#### 4.3 Files (Most Complex)
```
POST   /api/v1/files/upload/[engagement_id]        - Upload PDF
GET    /api/v1/files/[engagement_id]               - List files with invoices
GET    /api/v1/files/summary/[engagement_id]       - Get summary stats
DELETE /api/v1/files/[file_id]                     - Delete file
POST   /api/v1/files/[file_id]/reprocess           - Reprocess file
POST   /api/v1/files/reconcile/[engagement_id]     - Run reconciliation
GET    /api/v1/files/tax-mismatches/[engagement_id] - Get tax mismatches
```

#### 4.4 Registers
```
POST   /api/v1/registers/[engagement_id]           - Create/upload register
GET    /api/v1/registers/[engagement_id]           - Get register data
PUT    /api/v1/registers/[id]                      - Update register entry
DELETE /api/v1/registers/[id]                      - Delete register entry
```

#### 4.5 Reconciliation
```
POST   /api/v1/reconciliation                      - Trigger reconciliation
GET    /api/v1/reconciliation/results              - Get results
```

#### 4.6 HSN Recommender
```
POST   /api/v1/hsn/recommend                       - Get HSN recommendations
GET    /api/v1/hsn/[code]                          - HSN code details
```

#### 4.7 Bill of Sale
```
POST   /api/v1/bill_of_sale                        - Create BOS
GET    /api/v1/bill_of_sale/[id]                   - Get BOS
```

#### 4.8 Exceptions
```
GET    /api/v1/exceptions                          - List exceptions
PUT    /api/v1/exceptions/[id]                     - Update exception status
```

### Phase 5: Service Logic Migration
**Services to Convert:**
1. `extraction.py` → `lib/services/extraction.ts`
2. `reconciliation.py` → `lib/services/reconciliation.ts`
3. `hsn_recommender.py` → `lib/services/hsnRecommender.ts`
4. `tax_validator.py` → `lib/services/taxValidator.ts`

**Technology Stack for Services:**
- **PDF Processing:** `pdfjs-dist` (web-based, works in Node.js)
- **OCR:** OpenAI GPT-4o vision API
- **Text Processing:** Built-in JavaScript (no external deps needed)
- **Fuzzy Matching:** `fuse.js` for fuzzy matching (already JavaScript)
- **TF-IDF:** `natural` npm package

---

## Free Tier Constraints & Solutions

### OpenAI API
- **Constraint:** Pay-as-you-go (no permanent free tier)
- **Cost per request:** ~$0.0015 per request (GPT-4o-mini)
- **Mitigation:** User must bring their own API key
- **Action:** Store OPENAI_API_KEY in `.env.local` (not committed to GitHub)

### Cloudinary
- **Free Tier:** 25 GB storage + 25 GB bandwidth/month
- **Constraint:** Limited to 25 files/request
- **Mitigation:** Add file size validation in upload endpoint
- **Action:** Validate max file size (10 MB per PDF)

### Trigger.dev
- **Free Tier:** 500 task invocations/month
- **Constraint:** ~16 tasks/day for 30-day month
- **Mitigation:** Batch processing, encourage reconciliation in batches
- **Action:** Implement rate limiting or queue management

### Turso (Database)
- **Free Tier:** 1 GB storage, unlimited reads, 9 GB writes/month
- **Constraint:** 9 GB writes/month = ~300 small invoices/month
- **Mitigation:** Efficient schema, minimal writes
- **Action:** Monitor database usage

### Netlify
- **Free Tier:** 125,000 requests/month, 300 seconds per function
- **Constraint:** 300-second execution limit (5 minutes)
- **Mitigation:** Move long tasks to Trigger.dev background jobs
- **Action:** Keep endpoint responses <300 seconds

---

## Implementation Checklist

### Pre-Migration
- [ ] Backup Turso database
- [ ] Export all data from FastAPI backend
- [ ] Create Prisma schema from SQLAlchemy models
- [ ] Set up Cloudinary account and get API credentials
- [ ] Set up Trigger.dev account
- [ ] Set up OpenAI API key management

### Phase 1: Setup
- [ ] Install required npm packages:
  ```bash
  npm install cloudinary pdfjs-dist fuse.js natural
  npm install --save-dev @types/node
  ```
- [ ] Create environment variable template (`.env.example`)
- [ ] Set up TypeScript types for Prisma models
- [ ] Create utility functions (db connection, response handlers, error middleware)

### Phase 2: Core Services
- [ ] Implement `lib/services/extraction.ts`
- [ ] Implement `lib/services/reconciliation.ts`
- [ ] Implement `lib/services/hsnRecommender.ts`
- [ ] Implement `lib/services/taxValidator.ts`
- [ ] Implement `lib/cloudinary.ts`

### Phase 3: API Routes
- [ ] `/api/v1/clients/*`
- [ ] `/api/v1/engagements/*`
- [ ] `/api/v1/registers/*`
- [ ] `/api/v1/hsn/*`
- [ ] `/api/v1/bill_of_sale/*`
- [ ] `/api/v1/exceptions/*`
- [ ] `/api/v1/reconciliation/*`
- [ ] `/api/v1/files/*` (most complex)

### Phase 4: Trigger.dev Integration
- [ ] Create background job for invoice processing
- [ ] Update file upload endpoint to trigger async job
- [ ] Implement webhook to update UI on job completion

### Phase 5: Testing & Deployment
- [ ] Integration tests for all endpoints
- [ ] Load testing with sample data
- [ ] Test file upload with various PDF formats
- [ ] Test Cloudinary upload/retrieval
- [ ] Test Trigger.dev background jobs
- [ ] Deploy to Netlify and verify all endpoints work

### Phase 6: Migration & Cleanup
- [ ] Migrate all production data from FastAPI to Next.js
- [ ] Run parallel testing (both backends, compare results)
- [ ] Update frontend `.env` variables (NEXT_PUBLIC_API_BASE)
- [ ] Decommission FastAPI backend
- [ ] Delete `backend/` directory (optional, keep as reference)

---

## Key Environment Variables Needed

```bash
# Turso Database
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# OpenAI
OPENAI_API_KEY=... (user-provided)

# Trigger.dev
TRIGGER_API_KEY=... (for testing locally)

# Application
NEXT_PUBLIC_API_BASE=/api/v1 (localhost) or https://yourdomain.com/api/v1 (production)
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Netlify 300s function timeout | Files >100 pages may timeout | Use Trigger.dev for processing |
| OpenAI API costs | $0.0015+ per invoice | User brings own API key |
| Cloudinary free tier limit | Can't store >25 GB files | Monitor usage, implement cleanup |
| Trigger.dev quota (500/month) | <17 files/day on free tier | Communicate limitations to user |
| Data migration loss | Loss of historical records | Export all data, run parallel systems |
| Prisma ↔ libSQL compatibility | Query failures | Extensive testing of all DB operations |

---

## Timeline Estimate
- **Phase 1:** 2 hours (setup, dependencies)
- **Phase 2:** 4 hours (core services - most complex)
- **Phase 3:** 6 hours (API routes)
- **Phase 4:** 2 hours (Trigger.dev integration)
- **Phase 5:** 3 hours (testing & debugging)
- **Phase 6:** 1 hour (migration & cleanup)

**Total:** ~18 hours of development

---

## Success Criteria
- ✅ All FastAPI endpoints replicated in Next.js
- ✅ File upload works with Cloudinary
- ✅ Background processing works with Trigger.dev
- ✅ All free tier services remain within limits
- ✅ Frontend successfully connects to new API
- ✅ All invoice extraction & reconciliation logic preserved
- ✅ Database queries optimized for free tier constraints
- ✅ No data loss during migration
