import React, { useState } from 'react';
import { 
  Home, Activity, Compass, Dumbbell, User, Zap, 
  ChevronLeft, ChevronDown, ChevronUp, MapPin, 
  ArrowUpRight, TrendingUp, Info, AlertCircle, Mountain, 
  Timer, BarChart2, Route, Heart, Activity as SpeedIcon
} from 'lucide-react';

// --- MOCK DATA ---
const ACTIVITIES = [
  {
    id: '1',
    title: 'Ochtendrit — Heuvelland',
    date: 'Gisteren, ochtend',
    location: 'Limburg, NL',
    summary: 'Een rustige duurrit, lekker weer, benen voelden fris.',
    metrics: {
      duration: '2:15',
      distance: '62.4 km',
      elevation: '420 m',
      avgSpeed: '27.8 km/u',
      avgPower: '165 W',
      avgHR: '132 bpm',
      tss: '110',
      feel: 'Goed'
    },
    hasStreams: false,
    discoveries: [
      'Je hield je hartslag 85% van de tijd in zone 2. Heel netjes voor een duurrit.',
      'Langste klim was de Cauberg (1.2 km aan 5.8%).'
    ]
  },
  {
    id: '2',
    title: 'Intervaltraining 4×8',
    date: 'Dinsdag, avond',
    location: 'Binnen / Zwift',
    summary: 'Pittige blokken net onder het omslagpunt. Laatste blok was zwaar maar gehaald.',
    metrics: {
      duration: '1:10',
      distance: '38.2 km',
      elevation: '120 m',
      avgSpeed: '32.5 km/u',
      avgPower: '210 W',
      avgHR: '155 bpm',
      tss: '85',
      feel: 'Zwaar'
    },
    hasStreams: true,
    discoveries: [
      'Nieuw 20-min vermogen: 248 W (was 242 W).',
      'Je hartslag herstelde sneller tussen de blokken dan vorige week.'
    ]
  },
  {
    id: '3',
    title: 'Clubrit zondag',
    date: 'Zondag, ochtend',
    location: 'Maasvallei',
    summary: 'Kop over kop rammen met de groep. Veel wind tegen op de terugweg.',
    metrics: {
      duration: '3:20',
      distance: '105.0 km',
      elevation: '180 m',
      avgSpeed: '31.2 km/u',
      avgPower: '195 W',
      avgHR: '148 bpm',
      tss: '180',
      feel: 'Kapot'
    },
    hasStreams: false,
    discoveries: [
      'Hoogste TSS (180) van de afgelopen maand.',
      'Je reed 40 minuten in de rode zone.'
    ]
  }
];

