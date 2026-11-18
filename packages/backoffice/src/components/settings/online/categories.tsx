import { Link } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shopper/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Switch } from "@shopper/ui/components/switch";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { useShowCategory } from "../../../queries/settings/online";
import type { CategoryView } from "../../../queries/catalogue/types";

/**
 * Each department with its categories, each with a switch: a hidden category hides its products online, and a hidden
 * department hides every category under it. Products keep their own "Show online" too.
 */
export function OnlineCategories({ categories }: { categories: CategoryView[] }) {
  const departments = categories.filter((row) => !row.parentId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories online</CardTitle>
      </CardHeader>
      <CardContent>
        {departments.length ? (
          <ul className="flex flex-col divide-y" aria-label="Categories online">
            {departments.map((department) => (
              <li key={department.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                <CategorySwitch category={department} />
                <ul className="flex flex-col pl-6">
                  {categories
                    .filter((row) => row.parentId === department.id)
                    .map((child) => (
                      <li key={child.id}>
                        <CategorySwitch category={child} hiddenBy={!department.onlineVisible} />
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyTitle>No categories yet</EmptyTitle>
              <EmptyDescription>
                Every product you show online is listed. Add categories to hide whole groups at
                once.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link to="/products">Go to products</Link>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

function CategorySwitch({ category, hiddenBy }: { category: CategoryView; hiddenBy?: boolean }) {
  const online = useOnline();
  const show = useShowCategory();
  const pending = show.isPending && show.variables?.id === category.id;
  const checked = pending ? show.variables!.onlineVisible : category.onlineVisible;
  const id = `category-${category.id}`;
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0 text-sm font-medium break-words">
        {category.name}
        {hiddenBy && checked && (
          <span className="block font-normal text-muted-foreground sm:ml-2 sm:inline">
            Hidden with its department
          </span>
        )}
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={!online || pending}
        onCheckedChange={(next) => show.mutate({ id: category.id, onlineVisible: next })}
      />
    </div>
  );
}
