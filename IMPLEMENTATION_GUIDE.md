# Next.js API Routes Implementation Guide

## Status: Phase 1 - Core Infrastructure Complete

This document outlines what has been implemented and what remains to be done for the FastAPI → Next.js migration.

---

## ✅ What Has Been Implemented

### 1. Dependencies Installed
```json
{
  "cloudinary": "^1.40.0",
  "fuse.js": "^7.0.0",
  "openai": "^4.52.0",
  "pdfjs-dist": "^3.11.174"
}
```

### 2. Service Layer
Created core service modules in `src/lib/services/`:

#### `extraction.ts` - Invoice Data Extraction
- **Function:** `extractInvoiceData(fileBuffer, fileId, engagementId)`
- **Process:**
  1. Extracts text blocks from PDF using pdfjs-dist
  2. Sends OCR text to GPT-4o-mini for structured extraction
  3. Parses JSON response with invoice details
  4. Creates ExtractedInvoice and ExtractedInvoiceItem records in database
  5. Updates file status (uploaded → processing → extracted → completed/failed)
- **Dependencies:** OpenAI API, Prisma ORM

#### `reconciliation.ts` - Invoice Reconciliation
- **Functions:**
  - `reconcileSingleInvoice(invoiceId)` - Reconcile one invoice
  - `runFullReconciliation(engagementId)` - Reconcile all invoices for engagement
- **Algorithm:** Fuzzy matching with weighted scoring:
  - Invoice number match (40% weight)
  - Invoice date match (20% weight, within 7 days)
  - Vendor name match (20% weight, fuzzy)
  - Total amount match (20% weight, within 5% tolerance)
- **Dependencies:** Fuse.js for fuzzy matching, Prisma ORM

### 3. Cloudinary Integration
File: `src/lib/cloudinary.ts`
- **Functions:**
  - `uploadPDF(fileBuffer, filename, engagementId)` - Upload to Cloudinary
  - `deletePDF(publicId)` - Remove file from Cloudinary
  - `getPDFUrl(publicId)` - Get secure URL for file
- **Purpose:** Replace local filesystem storage (not available on Netlify)
- **Free Tier:** 25 GB storage + 25 GB bandwidth/month

### 4. API Routes Created

#### Clients Management
- `GET /api/v1/clients` - List all clients
- `POST /api/v1/clients` - Create new client
- `GET /api/v1/clients/[id]` - Get client details
- `PUT /api/v1/clients/[id]` - Update client
- `DELETE /api/v1/clients/[id]` - Delete client

#### Engagements Management
- `GET /api/v1/engagements` - List engagements (optionally filtered by client_id)
- `POST /api/v1/engagements` - Create engagement
- `GET /api/v1/engagements/[id]` - Get engagement details
- `PUT /api/v1/engagements/[id]` - Update engagement
- `DELETE /api/v1/engagements/[id]` - Delete engagement

#### File Operations
- `GET /api/v1/files` - List files with extracted invoices (by engagement_id)
- `POST /api/v1/files/upload` - Upload PDF file
  - Saves to Cloudinary
  - Creates database record
  - Triggers extraction and reconciliation (currently synchronous)
- `GET /api/v1/files/summary` - Get engagement statistics
  - Total files, matched count, exceptions
  - Match rate, quality score
  - Total value of invoices
  - Vendor breakdown

#### Reconciliation
- `POST /api/v1/reconciliation` - Trigger full reconciliation
- `GET /api/v1/reconciliation` - Get reconciliation results

#### Registers Management
- `GET /api/v1/registers` - List registers (with filtering)
- `POST /api/v1/registers` - Create register with rows

---

## 🔄 What Still Needs To Be Done

### Phase 2: Additional Endpoints
- [ ] **Bill of Sale endpoints** - Create, read, update, delete BOS files
- [ ] **HSN Recommender endpoints** - Get HSN recommendations for items
- [ ] **Tax Type Validation endpoints** - Identify tax mismatches
- [ ] **Exception Management endpoints** - Get, update, resolve exceptions
- [ ] **File deletion** - Delete file and associated records
- [ ] **File reprocessing** - Reprocess failed files

