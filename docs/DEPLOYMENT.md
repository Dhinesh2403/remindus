# Deployment Guide — Dev → Staging → Production

---

## 1. MongoDB Atlas Setup (all environments)

```bash
# Step 1: Create account at https://cloud.mongodb.com

# Step 2: Create 3 clusters (or use one with 3 databases)
#   - remindus_dev      → Free M0 tier (dev only)
#   - remindus_staging  → M10 shared (staging)
#   - remindus_prod     → M10+ dedicated (production)

# Step 3: For each cluster:
#   Database Access → Add DB User
#     Username: remindus_user
#     Password: <strong-generated-password>
#     Role: readWrite on relevant DB

#   Network Access → Add IP Address
#     Development: your IP
#     Staging/Prod: 0.0.0.0/0 (Railway IPs vary; lock down later with Railway static IPs)

# Step 4: Get connection string:
#   Clusters → Connect → Connect your application → Driver: Node.js 5.x
#   mongodb+srv://remindus_user:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
```

---

## 2. Generate VAPID Keys (Web Push)

```bash
cd backend
npx web-push generate-vapid-keys

# Copy output into each .env file:
# VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
```

---

## 3. Google OAuth Setup

```
1. Go to https://console.cloud.google.com
2. Create project: "RemindUs Buddy"
3. APIs & Services → Credentials → Create OAuth 2.0 Client ID
4. Type: Web application
5. Authorized JavaScript Origins:
     - http://localhost:8100          (dev)
     - https://remindus-buddy-staging.vercel.app (staging)
     - https://remindusbuddy.vercel.app          (prod)
6. Authorized redirect URIs: (same as origins)
7. Copy Client ID into frontend environments + backend .env
```

---

## 4. Development Setup (Windows)

```bash
# Install Node.js 20 LTS from https://nodejs.org
node --version   # should be v20.x

# Install global tools
npm install -g @angular/cli@17 @ionic/cli

# Clone repo
git clone https://github.com/YOUR_USERNAME/remindus-buddy.git
cd remindus-buddy

# Backend setup
cd backend
cp .env.development .env
# Edit .env — fill in MONGO_URI, GOOGLE_CLIENT_ID, etc.
npm install
npm run dev
# → http://localhost:5000/api/health should return { success: true }

# Frontend setup (new terminal)
cd ../frontend
npm install
ionic serve
# → http://localhost:8100
```

---

## 5. Deploy Backend to Railway

```bash
# Step 1: Install Railway CLI
npm install -g @railway/cli
railway login

# Step 2: Create two Railway services (staging + production)
railway init   # in backend/ folder

# Step 3: Set environment variables in Railway dashboard:
#   → railway.app → Your Project → Variables → Add all from .env.staging/.env.production

# Step 4: Link GitHub repo for automatic deploys
#   Railway Dashboard → Settings → Connect GitHub → Select repo
#   Set root directory: backend/
#   Branch for staging:    develop
#   Branch for production: main

# Step 5: Manual deploy (if not using GitHub)
cd backend
railway up --service remindus-buddy-api

# Step 6: Check logs
railway logs --service remindus-buddy-api

# Step 7: Verify
curl https://YOUR_RAILWAY_URL.up.railway.app/api/health
```

**Railway environment variables to set:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | `mongodb+srv://...` |
| `JWT_ACCESS_SECRET` | `<64-char-secret>` |
| `JWT_REFRESH_SECRET` | `<64-char-secret>` |
| `FRONTEND_URL` | `https://remindusbuddy.vercel.app` |
| `GOOGLE_CLIENT_ID` | `<from GCP>` |
| `SMTP_HOST` | `smtp.sendgrid.net` |
| `SMTP_USER` | `apikey` |
| `SMTP_PASS` | `<sendgrid-api-key>` |
| `TWILIO_ACCOUNT_SID` | `<from Twilio>` |
| `TWILIO_AUTH_TOKEN` | `<from Twilio>` |
| `VAPID_PUBLIC_KEY` | `<generated>` |
| `VAPID_PRIVATE_KEY` | `<generated>` |

---

## 6. Deploy Frontend to Vercel

```bash
# Step 1: Install Vercel CLI
npm install -g vercel
vercel login

# Step 2: Build and deploy staging
cd frontend
npm run build:staging
vercel --prod false    # creates preview URL

# Step 3: Set Vercel environment variables:
#   Vercel Dashboard → Project → Settings → Environment Variables
#   (or use .env.vercel files)

# Step 4: Link GitHub for automatic deploys
#   Vercel Dashboard → Import Git Repository
#   Root directory: frontend/
#   Build command:  npm run build:prod
#   Output dir:     www
#   Branch: main → Production
#   Branch: develop → Preview

# Step 5: Custom domain (optional)
vercel domains add remindusbuddy.com

# Step 6: Force redeploy
vercel --prod
```

**Vercel environment variables:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |

> Angular environment files are baked in at build time — no runtime vars needed on Vercel.
> Update `frontend/src/environments/environment.prod.ts` with real API URLs before building.

---

## 7. GitHub CI/CD Setup

```bash
# Initialize
cd remindus-buddy
git init
git remote add origin https://github.com/YOUR_USERNAME/remindus-buddy.git

# Branch strategy
git checkout -b develop    # staging deploys from this
git checkout -b main       # production deploys from this

# Initial commit
git add .
git commit -m "feat: initial RemindUs Buddy full-stack scaffold"
git push -u origin develop
```

**.github/workflows/ci.yml:**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: backend/package-lock.json }
      - run: cd backend && npm ci
      - run: cd backend && npm test

  frontend-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: frontend/package-lock.json }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build:prod
```

---

## 8. Environment Comparison

| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| `NODE_ENV` | development | staging | production |
| MongoDB | Local / Atlas free | Atlas M10 | Atlas M10+ |
| Email | Mailtrap (test) | SendGrid | SendGrid |
| CORS | localhost:8100 | staging.vercel.app | prod.vercel.app |
| Rate limit | 200 req/15min | 100 req/15min | 60 req/15min |
| Logging | debug | warn | error |
| Source maps | Yes | Yes | No |
| Optimization | No | Yes | Yes |
| Service Worker | No | No | Yes |
| VAPID | Optional | Required | Required |

---

## 9. .gitignore

```gitignore
# Dependencies
node_modules/
.npm

# Build output
www/
dist/

# Environment files (NEVER commit real secrets)
.env
.env.development
.env.staging
.env.production
*.env

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Angular
.angular/

# Railway
.railway/
```

---

## 10. Checklist Before Going Live

- [ ] All JWT secrets are 64+ chars, unique, generated with `openssl rand -base64 64`
- [ ] MongoDB IP whitelist configured for Railway's IPs
- [ ] CORS only allows your Vercel domain (not `*`)
- [ ] Rate limiting active (60 req/15min for auth routes)
- [ ] VAPID keys generated and set in Railway
- [ ] Google OAuth redirect URIs match your Vercel domain exactly
- [ ] Twilio account verified and numbers approved for WhatsApp
- [ ] SendGrid domain verified for email deliverability
- [ ] `npm audit` passes with no critical vulnerabilities
- [ ] Angular PWA `ngsw-config.json` configured for your API domain
- [ ] Health check endpoint returns 200 in Railway
