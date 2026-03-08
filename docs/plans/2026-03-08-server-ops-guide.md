# CoatPro Server Operations Guide

> **Domain**: coatpro.app
> **Server**: ROG PC (ARMOURY) — Windows 11, AMD Ryzen, 32GB RAM
> **IP**: 192.168.200.77
> **User**: decor

---

## 1. Quick-Start Commands (ROG PC)

Open **two** PowerShell windows (Window 3 is no longer needed once cloudflared is a service):

**Window 1 — API Server**
```powershell
cd C:\Users\decor\erp\server
npm run dev
```
Expected output: `Server running on port 3001` + `Backup scheduler started`

**Window 2 — Frontend**
```powershell
cd C:\Users\decor\erp
npm run dev
```
Expected output: `Local: http://localhost:5173`

**Tunnel** runs automatically as a Windows service (see Section 2).

---

## 2. Cloudflared Windows Service Setup

### Install the service (one-time)

Open PowerShell **as Administrator** (right-click → Run as Administrator):

```powershell
cloudflared service install
```

This registers `cloudflared` as a Windows service that auto-starts on boot.

### Verify it's running

```powershell
Get-Service cloudflared
```

Should show `Status: Running`.

### Manage the service

```powershell
# Stop the tunnel
Stop-Service cloudflared

# Start the tunnel
Start-Service cloudflared

# Restart the tunnel
Restart-Service cloudflared

# Check status
Get-Service cloudflared
```

### If you need to update the config later

The service reads from `C:\Users\decor\.cloudflared\config.yml`. After editing that file:

```powershell
Restart-Service cloudflared
```

---

## 3. Cloudflare Security Checklist

### Already Configured
- [x] Cloudflare Tunnel (no public IP exposed, no open ports)
- [x] Zero Trust Access with One-time PIN authentication
- [x] Email domain restriction (@decorapowdercoatings.com)
- [x] brock@luxyclad.com added as authorized user

### Recommended — Do These in Cloudflare Dashboard

#### A. SSL/TLS Settings (cloudflare.com → coatpro.app → SSL/TLS)
- [x] Set SSL mode to **Full (Strict)** — encrypts traffic end-to-end
- [ ] Enable **Always Use HTTPS** — redirects all HTTP to HTTPS
- [ ] Enable **Automatic HTTPS Rewrites** — fixes mixed content
- [ ] Set **Minimum TLS Version** to **TLS 1.2**

#### B. Security Settings (cloudflare.com → coatpro.app → Security)
- [ ] **Bot Fight Mode**: Turn ON — blocks known bot traffic (those /wordpress/ and /.git/config scanners you saw)
- [ ] **Security Level**: Set to **High** — challenges suspicious visitors
- [ ] **Challenge Passage**: Set to **30 minutes** — how long a solved challenge is valid
- [ ] **Browser Integrity Check**: Ensure ON — blocks requests with suspicious headers

#### C. Firewall Rules (cloudflare.com → coatpro.app → Security → WAF)
- [ ] Create rule: Block requests to paths containing `.git`, `.env`, `wp-admin`, `wordpress`, `xmlrpc`, `phpmyadmin`
  - Rule name: "Block Scanner Paths"
  - Expression: `(http.request.uri.path contains ".git") or (http.request.uri.path contains ".env") or (http.request.uri.path contains "wp-admin") or (http.request.uri.path contains "wordpress") or (http.request.uri.path contains "xmlrpc") or (http.request.uri.path contains "phpmyadmin")`
  - Action: **Block**

#### D. Zero Trust Access Policies (Cloudflare Zero Trust → Access → Applications)
Verify your application policy:
- **Application**: coatpro.app (and subdomains)
- **Policy**: Allow — Emails ending in `@decorapowdercoatings.com` + `brock@luxyclad.com`
- **Session Duration**: 24 hours (re-authenticate daily)
- **Purpose Justification**: OFF (not needed for internal team)

#### E. ROG PC Windows Firewall
Block all inbound traffic to ports 5173 and 3001 from external sources. Only cloudflared (localhost) should access these:

Open PowerShell as Administrator on ROG:
```powershell
# Block external access to Vite dev server
New-NetFirewallRule -DisplayName "Block External 5173" -Direction Inbound -LocalPort 5173 -Protocol TCP -RemoteAddress "0.0.0.0-255.255.255.255" -Action Block

# Block external access to API server
New-NetFirewallRule -DisplayName "Block External 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -RemoteAddress "0.0.0.0-255.255.255.255" -Action Block
```

This ensures the ONLY way to reach your ERP is through the Cloudflare Tunnel — nobody can hit it directly by IP.

---

## 4. Server Resilience Plan

### Problem: The servers don't auto-start on boot

Right now, you have to manually open PowerShell and run `npm run dev` for both the API server and the frontend. If the ROG restarts (Windows Update, power outage, etc.), the site goes down until you manually restart them.

### Solution A: Create startup scripts (Quick Fix)

Save this as `C:\Users\decor\start-coatpro.bat`:

```bat
@echo off
echo Starting CoatPro ERP...

:: Start API server in background
start "CoatPro API" cmd /k "cd C:\Users\decor\erp\server && npm run dev"

:: Wait 3 seconds for API to start
timeout /t 3 /nobreak

:: Start Frontend in background
start "CoatPro Frontend" cmd /k "cd C:\Users\decor\erp && npm run dev"

echo CoatPro servers starting...
```

