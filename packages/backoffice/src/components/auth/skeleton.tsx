import { CardContent } from "@shopper/ui/components/card";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { AuthBrand, AuthFrame } from "./frame";

type Props = {
  /** How many labelled fields the screen asks for. */
  fields?: number;
  /** The line under the button ("New to Shopper? Create a shop"). */
  footer?: boolean;
};

/** The compact card of a signed-out screen in the loaded one's sizes: brand, heading, lead, fields, button. */
export function AuthSkeleton({ fields = 3, footer = false }: Props) {
  return (
    <AuthFrame>
      <CardContent
        className="flex flex-col gap-6 p-6 sm:p-8"
        role="status"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="flex flex-col gap-1.5">
          <AuthBrand />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {Array.from({ length: fields }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-full" />
          {footer && <Skeleton className="mx-auto h-5 w-44" />}
        </div>
      </CardContent>
    </AuthFrame>
  );
}
