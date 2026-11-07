import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "./components/error-boundary";
import { OrbitalBoot } from "./game/OrbitalBoot";
import "./index.css";

// Retained offline/rollback entry. The app and this page use the same boot.
const offlineQueryClient = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <QueryClientProvider client={offlineQueryClient}>
      <OrbitalBoot standalone />
    </QueryClientProvider>
  </ErrorBoundary>,
);
