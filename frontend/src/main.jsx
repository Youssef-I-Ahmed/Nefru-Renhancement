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
          <aside role="note" style={{background:'#123249',color:'#fff',padding:'8px 16px',textAlign:'center',fontSize:13}}>NEFRU portfolio demo · Fictional experiences, no real reservations. Use payment test details only; do not upload real identity documents.</aside>
          <Suspense fallback={<div role="status" aria-live="polite" style={{minHeight:"45vh",display:"grid",placeItems:"center",padding:"32px 16px",color:"#64748b",fontSize:14,fontWeight:700}}>Loading NEFRU…</div>}>
            <RouterProvider router={router} />
          </Suspense>
        </SavedTripsProvider>
      </CurrencyProvider>
    </Provider>
  </StrictMode>,
);
