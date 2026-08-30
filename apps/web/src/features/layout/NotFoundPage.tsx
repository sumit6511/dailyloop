import { Link } from "react-router-dom";
import { Button } from "../../components/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-5xl">🧩</div>
      <h1 className="font-display text-2xl font-bold text-white">Page not found</h1>
      <p className="max-w-sm text-sm text-white/50">
        This piece doesn't fit the puzzle — the page you're looking for doesn't exist.
      </p>
      <Link to="/">
        <Button>Back to Daily Games</Button>
      </Link>
    </div>
  );
}
