# Arista AI – Smart Vouching & Compliance Intelligence Engine (SV-CIE)

A professional POC application designed for Chartered Accountant firms to automate the vouching and reconciliation process.

## Key Features
- **AI-Powered Extraction**: Uses OpenAI GPT-4o-mini to extract structured data from voucher PDFs.
- **Audit-Centric UI**: Dense, professional workspace designed for CA workflow.
- **Side-by-Side Review**: Verify extracted data directly against the original document.
- **Reconciliation Engine**: Match vouchers against purchase/sales registers with mismatch detection.
- **Exception Management**: Track and remark on discrepancies.
- **Verification Reports**: Generate manager-ready summary reports.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), Tailwind CSS, Lucide Icons.
- **Backend**: FastAPI (Python), SQLAlchemy, SQLite.
- **AI**: OpenAI Vision API.

## Repository Structure
- `/backend`: FastAPI application, models, and services.
- `/frontend`: Next.js application and UI components.
- `/storage`: Local file storage for the POC.

## Setup Instructions

### Backend Setup
1. `cd backend`
2. `pip install -r requirements.txt`
3. Create a `.env` file in the `backend/` directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   SECRET_KEY=highly-secure-secret-for-poc
   DATABASE_URL=sqlite:///./sql_app.db
   ```
4. Seed the database: `python seed_data.py`
5. Start the server: `python -m app.main` (or use `uvicorn app.main:app --reload`)

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. Start the dev server: `npm run dev`
4. Access the workspace at `http://localhost:3000`

## Core Workflow
1. **Initialize**: Create a Client and an Engagement period.
2. **Upload**: Drag-and-drop voucher PDFs into the Inbox.
3. **Review**: Use the Side-by-Side console to verify extraction accuracy.
4. **Reconcile**: Upload a Purchase Register and run the matching engine.
5. **Resolve**: Review exceptions and add remarks.
6. **Export**: Generate the final Verification Summary Report.

---
Built for the Future of Audit by Arista AI.
