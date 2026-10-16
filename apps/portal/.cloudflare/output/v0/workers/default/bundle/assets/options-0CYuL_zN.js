import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { c as Button } from "./createLucideIcon-DmKyVZgg.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { s as ChevronDown } from "./select-DQI7SO7u.js";
import { t as Check } from "./check-B_zEzfYT.js";
import {
  c as CommandInput,
  f as Plus,
  i as Command,
  l as CommandItem,
  n as PopoverContent,
  o as CommandEmpty,
  r as PopoverTrigger,
  s as CommandGroup,
  t as Popover,
  u as CommandList,
} from "./popover-BEG8WX3O.js";
import { G as categoriesQuery, q as useCreateCategory } from "./router-Dr1B-bFG.js";
//#region ../../packages/backoffice/src/components/catalogue/list/category/combobox.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
/** Pick a category, or type a new name and create it without leaving the product form. */
function CategoryCombobox({ id, value, onChange }) {
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const [open, setOpen] = (0, import_react.useState)(false);
  const [term, setTerm] = (0, import_react.useState)("");
  const create = useCreateCategory((category) => choose(category.id));
  const name = term.trim();
  const exists = categories.some((item) => item.name.toLowerCase() === name.toLowerCase());
  function choose(categoryId) {
    onChange(categoryId);
    setOpen(false);
    setTerm("");
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, {
    open,
    onOpenChange: setOpen,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
        asChild: true,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
          id,
          variant: "outline",
          role: "combobox",
          "aria-expanded": open,
          className: "w-full justify-between font-normal",
          children: [
            categories.find((item) => item.id === value)?.name ?? "No category",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {
              "aria-hidden": true,
              className: "opacity-50",
            }),
          ],
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverContent, {
        "aria-label": "Categories",
        className: "w-(--radix-popover-trigger-width) p-0",
        align: "start",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Command, {
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandInput, {
              value: term,
              onValueChange: setTerm,
              placeholder: "Find or add a category",
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandList, {
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandEmpty, {
                  children: "No category found.",
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandGroup, {
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandItem, {
                      value: "No category",
                      onSelect: () => choose(null),
                      children: "No category",
                    }),
                    categories.map((item) =>
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        CommandItem,
                        {
                          value: item.name,
                          onSelect: () => choose(item.id),
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                              className: "flex-1 truncate",
                              children: item.name,
                            }),
                            item.id === value &&
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
                                "aria-hidden": true,
                              }),
                          ],
                        },
                        item.id,
                      ),
                    ),
                  ],
                }),
                name &&
                  !exists &&
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandGroup, {
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandItem, {
                      forceMount: true,
                      value: `create ${name}`,
                      disabled: create.isPending,
                      onSelect: () => create.mutate(name),
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { "aria-hidden": true }),
                        'Create "',
                        name,
                        '"',
                      ],
                    }),
                  }),
              ],
            }),
          ],
        }),
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/lib/catalogue/list/options.ts
var UNITS = [
  {
    value: "each",
    label: "Each",
  },
  {
    value: "kg",
    label: "Kilogram (kg)",
  },
  {
    value: "g",
    label: "Gram (g)",
  },
  {
    value: "l",
    label: "Litre (l)",
  },
  {
    value: "ml",
    label: "Millilitre (ml)",
  },
];
var TAX_CLASSES = [
  {
    value: "standard",
    label: "Standard",
  },
  {
    value: "zero-rated",
    label: "Zero-rated",
  },
  {
    value: "exempt",
    label: "Exempt",
  },
];
//#endregion
export { UNITS as n, CategoryCombobox as r, TAX_CLASSES as t };
