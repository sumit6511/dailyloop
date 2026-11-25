import { StrictMode } from "react";
// Self-hosted variable fonts (only the unicode subsets a page uses are downloaded); bundled with
// a content hash, so they cache forever and no visitor data goes to a font CDN.
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/space-grotesk/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query-client";
import { AuthProvider } from "./lib/AuthProvider";
import { AmbientBackground } from "./components/AmbientBackground";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./lib/ToastProvider";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <AmbientBackground />
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
