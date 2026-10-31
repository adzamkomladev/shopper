import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "#components/dropdown/menu";
import { setTheme, useTheme } from "#hooks/theme";
import type { Theme } from "#hooks/types";

const THEMES = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const;

/** The Theme submenu for a user menu: Light, Dark or System, saved per browser. */
export function ThemeMenu() {
  const theme = useTheme();
  const Current = THEMES.find((item) => item.value === theme)!.Icon;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Current />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {THEMES.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              <item.Icon />
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
