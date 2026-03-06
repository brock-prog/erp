# DECORA ERP — ROG PC Deployment Guide

**Date**: 2026-03-03
**Audience**: First-time setup, no Docker/server experience assumed
**Hardware**: ASUS ROG liquid-cooled PC, 32-64 GB RAM, SSD, RTX 4070, Windows 10/11
**Network**: Same LAN as shop floor
**Result**: Self-hosted ERP accessible from any device on the shop network

---

## What You're Building

By the end of this guide, you'll have:

- Your DECORA ERP running on the ROG PC, accessible from any browser on the shop network
- A Postgres database storing all your data on the PC's SSD
- Supabase services (auth, edge functions, file storage) running locally
- ADP integration ready to plug in credentials
- Optional remote access via Cloudflare Tunnel

Everything auto-starts when the PC boots. All data stays on your hardware.

---

## Prerequisites

Before you start, have these ready:

- [ ] The ROG PC, powered on, connected to your shop network via ethernet (not WiFi)
- [ ] Windows 10 version 2004+ or Windows 11 (check: Settings > System > About)
- [ ] Admin access to the PC (you can install software)
- [ ] Internet connection (for downloading software — about 2 GB total)
- [ ] A USB drive or second drive for backups (recommended, not required)

---

## Part 1: Install WSL2 (5 minutes)

**What is WSL2?** Windows Subsystem for Linux. It runs a lightweight Linux environment inside Windows. Docker needs this to work. You won't interact with it directly — it runs invisibly in the background.

### Steps

1. **Open PowerShell as Administrator**
   - Click the Start menu
   - Type `PowerShell`
   - Right-click "Windows PowerShell" and choose **"Run as administrator"**
   - Click "Yes" on the permission prompt

2. **Run the install command**
   - Type this exactly and press Enter:
   ```
   wsl --install
   ```
   - This downloads and installs WSL2 + Ubuntu. It takes 2-3 minutes.

3. **Restart when prompted**
   - Windows will ask you to restart. Save any work and restart.

4. **After restart: finish Ubuntu setup**
   - A terminal window may open automatically asking for a username and password
   - Pick a simple username (e.g., `brock`) and password (e.g., `decora2026`)
   - **Write this password down** — you'll need it occasionally
   - If no terminal opens, that's fine — WSL2 is installed and Docker will handle the rest

5. **Verify it worked**
   - Open PowerShell (regular, not admin) and type:
   ```
   wsl --version
   ```
   - You should see version info. If you get an error, restart the PC once more.

---

## Part 2: Install Docker Desktop (10 minutes)

**What is Docker?** Software that runs pre-packaged applications in isolated "containers." Instead of manually installing Postgres, configuring it, etc., Docker downloads everything pre-configured and starts it with one command.

### Steps

1. **Download Docker Desktop**
   - Open your browser and go to: **https://www.docker.com/products/docker-desktop/**
   - Click **"Download for Windows"**
   - Run the installer when it finishes downloading

2. **Install Docker Desktop**
   - Leave all default options checked (especially "Use WSL 2 instead of Hyper-V")
   - Click "Ok" and let it install (2-3 minutes)
   - It will ask you to log out or restart — do it

3. **Start Docker Desktop**
   - After restart, Docker Desktop should start automatically
   - You'll see a whale icon in the system tray (bottom-right of your taskbar)
   - It may take 1-2 minutes to "start the engine" — wait for the whale icon to stop animating
   - **Skip** the Docker account signup if prompted — you don't need an account

4. **Configure Docker to start on boot**
   - Click the whale icon in the system tray
   - Go to **Settings** (gear icon)
   - Under **General**, make sure these are checked:
     - [x] Start Docker Desktop when you sign in to Windows
     - [x] Use the WSL 2 based engine
   - Click **Apply & restart**

5. **Verify it worked**
   - Open PowerShell and type:
   ```
   docker --version
   ```
   - You should see something like `Docker version 27.x.x`
   - Then type:
   ```
   docker run hello-world
   ```
   - You should see "Hello from Docker!" — this means Docker is working

---

## Part 3: Deploy Self-Hosted Supabase (15 minutes)

**What is Supabase?** An open-source platform that gives you a Postgres database + authentication + file storage + edge functions in one package. Your ERP already uses it. We're just running our own copy instead of using their cloud service.