Then add a shortcut to this .bat file in the Windows Startup folder:
1. Press `Win+R`, type `shell:startup`, press Enter
2. Right-click in the folder → New → Shortcut
3. Browse to `C:\Users\decor\start-coatpro.bat`
4. Name it "CoatPro Startup"

Now both servers start automatically when someone logs into the ROG.

### Solution B: PM2 Process Manager (Recommended for Production)

PM2 keeps your Node processes running and auto-restarts them if they crash:

```powershell
npm install -g pm2
npm install -g pm2-windows-service

# Start API server with PM2
cd C:\Users\decor\erp\server
pm2 start npm --name "coatpro-api" -- run dev

# Start Frontend with PM2
cd C:\Users\decor\erp
pm2 start npm --name "coatpro-frontend" -- run dev

# Save the process list
pm2 save

# Install as Windows service (auto-start on boot)
pm2-windows-service install
```

PM2 benefits:
- Auto-restarts crashed processes
- Log management (pm2 logs)
- Health monitoring (pm2 status)
- Memory/CPU tracking (pm2 monit)

### Solution C: Production Build (Best Performance)

For the demo and beyond, run a production build instead of dev mode:

```powershell
# Build once
cd C:\Users\decor\erp
npm run build

# Serve the built files (much faster, less memory)
npm install -g serve
serve -s dist -l 5173
```

This eliminates all those "stream canceled" warnings from Vite's dev mode.

---

## 5. Monitoring & Health Checks

### Check if everything is running

```powershell
# Check all three services
Get-Service cloudflared
Get-Process -Name node -ErrorAction SilentlyContinue | Format-Table Id, ProcessName, CPU
netstat -an | findstr "5173 3001"
```

You should see:
- cloudflared service: Running
- Two node processes (API + Frontend)
- Ports 5173 and 3001 in LISTENING state

### Check tunnel health

```powershell
cloudflared tunnel info coatpro
```

### Quick network test from any device

```
https://coatpro.app          → Should load ERP login
https://api.coatpro.app      → Should show API response
https://erp.coatpro.app      → Should load ERP login
```

---

## 6. Emergency Recovery Playbook

### Site is down — diagnostic steps

1. **Is the ROG on?** Check if the PC is running and not in sleep mode.
   - Go to Settings → System → Power → set "Sleep" to **Never** when plugged in

2. **Is the tunnel running?**
   ```powershell
   Get-Service cloudflared
   ```
   If stopped: `Start-Service cloudflared`

3. **Are the Node servers running?**
   ```powershell
   netstat -an | findstr "5173 3001"
   ```
   If port 5173 not listening → restart frontend:
   ```powershell
   cd C:\Users\decor\erp
   npm run dev
   ```
   If port 3001 not listening → restart API:
   ```powershell
   cd C:\Users\decor\erp\server
   npm run dev
   ```

4. **Is it a Cloudflare issue?**
   - Check https://www.cloudflarestatus.com
   - Check Zero Trust dashboard for blocked requests

5. **Is it a code issue?** (after a git pull broke something)
   ```powershell
   cd C:\Users\decor\erp
   git log --oneline -5
   # Roll back to last known good commit:
   git checkout <commit-hash> -- .
   npm run dev
   ```

### Database is down

- Check Supabase status: https://status.supabase.com
- The ERP falls back to localStorage automatically if Supabase is unreachable
- Backups run every 6 hours to `C:\Users\decor\erp-backups`

### Need to update code

Always from the Mac:
```bash
cd /Users/brock/erp
# Make changes, then:
git add <files>
git commit -m "description"
git push
```

Then on the ROG (Window 2):
```powershell
cd C:\Users\decor\erp
git pull
# Frontend auto-refreshes with Vite
```

For server changes, also restart Window 1:
```powershell
cd C:\Users\decor\erp\server
# Press Ctrl+C to stop, then:
npm run dev
```

---

## 7. Preventing Sleep/Shutdown Issues

On the ROG PC, change these power settings:

1. **Settings → System → Power & Battery**
   - Screen timeout: 15 minutes (OK to turn off screen)
   - Sleep: **Never** (when plugged in)

2. **Settings → Windows Update → Advanced Options**
   - Active hours: Set to your business hours (e.g., 6 AM – 10 PM)
   - This prevents Windows from rebooting for updates during work hours

3. **Disable fast startup** (can cause issues with services):
   - Control Panel → Power Options → Choose what power buttons do
   - Click "Change settings that are currently unavailable"
   - Uncheck "Turn on fast startup"

---

## 8. Key Contacts & Resources

| Resource | URL |
|----------|-----|
| Supabase Dashboard | https://supabase.com/dashboard (project: zbambxpdkowepjouokoj) |
| Cloudflare Dashboard | https://dash.cloudflare.com |
| Cloudflare Zero Trust | https://one.dash.cloudflare.com |
| GitHub Repo | https://github.com/brock-prog/erp (private) |
| Cloudflare Status | https://www.cloudflarestatus.com |
| Supabase Status | https://status.supabase.com |
