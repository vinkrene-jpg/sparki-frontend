// Gedeelde demo-opstelling voor de 10 kleurrichtingen: een routekaart-mock
// (routelijn, start/finish, meetpunt-bolletjes, fietser-marker, waarschuwing)
// plus een analysekaart (grafiek, kaders, letters). Elke variant levert alleen
// een palet; de opbouw is identiek zodat kleuren eerlijk vergelijkbaar zijn.
import { Bike, TriangleAlert, Flag } from "lucide-react";

export type Palet = {
  naam: string;
  hypothese: string;
  // Kaart
  mapBg: string;
  mapLand: string; // subtiele vlakken (parken/water-suggestie)
  routeLine: string;
  routeCasing: string;
  meetpunt: string;
  meetpuntRing: string;
  fietserBg: string;
  fietserFg: string;
  warnBg: string;
  warnFg: string;
  startBg: string;
  startFg: string;
  // Analyse
  paneelBg: string;
  paneelBorder: string;
  tekst: string;
  gedempt: string;
  chartFit: string; // fitheid (primaire lijn)
  chartVermoeid: string;
  chartVorm: string;
  chartGrid: string;
  as: string;
};

const ROUTE_D =
  "M 22 178 C 60 150, 55 96, 105 92 S 205 118, 244 76 S 330 40, 356 84";

function punt(t: number): [number, number] {
  // Vaste posities langs de curve (handmatig, stabiel).
  const pts: [number, number][] = [
    [22, 178],
    [78, 122],
    [140, 98],
    [214, 106],
    [270, 66],
    [356, 84],
  ];
  return pts[Math.round(t * (pts.length - 1))]!;
}

export function KleurDemo({ p }: { p: Palet }) {
  const meetpunten = [0.2, 0.4, 0.8].map(punt);
  const fietser = punt(0.6);
  const warn = punt(1) as [number, number];
  const start = punt(0);
  const balken = [34, 52, 41, 66, 58, 74, 49];
  return (
    <div
      className="min-h-screen w-full p-5 font-sans"
      style={{ background: p.paneelBg, color: p.tekst }}
    >
      <div className="mb-3">
        <div className="text-[15px] font-semibold">{p.naam}</div>
        <div className="text-[12px] leading-snug" style={{ color: p.gedempt }}>
          {p.hypothese}
        </div>
      </div>

      {/* Routekaart-mock */}
      <div
        className="relative overflow-hidden rounded-xl border"
        style={{ background: p.mapBg, borderColor: p.paneelBorder }}
      >
        <svg viewBox="0 0 380 210" className="block w-full">
          {/* landvlakken */}
          <rect x="0" y="0" width="380" height="210" fill={p.mapBg} />
          <circle cx="70" cy="40" r="46" fill={p.mapLand} />
          <rect x="230" y="140" width="150" height="80" rx="20" fill={p.mapLand} />
          <rect x="150" y="10" width="90" height="40" rx="12" fill={p.mapLand} />
          {/* routelijn met casing */}
          <path d={ROUTE_D} stroke={p.routeCasing} strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d={ROUTE_D} stroke={p.routeLine} strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* meetpunt-bolletjes */}
          {meetpunten.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="8" fill={p.meetpuntRing} />
              <circle cx={x} cy={y} r="5.5" fill={p.meetpunt} />
            </g>
          ))}
        </svg>
        {/* start/finish */}
        <div
          className="absolute flex h-8 w-8 items-center justify-center rounded-full border-2"
          style={{
            left: start[0] - 16 + 4,
            top: (start[1] / 210) * 100 + "%",
            transform: "translateY(-50%)",
            background: p.startBg,
            color: p.startFg,
            borderColor: p.startFg,
          }}
        >
          <Flag className="h-4 w-4" />
        </div>
        {/* fietser-marker */}
        <div
          className="absolute flex h-9 w-9 items-center justify-center rounded-full shadow-lg"
          style={{
            left: (fietser[0] / 380) * 100 + "%",
            top: (fietser[1] / 210) * 100 + "%",
            transform: "translate(-50%, -50%)",
            background: p.fietserBg,
            color: p.fietserFg,
          }}
        >
          <Bike className="h-5 w-5" />
        </div>
        {/* waarschuwingsmarker */}
        <div
          className="absolute flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            left: (warn[0] / 380) * 100 + "%",
            top: (warn[1] / 210) * 100 + "%",
            transform: "translate(-50%, -50%)",
            background: p.warnBg,
            color: p.warnFg,
          }}
        >
          <TriangleAlert className="h-4 w-4" />
        </div>
      </div>

      {/* Analysekaart */}
      <div
        className="mt-4 rounded-xl border p-4"
        style={{ borderColor: p.paneelBorder }}
      >
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] font-semibold">Belasting &amp; vorm</div>
          <div className="text-[11px]" style={{ color: p.gedempt }}>
            laatste 7 dagen
          </div>
        </div>
        <svg viewBox="0 0 340 110" className="mt-2 block w-full">
          {[22, 50, 78].map((y) => (
            <line key={y} x1="0" x2="340" y1={y} y2={y} stroke={p.chartGrid} strokeWidth="1" />
          ))}
          {balken.map((h, i) => (
            <rect
              key={i}
              x={14 + i * 46}
              y={100 - h}
              width="20"
              height={h}
              rx="3"
              fill={p.chartVermoeid}
              opacity="0.85"
            />
          ))}
          <path
            d="M 10 82 L 60 74 L 110 70 L 160 58 L 210 62 L 260 44 L 320 38"
            stroke={p.chartFit}
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 10 96 L 60 92 L 110 95 L 160 86 L 210 90 L 260 80 L 320 74"
            stroke={p.chartVorm}
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
          {["ma", "wo", "vr", "zo"].map((d, i) => (
            <text key={d} x={16 + i * 92} y="108" fontSize="9" fill={p.as}>
              {d}
            </text>
          ))}
        </svg>
        <div className="mt-2 flex gap-4 text-[11px]">
          <Legenda kleur={p.chartFit} label="Fitheid" tekst={p.tekst} />
          <Legenda kleur={p.chartVermoeid} label="Vermoeidheid" tekst={p.tekst} />
          <Legenda kleur={p.chartVorm} label="Vorm" tekst={p.tekst} />
        </div>
      </div>
    </div>
  );
}

function Legenda({ kleur, label, tekst }: { kleur: string; label: string; tekst: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: tekst }}>
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: kleur }} />
      {label}
    </span>
  );
}
