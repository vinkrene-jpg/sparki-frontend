# Sparki — Productie-deploymentplan: TransIP VPS sparki-vps2

**Versie:** 2026-07-28 (concept, nog niet uitgevoerd)  
**Auteur:** Replit Agent  
**Status:** wacht op goedkeuring van René vóór enige uitvoering

---

## Beslissamenvatting

| Vraag | Keuze | Reden |
|---|---|---|
| Architectuurbenadering | Native Node + systemd (PM2 als procesmanager) | Docker voegt ~300–400 MB RAM overhead toe op een 2 GB-machine; systemd + PM2 is bewezen, debugbaar zonder daemon-lagen, en vereist geen Docker-kennis voor dagelijks beheer |
| Frontend serving | Nginx serveert statische `dist/`-map direct | Zero Node-overhead; snelste optie voor SPA-bestanden |
| API | PM2 beheert één Node-proces | Automatisch herstarten, rolling restart, log-rotatie ingebouwd |
| Database | PostgreSQL 16 op dezelfde VPS | Lage latency, geen externe verbinding vereist; netwerk-uitrol naar externe DB pas nodig bij groei |
| Reverse proxy | Nginx | Bewezen, lage RAM (<20 MB), goede rate-limiting en SSL-afhandeling |
| SSL | Let's Encrypt via Certbot | Gratis, automatisch hernieuwen |
| CI/CD | Handmatige eerste deployment; GitHub Actions (SSH-deploy) daarna | Veilig, versiegecontroleerd, blokkeerbaar bij falende tests |

**RAM-prognose:** ~1,5 GB piekbelasting (zie § 5). Swap van 2 GB is verplicht vóór de eerste start.

---

## 1. Definitieve productiearchitectuur

```
Internet
    │  443/80
    ▼
┌───────────────────────────────────────────────────┐
│  Nginx (reverse proxy + static file server)        │
│  - /              → serveert /var/www/sparki/dist/ │
│  - /api/*         → proxy_pass http://127.0.0.1:PORT │
│  - SSL-terminatie (Let's Encrypt)                  │
│  - rate limiting (10 req/s per IP op /api)         │
└───────────────────┬───────────────────────────────┘
                    │ loopback (niet publiek)
                    ▼
        ┌───────────────────────┐
        │  API-server (Node.js) │
        │  PM2 – cluster mode   │
        │  poort: intern only   │
        └───────────┬───────────┘
                    │ Unix socket / localhost:5432
                    ▼
        ┌───────────────────────┐
        │  PostgreSQL 16        │
        │  listen: 127.0.0.1    │
        │  database: sparki     │
        └───────────────────────┘

Interne beheerlaag (niet publiek bereikbaar):
  - UFW: alleen 22, 80, 443 open naar buiten
  - PostgreSQL en API-poort: uitsluitend localhost
  - SSH: alleen key-authenticatie, root SSH uitsluitend voor noodgeval
```

### Componenten en hun rol

| Component | Rol | Draait als |
|---|---|---|
| Nginx | Reverse proxy, static serving, SSL, rate-limiting | `www-data` (systemd) |
| Node.js API-server | Bedrijfslogica, database-ORM, webhooks | `sparki` (PM2 via systemd) |
| PostgreSQL 16 | Persistente dataopslag | `postgres` (systemd) |
| PM2 | Procesmanager voor Node: auto-restart, logs, hot-reload | daemon onder `sparki` user |
| Certbot | SSL-certificaten Let's Encrypt, automatisch hernieuwen | root cron / systemd timer |
| UFW | Hostfirewall | systemd |
| logrotate | Rotatie van PM2-logs en Nginx-logs | cron |
| pg_dump cron | Dagelijkse back-up naar off-site S3/SFTP | cron onder `sparki` user |
| Uptime check | Externe monitoring (bv. UptimeRobot gratis tier) | extern |

---

## 2. Native Node + systemd/PM2 vs. Docker Compose

### Aanbeveling: **native Node + PM2 + systemd**

#### Argumenten voor

| Factor | Native PM2 | Docker Compose |
|---|---|---|
| RAM-overhead | ~0 MB extra | +300–400 MB (dockerd + containerd) |
| Debugbaarheid | `pm2 logs`, `journalctl` direct | `docker logs`, extra netwerklaag |
| Opstartcomplexiteit | Laag | Matig (images bouwen, volumes, netwerken) |
| Beveiligingspatch | `apt upgrade nodejs` | Image herbouwen + opnieuw uitrollen |
| Rollback | `pm2 reload --update-env` + git checkout | Container taggen + herstarten |
| Productie-betrouwbaarheid | Bewezen op kleine VPS | Goed, maar overdimensioneerd hier |

#### Wanneer Docker alsnog de voorkeur krijgt

- Zodra er meerdere diensten met conflicterende Node-versies draaien.
- Bij horizontale schaling naar een tweede VPS.
- Als team-gestandaardiseerde omgevingen vereist zijn.