### Steps

1. **Pick a folder for the server files**
   - Create a folder on the SSD. Open PowerShell and type:
   ```
   mkdir C:\ERP-Server
   cd C:\ERP-Server
   ```

2. **Download the Supabase self-hosting files**
   ```
   git clone --depth 1 https://github.com/supabase/supabase.git C:\ERP-Server\supabase
   cd C:\ERP-Server\supabase\docker
   ```
   - If `git` is not installed, download it from https://git-scm.com/download/win and install with defaults

3. **Create your environment file**
   - Copy the example config:
   ```
   copy .env.example .env
   ```

4. **Edit the .env file with your secrets**
   - Open the file in Notepad:
   ```
   notepad .env
   ```
   - Find and change these values (the file has comments explaining each one):

   ```
   # IMPORTANT: Change these from the defaults!

   POSTGRES_PASSWORD=pick-a-strong-password-here
   JWT_SECRET=pick-a-different-strong-secret-at-least-32-chars
   ANON_KEY=         (leave as-is for now, we'll generate proper keys)
   SERVICE_ROLE_KEY= (leave as-is for now, we'll generate proper keys)
   DASHBOARD_USERNAME=admin
   DASHBOARD_PASSWORD=pick-a-dashboard-password
   ```

   - **Write down these passwords somewhere safe.** You'll need them.
   - Save and close Notepad

5. **Generate proper JWT keys**
   - Go to: **https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys**
   - Use the JWT generator tool on that page
   - Paste your `JWT_SECRET` from step 4
   - It will generate `ANON_KEY` and `SERVICE_ROLE_KEY` values
   - Copy them back into your `.env` file

6. **Start Supabase**
   ```
   docker compose up -d
   ```
   - `-d` means "detached" — it runs in the background
   - First time takes 5-10 minutes to download all the container images (~1.5 GB)
   - You'll see each service pulling and starting

7. **Verify it's running**
   - Open your browser and go to: **http://localhost:8000**
   - You should see the Supabase Dashboard login screen
   - Log in with the `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` you set
   - You should see the Supabase dashboard — this is your database admin panel

8. **Find your PC's local IP address**
   - In PowerShell, type:
   ```
   ipconfig
   ```
   - Look for "Ethernet adapter" > "IPv4 Address" — it will be something like `192.168.1.50`
   - **Write this IP down.** This is how other devices on the network will reach the ERP.

9. **Test from another device**
   - On your phone or another computer on the same network, open a browser
   - Go to: `http://192.168.1.50:8000` (use your actual IP)
   - You should see the Supabase Dashboard

---

## Part 4: Build and Deploy the ERP Frontend (10 minutes)

Now we build your DECORA ERP app and serve it through Supabase.

### Steps

1. **On your Mac (your development machine), build the app**
   ```bash
   cd /Users/brock/erp
   /Users/brock/.local/node-v22.14.0-darwin-arm64/bin/npm run build
   ```
   - This creates a `dist/` folder with the compiled app

2. **Update .env.local to point at the ROG PC**
   - Edit `/Users/brock/erp/.env.local`:
   ```
   VITE_SUPABASE_URL=http://192.168.1.50:8000
   VITE_SUPABASE_ANON_KEY=your-anon-key-from-step-5-above
   ```
   - Rebuild after changing env:
   ```bash
   /Users/brock/.local/node-v22.14.0-darwin-arm64/bin/npm run build
   ```

