# Owner and manager guide

For the people who run the shop from the back office: https://shopper.temtem.dev in the cloud, or
https://shopper.local on a box. The register's sidebar opens it too when it is online. What you see depends on your
role: a page you have no permission for is not in your sidebar.

## Every day

- **Reports** opens on the Dashboard: today's sales, top products and tenders. Sales, Products, Dead stock and
  Branches compare days and shops.
- **Sales → Shifts** lists every shift. A closed shift shows the counted cash against what it should be, and its
  Z-report.
- **Sales → Transactions** finds any sale by receipt number, customer or amount. Refunds start there.
- **Sales → Approvals** holds what a cashier asked a manager to allow.
- **Sales → Online orders** has the online store's orders to pick and hand over.

## Products and prices

- **Catalogue → Products** adds and edits products, prices and tax class. **Import** takes a spreadsheet and shows
  every row it could not read before it changes anything. **Barcodes** tells the till how to read scale and price labels (13-digit barcodes starting 20–29).
- A price change reaches the registers at their next sync, usually within a minute.

## Stock

- **Inventory → Stock** shows what is on hand and what is low. **Records** lists every receipt, adjustment and
  count. **Stock takes** runs a count; **Valuation** values what is on hand; **Suppliers** keeps who you buy from.
- Never edit stock to make a report match: count it, and the difference is recorded.

## Tax

- **Catalogue → Tax**: Summary, the **VAT return** for a period, **Fiscal** (each sale's E-VAT submission: Pending,
  Accepted, Rejected) and **Rates**. Rates change by date; every sale keeps the tax it was charged.
- A rejected or dead-lettered fiscal submission needs support. Do not refund and sell again to fix it.

## Customers

- **Customers** keeps accounts, credit and deposits; statements go out by email. **Identity checks** reviews
  customers' ID checks. **Loyalty** sets how points are earned and the tiers.

## Staff and access

- **Organisation → Users** invites staff and sets their role. **Roles** decides what each role can do. Cashiers
  cannot void, refund or change a price without a manager's PIN.
- **Devices** enrols registers and shows each one's last contact.
- A cashier locked out after wrong passwords: unlock them with your PIN on the register's sign-in screen.

## Records you can trust

- **Audit → Log** shows who did what and when. **Integrity** proves nothing in the log was changed or removed.
- **General ledger** is the books every report reads from.
- **Organisation → Data export** makes a Shopper Archive of the whole shop to keep or hand to an accountant.

## Billing and updates

- **Organisation → Billing** shows the subscription or licence. On a box, Updates installs new versions: see the
  [box guide](box.md#5-updates).

## Getting around

- The sidebar groups every page. Ctrl+B collapses it to icons. The search button (or `/`, or Ctrl+K) jumps to any page
  or product. `?` lists the keyboard shortcuts.
- Your name at the bottom of the sidebar has your account, the theme and Sign out.

## When something is wrong

- A register that shows **Offline** keeps selling and catches up by itself. If it stays offline for more than an
  hour while the shop has internet, tell support.
- Anything that looks wrong in the numbers: note the receipt number and the time and tell support.
