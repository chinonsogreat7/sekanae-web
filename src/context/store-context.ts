import { createContext, useContext } from "react";
import type { StoreContextValue } from "./store-types";

export const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function useStore() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error("useStore must be used inside StoreProvider");
  }

  return context;
}
