import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — Realm of Dominion` : 'Realm of Dominion';
  }, [title]);
}