---

## 3. Exacte installatievolgorde per fase

### Fase 0 — Voorbereiding (door René, voor de server)

**Doel:** benodigde informatie verzamelen voor alle fasen.

**Benodigde gegevens van René (zie ook § 9 openstaande punten):**
- Definitieve domeinnaam (bv. `app.sparki.nl`)
- E-mailadres voor Let's Encrypt (beveiligingswaarschuwingen)
- Keuze back-upbestemming (TransIP Object Storage, externe SFTP, of S3-compatibel)
- Back-up credentials (niet hier vastleggen, apart aanleveren)
- Wens voor een afgeschermd testsubdomein vóór publieke livegang (bv. `staging.sparki.nl`)

---

### Fase 1 — Serverbeveiliging

**Doel:** basisverharding van de root-omgeving vóór enige applicatieinstallatie.

**Exacte wijzigingen:**
```bash
# Als root via SSH:
apt update && apt upgrade -y
apt install -y unattended-upgrades apt-listchanges
dpkg-reconfigure --priority=low unattended-upgrades   # automatische beveiligingsupdates

# SSH-hardening: controleer dat PasswordAuthentication al uit staat
grep -E '^(PasswordAuthentication|PermitRootLogin|PubkeyAuthentication)' /etc/ssh/sshd_config
# Verwacht:
#   PasswordAuthentication no
#   PermitRootLogin prohibit-password   (of without-password)
#   PubkeyAuthentication yes
```

**Controles vooraf:**
- Kan René inloggen via SSH-key?  
  `ssh root@141.138.141.205 'echo ok'` → verwacht `ok`
- Zijn er onverwachte open poorten?  
  `ss -tlnp` op de server

**Acceptatiecriteria:**
- `apt upgrade` eindigt zonder fouten
- `unattended-upgrades` actief: `systemctl status unattended-upgrades`
- SSH-hardening-instellingen bevestigd

**Rollback:** geen (alle wijzigingen zijn additief of correctief)

**Risico:** laag — uitsluitend OS-updates en SSH-controle

**Handeling René:** SSH-sessie starten als root, commando's uitvoeren

---

### Fase 2 — Deploy-gebruiker

**Doel:** een dedicated unprivileged user `sparki` voor alle applicatieoperaties; root niet gebruikt buiten noodgevallen.

**Exacte wijzigingen:**
```bash
# Als root:
adduser --disabled-password --gecos "" sparki
# Kopieer René's SSH-key naar de sparki user:
mkdir -p /home/sparki/.ssh
cp /root/.authorized_keys /home/sparki/.ssh/authorized_keys   # of opnieuw plakken
chown -R sparki:sparki /home/sparki/.ssh
chmod 700 /home/sparki/.ssh
chmod 600 /home/sparki/.ssh/authorized_keys
```

**Acceptatiecriteria:**
- René kan inloggen als `sparki` via SSH-key: `ssh sparki@141.138.141.205 'whoami'` → `sparki`
- `sparki` heeft geen sudo-rechten (tenzij zelf toegevoegd)

**Rollback:** `userdel -r sparki` als root

**Risico:** laag

**Handeling René:** SSH-key kopiëren/plakken voor de `sparki` user

---

### Fase 3 — Firewall (UFW)

**Doel:** alleen poorten 22, 80 en 443 toegankelijk; alle overige poorten geblokkeerd.

**Exacte wijzigingen:**
```bash
# Als root:
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (redirect naar HTTPS)'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ufw status verbose
```

**Acceptatiecriteria:**
- `ufw status verbose` toont alleen 22, 80, 443 inkomend
- SSH-verbinding blijft actief na activering (controleer vóór `ufw enable` dat 22 is toegestaan)

**Rollback:** `ufw disable` als de server onbereikbaar wordt

**Risico:** middel — als 22 ontbreekt vóór activering, is de server tijdelijk alleen bereikbaar via de TransIP VPS-console

**Handeling René:** controleer dat SSH-verbinding actief blijft na `ufw enable`

---

### Fase 4 — Software-installatie

**Doel:** Node.js (LTS), PM2, PostgreSQL 16, Nginx, Certbot, Git installeren.

**Exacte wijzigingen:**
```bash
# Als root:

# Node.js LTS via NodeSource (versie afstemmen op wat in repl.nix/package.json staat — check vooraf)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# pnpm (globaal, zelfde major-versie als in de repo)
npm install -g pnpm pm2

# PostgreSQL 16
apt install -y postgresql-16 postgresql-client-16

# Nginx
apt install -y nginx

# Certbot
apt install -y certbot python3-certbot-nginx

# Overige tools
apt install -y git curl jq htop logrotate
```

**Controles vooraf:**
- `node --version` (moet overeenkomen met `engines.node` in `package.json`)
- `pnpm --version`

