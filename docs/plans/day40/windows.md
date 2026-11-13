# Day 40 runbook · Windows tills on the box LAN, real hardware

What the automated drills cannot prove: a Windows till resolving `shopper.local`, the real printer, scanner and drawer,
a WAN cable pulled out, and a real USB stick in the box. Run this on the bench (or at the pilot store) and record each
**Record** line in `docs/plans/day40/verification.md` under "Windows run".

## Bench

- Box: an Ubuntu 24.04 PC installed from the offline installer (`deployment.md` → Box install), first boot done,
  licence pasted, backups set up (`/etc/shopper/backup.env`), on the shop switch.
- Till: a Windows 10/11 x64 PC on the same switch, network profile **Private** first (Settings → Network → Properties).
- The pilot store's printer (Ethernet or USB), barcode scanner and cash drawer (on the printer's RJ11).
- A router whose WAN cable you can pull. A FAT32 or exFAT USB stick.

## 1 · Signed installer finds the box and enrols

1. Build the till with the `Release till` workflow (pilot channel, `--sign`) or download `Shopper-Setup-x64.exe`.
2. Right-click the installer → Properties → Digital Signatures. **Record:** signer name, timestamp.
3. Install and start. The enrol screen says **Shopper box on this network · shopper.local**. **Record:** what it says,
   how long the first screen took to appear.
4. In the box's back office (`https://shopper.local` from the till's browser), Devices → Create enrolment code. Type the
   shop code and code, name it "Front till". **Record:** enrolled (yes/no), the till appears under Devices.
5. Fallback: uninstall, delete `%APPDATA%\Shopper`, set the network profile to **Public**, reinstall. The screen should
   say **Shopper cloud**. Press Alt+S, type the box's IP (on the box: `ip -4 addr`), Enter. The register restarts on the
   box. **Record:** the screen before and after, and whether enrolment then works.

## 2 · A real hardware sale through the box

1. Sign in as a cashier (password set in the back office). The owner has granted the role `register.settings`, or a
   manager signs in for this step: Settings → Printer (network IP or USB name), Scanner, Test print, Test drawer.
2. Open the shift with a counted float: the drawer opens.
3. Scan two products, pay cash. **Record:** receipt prints with the receipt number, drawer opens once, the scan-to-line
   time feels instant.
4. Back office → Sales: the sale is there with the same receipt number. **Record:** yes/no.

## 3 · Unplug the internet: a full session and the Z-report

1. Pull the router's WAN cable. On the box: `curl -sS https://api.paystack.co >/dev/null || echo offline`.
2. Trade 20 sales: cash, card (offline slip), a split, one void, one refund (cash), a cash drop.
3. Try MoMo once. **Record:** what the till says (expected: the provider cannot be reached; pay another way).
4. Count the drawer and close the shift. **Record:** the printed Z (photo), variances (expected 0), and that the back
   office's Shifts page shows the same Z.
5. Back office → Reports → Day: the day's totals match the Z. Plug the WAN back in. **Record:** fiscal documents
   (if the SDC is configured) drain within a few minutes.

## 4 · Air-gapped update from a signed USB stick

1. On the build machine: `vpx tooling/installer/update.ts` for the next version (with a till feed for step 5), copy the
   `.tgz` onto the USB stick (FAT32/exFAT; anything else on it is ignored).
2. Plug the stick into the box. Within a few seconds Billing → Updates lists it. On the box:
   `journalctl -u 'shopper-usb@*' -n 5`. **Record:** the line "copied 1 update bundle(s)".
3. Pull the stick (it is already unmounted). Install now. **Record:** the box reports the new version, the till keeps
   selling during the restart (offline mode, then back online).
4. A stick holding a bundle that is not Shopper's: it is copied but never listed, so it cannot be installed. **Record.**
5. The till: Settings → Updates shows the new till version from the box (no internet). Restart now after the shift.
   **Record:** the till's version afterwards.

## If something fails

- No `shopper.local` on Windows: `ping shopper.local` from cmd. Public network profiles block mDNS; use Change server.
- `register.log` in `%APPDATA%\Shopper` has the register's start errors; the box's are `journalctl -u shopper-box`.
