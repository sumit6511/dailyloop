import { Suspense } from "react";
import { useParams, Navigate } from "react-router-dom";
import { GAME_PAGES } from "./registry";
import { PageLoading } from "../layout/PageLoading";

export function PlayGamePage() {
  const { slug } = useParams<{ slug: string }>();
  const Component = slug ? GAME_PAGES[slug] : undefined;
  if (!Component) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<PageLoading />}>
      <Component />
    </Suspense>
  );
}
