import { Link } from "react-router-dom";
import { buttonClasses } from "../../components/button-styles";
import { Icon } from "../../components/Icon";
import { StatusPanel } from "../../components/StatusPanel";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <StatusPanel
        icon="extension"
        code="Error 404"
        title="Page not found"
        actions={
          <Link to="/" className={buttonClasses()}>
            <Icon name="home" className="text-lg" /> Back to today
          </Link>
        }
      >
        This piece doesn&rsquo;t fit the puzzle — the page you&rsquo;re looking for doesn&rsquo;t
        exist.
      </StatusPanel>
    </div>
  );
}
