import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Ramp } from "@nairaramp/core";

const NairaRampContext = createContext<Ramp | undefined>(undefined);

export interface NairaRampProviderProps {
  ramp: Ramp;
  children: ReactNode;
}

/**
 * Provides a `@nairaramp/core` `Ramp` instance to descendant hooks and components
 * so callers do not need to thread `ramp` through every component prop.
 */
export function NairaRampProvider({
  ramp,
  children,
}: NairaRampProviderProps): ReactElement {
  return (
    <NairaRampContext.Provider value={ramp}>
      {children}
    </NairaRampContext.Provider>
  );
}

/**
 * Resolves a `Ramp` instance from an explicit override or the nearest `NairaRampProvider`.
 */
export function useNairaRamp(overrideRamp?: Ramp): Ramp {
  const contextRamp = useContext(NairaRampContext);
  const resolved = overrideRamp ?? contextRamp;
  if (!resolved) {
    throw new Error(
      "No Ramp instance found. Pass a `ramp` prop/option or wrap your component tree in <NairaRampProvider>."
    );
  }
  return resolved;
}

