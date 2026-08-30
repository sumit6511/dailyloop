import { useParams, Navigate } from "react-router-dom";
import { GAME_PAGES } from "./registry";

export function PlayGamePage() {
  const { slug } = useParams<{ slug: string }>();
  const Component = slug ? GAME_PAGES[slug] : undefined;
  if (!Component) return <Navigate to="/" replace />;
  return <Component />;
}
