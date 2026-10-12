import { useParams } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productQuery } from "./queries";

export function ProductScreen() {
  const { productId } = useParams({ from: "/_shop/products/$productId" });
  const { data: product } = useSuspenseQuery(productQuery(productId));
  return <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>;
}
