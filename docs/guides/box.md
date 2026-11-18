# Installing a Shopper box

For Shopper support installing an on-premise shop: one box on the shop's own network runs the shop with no
internet. The engineering detail behind every step is in [deployment.md](../engineering/deployment.md).

## What you need

- **The box**: an x86-64 PC with Ubuntu Server 24.04, wired to the shop network. Give it a fixed or reserved LAN
  address (for example `192.168.1.20`): registers that enrol by address follow that address.
- **The installer** `shopper-box-installer.run` on a USB stick. It carries everything (PostgreSQL 18, Caddy, Avahi,
  backup tools); the box needs no internet to install.
- **The licence**: the owner's site name and maintenance date. Shopper issues `licence.json` from the box's request code.
- **The registers**: Windows 10 or 11, 64-bit, with the Shopper till installer.

## 1. Install

```bash
sudo sh shopper-box-installer.run
```

The installer checks Shopper's signature on every file before it touches the machine, then creates the `shopper`
user and database, writes `/etc/shopper/box.env` with fresh secrets, starts everything and runs
`shopper-box doctor`. It ends by printing a one-time **setup code**: write it down.

## 2. First boot

1. From any computer on the shop network, open https://shopper.local/setup. The browser warns about the
   certificate once: the box has its own; accept it.
2. Enter the setup code, the shop and its first store, and the owner's name, email and password.
3. **Licence**: copy the request code from the page to Shopper, then paste the `licence.json` you get back.
4. The box is ready. The owner signs in at https://shopper.local and follows the
   [owner guide](admin.md) and the setup wizard, as in the cloud.

## 3. Registers

1. Install Shopper on each register and start it. It finds `https://shopper.local` by itself and shows the box's
   name on the enrol screen.
2. If it does not (a Windows network set to _Public_ blocks the name), press **Change server** (Alt+S) and type the
   box's address.
3. Enrol with a code from Organisation → Devices → _Enrol device_ (`N`), as in the cloud.

## 4. Backups

Backups run nightly at 02:30 once `/etc/shopper/backup.env` is in place. Each one is restored into a scratch
database and checked before it is uploaded encrypted. Shopper keeps the key to read them. An update refuses to install
until backups are set up.

## 5. Updates

1. Copy the signed update bundle (`*.tgz`) onto a USB stick and plug it into the box. The box copies it in by
   itself; nothing on the stick runs.
2. The owner opens Organisation → **Billing** → Updates and chooses **Install now** or **After closing**.
3. The box backs itself up, installs into its spare slot and restarts. If it is not healthy within 90 seconds it
   goes back to the old version by itself, and Billing says why.

Updates built after the licence's maintenance date are refused. Tax rule packs always install.

## 6. Replacing a broken box

Install a spare from the same installer, restore the last nightly backup (the commands are under _Restore runbook_
in [deployment.md](../engineering/deployment.md)), and give the spare the old box's name and address. Registers
reconnect and send again any sales the backup missed.

## 7. Selling online

With the Online Orders add-on, Shopper keeps an online store for the shop, and the box keeps that store's catalogue
up to date.

1. Shopper staff enrol the box's licence and switch on the add-on.
2. The owner opens Settings → **Online store** and turns on **Sell online from this box**. The box sends the whole
   catalogue once. After that it sends only what changes, within seconds of each change.
3. Choose what shoppers see:
   - A product appears online only when its own **Show online** is on, and its category and department are switched
     on on the same page.
   - Hiding a department hides every category under it.

Only names, SKUs, categories, prices and branches leave the box. Cost prices, suppliers, stock and customers never
do. If the page says the last update did not reach Shopper, the box keeps trying by itself. Turning the switch off and
on again sends the whole catalogue afresh.

## When something is wrong

- The installer stops and names what failed. If the engine or receipt renderer did not run, read
  `journalctl -u shopper-engine` and `journalctl -u shopper-box`.
- A box that would not start writes why to `/var/lib/shopper/updates/boot-error.txt`.
- Moving the shop to or from the cloud: the [migration guide](migration.md).