**Acceptatiecriteria:**
- `node --version` → v22.x.x (of de gewenste LTS)
- `pm2 --version`
- `psql --version` → 16.x
- `nginx -v`
- `certbot --version`

**Rollback:** `apt remove --purge <pakket>` voor elk geïnstalleerd pakket

**Risico:** laag

**Handeling René:** geen — agent of script voert uit

---

### Fase 5 — Code checkout

**Doel:** de repository klonen als `sparki` user, zonder secrets.

**Exacte wijzigingen:**
```bash
# Als user sparki:
mkdir -p /home/sparki/app
cd /home/sparki/app
git clone https://github.com/vinkrene-jpg/sparki-frontend.git .
# of via SSH-deploy key (aanbevolen voor CI/CD later):
# git clone git@github.com:vinkrene-jpg/sparki-frontend.git .
git log --oneline -3   # bevestig commit-hash
```

**Over deploy keys (aanbevolen):**
- Genereer een SSH-keypair als `sparki` user: `ssh-keygen -t ed25519 -C "sparki-vps2-deploy"`
- Voeg de **public** key toe als read-only deploy key in GitHub → Repository Settings → Deploy keys
- Gebruik `git@github.com:vinkrene-jpg/sparki-frontend.git` als remote URL

**Acceptatiecriteria:**
- `/home/sparki/app/package.json` bestaat
- `git status` is clean
- `git log --oneline -1` toont de verwachte commit-hash

**Rollback:** `rm -rf /home/sparki/app && git clone ...`

**Risico:** laag

**Handeling René:** deploy key aanmaken in GitHub als SSH-methode gekozen is

---

### Fase 6 — Database-inrichting

**Doel:** PostgreSQL-database en -gebruiker aanmaken, uitsluitend via localhost bereikbaar.

**Exacte wijzigingen:**
```bash
# Als root, controleer eerst PostgreSQL-config:
grep listen_addresses /etc/postgresql/16/main/postgresql.conf
# Moet zijn: listen_addresses = 'localhost'
# Zo niet: wijzig en herstart

# Als user postgres:
sudo -u postgres psql <<'SQL'
CREATE USER sparki_app WITH PASSWORD 'VERVANG_MET_STERK_WACHTWOORD';
CREATE DATABASE sparki OWNER sparki_app;
GRANT ALL PRIVILEGES ON DATABASE sparki TO sparki_app;
SQL

# Test verbinding:
psql -h 127.0.0.1 -U sparki_app -d sparki -c '\conninfo'
```

**PostgreSQL-instellingen voor 2 GB RAM (zie ook § 5):**  
Configureer in `/etc/postgresql/16/main/postgresql.conf`:
```
shared_buffers = 256MB         # ~12,5% van 2 GB RAM
effective_cache_size = 768MB   # ~37,5% van 2 GB RAM
work_mem = 4MB                 # bescheiden; verhoog pas bij trage queries
maintenance_work_mem = 64MB
max_connections = 30           # API gebruikt verbindingspool, nooit honderden connections
```

**Acceptatiecriteria:**
- `psql -h 127.0.0.1 -U sparki_app -d sparki -c '\l'` toont database `sparki`
- Verbinding van buiten VPS mislukt (database niet publiek)

**Rollback:** `DROP DATABASE sparki; DROP USER sparki_app;`

**Risico:** laag — database nog leeg, geen data te verliezen

**Handeling René:** sterk wachtwoord kiezen en veilig opslaan in wachtwoordmanager

---

### Fase 7 — Environment variables

**Doel:** productiegerheimen veilig opslaan buiten de Git-repository.

**Exacte wijzigingen:**
```bash
# Als user sparki, aanmaken van secrets-bestand:
touch /home/sparki/app/.env.production
chmod 600 /home/sparki/app/.env.production
# Bestand staat in .gitignore (controleren!)

# Inhoud: zie § 8 voor de volledige lijst van benodigde variabelenamen
# Vul de waarden in — nooit naar GitHub pushen
```

**Acceptatiecriteria:**
- `.env.production` is **niet** aanwezig in `git status` (staat in `.gitignore`)
- Bestandsrechten: `-rw-------` (alleen `sparki` kan lezen)
- `cat /home/sparki/app/.gitignore | grep .env` bevestigt uitsluiting

**Rollback:** bestand verwijderen en opnieuw aanmaken

**Risico:** hoog als `.env.production` per ongeluk wordt gecommit — controleer `.gitignore` vóór deze stap

**Handeling René:** alle productiewaarden invullen (wachtwoorden, API-keys, domeinnaam, etc.)

---

### Fase 8 — Build

**Doel:** productiebundles compileren vanuit de broncode.

**Exacte wijzigingen:**
```bash
# Als user sparki:
cd /home/sparki/app
pnpm install --frozen-lockfile
pnpm --filter @workspace/sparki build
pnpm --filter @workspace/api-server build
# Controleer uitvoer:
ls -lh artifacts/sparki/dist/
ls -lh artifacts/api-server/dist/
```

