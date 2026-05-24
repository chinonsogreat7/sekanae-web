import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { StoreProvider } from "./context/StoreContext";
import { ScrollToTop } from "./components/ScrollToTop";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <StoreProvider>
        <ScrollToTop />
        <App />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>
);
