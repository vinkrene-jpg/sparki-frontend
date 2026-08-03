import { useEffect } from 'react';

interface PageMetaOptions {
  title: string;
  description: string;
}

/* Tijdens prerendering (SSR) draaien effects niet; de prerender-stap leest de
   meta daarom uit deze collector, die tijdens de render wordt gevuld. */
export const ssrPageMeta: PageMetaOptions = { title: '', description: '' };

export function usePageMeta({ title, description }: PageMetaOptions) {
  if (import.meta.env.SSR) {
    ssrPageMeta.title = title;
    ssrPageMeta.description = description;
  }
  useEffect(() => {
    document.title = `${title} — Sparki`;
    
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);
  }, [title, description]);
}
