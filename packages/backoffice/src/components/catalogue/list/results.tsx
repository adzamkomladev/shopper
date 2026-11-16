import { useSuspenseQuery } from "@tanstack/react-query";
import { EmptyCatalogue, NoMatch } from "./states";
import { ProductPager } from "./pager";
import { ProductTable } from "./table";
import {
  PAGE_SIZE,
  productsQuery,
  type CategoryView,
  type ProductSearch,
} from "../../../queries/catalogue/list";

type Props = {
  search: ProductSearch;
  categories: CategoryView[];
  addRef: React.Ref<HTMLButtonElement>;
  onAdd: () => void;
  onClear: () => void;
};

/** The part of the screen that waits for products: a page of the table, or the state that stands in for it. */
export function ProductResults({ search, categories, addRef, onAdd, onClear }: Props) {
  const { data } = useSuspenseQuery(productsQuery(search));
  if (data.total === 0) {
    return search.q || search.categoryId ? (
      <NoMatch query={search.q} onClear={onClear} />
    ) : (
      <EmptyCatalogue onAdd={onAdd} addRef={addRef} />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ProductTable products={data.items} categories={categories} />
      <ProductPager page={search.page ?? 1} pageSize={PAGE_SIZE} total={data.total} />
    </div>
  );
}