// --- UI COMPONENTS ---
const Card = ({ children, className = '', onClick }: any) => (
  <div 
    onClick={onClick}
    className={`bg-[rgba(7,13,22,0.82)] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
  >
    {children}
  </div>
);

const SectionHeading = ({ children, icon: Icon }: any) => (
  <h2 className="text-sm uppercase tracking-widest font-mono text-white/50 mb-3 flex items-center gap-2">
    {Icon && <Icon className="w-4 h-4" />}
    {children}
  </h2>
);

const SparkiBadge = () => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#78D2E6]/10 border border-[#78D2E6]/20 text-[#78D2E6] text-[10px] uppercase font-mono tracking-widest mb-2">
    <Zap className="w-3 h-3 fill-[#78D2E6]" />
    Sparki ziet
  </div>
);

// --- TABS ---
const VandaagTab = ({ onOpenActivity }: any) => {
  const recent = ACTIVITIES[0];
  const [explainOpen, setExplainOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* BELEVEN - Hero Card */}
      <section>
        <SectionHeading>Beleven</SectionHeading>
        <Card onClick={() => onOpenActivity(recent)}>
          <div className="relative h-48 bg-[#05070e]">
            <img 
              src="/__mockup/images/sparki-hero.png" 
              alt="Hero" 
              className="absolute inset-0 w-full h-full object-cover opacity-95"
              style={{ objectPosition: "center 72%" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05070e] via-[#05070e]/40 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white/60 text-sm mb-1">{recent.date} — {recent.location}</p>
              <h3 className="text-2xl font-semibold mb-2">{recent.title}</h3>
              <p className="text-white/80 leading-relaxed text-sm italic border-l-2 border-[#78D2E6] pl-3">
                "{recent.summary}"
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* ONTDEKKEN */}
      <section>
        <SectionHeading icon={Compass}>Ontdekken</SectionHeading>
        <Card className="p-4">
          <SparkiBadge />
          <p className="text-white/90 leading-relaxed mb-3 text-sm">
            Je derde rit op rij met stijgende duur — je bouwt rustig op. De hartslag bleef stabiel in zone 2, wat wijst op goede aerobe fitheid.
          </p>
          
          {/* BEGRIJPEN Expandable */}
          <button 
            onClick={(e) => { e.stopPropagation(); setExplainOpen(!explainOpen); }}
            className="flex items-center gap-1.5 text-[#78D2E6] text-sm font-medium hover:text-white transition-colors mt-2"
          >
            Waarom ziet Sparki dit?
            {explainOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {explainOpen && (
            <div className="mt-3 pt-3 border-t border-white/10 text-sm text-white/70 space-y-3">
              <p>Sparki vergelijkt de tijdsduur en de gemiddelde hartslag van je laatste 3 ritten. Terwijl de duur toenam (60m → 90m → 135m), bleef de hartslag op gemiddeld 132 bpm.</p>
              <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg">
                <TrendingUp className="w-4 h-4 text-[#78D2E6]" />
                <span className="font-mono text-xs">Vertrouwen: Hoog (op basis van 3 weken data)</span>
              </div>
              <p className="text-xs text-white/50 italic flex gap-1.5 items-start">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Wat Sparki nog mist: Gevoel van spiervermoeidheid de dag erna, omdat je geen herstelvragenlijst hebt ingevuld.
              </p>
            </div>
          )}
        </Card>
      </section>

      {/* COMPACT SNAPSHOT */}
      <section className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-white/50 text-xs uppercase tracking-widest font-mono mb-1">Vorm (CTL)</div>
          <div className="text-3xl font-semibold font-mono tabular-nums">42.5</div>
          <div className="text-white/50 text-xs mt-1">+1.2 deze week</div>
        </Card>
        <Card className="p-4">
          <div className="text-white/50 text-xs uppercase tracking-widest font-mono mb-1">Vermoeidheid</div>
          <div className="text-3xl font-semibold font-mono tabular-nums">56.0</div>
          <div className="text-[#78D2E6] text-xs mt-1">Licht stijgend</div>
        </Card>
      </section>

      {/* VERBETEREN (Last) */}
      <section>
        <SectionHeading icon={ArrowUpRight}>Verbeteren</SectionHeading>
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#78D2E6]" />
            Sparki-coaching
          </h4>
          <p className="text-white/70 text-sm leading-relaxed mb-3">
            Omdat je vermoeidheid licht stijgt na het blokken van afgelopen dagen, stelt Sparki voor om morgen een actieve hersteldag in te plannen (max 45 min, zone 1).
          </p>
          <button className="text-[#78D2E6] text-sm font-medium">
            Bekijk volledige analyse →
          </button>
        </Card>
      </section>
    </div>
  );
};

const ActiviteitenTab = ({ onOpenActivity }: any) => (
  <div className="flex flex-col gap-4">
    <SectionHeading>Recente Ritten</SectionHeading>
    {ACTIVITIES.map(activity => (
      <Card key={activity.id} onClick={() => onOpenActivity(activity)} className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-900/30 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Route className="w-6 h-6 text-[#78D2E6]/70" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white mb-1 truncate">{activity.title}</h4>
          <p className="text-white/50 text-xs mb-2">{activity.date}</p>
          <div className="flex gap-3 text-white/70 text-xs font-mono">
            <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {activity.metrics.duration}</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {activity.metrics.distance}</span>
            <span className="flex items-center gap-1"><Mountain className="w-3 h-3" /> {activity.metrics.elevation}</span>
          </div>
        </div>
        {activity.hasStreams && (
          <div className="shrink-0 text-[10px] text-[#78D2E6]/60 border border-[#78D2E6]/20 px-1.5 py-0.5 rounded uppercase font-mono bg-[#78D2E6]/10">
            Seconde-data
          </div>
        )}
      </Card>
    ))}
  </div>
);

const ActivityDetail = ({ activity, onBack }: any) => {
  const [explainOpen, setExplainOpen] = useState(false);

  return (
    <div className="absolute inset-0 bg-[#05070e] z-50 overflow-y-auto pb-24 duration-300">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-[#05070e]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center">
        <button onClick={onBack} className="flex items-center gap-1 text-[#78D2E6] font-medium py-1 pr-4 hover:opacity-80">
          <ChevronLeft className="w-5 h-5" />
          Terug
        </button>
      </div>

      {/* BELEVEN */}
      <div className="relative h-64 bg-[#05070e]">
        <img 
          src="/__mockup/images/sparki-hero.png" 
          alt="Hero" 
          className="absolute inset-0 w-full h-full object-cover opacity-95"
          style={{ objectPosition: "center 70%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070e] via-[#05070e]/30 to-transparent" />
        
        <div className="absolute bottom-6 left-4 right-4">
          <div className="text-white/60 text-sm mb-1">{activity.date} — {activity.location}</div>
          <h1 className="text-2xl font-bold mb-3">{activity.title}</h1>
          <p className="text-white/80 leading-relaxed text-sm italic border-l-2 border-[#78D2E6] pl-3">
            "{activity.summary}"
          </p>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-6 mt-2">
        {/* Headline Numbers */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-white/50 text-[10px] uppercase font-mono mb-1">Duur</div>
            <div className="font-mono font-semibold text-sm">{activity.metrics.duration}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-white/50 text-[10px] uppercase font-mono mb-1">Afstand</div>
            <div className="font-mono font-semibold text-sm">{activity.metrics.distance.split(' ')[0]}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-white/50 text-[10px] uppercase font-mono mb-1">Hoogte</div>
            <div className="font-mono font-semibold text-sm">{activity.metrics.elevation.split(' ')[0]}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-white/50 text-[10px] uppercase font-mono mb-1">Km/u</div>
            <div className="font-mono font-semibold text-sm">{activity.metrics.avgSpeed.split(' ')[0]}</div>
          </div>
        </div>

        {/* ONTDEKKEN */}
        <section>
          <SectionHeading icon={Compass}>Ontdekken</SectionHeading>
          <Card className="p-4">
            <SparkiBadge />
            <h4 className="font-semibold text-sm mb-2">Sparki ontdekte in deze rit:</h4>
            <ul className="space-y-2 text-white/80 text-sm">
              {activity.discoveries.map((disc: string, i: number) => (
                <li key={i} className="flex gap-2 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#78D2E6] mt-1.5 shrink-0" />
                  <span>{disc}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={() => setExplainOpen(!explainOpen)}
              className="flex items-center gap-1.5 text-[#78D2E6] text-sm font-medium hover:text-white transition-colors mt-4"
            >
              Waarom ziet Sparki dit?
              {explainOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {explainOpen && (
              <div className="mt-3 pt-3 border-t border-white/10 text-sm text-white/70 space-y-3">
                <p>Sparki analyseert je vermogenscurve (Power Duration Curve) en zag een nieuw record op de 20-minuten as.</p>
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-[#78D2E6]" />
                  <span className="font-mono text-xs">Vertrouwen: Zeer hoog (seconde-data)</span>
                </div>
                <p className="text-xs text-white/50 italic flex gap-1.5 items-start">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Wat Sparki nog mist: Gekalibreerde weegschaal data voor exacte W/kg. De huidige W/kg is geschat op basis van 68kg.
                </p>
              </div>
            )}
          </Card>
        </section>

        {/* DATA / CHARTS */}
        <section>
          <SectionHeading icon={BarChart2}>De Cijfers</SectionHeading>
          
          {/* GPX Derived: Hoogteprofiel */}
          <Card className="p-4 mb-3">
            <h4 className="text-xs font-mono uppercase text-white/50 mb-3 flex items-center gap-2">
              <Mountain className="w-3.5 h-3.5" /> Hoogteprofiel
            </h4>
            <div className="h-20 relative w-full">
              <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#78D2E6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#78D2E6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path 
                  d="M0,30 L0,25 L10,24 L20,15 L30,22 L40,10 L50,18 L60,5 L70,8 L80,25 L90,15 L100,28 L100,30 Z" 
                  fill="url(#elevGrad)"
                />
                <polyline 
                  points="0,25 10,24 20,15 30,22 40,10 50,18 60,5 70,8 80,25 90,15 100,28" 
                  fill="none" 
                  stroke="#78D2E6" 
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </Card>

          {/* GPX Derived: Snelheid */}
          <Card className="p-4 mb-3">
            <h4 className="text-xs font-mono uppercase text-white/50 mb-3 flex items-center gap-2">
              <SpeedIcon className="w-3.5 h-3.5" /> Snelheid (km/u)
            </h4>
            <div className="h-16 relative w-full">
              <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                <polyline 
                  points="0,15 10,12 20,20 30,10 40,18 50,22 60,5 70,12 80,15 90,25 100,10" 
                  fill="none" 
                  stroke="rgba(255,255,255,0.5)" 
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </Card>

          {/* STREAM DATA OR HONEST EMPTY STATE */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-mono uppercase text-white/50 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" /> Vermogen & Hartslag
              </h4>
            </div>
            
            {activity.hasStreams ? (
              <div className="h-32 relative w-full mt-2">
                <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                  <polyline 
                    points="0,35 10,30 20,10 30,12 40,25 50,22 60,8 70,10 80,30 90,32 100,35" 
                    fill="none" 
                    stroke="#E67878" // HR red
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    opacity="0.8"
                  />
                  <polyline 
                    points="0,30 10,25 20,5 30,8 40,28 50,25 60,2 70,5 80,25 90,28 100,32" 
                    fill="none" 
                    stroke="#78D2E6" // Power cyan
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div className="absolute top-0 right-0 flex gap-3 text-[10px] font-mono">
                  <span className="text-[#78D2E6] flex items-center gap-1"><Zap className="w-3 h-3" /> Vermogen</span>
                  <span className="text-[#E67878] flex items-center gap-1"><Heart className="w-3 h-3" /> Hartslag</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-6 px-4 bg-black/20 rounded-xl border border-white/5">
                <AlertCircle className="w-6 h-6 text-white/30 mb-2" />
                <p className="text-sm font-medium text-white/70 mb-1">
                  Vermogen per seconde — nog niet beschikbaar
                </p>
                <p className="text-xs text-white/50 leading-relaxed max-w-[250px]">
                  Deze rit kwam binnen zonder seconde-data. Koppel een vermogensmeter of importeer via een bron met seconde-data om deze grafieken te zien.
                </p>
                <div className="mt-4 text-[10px] font-mono uppercase tracking-widest text-[#78D2E6]/60 border border-[#78D2E6]/20 px-2 py-1 rounded">
                  Alleen totalen (aggregates)
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* VERBETEREN */}
        <section>
          <SectionHeading icon={ArrowUpRight}>Verbeteren</SectionHeading>
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#78D2E6]" />
              Sparki-coaching
            </h4>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              {activity.hasStreams 
                ? "Je intervallen waren sterk, maar je trapte iets te zwaar in het begin. Probeer volgende keer je krachten gelijkmatiger te verdelen over de 4 blokken."
                : "Aangezien dit een zware rit was (TSS 180), is het essentieel om voldoende koolhydraten aan te vullen. Denk aan ~60g KH in de komende uren."}
            </p>
            <button className="w-full py-2.5 rounded-lg border border-white/10 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
              Markeer als begrepen
            </button>
          </Card>
        </section>
      </div>
    </div>
  );
};

const OntdekkenTab = () => (
  <div className="flex flex-col gap-6">
    <SectionHeading>De Feed</SectionHeading>
    <Card className="p-4">
      <div className="text-[10px] uppercase font-mono text-[#78D2E6] mb-2 tracking-widest">Persoonlijk Inzicht</div>
      <h3 className="font-semibold text-lg mb-2">Je trapt efficiënter op klimmen</h3>
      <p className="text-sm text-white/70 mb-3">Sparki ziet dat je hartslag bij 200W op hellingen van {'>'}5% de afgelopen maand met 4 bpm is gedaald.</p>
      <div className="h-1 bg-white/10 rounded overflow-hidden">
        <div className="h-full bg-[#78D2E6] w-[70%]" />
      </div>
    </Card>
    
    <Card className="p-4">
      <div className="text-[10px] uppercase font-mono text-purple-400 mb-2 tracking-widest">Kennis</div>
      <h3 className="font-semibold text-lg mb-2">Waarom Zone 2 training werkt</h3>
      <p className="text-sm text-white/70">Een korte, heldere uitleg over hoe rustig fietsen je mitochondriën bouwt, zonder moeilijke fysiologie.</p>
    </Card>
  </div>
);

const TrainenTab = () => (
  <div className="flex flex-col gap-6">
    <SectionHeading>Deze week</SectionHeading>
    <Card className="p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div>
          <div className="text-xs text-white/50 font-mono mb-0.5">Vandaag</div>
          <div className="font-semibold text-sm">Rust / Actief herstel</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50 font-mono mb-0.5">45 min</div>
          <div className="text-xs text-[#78D2E6]">Zone 1</div>
        </div>
      </div>
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div>
          <div className="text-xs text-white/50 font-mono mb-0.5">Morgen</div>
          <div className="font-semibold text-sm">VO2max Intervallen</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50 font-mono mb-0.5">1u 15m</div>
          <div className="text-xs text-red-400">Zone 5</div>
        </div>
      </div>
    </Card>

    <SectionHeading>Volgende Wedstrijd</SectionHeading>
    <Card className="p-4">
      <div className="text-xl font-bold mb-1">Ronde van de Maasvallei</div>
      <div className="text-sm text-white/60 mb-3">Zondag 14 Mei — 120 km</div>
      <p className="text-sm text-white/80">Nog 3 weken te gaan. Je voorbereiding loopt op schema.</p>
    </Card>
  </div>
);

const JijTab = () => (
  <div className="flex flex-col gap-6">
    <div className="flex items-center gap-4 mb-2">
      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-[#78D2E6] flex items-center justify-center text-2xl font-bold">
        S
      </div>
      <div>
        <h2 className="text-2xl font-bold">Sen</h2>
        <p className="text-white/50 font-mono text-sm">Jeugdrenner • WV Schijndel</p>
      </div>
    </div>

    <SectionHeading>Wat Sparki weet</SectionHeading>
    <Card className="p-4">
      <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
        <span className="text-sm text-white/70">Huidige FTP (geschat)</span>
        <span className="font-mono font-semibold">248 W</span>
      </div>
      <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
        <span className="text-sm text-white/70">Gewicht</span>
        <span className="font-mono font-semibold">68 kg</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-white/70">Klimmer / Sprinter</span>
        <span className="font-mono font-semibold text-[#78D2E6]">All-rounder</span>
      </div>
    </Card>
  </div>
);

// --- MAIN PROTOTYPE APP ---
export function Prototype() {
  const [activeTab, setActiveTab] = useState('vandaag');
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  const renderTab = () => {
    switch (activeTab) {
      case 'vandaag': return <VandaagTab onOpenActivity={setSelectedActivity} />;
      case 'activiteiten': return <ActiviteitenTab onOpenActivity={setSelectedActivity} />;
      case 'ontdekken': return <OntdekkenTab />;
      case 'trainen': return <TrainenTab />;
      case 'jij': return <JijTab />;
      default: return null;
    }
  };

  return (
    <div className="font-sans text-white bg-[#05070e] min-h-[100dvh] relative overflow-hidden flex flex-col antialiased selection:bg-[#78D2E6]/30">
      {/* Global Background Gradients */}
      <div className="fixed top-0 inset-x-0 h-[50vh] bg-[radial-gradient(ellipse_at_top,rgba(120,210,230,0.06),transparent_70%)] pointer-events-none" />
      <div className="fixed bottom-0 inset-x-0 h-[30vh] bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-8 z-0">
        {renderTab()}
      </main>

      {/* Detail Overlay */}
      {selectedActivity && (
        <ActivityDetail 
          activity={selectedActivity} 
          onBack={() => setSelectedActivity(null)} 
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40">
        <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[#040506] to-transparent pointer-events-none" />
        <div className="bg-[#040506]/90 backdrop-blur-xl border-t border-white/10 px-2 pb-6 pt-3 flex justify-between items-center">
          {[
            { id: 'vandaag', label: 'Vandaag', icon: Home },
            { id: 'activiteiten', label: 'Activiteiten', icon: Activity },
            { id: 'ontdekken', label: 'Ontdekken', icon: Compass },
            { id: 'trainen', label: 'Trainen', icon: Dumbbell },
            { id: 'jij', label: 'Jij', icon: User },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedActivity(null); }}
                className="flex-1 flex flex-col items-center gap-1.5"
              >
                <Icon 
                  className={`w-5 h-5 transition-colors ${isActive ? 'text-[#78D2E6] drop-shadow-[0_0_6px_rgba(120,210,230,0.8)]' : 'text-white/40'}`} 
                  strokeWidth={isActive ? 2 : 1.5}
                />
                <span className={`text-[10px] font-mono uppercase tracking-widest ${isActive ? 'text-[#78D2E6]' : 'text-white/40'}`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  );
}