**Controles vooraf:**
- Alle environment variables in `.env.production` zijn gevuld
- `node --version` en `pnpm --version` kloppen met verwachting

**Acceptatiecriteria:**
- `artifacts/sparki/dist/index.html` bestaat
- `artifacts/api-server/dist/index.js` bestaat (of gelijkwaardig esbuild-uitvoer)
- Geen TypeScript-fouten of build-fouten

**Rollback:** opnieuw uitvoeren na foutcorrectie; er worden geen bestanden overschreven die al werkten

**Risico:** middel — buildfouten kunnen duiden op ontbrekende secrets of verkeerde Node-versie

**Handeling René:** buildfouten melden als ze optreden

---

### Fase 9 — Services (PM2)

**Doel:** API-server starten via PM2 en persisteren na herstart.

**Exacte wijzigingen:**
```bash
# Als user sparki:
cd /home/sparki/app

# PM2 ecosystem-bestand aanmaken (niet in Git, bevat paden):
cat > /home/sparki/pm2.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'sparki-api',
    script: './artifacts/api-server/dist/index.js',
    cwd: '/home/sparki/app',
    env_file: '/home/sparki/app/.env.production',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '400M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/home/sparki/logs/api-error.log',
    out_file: '/home/sparki/logs/api-out.log',
    merge_logs: true,
    restart_delay: 3000,
    max_restarts: 10,
    watch: false
  }]
}
EOF

mkdir -p /home/sparki/logs
pm2 start /home/sparki/pm2.config.js
pm2 save

# PM2 opstarten via systemd (als root):
pm2 startup systemd -u sparki --hp /home/sparki
# → kopieer en voer het gegenereerde commando uit als root
```

**Acceptatiecriteria:**
- `pm2 list` toont `sparki-api` als `online`
- `curl -s http://127.0.0.1:PORT/health` retourneert 200 (PORT uit `.env.production`)
- Na `sudo reboot` start de service automatisch

**Rollback:** `pm2 delete sparki-api`

**Risico:** middel — als de API crasht, herstart PM2 automatisch tot `max_restarts` bereikt is

**Handeling René:** PORT-waarde bevestigen in `.env.production` voor de health-check curl

---

### Fase 10 — Nginx

**Doel:** reverse proxy instellen; frontend statisch serveren; API proxyen.

**Exacte wijzigingen:**
```nginx
# /etc/nginx/sites-available/sparki
server {
    listen 80;
    server_name APP_DOMEIN;    # bv. app.sparki.nl — invullen door René
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name APP_DOMEIN;

    # SSL: ingevuld door Certbot in fase 12
    # ssl_certificate / ssl_certificate_key: Certbot schrijft dit in

    # Statische frontend
    root /home/sparki/app/artifacts/sparki/dist;
    index index.html;
    try_files $uri $uri/ /index.html;

    # API-proxy
    location /api/ {
        proxy_pass http://127.0.0.1:PORT;    # PORT uit .env.production
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;

        # Rate limiting (gedefinieerd in nginx.conf main block):
        limit_req zone=api burst=20 nodelay;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Security headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
}
```

**Rate-limiting toevoegen aan `/etc/nginx/nginx.conf` (in `http`-blok):**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
```

```bash
# Activeren:
ln -s /etc/nginx/sites-available/sparki /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

**Acceptatiecriteria:**
- `nginx -t` geeft `syntax is ok`
- `curl -I http://141.138.141.205` redirectt naar HTTPS (na SSL-stap)
- `curl -s https://APP_DOMEIN/api/health` retourneert 200

**Rollback:** `rm /etc/nginx/sites-enabled/sparki && systemctl reload nginx`

**Risico:** middel — verkeerde PORT of ontbrekende dist-map geeft 502/404

**Handeling René:** domeinnaam en API-PORT invullen in de configuratie

---

### Fase 11 — Domein

**Doel:** DNS van de domeinnaam laten wijzen naar het IP van de VPS.

**Exacte wijzigingen (door René in TransIP DNS-beheer):**

| Type | Naam | Waarde | TTL |
|---|---|---|---|
| A | `app` (bv.) | `141.138.141.205` | 300 |
| A | `www` (optioneel) | `141.138.141.205` | 300 |

**Acceptatiecriteria:**
- `dig +short app.sparki.nl` (of gewenst subdomein) retourneert `141.138.141.205`
- Propagatie: wacht minimaal 5–15 minuten

**Rollback:** DNS-record terugzetten of verwijderen

**Risico:** laag — DNS-wijziging raakt bestaande Replit/Vercel-setup niet als het subdomein nieuw is

**Handeling René:** DNS-aanpassing uitvoeren in TransIP-controlepaneel

---

### Fase 12 — SSL (Let's Encrypt)

