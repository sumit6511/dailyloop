import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Icon name="extension" className="text-5xl text-white/60" />
      <h1 className="font-display text-2xl font-bold text-white">Page not found</h1>
      <p className="max-w-sm text-sm text-white/50">
        This piece doesn't fit the puzzle — the page you're looking for doesn't exist.
      </p>
      <Link to="/">
        <Button>
          <Icon name="home" className="text-lg" /> Back to Daily Games
        </Button>
      </Link>
    </div>
  );
}
