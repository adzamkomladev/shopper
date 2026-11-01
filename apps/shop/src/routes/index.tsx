import { createFileRoute } from "@tanstack/react-router";
import { Missing } from "../components/shop/missing";

/** No shop named: the shop's link (`/<shop code>`) is how shoppers arrive. */
export const Route = createFileRoute("/")({
  component: () => (
    <Missing
      title="Open your shop's link"
      description="Your shop's link ends in its code, like /accra-mart. Ask the cashier or scan the code on your receipt."
    />
  ),
});