**Doel:** HTTPS-certificaat aanvragen en automatisch verlengen instellen.

**Exacte wijzigingen:**
```bash
# Als root:
certbot --nginx -d APP_DOMEIN -d www.APP_DOMEIN \
  --email RENE_EMAIL \
  --agree-tos \
  --non-interactive \
  --redirect

# Controleer auto-renewal:
systemctl status certbot.timer
certbot renew --dry-run
```

**Acceptatiecriteria:**
- `https://APP_DOMEIN` laadt zonder certificaatwaarschuwing
- `certbot renew --dry-run` eindigt met `Congratulations`
- `systemctl status certbot.timer` is actief

**Rollback:** `certbot delete --cert-name APP_DOMEIN` (verwijdert certificaat; HTTP blijft werken)

**Risico:** laag — Let's Encrypt heeft een rate limit van 5 certificaten per domein per week; niet herhalen als het al werkt

**Handeling René:** e-mailadres voor certificaatwaarschuwingen opgeven

---

### Fase 13 — Health checks

**Doel:** bevestigen dat alle lagen van de stack werken na volledige inrichting.

**Controles:**
```bash
# Interne controles (als sparki user op VPS):
curl -s http://127.0.0.1:PORT/health           # API intern
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:PORT/api/health

# Externe controles (vanaf René's machine):
curl -I https://APP_DOMEIN                     # HTTPS bereikbaar
curl -s https://APP_DOMEIN/api/health          # API bereikbaar via Nginx

# Database:
psql -h 127.0.0.1 -U sparki_app -d sparki -c 'SELECT count(*) FROM information_schema.tables;'

# PM2:
pm2 list       # sparki-api: online, 0 restarts

# Nginx:
systemctl status nginx

# PostgreSQL:
systemctl status postgresql
```

**Externe monitoring (na livegang):**
- UptimeRobot (gratis tier): HTTP-monitor op `https://APP_DOMEIN/api/health`, interval 5 min
- Melding via e-mail bij downtime

**Acceptatiecriteria:** alle bovenstaande checks slagen zonder foutmelding

**Handeling René:** UptimeRobot-account aanmaken en monitor instellen

---

### Fase 14 — Back-up

**Doel:** dagelijkse geautomatiseerde databaseback-up naar een locatie buiten de VPS.

**Exacte wijzigingen:**
```bash
# Als user sparki, back-upscript aanmaken:
cat > /home/sparki/scripts/backup.sh <<'SCRIPT'
#!/bin/bash
set -euo pipefail
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="/home/sparki/backups/sparki-${DATE}.sql.gz"
mkdir -p /home/sparki/backups
pg_dump -h 127.0.0.1 -U sparki_app sparki | gzip > "$BACKUP_FILE"
# Bewaar uitsluitend de laatste 7 lokale back-ups:
find /home/sparki/backups -name "sparki-*.sql.gz" -mtime +7 -delete
# Off-site upload (keuze René: S3, TransIP Object Storage, of SFTP):
# aws s3 cp "$BACKUP_FILE" s3://BUCKET_NAAM/  --profile sparki
# OF: rclone copy "$BACKUP_FILE" remote:sparki-backups/
echo "Back-up voltooid: $BACKUP_FILE"
SCRIPT

chmod +x /home/sparki/scripts/backup.sh

# Cronjob instellen (dagelijks 03:00 Amsterdam-tijd):
(crontab -l 2>/dev/null; echo "0 3 * * * /home/sparki/scripts/backup.sh >> /home/sparki/logs/backup.log 2>&1") | crontab -
```

**Acceptatiecriteria:**
- Handmatig uitvoeren: `/home/sparki/scripts/backup.sh` → bestand aangemaakt in `backups/`
- Crontab actief: `crontab -l` toont de back-upregel
- Off-site upload werkt (test handmatig vóór livegang)

**Rollback:** n.v.t. (back-up is additief)

**Risico:** hoog als uitsluitend lokale back-up — off-site bestemming is verplicht vóór publieke livegang

**Handeling René:** off-site back-upbestemming kiezen en credentials aanleveren (TransIP Object Storage, S3, SFTP)

---

### Fase 15 — Rollback-procedure

**Doel:** terugkeren naar een vorige werkende commit na een mislukte deployment.

**Procedure:**
```bash
# Als user sparki:
cd /home/sparki/app
git log --oneline -10                 # zoek de gewenste commit-hash
git checkout COMMIT_HASH              # of: git reset --hard COMMIT_HASH

# Herbouwen:
pnpm install --frozen-lockfile
pnpm --filter @workspace/sparki build
pnpm --filter @workspace/api-server build

# Services herstarten:
pm2 restart sparki-api
systemctl reload nginx

# Verificatie:
curl -s https://APP_DOMEIN/api/health
pm2 list
```

