import { Layout } from '@/components/layout';
import { usePageMeta } from '@/hooks/use-page-meta';
import { Link } from 'wouter';

export default function NotFound() {
  usePageMeta({
    title: 'Pagina niet gevonden',
    description: 'Deze pagina bestaat niet (meer).'
  });

  return (
    <Layout>
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-[120px] font-bold text-muted/30 leading-none num select-none">404</h1>
        <h2 className="type-display text-foreground mt-4 mb-6">We zijn de route kwijt.</h2>
        <p className="type-body text-muted-foreground mb-8">De pagina die je zoekt bestaat niet (meer).</p>
        <Link 
          href="/" 
          className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-float"
        >
          Terug naar de start
        </Link>
      </div>
    </Layout>
  );
}