3. **Copy the dist folder to the ROG PC**
   - Option A — USB drive: Copy `dist/` to a USB drive, plug into ROG PC, copy to `C:\ERP-Server\frontend\`
   - Option B — Network share: If the ROG PC has a shared folder, copy over the network
   - Option C — SCP/SFTP: Use a tool like WinSCP if you're comfortable with it

4. **Serve the frontend with a simple static server**
   - On the ROG PC, we'll use a Docker container to serve the static files. In PowerShell:
   ```
   docker run -d --name erp-frontend --restart always -p 3000:80 -v C:\ERP-Server\frontend\dist:/usr/share/nginx/html:ro nginx:alpine
   ```
   - This starts an Nginx web server that serves your ERP on port 3000

5. **Test the ERP**
   - On the ROG PC: open **http://localhost:3000**
   - On other devices on the network: open **http://192.168.1.50:3000**
   - You should see the DECORA ERP login screen!

---

## Part 5: Auto-Recovery Setup (5 minutes)

Make sure everything comes back after a restart.

### Steps

1. **Docker containers are already set to auto-restart**
   - The Supabase `docker-compose.yml` has `restart: always` on all services
   - The Nginx container we created with `--restart always` also auto-restarts
   - Docker Desktop auto-starts with Windows (we set this in Part 2)

2. **Set BIOS to auto-boot on power loss**
   - Restart the ROG PC and press **DEL** or **F2** during boot to enter BIOS
   - Look for: **Advanced** > **APM Configuration** > **Restore AC Power Loss**
   - Set it to: **Power On**
   - Save and exit BIOS (usually F10)
   - This means: if the power goes out, the PC turns itself back on when power returns

3. **Set Windows to auto-login (optional but recommended)**
   - The ERP server needs Windows to fully boot (Docker Desktop starts at login)
   - Open Run (Win+R), type `netplwiz`, press Enter
   - Uncheck "Users must enter a user name and password to use this computer"
   - Click Apply, enter your password, click OK
   - Now the PC boots straight to desktop without waiting for login

4. **Test the full recovery**
   - Restart the ROG PC
   - Wait 2-3 minutes after the desktop appears
   - Open a browser and go to `http://localhost:3000`
   - The ERP should be running — everything auto-started

---

## Part 6: Database Backup (5 minutes)

Your ERP data lives in a Postgres database inside Docker. Set up automatic backups.

### Steps

