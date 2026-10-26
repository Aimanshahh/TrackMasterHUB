import { createContext, useContext } from 'react';

export const SystemHealthContext = createContext(null);

/**
 * Reads the shared API health snapshot. Render inside SystemHealthProvider.
 */
export function useSystemHealth() {
  const context = useContext(SystemHealthContext);

  if (!context) {
    throw new Error('useSystemHealth must be used inside a SystemHealthProvider.');
  }

  return context;
}
