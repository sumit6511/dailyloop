import { useEffect } from "react";

const APP_NAME = "DailyLoop";

/** Sets the browser tab title to "<title> · DailyLoop" while the calling page is shown. */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
