import { Suspense } from "react";
import ResultsClient from "./ResultsClient";
import ApartmentCardSkeleton from "@/components/ApartmentCardSkeleton";

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <div className="h-14 border-b border-border/60" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ApartmentCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <ResultsClient />
    </Suspense>
  );
}
