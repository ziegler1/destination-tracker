# Waypoint — Railway Deployment Guide

## Prerequisites

| Tool | Purpose |
|------|---------|
| Railway account | railway.app |
| GitHub repo | Push the monorepo before deploying |
| Cloudflare account | DNS + SSL (optional but recommended) |
| Cloudflare R2 bucket | Photo storage (already configured in `.env.example`) |

---

## Step 1 — Push to GitHub

```bash
git add -A
git commit -m "ready for production"
git push origin main
```

---

## Step 2 — Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Empty Project**
3. Click **+ Add Service** → **Database** → **PostgreSQL**
4. Wait for the plugin to provision (30–60 seconds)
5. Click the Postgres plugin → **Variables** tab → copy **DATABASE_URL**

---

## Step 3 — Deploy the Backend

1. Click **+ Add Service** → **GitHub Repo** → select your repo
2. Railway auto-detects the root Dockerfile — override it:
   - **Root Directory:** `/` (repo root — leave blank)
   - **Dockerfile Path:** `backend/Dockerfile`
3. Once created, go to the service → **Variables** tab → add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Paste from Step 2 (**use the private network URL**) |
| `PORT` | `3000` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `R2_ACCOUNT_ID` | Your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 key ID |
| `R2_SECRET_ACCESS_KEY` | R2 secret |
| `R2_BUCKET` | `waypoint-photos` |
| `R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` |
| `CORS_ORIGIN` | Leave blank for now — fill in after frontend deploys |

4. Click **Deploy** → watch the build log
5. First boot runs auto-migrations. Confirm in logs:
   ```
   Applying migration: 001_init.sql
   Migration applied: 001_init.sql
   Waypoint backend listening on port 3000
   ```
6. Click the generated Railway domain → append `/health`  
   → should return `{"status":"ok","ts":"..."}` ✅

---

## Step 4 — Deploy the Frontend

1. Click **+ Add Service** → **GitHub Repo** → same repo
2. Override build settings:
   - **Root Directory:** `/` (repo root)
   - **Dockerfile Path:** `frontend/Dockerfile`
3. Add variable:

| Variable | Value |
|----------|-------|
| `BACKEND_URL` | The backend service's **private Railway URL** e.g. `https://waypoint-backend.railway.internal` |

> **Important:** Use the private URL (ends in `.railway.internal`), not the public domain. This keeps backend traffic on Railway's internal network.

4. Click **Deploy**
5. When build completes, open the generated Railway domain — you should see the Waypoint UI load

---

## Step 5 — Wire CORS

Now that the frontend URL is known:

1. Go to the **backend** service → Variables
2. Set `CORS_ORIGIN` to the frontend Railway domain:
   ```
   CORS_ORIGIN=https://waypoint-frontend.up.railway.app
   ```
   If you'll add a custom domain, add it too (comma-separated):
   ```
   CORS_ORIGIN=https://waypoint-frontend.up.railway.app,https://waypoint.yourdomain.com
   ```
3. Railway auto-redeploys the backend

---

## Step 6 — Custom Domain via Cloudflare (Optional)

### On Railway (frontend service)
1. Settings → Domains → **Add Custom Domain**
2. Enter `waypoint.yourdomain.com`
3. Railway shows the CNAME target

### On Cloudflare
1. DNS → Add record:
   - **Type:** CNAME
   - **Name:** `waypoint`
   - **Target:** the Railway-provided CNAME
   - **Proxy:** ☁️ Proxied (orange cloud)
2. SSL/TLS → Mode → **Full (strict)**
3. (Optional) Caching rules → cache `*.js`, `*.css` for 30 days at the edge

### Update CORS again
Add the custom domain to `CORS_ORIGIN` on the backend.

---

## Step 7 — Smoke Test Checklist

Run through these after every production deploy:

- [ ] `/health` returns `{"status":"ok"}` on the backend domain
- [ ] All 6 nav routes load: Trips, Destinations, Restaurants, Lodging, Map, Stats
- [ ] Add a destination — form saves and card appears in the list
- [ ] Map shows destination pin (requires lat/lon on the destination)
- [ ] Stats page shows charts (will be empty until data is entered)
- [ ] Photo upload on a destination detail — drag a JPG, confirm thumbnail appears
- [ ] Trip Summary AI button fires and returns text

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Backend logs `DATABASE_URL` error | Wrong connection string | Use private network URL from Postgres plugin |
| Frontend shows blank page | nginx can't reach backend | Check `BACKEND_URL` in frontend Variables |
| CORS error in browser console | `CORS_ORIGIN` not set | Add frontend domain to backend `CORS_ORIGIN` |
| Photos 403 on upload | R2 credentials wrong | Verify `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` |
| Migration table error | DB not yet ready | Redeploy backend — Railway DB needs a few seconds |
| Map tiles don't load | Network / CSP | OSM tiles are HTTP — add CSP `img-src` if using strict headers |

---

## Environment Variable Summary

### Backend service
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Copy from Railway Postgres plugin |
| `PORT` | ✅ | Set to `3000` |
| `ANTHROPIC_API_KEY` | ✅ | For Claude AI features |
| `R2_ACCOUNT_ID` | ✅ | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | ✅ | R2 API token |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 API secret |
| `R2_BUCKET` | ✅ | Bucket name |
| `R2_PUBLIC_URL` | ✅ | Public base URL for photos |
| `CORS_ORIGIN` | ✅ prod | Frontend domain(s), comma-separated |
| `NODE_ENV` | auto | Set to `production` by Dockerfile |

### Frontend service
| Variable | Required | Notes |
|----------|----------|-------|
| `BACKEND_URL` | ✅ | Backend private Railway URL |