1. **Create a backup script**
   - Open Notepad and paste this:
   ```bat
   @echo off
   set BACKUP_DIR=C:\ERP-Server\backups
   set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
   set TIMESTAMP=%TIMESTAMP: =0%

   if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%

   docker exec supabase-db pg_dump -U postgres > "%BACKUP_DIR%\erp_backup_%TIMESTAMP%.sql"

   echo Backup created: erp_backup_%TIMESTAMP%.sql

   REM Keep only last 30 backups
   forfiles /p "%BACKUP_DIR%" /m "erp_backup_*.sql" /d -30 /c "cmd /c del @file" 2>nul
   ```
   - Save as `C:\ERP-Server\backup.bat` (make sure it's `.bat` not `.bat.txt`)

2. **Schedule daily backups**
   - Open **Task Scheduler** (search for it in Start menu)
   - Click **Create Basic Task**
   - Name: `ERP Database Backup`
   - Trigger: **Daily**, at a time when the shop is closed (e.g., 11:00 PM)
   - Action: **Start a program**
   - Program: `C:\ERP-Server\backup.bat`
   - Check "Open the Properties dialog" and click Finish
   - In Properties: check "Run whether user is logged on or not"
   - Click OK, enter your Windows password

3. **Test the backup**
   - Double-click `C:\ERP-Server\backup.bat`
   - Check `C:\ERP-Server\backups\` — you should see an `.sql` file
   - This file contains your entire database. Keep a copy on a USB drive weekly.

---

## Part 7: Cloudflare Tunnel — Remote Access (Optional, 10 minutes)

This lets you access the ERP from outside the shop (your phone, home computer, etc.) without opening any ports on your router.

### Prerequisites
- A Cloudflare account (free): https://dash.cloudflare.com/sign-up
- A domain name pointed to Cloudflare nameservers (if you don't have one, you can buy one through Cloudflare for ~$10/year)

### Steps

1. **Install cloudflared on the ROG PC**
   - Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   - Run the `.msi` installer

2. **Authenticate**
   - Open PowerShell and type:
   ```
   cloudflared tunnel login
   ```
   - A browser window opens. Log into Cloudflare and select your domain.

3. **Create the tunnel**
   ```
   cloudflared tunnel create erp-server
   ```
   - Note the Tunnel ID it gives you.

4. **Configure the tunnel**
   - Create `C:\ERP-Server\cloudflared\config.yml`:
   ```yaml
   tunnel: YOUR_TUNNEL_ID
   credentials-file: C:\Users\YOUR_USERNAME\.cloudflared\YOUR_TUNNEL_ID.json

   ingress:
     - hostname: erp.yourdomain.com
       service: http://localhost:3000
     - hostname: db.yourdomain.com
       service: http://localhost:8000
     - service: http_status:404
   ```

5. **Set DNS records**
   ```
   cloudflared tunnel route dns erp-server erp.yourdomain.com
   cloudflared tunnel route dns erp-server db.yourdomain.com
   ```

6. **Install as a Windows service (auto-starts on boot)**
   ```
   cloudflared service install
   ```

7. **Test remote access**
   - From your phone (on cellular, not WiFi): open `https://erp.yourdomain.com`
   - You should see the DECORA ERP login screen, secured with HTTPS

---

## Part 8: Connecting ADP (When You Have Credentials)

Once you've signed up for ADP API Central and received your Client ID + Secret:

1. **Edit the Supabase .env file on the ROG PC**
   ```
   notepad C:\ERP-Server\supabase\docker\.env
   ```
   Add these lines:
   ```
   ADP_CLIENT_ID=your_client_id_from_adp
   ADP_CLIENT_SECRET=your_client_secret_from_adp
   ADP_ENVIRONMENT=sandbox
   ```

2. **Restart Supabase to pick up the new env vars**
   ```
   cd C:\ERP-Server\supabase\docker
   docker compose down
   docker compose up -d
   ```

3. **Deploy the ADP Edge Functions**
   - (This step will be covered in the ADP implementation plan — the Edge Functions get deployed to your self-hosted Supabase instance)

---

## Quick Reference Card

Print this and tape it near the ROG PC:

```
DECORA ERP Server — Quick Reference
====================================

ERP (shop floor):    http://192.168.x.x:3000
Supabase Dashboard:  http://192.168.x.x:8000
Remote (if set up):  https://erp.yourdomain.com

Passwords stored:    C:\ERP-Server\PASSWORDS.txt (keep secure!)

START everything:    Docker Desktop starts automatically on boot
STOP everything:     Right-click Docker whale icon > "Quit Docker Desktop"
RESTART Supabase:    cd C:\ERP-Server\supabase\docker && docker compose restart
VIEW logs:           docker compose logs -f  (Ctrl+C to stop watching)
MANUAL backup:       Double-click C:\ERP-Server\backup.bat
CHECK status:        docker ps  (should show ~12 running containers)

If ERP is down:
  1. Is Docker Desktop running? (whale icon in system tray)
  2. Run: docker ps  — are containers running?
  3. Run: cd C:\ERP-Server\supabase\docker && docker compose up -d
  4. Wait 60 seconds, try again

If PC won't boot:
  - Data is safe on the SSD
  - Restore from USB backup if needed
  - Reinstall Docker + re-run docker compose up -d
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Docker Desktop requires Windows 10 version 2004" | Run Windows Update and install all updates |
| Docker is slow to start | Normal — first boot takes 1-2 min. Give it time. |
| `wsl --install` fails | Reboot, try again. If still fails: Settings > Apps > Optional Features > More Windows Features > enable "Virtual Machine Platform" and "Windows Subsystem for Linux" |
| Can't reach ERP from other devices | Check firewall: Windows Defender Firewall > Allow an app > add Docker Desktop. Also check ports 3000 and 8000 are allowed. |
| "port 8000 already in use" | Something else is using that port. Run `netstat -ano | findstr :8000` to find it, then kill that process or change the Supabase port in `.env` |
| Supabase dashboard says "no connection" | Wait 60 seconds after `docker compose up`. Postgres needs time to initialize on first run. |
| ERP loads but shows "Supabase not configured" | Check that `.env.local` in the ERP build has the correct `VITE_SUPABASE_URL` pointing to the ROG PC's IP |

---

## Updating the ERP (When New Features Are Built)

When we build new features in Claude Code sessions:

1. On your Mac, build the app:
   ```bash
   cd /Users/brock/erp
   /Users/brock/.local/node-v22.14.0-darwin-arm64/bin/npm run build
   ```

2. Copy the `dist/` folder to `C:\ERP-Server\frontend\dist` on the ROG PC (replacing the old one)

3. Restart the frontend container:
   ```
   docker restart erp-frontend
   ```

4. Refresh the browser — you'll see the new version. No downtime for shop floor users.
