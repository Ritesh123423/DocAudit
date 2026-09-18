# Audit Document Analyzer

Upload a document (PDF, Word, Excel, or an image). It's stored in MongoDB
(via GridFS, so no separate paid storage service is needed), and real text is
pulled out automatically:

- **.docx** — extracted with Mammoth
- **Native (text-based) PDF** — extracted with pdf-parse
- **.xlsx** — every sheet's cell data extracted with ExcelJS
- **Scanned PDFs, images, and legacy .doc/.xls** — flagged with a clear status
  (`Needs OCR` or `Format not supported yet`) rather than failing silently.
  OCR support for these is the next phase.

Click **View text** on any document to see its extraction status and the
extracted text itself.

Later phases add OCR for scanned documents, AI-assisted analysis
(classification, risk flags, figure verification, SOP process walkthroughs),
and Word/Excel export.

## Stack

- **Backend**: Node.js + Express, in `server/`
- **Frontend**: React + Vite, in `client/`
- **Database + file storage**: MongoDB Atlas (free tier), using GridFS to
  store the actual files inside the same cluster — no Firebase, no billing.
- **Hosting**: Render (free tier), two services — one for the backend, one
  for the static frontend build.

## 1. One-time setup: MongoDB Atlas

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free
   account (no credit card required for the free M0 cluster).
2. Create a free (M0) cluster.
3. Under **Database Access**, create a database user with a username and
   password (save these).
4. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) —
   Render's outbound IPs aren't fixed on the free plan, so this is the
   simplest option for now.
5. Click **Connect** on your cluster → **Drivers** → copy the connection
   string. It looks like:
   `mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority`
6. Add a database name into the path, e.g.
   `mongodb+srv://<username>:<password>@<cluster-url>/audit-doc-analyzer?retryWrites=true&w=majority`
   This full string is your `MONGODB_URI`.

## 2. Running locally

You'll need Node.js 18 or later installed.

```bash
# from the project root
npm run install:all

# copy the env templates and fill them in
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` and set `MONGODB_URI` to the connection string from step 1.
Leave `CLIENT_ORIGIN` and the client's `VITE_API_BASE_URL` as their local
defaults — they're already set for `http://localhost:5173` and
`http://localhost:3001`.

Then start both the server and client together:

```bash
npm run dev
```

- Backend: http://localhost:3001 (health check at `/api/health`)
- Frontend: http://localhost:5173

Upload a test file and confirm it appears in the table and downloads back
correctly.

## 3. Pushing to GitHub

```bash
git init
git add .
git commit -m "Phase 1: upload and storage plumbing"
git branch -M main
git remote add origin https://github.com/<your-username>/audit-doc-analyzer.git
git push -u origin main
```

Your `.env` files are excluded by `.gitignore` and will not be pushed —
only `.env.example` is committed. This is intentional: your Atlas
credentials should never go into GitHub.

## 4. Deploying on Render

This repo includes a `render.yaml` "Blueprint" that defines both services.

1. Go to https://dashboard.render.com, click **New** → **Blueprint**.
2. Connect your GitHub account and select the `audit-doc-analyzer` repo.
3. Render reads `render.yaml` and proposes two services:
   - `audit-doc-analyzer-server` (Node web service)
   - `audit-doc-analyzer-client` (static site)
4. Click **Apply**. Render will create both services and try to build them.
   The first build may fail or the app may not work yet — that's expected,
   because two environment variables still need real values (see next step).
5. Once both services exist, note their URLs from the Render dashboard
   (something like `https://audit-doc-analyzer-server.onrender.com` and
   `https://audit-doc-analyzer-client.onrender.com`).
6. Set the following environment variables in the Render dashboard (each
   service has its own **Environment** tab):
   - On `audit-doc-analyzer-server`:
     - `MONGODB_URI` — your Atlas connection string from step 1
     - `CLIENT_ORIGIN` — your client service's URL (from step 5)
   - On `audit-doc-analyzer-client`:
     - `VITE_API_BASE_URL` — your server service's URL (from step 5)
7. After setting these, trigger a **Manual Deploy** → **Deploy latest commit**
   on both services (the client needs a rebuild since Vite bakes environment
   variables in at build time, not at runtime).
8. Once both redeploy successfully, open the client's URL, upload a test
   file, and confirm it appears in the list and downloads correctly.

### Note on the free tier

Render's free web services spin down after around 15 minutes of inactivity.
The first request after idle time will be slow (the service has to spin
back up) — this is normal and not a bug.

## Project structure

```
audit-doc-analyzer/
├── render.yaml              Render Blueprint (both services)
├── package.json             Root scripts (npm run dev, install:all)
├── server/                  Express backend
│   ├── src/
│   │   ├── index.js         Entry point — connects DB, starts server
│   │   ├── app.js           Express app setup (CORS, routes, error handling)
│   │   ├── db/mongo.js      MongoDB connection + GridFS bucket
│   │   ├── middleware/      Error handling
│   │   ├── routes/          /api/documents endpoints
│   │   └── services/
│   │       └── textExtraction.js   docx/PDF/Excel text extraction
│   └── .env.example
└── client/                  React + Vite frontend
    ├── src/
    │   ├── App.jsx
    │   ├── api.js            Fetch calls to the backend
    │   ├── statusLabels.js   Status → badge label/color mapping
    │   └── components/       UploadForm, DocumentsTable, DocumentDetail
    └── .env.example
```

## What's next (future phases)

- OCR for scanned PDFs and images
- AI-assisted document classification and analysis (Gemini)
- Word and Excel synopsis/export in your house style
- Review/edit screen before export, and an audit trail