**Release manifest:** elke productie-deployment legt de commit-hash vast in `/home/sparki/CURRENT_RELEASE`:
```bash
git rev-parse HEAD > /home/sparki/CURRENT_RELEASE
```

---

### Fase 16 — Eerste afgeschermde testdeployment

**Doel:** de volledige stack testen terwijl de applicatie nog niet publiek bereikbaar is via de definitieve domeinnaam.

**Aanpak:**
- Nginx serveerdt uitsluitend op een tijdelijk testsubdomein of direct via IP
- Alternatief: `/etc/hosts`-aanpassing op René's machine om al te testen voor DNS-propagatie
- Optioneel: HTTP Basic Auth op de gehele Nginx-configuratie als extra afscherming tijdelijk testfase

```nginx
# Tijdelijke Basic Auth in server-blok (in fase 16 toevoegen, in fase 17 verwijderen):
auth_basic "Afgeschermd";
auth_basic_user_file /etc/nginx/.htpasswd;
```

```bash
# Aanmaken testgebruiker:
apt install -y apache2-utils
htpasswd -c /etc/nginx/.htpasswd TESTGEBRUIKER
```

**Acceptatiecriteria:**
- René kan de volledige app testen via het afgeschermde adres
- Alle kritieke flows werken (login, API-calls, data opslaan)
- PM2 toont 0 ongeplande restarts

**Handeling René:** testen van alle kritieke flows en goedkeuring geven voor fase 17

---

### Fase 17 — Publieke livegang

**Doel:** definitieve DNS activeren, afscherming verwijderen, livegang bevestigen.

**Exacte wijzigingen:**
1. DNS-propagatie bevestigen: `dig +short APP_DOMEIN` → `141.138.141.205`
2. Basic Auth (als gebruikt in fase 16) verwijderen uit Nginx-config
3. `nginx -t && systemctl reload nginx`
4. SSL-certificaat aanvragen voor definitief domein (fase 12, als nog niet gedaan)
5. Externe monitoring activeren (UptimeRobot)
6. `git rev-parse HEAD > /home/sparki/CURRENT_RELEASE`

**Acceptatiecriteria:**
- `https://APP_DOMEIN` laadt zonder waarschuwingen voor externe bezoekers
- SSL-grade A op ssllabs.com/ssltest
- `pm2 list` toont 0 ongeplande restarts
- UptimeRobot-monitor geeft groen

---

## 4. Per fase — gestructureerd overzicht

| Fase | Doel | René handeling | Risico |
|---|---|---|---|
| 0 | Gegevens verzamelen | Domein, e-mail, back-upkeuze aanleveren | — |
| 1 | Serverbeveiliging | SSH-sessie starten | Laag |
| 2 | Deploy-gebruiker | SSH-key kopiëren | Laag |
| 3 | Firewall | Controleer SSH actief na enable | Middel |
| 4 | Software | Geen | Laag |
| 5 | Code checkout | Deploy key aanmaken in GitHub | Laag |
| 6 | Database | Sterk wachtwoord kiezen | Laag |
| 7 | Environment variables | Alle waarden invullen | Hoog (als .env per ongeluk in Git) |
| 8 | Build | Buildfouten melden | Middel |
| 9 | Services PM2 | PORT bevestigen | Middel |
| 10 | Nginx | Domeinnaam en PORT invullen | Middel |
| 11 | Domein DNS | DNS aanpassen in TransIP | Laag |
| 12 | SSL | E-mailadres opgeven | Laag |
| 13 | Health checks | UptimeRobot instellen | Laag |
| 14 | Back-up | Off-site bestemming kiezen + credentials | Hoog (als uitsluitend lokaal) |
| 15 | Rollback | — | — |
| 16 | Afgeschermd testen | Alle flows testen + goedkeuring | Middel |
| 17 | Publieke livegang | DNS bevestigen | Laag |

---

## 5. Resources

### Geschat RAM-gebruik (piek)

| Component | RAM-gebruik |
|---|---|
| OS + kernel | ~200 MB |
| PostgreSQL 16 (shared_buffers 256 MB) | ~350 MB |
| Node.js API-server (PM2, 1 worker) | ~200–300 MB |
| Nginx | ~20 MB |
| PM2 daemon | ~50 MB |
| Buffer/cache OS | ~300 MB |
| **Totaal piek** | **~1.1–1.2 GB** |
| **Vrije ruimte** | ~0,8–0,9 GB |

**Conclusie:** de stack past comfortabel in 2 GB RAM mits swap aanwezig is als vangnet.

### Swap-advies (verplicht)

**Configureer 2 GB swap vóór de eerste start:**
```bash
# Als root:
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
# Swappiness laag houden (swap als noodventiel, niet als routine):
echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl -p
```

### PostgreSQL-instellingen voor 2 GB RAM

```ini
# /etc/postgresql/16/main/postgresql.conf
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 4MB
maintenance_work_mem = 64MB
max_connections = 30
wal_buffers = 8MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1       # SSD
effective_io_concurrency = 200
```

