#!/bin/sh
# shopper-box-installer.run: installs a whole store server with no internet. Run as root on Ubuntu 24.04 (x86-64).
# Everything it installs travels inside this file. It checks Shopper's signature on the contents before it touches the machine.
set -eu
fail() { echo "shopper-box-installer: $*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || fail "run as root (sudo sh $0)"
command -v openssl >/dev/null || fail "openssl is required to check the signature"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cat > "$work/shopper-release.pem" <<'KEY'
@@PUBLIC_KEY@@
KEY
tail -n +@@PAYLOAD_LINE@@ "$0" | tar -xzf - -C "$work" 2>/dev/null || fail "the installer is damaged: it does not unpack"
cd "$work/payload"
# Shopper signs the list of hashes; the hashes then cover every file, so one changed byte anywhere is refused here.
openssl pkeyutl -verify -pubin -inkey "$work/shopper-release.pem" -rawin -in SHA256SUMS -sigfile SHA256SUMS.sig >/dev/null 2>&1 \
  || fail "this installer is not signed by Shopper; nothing was installed"
sha256sum --check --quiet SHA256SUMS >/dev/null 2>&1 || fail "the installer is damaged or altered; nothing was installed"
echo "Signature verified: $(openssl pkey -pubin -in "$work/shopper-release.pem" -outform DER | sha256sum | cut -c1-16)"
sh ./install.sh "$@"
exit $?