### Phase 3: Background Task Processing
**Current Issue:** Synchronous processing limits on Netlify (5-minute max timeout)

**Solution Options:**
1. **Trigger.dev** (Recommended)
   - Serverless task queue
   - 500 invocations/month on free tier
   - Handles long-running invoice processing
   
   **Implementation Steps:**
   ```typescript
   // 1. Install @trigger.dev/sdk
   // npm install @trigger.dev/sdk
   
   // 2. Create background job
   // src/lib/trigger.server.ts
   import { Trigger } from '@trigger.dev/sdk/v3';
   
   export const processInvoiceJob = Trigger.defineJob({
     id: 'process-invoice',
     trigger: io.runOnDemandTrigger({
       params: { 
         fileId: { type: 'number' },
         engagementId: { type: 'number' }
       },
     }),
     run: async (payload) => {
       // Run extraction, reconciliation, tax validation
     },
   });
   
   // 3. Update API route to use trigger
   // POST /api/v1/files/upload
   await processInvoiceJob.trigger({ fileId, engagementId });
   ```

2. **Vercel Crons** (Netlify alternative)
   - Not natively available on Netlify
   - Would require separate Vercel deployment

3. **Webhook-based Processing**
   - Simple but less reliable
   - Good for proof of concept

**Recommendation:** Implement Trigger.dev for production-ready background processing

### Phase 4: Environment Variables Setup

**Required `.env.local` variables:**
```bash
# Database
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# OpenAI (User provided)
OPENAI_API_KEY=sk-proj-...

# Trigger.dev (Optional, for background jobs)
TRIGGER_API_KEY=...

# API Configuration
NEXT_PUBLIC_API_BASE=/api/v1
```

**Note:** Do NOT commit `OPENAI_API_KEY` or secrets to GitHub. Add to `.env.local` (in .gitignore).

### Phase 5: Testing & Deployment

#### Local Testing
```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Run development server
npm run dev

# 4. Test endpoints
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Client","pan":"...","gstin":"..."}'
```

#### Deployment
```bash
# 1. Push code to GitHub
git add .
git commit -m "Add Next.js API routes and services"
git push origin main

# 2. Set environment variables in Netlify
# Dashboard → Site Settings → Build & Deploy → Environment
# Add: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, etc.

# 3. Redeploy from Netlify dashboard
```

### Phase 6: Complete API Coverage

These endpoints still need implementation:

| Endpoint | Method | Status |
|----------|--------|--------|
| `/bill-of-sale` | GET, POST | TODO |
| `/bill-of-sale/[id]` | GET, PUT, DELETE | TODO |
| `/hsn/recommend` | POST | TODO |
| `/hsn/[code]` | GET | TODO |
| `/exceptions` | GET | TODO |
| `/exceptions/[id]` | PUT | TODO |
| `/files/[id]/delete` | DELETE | TODO |
| `/files/[id]/reprocess` | POST | TODO |
| `/registers/[id]` | GET, PUT, DELETE | TODO |
| `/tax-mismatches` | GET | TODO |

---

## 🚀 Deployment Checklist

- [ ] **Environment Variables:**
  - [ ] TURSO_DATABASE_URL configured
  - [ ] TURSO_AUTH_TOKEN configured
  - [ ] CLOUDINARY credentials configured
  - [ ] OPENAI_API_KEY configured (user-provided)

- [ ] **Code Quality:**
  - [ ] All TypeScript types properly defined
  - [ ] Error handling implemented for all endpoints
  - [ ] Input validation on all endpoints
  - [ ] Database constraints in place

- [ ] **Testing:**
  - [ ] Unit tests for services (extraction, reconciliation)
  - [ ] Integration tests for API routes
  - [ ] Manual testing with sample PDFs
  - [ ] Load testing for concurrent uploads