### Maatregelen om geheugentekort te voorkomen

- `max_memory_restart: '400M'` in PM2-config: herstart API als geheugenlek optreedt
- `max_connections = 30` PostgreSQL: voorkomt verbindingsstormen
- Nginx statisch serveren van de frontend: geen Node bij pagina-ophalen
- PM2 `instances: 1`: geen cluster-overhead op 1 vCPU
- Regelmatige check: `free -h` en `pm2 monit`

### Wanneer VPS-upgrade noodzakelijk wordt

- Gemiddeld geheugengebruik >1,6 GB (swap wordt routinematig gebruikt)
- PostgreSQL-query-latency stijgt door onvoldoende `effective_cache_size`
- PM2 herstart API door geheugenoverloop (`max_memory_restart`)
- Tweede worker-process nodig voor hogere concurrency

---

## 6. Beveiliging

| Maatregel | Hoe |
|---|---|
| Root niet voor deployments | Deploy-user `sparki`; root uitsluitend voor beheer en noodgevallen |
| Aparte deploy-user | `sparki` user zonder sudo-rechten |
| Uitsluitend SSH-key | `PasswordAuthentication no` in sshd_config (al geconfigureerd) |
| UFW-regels | Alleen 22, 80, 443 inkomend; alles overig geblokkeerd |
| Database niet publiek | `listen_addresses = 'localhost'` in PostgreSQL-config; geen UFW-regel voor 5432 |
| Secrets niet in GitHub | `.env.production` in `.gitignore`; nooit gecommit |
| Minimale bestandsrechten | `.env.production`: `chmod 600`; scripts: `chmod 700`; `sparki`-home: `chmod 750` |
| Automatische beveiligingsupdates | `unattended-upgrades` actief voor OS-patches |
| Rate limiting | Nginx `limit_req_zone` op `/api/`-locatie (10 req/s per IP) |
| Back-ups buiten VPS | Off-site: TransIP Object Storage, S3 of SFTP — niet alleen lokaal |
| Security headers | X-Frame-Options, X-Content-Type-Options, Referrer-Policy via Nginx |
| HTTPS only | HTTP redirectt altijd naar HTTPS (301); geen mixed content |

---

## 7. GitHub-deployment

### Eerste deployment: handmatig

Zie fasen 5 t/m 9 hierboven. De eerste deployment wordt volledig handmatig uitgevoerd om te verifiëren dat elke stap werkt.

### Latere deployments: GitHub Actions (CI/CD)

**Deploy-flow via GitHub Actions:**

```yaml
# .github/workflows/deploy.yml (concept — nog niet toevoegen)
name: Deploy naar TransIP VPS

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @workspace/api-server test
      # Voeg meer testsuites toe

  deploy:
    needs: test    # ← deployment blokkeert bij falende tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: 141.138.141.205
          username: sparki
          key: ${{ secrets.VPS_SSH_PRIVATE_KEY }}
          script: |
            set -euo pipefail
            cd /home/sparki/app
            git fetch origin main
            git reset --hard origin/main
            pnpm install --frozen-lockfile
            pnpm --filter @workspace/sparki build
            pnpm --filter @workspace/api-server build
            pm2 restart sparki-api
            systemctl reload nginx
            git rev-parse HEAD > /home/sparki/CURRENT_RELEASE
            echo "Deploy succesvol: $(cat /home/sparki/CURRENT_RELEASE)"
```

**Vereisten:**
- `VPS_SSH_PRIVATE_KEY` als GitHub Actions Secret toevoegen (private key van de `sparki` deploy-user)
- Corresponderende public key staat in `/home/sparki/.ssh/authorized_keys` op de VPS
- Tests moeten slagen vóór deployment (`needs: test`)

### Rollback naar vorige werkende commit

```bash
# Handmatig via SSH als sparki:
PREV_COMMIT=$(git log --oneline -2 | tail -1 | awk '{print $1}')
git checkout $PREV_COMMIT
pnpm --filter @workspace/sparki build
pnpm --filter @workspace/api-server build
pm2 restart sparki-api
systemctl reload nginx
echo $PREV_COMMIT > /home/sparki/CURRENT_RELEASE
```

### Commit-hash in release manifest

Na elke deployment:
```bash
git rev-parse HEAD > /home/sparki/CURRENT_RELEASE
date -u >> /home/sparki/CURRENT_RELEASE
```

### Geen deploy bij falende tests

De GitHub Actions-workflow gebruikt `needs: test` — de `deploy`-job start niet als de `test`-job mislukt.

---

## 8. Productieconfiguratie — benodigde environment variables

Uitsluitend namen, geen waarden, geen secrets.

