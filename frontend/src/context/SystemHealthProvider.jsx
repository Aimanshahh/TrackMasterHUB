import { useApiHealth } from '../hooks/useApiHealth.js';
import { SystemHealthContext } from './systemHealth.js';

/**
 * One health poll for the whole app. Header, landing panel and status page
 * render the same snapshot instead of issuing duplicate requests.
 */
export function SystemHealthProvider({ children }) {
  const health = useApiHealth();

  return <SystemHealthContext.Provider value={health}>{children}</SystemHealthContext.Provider>;
}
