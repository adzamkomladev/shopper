import { Skeleton } from "@shopper/ui/components/skeleton";
import { Section } from "./details";

/**
 * The case's shape while it loads: the header, then the checks, business, evidence and decision sections with their
 * real titles. Heights are the loaded ones for a typical case; the two-column bodies stack on a phone and grow.
 */
export function KybReviewSkeleton() {
  return (
    <div
      className="flex max-w-3xl flex-col gap-6 pb-6"
      role="status"
      aria-busy="true"
      aria-label="Loading verification"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-44" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-64" />
      </div>
      <Section label="Automated checks">
        <Skeleton className="h-29 sm:h-13" />
      </Section>
      <Section label="Business">
        <Skeleton className="h-77 sm:h-36.5" />
      </Section>
      <Section label="Directors and documents">
        <Skeleton className="h-54.75" />
      </Section>
      <Section label="Decision">
        <Skeleton className="h-8 w-40" />
      </Section>
    </div>
  );
}