```
# Database
DATABASE_URL

# Authenticatie (Clerk)
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
VITE_CLERK_PUBLISHABLE_KEY

# Sessie
SESSION_SECRET

# Strava OAuth
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET

# Strava Webhook (als van toepassing)
STRAVA_WEBHOOK_VERIFY_TOKEN

# AI-integraties
AI_INTEGRATIONS_ANTHROPIC_API_KEY
AI_INTEGRATIONS_ANTHROPIC_BASE_URL
AI_INTEGRATIONS_GEMINI_API_KEY
AI_INTEGRATIONS_GEMINI_BASE_URL

# Object Storage
DEFAULT_OBJECT_STORAGE_BUCKET_ID
PRIVATE_OBJECT_DIR
PUBLIC_OBJECT_SEARCH_PATHS

# Web Push (VAPID)
VAPID_PRIVATE_KEY
VAPID_PUBLIC_KEY

# Server configuratie
PORT
NODE_ENV
BASE_URL

# Admin
SPARKI_ADMIN_IDS

# Resend (e-mail)
RESEND_API_KEY

# Optioneel: back-up off-site
BACKUP_S3_BUCKET
BACKUP_S3_ACCESS_KEY_ID
BACKUP_S3_SECRET_ACCESS_KEY
BACKUP_S3_REGION
```

---

## 9. Oplevering

### Gefaseerde uitvoeringslijst

| # | Fase | Vereist van René | Vereist agent/script |
|---|---|---|---|
| 0 | Voorbereiding | Domein, e-mail, back-upkeuze ✦ | — |
| 1 | Serverbeveiliging | SSH-sessie starten | OS-updates, unattended-upgrades |
| 2 | Deploy-user | SSH-key kopiëren voor `sparki` | Useraanmaak |
| 3 | Firewall | Controleer SSH na enable | UFW-configuratie |
| 4 | Software | — | Node, PM2, PostgreSQL, Nginx, Certbot |
| 5 | Code checkout | Deploy key in GitHub ✦ | `git clone` |
| 6 | Database | Sterk wachtwoord kiezen ✦ | DB + user aanmaken |
| 7 | Environment variables | **Alle waarden invullen** ✦✦ | `.env.production` aanmaken |
| 8 | Build | Buildfouten doorgeven | `pnpm build` |
| 9 | Services | PORT bevestigen | PM2-config + systemd |
| 10 | Nginx | Domein + PORT invullen ✦ | Nginx-config + reload |
| 11 | Domein DNS | **DNS aanpassen in TransIP** ✦✦ | — |
| 12 | SSL | E-mailadres ✦ | Certbot |
| 13 | Health checks | UptimeRobot instellen ✦ | Verificatiescripts |
| 14 | Back-up | Off-site bestemming + credentials ✦✦ | Back-upscript + cron |
| 15 | Rollback | — | Procedure gedocumenteerd |
| 16 | Afgeschermd testen | **Alle flows testen + goedkeuring** ✦✦ | Basic Auth tijdelijk |
| 17 | Publieke livegang | DNS-propagatie bevestigen | Basic Auth verwijderen |

✦ = René-handeling vereist vóór de fase  
✦✦ = blokkerende René-handeling

---

### Open gegevens die nog van René nodig zijn

| # | Gegeven | Waarvoor nodig | Verplicht vóór |
|---|---|---|---|
| 1 | **Definitieve domeinnaam** (bv. `app.sparki.nl`) | Nginx-config, SSL, DNS | Fase 10 |
| 2 | **E-mailadres voor Let's Encrypt** | Certbot-certificaatregistratie | Fase 12 |
| 3 | **Keuze back-upbestemming** (TransIP Object Storage / AWS S3 / SFTP) | Back-upscript | Fase 14 |
| 4 | **Back-up-credentials** (niet in dit document invullen — apart aanleveren) | Off-site back-up | Fase 14 |
| 5 | **Sterk wachtwoord voor PostgreSQL-user `sparki_app`** | Database-aanmaak | Fase 6 |
| 6 | **Alle productiewaarden voor `.env.production`** | Application runtime | Fase 7 |
| 7 | **Wens voor testsubdomein** (`staging.sparki.nl`?) | Afgeschermde testfase 16 | Fase 16 |
| 8 | **GitHub SSH-deploy key instelling** | CI/CD en code checkout | Fase 5 |
| 9 | **Voorkeur monitoring**: zelf via UptimeRobot, of andere dienst? | Health monitoring | Fase 13 |

---

### Beperkingen van dit plan

- Dit document is uitsluitend een plan. Er is **niets geïnstalleerd, niets gewijzigd, geen Git-commit geplaatst**.
- De exacte Node.js-versie moet worden afgestemd op `engines.node` in de `package.json` van de repo — controleer dit vóór fase 4.
- Migratiestrategie voor de bestaande Replit-productiedatabase (Neon) is bewust buiten scope gelaten — dit vereist een apart besluit van René.
- GitHub Actions CI/CD is als concept opgenomen maar wordt pas geactiveerd na een succesvolle handmatige livegang.
