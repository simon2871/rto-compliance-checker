# Deployment Plan

This document describes deployment for the frontend (Cloudflare Pages) and backend (Google Cloud Run) for the RTO Compliance Checker project.

## Goals
- Serve static frontend from a CDN (fast global delivery).
- Run backend (Node/Express + Puppeteer) in a managed container (Cloud Run) with native dependencies.
- Secure secrets, use object storage for large artifacts, and set up monitoring and cost controls.

## Repo References
- Frontend static site: [`public/index.html`](public/index.html:1)
- Backend server: [`src/api/server.js`](src/api/server.js:1) and entry [`src/index.js`](src/index.js:1)
- Container config: [`Dockerfile`](Dockerfile:1)
- Env docs: [`.env.example`](.env.example:1)

## Prerequisites
- Google Cloud project with billing enabled, region set to australia-southeast1 (Sydney).
- Cloud Build / Artifact Registry (or Container Registry) access.
- Cloud Run API enabled.
- Cloudflare account for Pages and custom domain (optional).
- Secrets (OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, SMTP_*, LEAD_WEBHOOK_URL).

## Frontend — Cloudflare Pages
1. Build and prepare static assets:
   - The site is already pre-built in `public/`. Ensure any build step copies assets to `public/`.
2. Configure API base URL:
   - Update frontend runtime configuration to point to the deployed backend API (set during Pages build or via a small runtime config).
   - Option: add detection in `public/js/app.js` to use `window.__API_BASE || '/api'`.
3. Deploy to Cloudflare Pages:
   - Create a new Pages project, connect the repository, set the build output directory to `public`.
   - Add environment variable for the API base URL if needed.
4. DNS:
   - Map your domain in Cloudflare and configure HTTPS.

## Backend — Google Cloud Run
1. Build container:
   - Use the provided [`Dockerfile`](Dockerfile:1).
   - Example: `docker build -t gcr.io/PROJECT_ID/rto-compliance-checker:latest .`
2. Push image to Artifact Registry / Container Registry:
   - `docker push gcr.io/PROJECT_ID/rto-compliance-checker:latest`
3. Deploy to Cloud Run (recommended settings):
   - Region: `australia-southeast1`
   - Memory: 1Gi (or 2Gi if Puppeteer heavy)
   - CPU: 1 vCPU (increase to 2 if needed)
   - Concurrency: 1 (Puppeteer is single-threaded)
   - Max instances: 3 (start small)
   - Allow unauthenticated (if public API) or restrict via IAM
   - Set environment variables from `.env.example` (use Secret Manager for API keys)
   - Port: 5000 (the `Dockerfile` exposes 5000)
   - Revision timeout: increase to e.g., 300s for long scraping runs
4. Example gcloud command:
```
gcloud run deploy rto-compliance-checker \
  --image gcr.io/PROJECT_ID/rto-compliance-checker:latest \
  --region=australia-southeast1 \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=1 \
  --max-instances=3 \
  --port=5000
```

## Storage & Reports
- Move persisted reports and large files to Cloud Storage (GCS).
- Configure [`src/reports/reportGenerator.js`](src/reports/reportGenerator.js:1) to write to GCS or mount a persistent disk.
- Store leads in a managed DB (Cloud SQL) or a simple managed datastore; local file storage is acceptable for an MVP but not recommended for production.

## Secrets & Config
- Use Secret Manager for OPENAI_API_KEY, ANTHROPIC_API_KEY, SMTP credentials.
- Set environment variables in Cloud Run referencing secrets.
- Update `.env.example` with production notes and variables required for deployment.

## Networking & CORS
- Serve frontend from Cloudflare domain; set `ALLOWED_ORIGINS` in Cloud Run env to that domain.
- Use HTTPS; Cloud Run provides TLS.
- Configure CORS carefully in [`src/api/server.js`](src/api/server.js:1).

## Autoscaling & Queueing
- For robustness, offload scraping and AI calls to background jobs via a queue (Cloud Tasks / Pub/Sub).
- Use Cloud Run to run workers triggered by Pub/Sub; frontend receives a job ID and polls for results.

## Monitoring & Logging
- Enable Cloud Monitoring & Logging (Stackdriver).
- Add alerts for budget, high error rates, or high instance counts.
- Use structured logging (winston is already in the codebase).

## Cost control
- Start with low instance counts and concurrency=1.
- Use Cloud Run scale-to-zero to minimize cost when idle.
- Monitor egress and AI API call costs (AI API calls will likely dominate costs as usage grows).

## Local testing & CI
- Use GitHub Actions / Cloud Build to build and push images, and deploy to Cloud Run.
- Test locally with: `docker run -p 5000:5000 gcr.io/PROJECT_ID/rto-compliance-checker:latest`

## cPanel note
- cPanel can host the static frontend reliably. The backend requires SSH/root to install Node, Chromium, and native libraries — container deployment is recommended over cPanel for stability.

## Rollback & Blue/Green
- Use Cloud Run revision traffic split for safe rollouts and quick rollback to previous revisions.

## Checklist (step-by-step)
- [ ] Create Google Cloud project and enable APIs
- [ ] Configure Artifact Registry / Container Registry
- [ ] Build & push Docker image (use [`Dockerfile`](Dockerfile:1))
- [ ] Deploy to Cloud Run with env & secrets
- [ ] Deploy frontend to Cloudflare Pages (publish `public/`)
- [ ] Update frontend API base and CORS
- [ ] Configure GCS/DB for reports & leads
- [ ] Set up monitoring, alerts, and billing alerts

## Next actions I can take for you
- Create Cloud Run deploy scripts (gcloud) and a GitHub Actions workflow.
- Update `reportGenerator` to support writing to GCS.
- Add README section and `.env.example` production keys and secrets guidance.

End of deployment plan.