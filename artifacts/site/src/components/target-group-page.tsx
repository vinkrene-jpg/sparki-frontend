import { usePageMeta } from '@/hooks/use-page-meta';
import { Layout } from '@/components/layout';
import { Link } from 'wouter';
import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { asset } from '@/lib/asset';

interface Benefit {
  title: string;
  description: string;
}

interface TargetGroupPageProps {
  title: string;
  promise: string;
  screenPath: string; // e.g. "vandaag", "route"
  screenAlt: string;
  caption?: string; // Honest caption to describe empty states or test data
  benefits: [Benefit, Benefit, Benefit];
  ctaType: "buy" | "share";
  ctaText: string;
  shareMessage?: string;
  pricingLink?: string;
}

export function TargetGroupPage({
  title,
  promise,
  screenPath,
  screenAlt,
  caption,
  benefits,
  ctaType,
  ctaText,
  shareMessage,
  pricingLink
}: TargetGroupPageProps) {
  usePageMeta({
    title,
    description: promise
  });

  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Sparki — ${title}`,
          text: shareMessage || promise,
          url: url,
        });
      } catch (err) {
        // user cancelled or failed, fallback to copy
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Layout>
      <article className="pt-20 sm:pt-32 pb-16 px-6 max-w-7xl mx-auto min-h-[70vh] flex flex-col lg:flex-row items-center gap-16 lg:gap-24 animate-fade-in-up">
        
        {/* Text Content */}
        <div className="flex-1 w-full max-w-2xl lg:max-w-none">
          <h1 className="text-[11px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-6">
            Voor {title.toLowerCase()}
          </h1>
          <h2 className="type-display text-foreground mb-12">
            {promise}
          </h2>

          <div className="space-y-10 mb-16">
            {benefits.map((b, i) => (
              <div key={i}>
                <h3 className="type-title-card text-foreground mb-2">{b.title}</h3>
                <p className="type-body text-muted-foreground">{b.description}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {ctaType === "buy" ? (
              <>
                <Link href="/app" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-float">
                  {ctaText}
                </Link>
                {pricingLink && (
                  <Link href={pricingLink} className="text-muted-foreground hover:text-foreground font-medium underline underline-offset-4 decoration-border">
                    Bekijk de prijzen
                  </Link>
                )}
              </>
            ) : (
              <button 
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 border border-border/50 transition-colors shadow-sm"
              >
                <Share2 size={18} />
                {copied ? "Link gekopieerd!" : ctaText}
              </button>
            )}
          </div>
        </div>

        {/* Screen Visual - MKT-08: Grote ECHTE productschermen */}
        <div className="flex-1 w-full flex justify-center lg:justify-end relative">
          <div className="relative w-full max-w-[320px] sm:max-w-[360px] md:max-w-[390px] flex flex-col items-center">
            {/* Phone Frame wrapper */}
            <div className="relative rounded-[3rem] overflow-hidden border-[8px] border-foreground/5 bg-background shadow-2xl drop-shadow-2xl w-full">
              <div className="absolute top-0 inset-x-0 h-6 bg-background z-10 flex justify-center">
                {/* Notch mock */}
                <div className="w-1/3 h-4 bg-foreground/5 rounded-b-xl"></div>
              </div>
              
              <img 
                src={asset(`/screens/mobiel/${screenPath}.png`)} 
                alt={screenAlt}
                className="w-full h-auto object-cover object-top block min-h-[600px] bg-secondary"
                loading="eager"
                width={390}
                height={844}
              />
            </div>
            
            {caption && (
              <p className="mt-6 text-sm text-muted-foreground text-center max-w-xs balance leading-relaxed">
                {caption}
              </p>
            )}
            
            {/* Subtle background glow/shadow to make the phone pop */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-accent-cyan/10 blur-3xl -z-10 rounded-full opacity-50 mix-blend-multiply pointer-events-none"></div>
          </div>
        </div>

      </article>
    </Layout>
  );
}
