import type { SetupStep } from "../../schemas/setup";
import type { PermissionCode } from "../roles/types";

/**
 * Each step's place, name and what it is for, in wizard order; Alt and the number opens it. `needs` is every
 * permission its form uses: a member missing one sees where the step stands, not the form.
 */
export const STEPS: {
  step: SetupStep;
  title: string;
  description: string;
  needs: PermissionCode[];
}[] = [
  {
    step: "store",
    needs: ["store.read", "store.write"],
    title: "Store",
    description: "A store groups your branches and sets how cash totals are rounded.",
  },
  {
    step: "branch",
    needs: ["store.read", "branch.read", "branch.write"],
    title: "Branch",
    description: "Each branch is one shop floor, with its own tills, stock and reports.",
  },
  {
    step: "tax",
    needs: ["tax.read", "tax.write"],
    title: "Tax",
    description:
      "Your TIN, when you registered for VAT, and whether shelf prices include VAT and levies.",
  },
  {
    step: "products",
    needs: ["store.write"],
    title: "Products",
    description:
      "Import your price list from a spreadsheet, add products one by one, or do it later.",
  },
  {
    step: "team",
    needs: ["role.read", "user.write"],
    title: "Team",
    description:
      "Invite the people who run the shop with you. Each gets the access their role allows.",
  },
  {
    step: "till",
    needs: ["branch.read", "device.enroll"],
    title: "Till",
    description:
      "Install Shopper on the till computer, then enrol it with a one-time code or its QR.",
  },
  {
    step: "done",
    needs: ["store.write"],
    title: "Done",
    description: "Check what is set up, then start selling.",
  },
];