- [ ] **Monitoring:**
  - [ ] Error logging implemented
  - [ ] Performance monitoring (for Netlify)
  - [ ] Database query monitoring
  - [ ] Cloudinary usage tracking

- [ ] **Cleanup:**
  - [ ] Remove old FastAPI backend references
  - [ ] Update frontend API_BASE if needed
  - [ ] Clean up unused dependencies
  - [ ] Document API changes for frontend team

---

## 📋 Free Tier Constraints & Monitoring

### Turso Database
- **Limit:** 9 GB writes/month
- **Current usage tracking:** Monitor via Turso dashboard
- **Mitigation:** Batch operations, efficient queries

### Cloudinary
- **Limit:** 25 GB storage, 25 GB bandwidth/month
- **Current usage tracking:** Monitor via Cloudinary dashboard
- **Mitigation:** Implement file cleanup, size validation (max 50MB per file)

### Trigger.dev
- **Limit:** 500 task invocations/month
- **Current usage tracking:** Monitor via Trigger.dev dashboard
- **Mitigation:** Batch processing, queue management

### Netlify
- **Limit:** 125,000 requests/month, 300 seconds per function
- **Current usage tracking:** Monitor via Netlify analytics
- **Mitigation:** Move long tasks to Trigger.dev

---

## 🔗 API Response Examples

### File Upload
```bash
curl -X POST http://localhost:3000/api/v1/files/upload \
  -F "file=@invoice.pdf" \
  -F "engagement_id=1"
```

**Response:**
```json
{
  "id": 1,
  "filename": "invoice.pdf",
  "status": "completed",
  "created_at": "2026-05-23T16:35:00Z"
}
```

### Get Summary
```bash
curl http://localhost:3000/api/v1/files/summary?engagement_id=1
```

**Response:**
```json
{
  "total": 15,
  "matched": 12,
  "not_in_registry": 3,
  "failed": 0,
  "pending": 0,
  "match_rate": 80.0,
  "quality_score": 80,
  "total_value": 125000.50,
  "total_matched_value": 100000.40,
  "vendor_breakdown": [
    {
      "vendor": "ABC Corp",
      "count": 5,
      "total": 45000.25
    }
  ]
}
```

---

## 🐛 Known Issues & Workarounds

1. **Synchronous File Processing**
   - **Issue:** Large PDFs may timeout on Netlify (>5 minutes)
   - **Workaround:** Implement Trigger.dev background processing
   - **Status:** Not yet implemented

2. **No File Persistence**
   - **Issue:** Netlify doesn't have persistent filesystem
   - **Solution:** Files stored in Cloudinary
   - **Status:** ✅ Implemented

3. **Reconciliation SQL Issues**
   - **Issue:** libSQL may not support all SQLAlchemy features
   - **Status:** Requires testing with actual data

---

## 📖 Next Steps

1. **Immediate (Required for MVP):**
   - Implement remaining API endpoints (bill-of-sale, HSN, exceptions)
   - Test all endpoints with sample data
   - Set up Cloudinary account
   - Configure environment variables on Netlify

2. **Short-term (Required for Production):**
   - Implement Trigger.dev integration for background processing
   - Add input validation and error handling
   - Set up monitoring and alerting
   - Create API documentation (OpenAPI/Swagger)

3. **Medium-term (Nice to Have):**
   - Add authentication/authorization
   - Implement rate limiting
   - Add caching layer
   - Create frontend integration tests

4. **Long-term (Optimization):**
   - Implement data pagination
   - Add full-text search
   - Optimize database queries
   - Add batch processing capabilities

---

## 📞 Support

For questions about this implementation:
- Review the MIGRATION_PLAN.md for architecture decisions
- Check individual service files for implementation details
- Refer to Prisma documentation: https://www.prisma.io/docs/
- OpenAI API docs: https://platform.openai.com/docs/
