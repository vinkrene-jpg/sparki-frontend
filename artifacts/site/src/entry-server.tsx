// Prerender-ingang (MKT-18: elke pagina leesbaar zonder JavaScript).
// Wordt alleen gebruikt door prerender.mjs tijdens `pnpm run build`.
import { renderToString } from 'react-dom/server';

import App from './App';
import { ssrPageMeta } from '@/hooks/use-page-meta';

export function render(path: string): {
  html: string;
  title: string;
  description: string;
} {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  ssrPageMeta.title = '';
  ssrPageMeta.description = '';
  const html = renderToString(<App ssrPath={`${base}${path}`} />);
  return {
    html,
    title: ssrPageMeta.title,
    description: ssrPageMeta.description,
  };
}
