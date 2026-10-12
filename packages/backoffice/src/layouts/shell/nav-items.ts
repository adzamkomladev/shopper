import { PackageIcon, UploadIcon } from "lucide-react";

export const NAV_ITEMS = [
  { to: "/products", label: "Products", icon: PackageIcon },
  { to: "/imports", label: "Import", icon: UploadIcon },
] as const;
