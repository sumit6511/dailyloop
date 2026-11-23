import { Spinner } from "../../components/Spinner";

/** Shown while a lazily loaded page's code downloads (usually a few hundred milliseconds). */
export function PageLoading() {
  return (
    <div className="flex justify-center py-16 text-white/60" role="status" aria-label="Loading">
      <Spinner className="h-7 w-7" />
    </div>
  );
}
