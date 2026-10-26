import { useEffect } from 'react';

const SUFFIX = 'TrackMaster Hub';

/**
 * Keeps the document title meaningful on every route.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} — ${SUFFIX}` : SUFFIX;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
