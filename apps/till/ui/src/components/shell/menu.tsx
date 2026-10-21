import type { ReactNode } from "react";
import {
  Building2,
  HandCoins,
  LogOut,
  PanelBottomOpen,
  Receipt,
  Settings,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shopper/ui/components/sheet";
import type { ShellAction, ShellView } from "./types";
import { aria, hint, signOutShortcut } from "./views";

const item = "h-14 w-full justify-start gap-3 px-4 text-base";

/** Figma "Menu": the screens that are not tabs, the back office, and Sign out. */
export function MenuDrawer({
  user,
  registerName,
  online,
  shifts,
  onView,
  onSignOut,
  onCloseAutoFocus,
}: {
  user: string;
  registerName: string;
  /** The back office needs the server; offline it is disabled with the reason. */
  online: boolean;
  /** The user holds shift.write, so the shift screens and the cash movements are theirs to open. */
  shifts: boolean;
  onView: (view: ShellView | ShellAction) => void;
  onSignOut: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <SheetContent
      className="w-full gap-0 sm:max-w-sm"
      onCloseAutoFocus={onCloseAutoFocus}
      showCloseButton={false}
      side="left"
    >
      <SheetHeader className="flex-row items-start justify-between gap-3 border-b p-4">
        <div className="grid min-w-0 gap-1">
          <SheetTitle className="text-xl">Menu</SheetTitle>
          <SheetDescription className="truncate">
            {[user, registerName].filter(Boolean).join(" · ")}
          </SheetDescription>
        </div>
        <SheetClose asChild>
          <Button aria-label="Close menu" size="icon-touch" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </SheetClose>
      </SheetHeader>
      <nav aria-label="Menu" className="grid gap-1 p-2">
        <MenuButton icon={Receipt} onClick={() => onView("purchases")} shortcut="Alt+P">
          Previous purchases
        </MenuButton>
        {shifts && (
          <>
            <MenuButton icon={Timer} onClick={() => onView("shift")} shortcut="Alt+H">
              Shift
            </MenuButton>
            <MenuButton icon={HandCoins} onClick={() => onView("drop")} shortcut="Alt+K">
              Cash drop
            </MenuButton>
            <MenuButton icon={PanelBottomOpen} onClick={() => onView("nosale")} shortcut="Alt+J">
              No sale
            </MenuButton>
          </>
        )}
        <MenuButton icon={Settings} onClick={() => onView("settings")} shortcut="Alt+T">
          Settings
        </MenuButton>
        {online ? (
          <Button asChild className={item} variant="ghost">
            <a href="/backoffice/">
              <Building2 aria-hidden="true" /> Back office
            </a>
          </Button>
        ) : (
          <div>
            <Button
              aria-describedby="menu-backoffice-reason"
              className={item}
              disabled
              variant="ghost"
            >
              <Building2 aria-hidden="true" /> Back office
            </Button>
            <p className="px-4 pb-2 text-sm text-muted-foreground" id="menu-backoffice-reason">
              Needs connection
            </p>
          </div>
        )}
      </nav>
      <SheetFooter className="border-t p-2">
        <MenuButton icon={LogOut} onClick={onSignOut} shortcut={signOutShortcut}>
          Sign out
        </MenuButton>
      </SheetFooter>
    </SheetContent>
  );
}

function MenuButton({
  icon: Icon,
  shortcut,
  onClick,
  children,
}: {
  icon: LucideIcon;
  shortcut: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button aria-keyshortcuts={aria(shortcut)} className={item} onClick={onClick} variant="ghost">
      <Icon aria-hidden="true" /> {children}
      <Kbd className="ml-auto max-sm:hidden">{hint(shortcut)}</Kbd>
    </Button>
  );
}
