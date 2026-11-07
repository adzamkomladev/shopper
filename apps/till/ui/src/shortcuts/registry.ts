import type { ShortcutGroup } from "@shopper/ui/components/shortcuts/dialog";

/**
 * Every till key in one place, for Help (F1) and the cashier card (docs/pilot/cashier.md). The
 * screens register the handlers; this is what they mean, in the cashier's words.
 */
export const TILL_SHORTCUTS: readonly ShortcutGroup[] = [
  {
    label: "Navigation",
    items: [
      { keys: "Ctrl+1 … Ctrl+4", label: "Dashboard, Checkout, Inventory, Sales reports" },
      { keys: "Alt+S", label: "Checkout" },
      { keys: "Alt+P", label: "Previous purchases" },
      { keys: "Alt+H", label: "Shift" },
      { keys: "Alt+K", label: "Cash drop" },
      { keys: "Alt+J", label: "No sale (open the drawer)" },
      { keys: "Alt+T", label: "Register settings" },
      { keys: "Alt+W", label: "Online orders (needs order.read)" },
      { keys: "Ctrl+M", label: "Show or hide the sidebar (also Ctrl+B)" },
      { keys: "F1", label: "Help (also Ctrl+/)" },
      { keys: "Ctrl+Shift+L", label: "Sign out" },
    ],
  },
  {
    label: "Sale",
    items: [
      { keys: "F2", label: "Scan or search" },
      { keys: "↑ ↓", label: "Choose a result" },
      { keys: "Enter", label: "Add to the cart" },
      { keys: "Alt+C", label: "Go to the cart" },
      { keys: "F3", label: "Basket" },
      { keys: "F4", label: "Quantity" },
      { keys: "Alt+O", label: "Override the price" },
      { keys: "Delete", label: "Remove the line" },
      { keys: "F6", label: "Hold the sale" },
      { keys: "F7", label: "Held sales" },
      { keys: "F11", label: "Clear the cart" },
      { keys: "Esc", label: "Clear the search" },
      { keys: "F8", label: "Sync now" },
      { keys: "F10", label: "Register status" },
    ],
  },
  {
    label: "Tender",
    items: [
      { keys: "Ctrl+Enter", label: "Checkout" },
      { keys: "Alt+1 / Alt+2 / Alt+3", label: "Cash, mobile money or card" },
      { keys: "Alt+5 / Alt+6", label: "On account or points" },
      { keys: "F5", label: "Charge" },
    ],
  },
  {
    label: "Customer",
    items: [
      { keys: "Alt+U", label: "Add a customer to the sale" },
      { keys: "Alt+I", label: "Create an invoice" },
      { keys: "Alt+E", label: "Edit the customer" },
      { keys: "Alt+R", label: "Remove the customer" },
      { keys: "Alt+A", label: "Take an account payment" },
    ],
  },
];
