import { RouterProvider } from "react-router-dom";
import { router } from "./routes/routes.jsx";
import "bootstrap/dist/css/bootstrap.min.css";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";
import { store } from "./store/store";
import AuthRefresh from "./pages/Auth/components/AuthRefresh/AuthRefresh";
import NotificationSync from "./shared/components/NotificationSync/NotificationSync";
import SavedTripsProvider from "./context/SavedTripsProvider";
import { CurrencyProvider } from "./state/CurrencyProvider";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <CurrencyProvider>
        <SavedTripsProvider>
          <AuthRefresh />
          <NotificationSync />
          <aside className="nefruDemoBanner" role="note">
            <strong>Portfolio demo</strong>
            <span>Fictional experiences · no real reservations · use payment test details only · do not upload real identity documents.</span>
          </aside>
          <Suspense
            fallback={
              <div className="nefruRouteLoading" role="status" aria-live="polite">
                <span className="nefruRouteSpinner" aria-hidden="true" />
                <strong>Loading NEFRU</strong>
                <small>Preparing your experience…</small>
              </div>
            }
          >
            <RouterProvider router={router} />
          </Suspense>
        </SavedTripsProvider>
      </CurrencyProvider>
    </Provider>
  </StrictMode>,
);
