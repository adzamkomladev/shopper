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
4. Set **Keep back from the online store**: that many units of every product stay for the shelf. The online store
   shows a little less than you have (it rounds down to 1, 2, 3, 5, 10, 20, 50, 100 and so on), so it never sells
   what the shop cannot fill. A sell-out reaches the online store within seconds; restocks within a minute.

Only names, SKUs, categories, prices, the shop's tax settings and rates, branches and how much each branch can sell
leave the box. Cost prices,
suppliers, stock counts and customers never do. The box checks in every minute. If it goes quiet for 5 minutes while a
branch is open (power or internet down), the online store pauses ordering at that branch and keeps shoppers' carts;
it resumes by itself when the box is back.

If the box is off or offline when an order is paid, the order waits for it. After 30 minutes the shopper is texted
that they can cancel for a full refund or keep waiting; if they wait, the box takes the order as soon as it is back,
until the order's time slot ends (then the shopper is refunded).

Paid online orders come to the box within a minute and appear under **Online orders**, already accepted, with their
stock set aside. An order the branch cannot fill is turned down and the shopper is refunded and told by text. Pick an
online order in full, or cancel it: the shopper gets their money back. If a price changed after the shopper paid, the
order says so; charge what they paid. When the order is ready or handed over, the shopper is told. Handing an online
order over records its tax invoice on the box, like a till sale. An online order joins the in-store customer with the
same phone (a new customer is added when the shop has none).

Shoppers sign in to the online store with their phone. To let one see their till receipts and points there, open the
customer and turn on **Show receipts and points online** once they agree. Only those customers' receipts and points
leave the box; turning it off removes them from the online store within a minute.

If the page says the last update did not reach Shopper, the box keeps trying by itself. Turning the switch off and
on again sends the whole catalogue afresh.

## When something is wrong

- The installer stops and names what failed. If the engine or receipt renderer did not run, read
  `journalctl -u shopper-engine` and `journalctl -u shopper-box`.
- A box that would not start writes why to `/var/lib/shopper/updates/boot-error.txt`.
- Moving the shop to or from the cloud: the [migration guide](migration.md).
