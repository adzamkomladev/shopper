#!/bin/sh
# Runs from the verified payload. Installs PostgreSQL 18, the Rivet engine, Caddy, Avahi and the sealed box, then starts them.
# SHOPPER_INSTALL_NO_START=1 installs without starting services (for machines without systemd as PID 1).
set -eu
fail() { echo "shopper-box-installer: $*" >&2; exit 1; }
say() { echo "==> $*"; }
started=$(date +%s)

[ -r /etc/os-release ] && . /etc/os-release
[ "${VERSION_ID:-}" = "24.04" ] && [ "$(uname -m)" = "x86_64" ] || fail "Ubuntu 24.04 on x86-64 is required"
[ ! -e /opt/shopper/current ] || fail "this machine already has a Shopper box. Install updates from the portal; nothing was changed"
systemd=0; [ -d /run/systemd/system ] && [ "${SHOPPER_INSTALL_NO_START:-0}" != 1 ] && systemd=1
random() { tr -dc 'a-f0-9' < /dev/urandom | head -c "$1"; }

say "Installing PostgreSQL 18, Caddy, Avahi, age and rclone from this file (no network)"
DEBIAN_FRONTEND=noninteractive dpkg --install --skip-same-version debs/*.deb >/dev/null

say "Creating the shopper user and folders"
id shopper >/dev/null 2>&1 || useradd --system --home-dir /var/lib/shopper --shell /usr/sbin/nologin shopper
install -d -o shopper -g shopper /var/lib/shopper /var/lib/shopper/updates /var/lib/shopper/licence /var/lib/shopper/rivet /var/lib/shopper/tmp
install -d /opt/shopper/slots/a /opt/shopper/bin /etc/shopper
# The box unpacks updates into the spare slot as itself; the helper that switches slots runs as root.
install -d -o shopper -g shopper /opt/shopper/slots/b
install -m 0755 deploy/bin/shopper-apply /opt/shopper/bin/shopper-apply
cp -a slot/. /opt/shopper/slots/a/
printf '#!/bin/sh\nexec /opt/shopper/current/shopper-box backup "$@"\n' > /opt/shopper/bin/shopper-backup
chmod 0755 /opt/shopper/bin/shopper-backup

say "Preparing the database"
pg_lsclusters -h | grep -q '^18 main' || fail "PostgreSQL 18 did not create its cluster"
if [ "$systemd" = 1 ]; then systemctl enable --now postgresql@18-main >/dev/null 2>&1 || true
else pg_ctlcluster 18 main status >/dev/null 2>&1 || pg_ctlcluster 18 main start; fi
for _ in $(seq 1 60); do su postgres -c "psql -qAt -c 'select 1'" >/dev/null 2>&1 && break; sleep 1; done
# CREATEDB: the nightly backup proves itself by restoring into a scratch database.
dbpass=$(random 40)
su postgres -c "psql -v ON_ERROR_STOP=1 -q" >/dev/null <<SQL
CREATE ROLE shopper LOGIN CREATEDB PASSWORD '$dbpass';
CREATE DATABASE shopper OWNER shopper;
SQL

say "Writing the box's configuration"
code=$(tr -dc 'A-HJ-NP-Z2-9' < /dev/urandom | head -c 12)
codehash=$(printf '%s' "$code" | sha256sum | cut -d' ' -f1)
enginetoken=$(random 48)
umask 077
cat > /etc/shopper/box.env <<ENV
DATABASE_URL=postgresql://shopper:$dbpass@127.0.0.1:5432/shopper
SHOPPER_AUTH_SECRET=$(random 64)
SHOPPER_LINK_SECRET=$(random 64)
SHOPPER_AUTH_URL=https://shopper.local
SHOPPER_RELEASE_DIR=/opt/shopper/current
SHOPPER_LICENCE_DIR=/var/lib/shopper/licence
SHOPPER_BLOBS_PATH=/var/lib/shopper/blobs
SHOPPER_CACHE_PATH=/var/lib/shopper/cache.sqlite
SHOPPER_UPDATES_DIR=/var/lib/shopper/updates
SHOPPER_SLOTS_DIR=/opt/shopper
SHOPPER_SETUP_CODE_HASH=$codehash
# This box is one shop: the shop the wizard creates is the tenant for everyone who signs in.
SHOPPER_SINGLE_SHOP=1
RIVET_ENDPOINT=http://127.0.0.1:6420
RIVET_TOKEN=$enginetoken
RIVET_POOL=shopper-box
# Bun unpacks the engine client's native addon here and loads it, so this folder must allow execution (a hardened /tmp does not).
TMPDIR=/var/lib/shopper/tmp
PORT=3001
ENV
printf 'RIVET__AUTH__ADMIN_TOKEN=%s\n' "$enginetoken" > /etc/shopper/engine.env
chown root:shopper /etc/shopper/box.env /etc/shopper/engine.env
chmod 0640 /etc/shopper/box.env /etc/shopper/engine.env

say "Setting the host name to shopper (shopper.local on the shop network)"
{ [ "$systemd" = 1 ] && hostnamectl set-hostname shopper; } 2>/dev/null || { echo shopper > /etc/hostname; hostname shopper; } 2>/dev/null || true
grep -q 'shopper.local' /etc/hosts || echo '127.0.0.1 shopper.local shopper' >> /etc/hosts
cp deploy/avahi/shopper.service /etc/avahi/services/shopper.service
[ -e /etc/caddy/Caddyfile.ubuntu ] || cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.ubuntu
cp deploy/Caddyfile /etc/caddy/Caddyfile
cp deploy/systemd/shopper-box.service deploy/systemd/shopper-engine.service /etc/systemd/system/
cp deploy/systemd/shopper-update.path deploy/systemd/shopper-update.service /etc/systemd/system/
cp deploy/systemd/backup.service /etc/systemd/system/shopper-backup.service
cp deploy/systemd/backup.timer /etc/systemd/system/shopper-backup.timer
ln -sfn /opt/shopper/slots/a /opt/shopper/current

if command -v ufw >/dev/null; then
  say "Opening only SSH, HTTP, HTTPS and mDNS to the shop network"
  ufw --force reset >/dev/null; ufw default deny incoming >/dev/null; ufw default allow outgoing >/dev/null
  ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 5353/udp >/dev/null
  ufw --force enable >/dev/null
fi

if [ "$systemd" = 1 ]; then
  say "Starting the box"
  systemctl daemon-reload
  # mDNS needs a network interface; a box still works by address without it, so it never stops the install.
  systemctl enable --now avahi-daemon >/dev/null 2>&1 || echo "warning: the mDNS service (shopper.local) did not start; check the network cable"
  systemctl enable --now caddy shopper-engine shopper-box shopper-backup.timer shopper-update.path >/dev/null 2>&1
  systemctl restart caddy
  for _ in $(seq 1 120); do curl -fsS --max-time 2 http://127.0.0.1:3001/api/health >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS --max-time 2 http://127.0.0.1:3001/api/health >/dev/null 2>&1 || fail "the box did not start; see: journalctl -u shopper-box"
  pki=/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt
  for _ in $(seq 1 60); do [ -s "$pki" ] && break; sleep 1; done
  curl -fsS --max-time 5 --cacert "$pki" --resolve shopper.local:443:127.0.0.1 https://shopper.local/api/health >/dev/null \
    || fail "Caddy does not serve https://shopper.local; see: journalctl -u caddy"
  say "Checking that the workflow engine runs a workflow"
  doctor=$(runuser -u shopper -- sh -c 'cd /var/lib/shopper && set -a && . /etc/shopper/box.env && exec /opt/shopper/current/shopper-box doctor' 2>&1) \
    || fail "the workflow engine or the receipt renderer did not run: $(echo "$doctor" | tail -3); see: journalctl -u shopper-engine"
fi

elapsed=$(( $(date +%s) - started ))
echo
echo "Shopper box installed in $((elapsed / 60)) min $((elapsed % 60)) s."
echo "Open https://shopper.local/setup from a computer on the shop network."
echo "Setup code (shown once, keep it safe): $(echo "$code" | sed 's/\(....\)\(....\)\(....\)/\1-\2-\3/')"
