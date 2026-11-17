# Getting started in the cloud

For a shop owner opening Shopper as a subscription. You need a computer with a browser, the till PC (Windows 10 or
11, 64-bit) and, if you have them, the receipt printer, scanner and cash drawer. The back office is at
https://shopper.temtem.dev.

## 1. Sign up

1. **Sign up** with your name, email and a password. Shopper sends a link: open it to verify the email.
2. You land in the **setup wizard**. It shows every step and how far you are (_3 of 7 steps_). You can leave and
   come back; it opens at the next step not done. Alt and the step's number jumps to it.

## 2. The setup wizard

| Step     | What you enter                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------- |
| Store    | The store's name, and how cash totals round (to the nearest 10 pesewas, for example).          |
| Branch   | Each shop floor. Every branch has its own tills, stock and reports.                            |
| Tax      | Your TIN, the date you registered for VAT (if you have), and whether shelf prices include VAT. |
| Products | Import your price list from a spreadsheet, add products one by one, or do it later.            |
| Team     | Invite the people who run the shop with you. Each gets what their role allows.                 |
| Till     | Download the till installer, then enrol the till with a one-time code or its QR.               |
| Done     | Check what is set up, then start selling.                                                      |

The spreadsheet import (Catalogue → Import) shows every row it could not read before it changes anything.

## 3. Verify the business

Sales → Payments → **Verification** asks for the business's registration, its directors, their documents and
the account mobile money payouts go to. Shopper staff review it. It turns on payouts to your own account; cash sales
work before it is done.

## 4. Set up the till

1. Run the installer on the till PC. It installs for the signed-in Windows user and updates itself.
2. Enter the enrolment code from the Till step (or Organisation → Devices → _Enrol device_, `N`). Codes expire; make a
   new one if it has.
3. Plug in the printer, scanner and drawer. Register settings (Ctrl+M) has _Test print_ and _Open drawer_.
4. The cashier signs in, opens a shift with the float, and sells. Cashiers read the
   [cashier guide](../pilot/cashier.md).

## 5. The first day

- Sell one item in cash and check the receipt prints and the drawer opens.
- At close: each cashier closes their shift with a count, then Reports shows the day. The
  [owner guide](admin.md) covers the back office from here.

## When something is wrong

- No verification email: check spam, then _Resend email_ (or _Check delivery_) on the screen that asked you to check your inbox.
- The till says **Offline**: it keeps selling and sends the sales when the connection is back.
- Anything else: note the time and what the screen said, and tell support.
