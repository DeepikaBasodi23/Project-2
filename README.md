# Loan / Credit Application Processing Agent

An AI-assisted decision support system for retail lenders. The AI may only **recommend** APPROVE, REFER, or DECLINE — a licensed human underwriter always makes the final decision.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite + TS)            │
│  ┌──────────────────┐ ┌─────────────────────┐ ┌─────────────┐  │
│  │  Applicant Portal│ │ Underwriter Dashboard│ │Audit History│  │
│  └──────────────────┘ └─────────────────────┘ └─────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API /api/v1
┌──────────────────────────────▼──────────────────────────────────┐
│                        BACKEND (Node.js / Express / TypeScript)  │
│                                                                  │
│  POST /applications          GET /applications                   │
│  POST /applications/:id/process                                  │
│  POST /applications/:id/documents                                │
│  POST /applications/:id/decisions                                │
│  GET  /audit                 GET /audit/:id                      │
│  GET/POST /policy/versions                                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              APPLICATION PROCESSOR (Orchestrator)        │    │
│  └───┬─────┬──────┬──────┬───────┬────────┬───────┬───────┘    │
│      │     │      │      │       │        │       │             │
│  ┌───▼──┐ ┌▼────┐ ┌▼────┐ ┌────▼┐ ┌────▼┐ ┌───▼────┐ ┌──▼──┐ │
│  │DocVal│ │Data │ │Poli-│ │Score│ │Reco-│ │Fairness│ │Audit│ │
│  │idat. │ │Extr.│ │cyEng│ │Eng. │ │mmEng│ │Checker │ │Svc  │ │
│  └──────┘ └─────┘ └─────┘ └─────┘ └─────┘ └────────┘ └─────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    PostgreSQL Database                           │
│  policy_versions • applications • documents                      │
│  document_validation_results • policy_scores                     │
│  recommendations • fairness_checks • human_decisions             │
│  audit_logs                                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Processing Pipeline

```
Application submitted
        │
        ▼
Sanitize input (prompt injection defence)
        │
        ▼
Validate documents ──► MISSING? ──► Stop, request missing docs
        │ (all present)
        ▼
Extract data from documents
        │
        ▼
Check document consistency (name / income / employer)
        │
        ▼
Load active policy version (configurable rules)
        │
        ▼
Calculate scores (DTI 35%, Credit 30%, Income 20%, Employment 15%)
        │
        ▼
Evaluate hard & soft rules (cite policy clauses)
        │
        ▼
Generate AI recommendation (APPROVE / REFER / DECLINE)
        │
        ▼
Fairness check (strip identity fields, re-score, compare)
        │
        ▼
Persist full audit record
        │
        ▼
Present to human underwriter ──► FINAL DECISION
```

---

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Clone & install

```bash
# Install all workspace dependencies
npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
```

### 3. Initialize database

```bash
cd backend
npm run migrate    # Creates all tables
npm run seed       # Seeds policy rules + 5 test applications
```

### 4. Run development servers

```bash
# From root — starts both backend (port 4000) and frontend (port 3000) concurrently
npm run dev
```

Or individually:
```bash
cd backend && npm run dev    # Backend: http://localhost:4000
cd frontend && npm run dev   # Frontend: http://localhost:3000
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend server port |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `NODE_ENV` | `development` | Environment |
| `UPLOAD_DIR` | `./uploads` | Document upload directory |
| `MAX_FILE_SIZE_MB` | `10` | Max upload size |
| `CREDIT_REPORT_REQUIRED` | `false` | Whether credit report is a required document |

---

## API Reference

### Applications

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/applications` | Submit new application |
| `GET` | `/api/v1/applications` | List applications (paginated, filterable) |
| `GET` | `/api/v1/applications/:id` | Get full application with all results |
| `POST` | `/api/v1/applications/:id/process` | Trigger AI processing pipeline |
| `GET` | `/api/v1/applications/:id/status` | Get processing status |

### Documents

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/applications/:id/documents` | Upload documents (multipart/form-data) |
| `GET` | `/api/v1/applications/:id/documents` | List uploaded documents |
| `DELETE` | `/api/v1/applications/:id/documents/:docId` | Delete a document |

### Decisions

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/applications/:id/decisions` | Submit underwriter decision |
| `GET` | `/api/v1/applications/:id/decisions` | Get decision history |

### Audit

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/audit` | Paginated audit history with search/filters |
| `GET` | `/api/v1/audit/:applicationId` | Full audit record |

### Policy

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/policy/versions` | List all policy versions |
| `GET` | `/api/v1/policy/versions/active` | Get active policy |
| `POST` | `/api/v1/policy/versions` | Create new policy version |
| `PUT` | `/api/v1/policy/versions/:id/activate` | Activate a policy version |

---

## Running Tests

```bash
cd backend
npm test              # Run all tests
npm run test:coverage # With coverage report
```

Tests cover:
- `scoringEngine.test.ts` — DTI, credit, income, employment, weighted scoring
- `documentValidation.test.ts` — Required doc presence, prompt injection detection
- `recommendationEngine.test.ts` — APPROVE/REFER/DECLINE logic, policy citations
- `fairnessChecker.test.ts` — Identity field stripping, fairness flag logic
- `policyEngine.test.ts` — Rule evaluation with various applicant profiles

---

## Seed Data

After running `npm run seed` you get 5 test applications:

| Test Case | Applicant | Expected |
|---|---|---|
| Clear APPROVE | John Smith | Score ~85, all hard rules pass |
| Borderline REFER | Jane Doe | Score ~58, fair credit |
| Missing Documents | Bob Johnson | Stops processing, requests INCOME_PROOF + BANK_STATEMENT |
| Fairness Check | Maria Garcia | Recommendation unchanged after anonymization |
| Prompt Injection | Alex Turner | Injection in notes detected and neutralized |

---

## Security

- All free-text fields and document content are sanitized for prompt injection patterns
- Documents are treated as untrusted input — never executed or interpreted
- Multer restricts uploads to PDF, JPEG, PNG, DOC (10 MB max)
- Helmet sets security headers
- Input validation on all endpoints via express-validator
- CORS configured to restrict origins in production

---

## Policy Configuration

Policy rules are stored in the `policy_versions` table as JSONB. To update rules without code changes:

1. Create a new version via `POST /api/v1/policy/versions`
2. Activate it via `PUT /api/v1/policy/versions/:id/activate`

The policy JSON structure:

```json
{
  "weights": { "dti": 0.35, "creditHistory": 0.30, "incomeStability": 0.20, "employmentStability": 0.15 },
  "thresholds": { "approveMinScore": 70, "referMinScore": 50, "maxDTIRatio": 0.43, "minCreditScore": 580, "minAnnualIncome": 24000, "minYearsEmployed": 0.5 },
  "hardRules": [{ "id": "HR-001", "clause": "Section 3.1", "description": "DTI ratio must not exceed 43%", "field": "dtiRatio", "operator": "lte", "threshold": 0.43, "isHard": true }],
  "softRules": [{ "id": "SR-001", "clause": "Section 4.1", "description": "Employment duration of at least 6 months preferred", "field": "yearsEmployed", "operator": "gte", "threshold": 0.5, "isHard": false }]
}
```
