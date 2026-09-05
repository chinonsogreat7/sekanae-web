import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { StoreProvider } from "./context/StoreContext";
import { ScrollToTop } from "./components/ScrollToTop";
import { CatalogProvider } from "./context/CatalogProvider";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <CatalogProvider>
      <StoreProvider>
        <ScrollToTop />
        <App />
      </StoreProvider>
      </CatalogProvider>
    </BrowserRouter>
  </StrictMode>
);
