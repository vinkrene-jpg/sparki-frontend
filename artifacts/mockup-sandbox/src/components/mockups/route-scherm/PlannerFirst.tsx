import { ArrowLeft, Bike, Mountain, Footprints, CircleDot, MapPin, Plus, TrendingUp, Clock, Ruler } from "lucide-react";

// Variant B — Planner-first: het Komoot-routeplannerscherm. Boven de kaart een
// compacte planner (A→B of rondje), onderin een vaste statistiekbalk + Start.
export function PlannerFirst() {
  return (
    <div className="relative mx-auto h-screen w-full max-w-[390px] overflow-hidden bg-slate-100 font-sans">
      <img src="/__mockup/images/kaart-licht.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 390 844">
        <path d="M100 620 C 150 520, 280 500, 300 380 S 240 220, 160 280 S 60 520, 100 620" fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
        <circle cx="100" cy="620" r="9" fill="#7c3aed" stroke="white" strokeWidth="3" />
        <circle cx="300" cy="380" r="8" fill="white" stroke="#7c3aed" strokeWidth="3" />
      </svg>

      {/* Plannerkop */}
      <div className="absolute inset-x-0 top-0 bg-white pb-3 pt-3 shadow-lg">
        <div className="flex items-center gap-2 px-3">
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100"><ArrowLeft className="h-5 w-5 text-slate-700" /></button>
          <div className="flex flex-1 gap-2">
            <button className="flex h-11 flex-1 items-center justify-center rounded-xl bg-violet-600 text-[13px] font-semibold text-white">Rondje</button>
            <button className="flex h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 text-[13px] text-slate-600">A naar B</button>
          </div>
        </div>
        {/* Waypoints */}
        <div className="mt-3 space-y-2 px-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <CircleDot className="h-4 w-4 text-violet-600" />
            <span className="text-[14px] text-slate-800">Huidige locatie</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="text-[14px] text-slate-400">Via een klim of plaats (optioneel)</span>
            <Plus className="ml-auto h-4 w-4 text-slate-400" />
          </div>
        </div>
        {/* Sport/fietstype */}
        <div className="mt-3 flex gap-2 overflow-x-auto px-4">
          <span className="flex h-10 items-center gap-1.5 rounded-full border-2 border-violet-600 px-4 text-[13px] font-medium text-violet-700"><Bike className="h-4 w-4" /> Racefiets</span>
          <span className="flex h-10 items-center rounded-full border border-slate-200 px-4 text-[13px] text-slate-600">Gravel</span>
          <span className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-[13px] text-slate-600"><Mountain className="h-4 w-4" /> MTB</span>
          <span className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-[13px] text-slate-600"><Footprints className="h-4 w-4" /> Te voet</span>
        </div>
        {/* Afstand vrij instelbaar */}
        <div className="mt-3 px-4">
          <div className="flex items-center justify-between text-[12px] text-slate-500">
            <span>Afstand</span><span className="font-semibold text-slate-800">62 km</span>
          </div>
          <div className="relative mt-1 h-1.5 rounded-full bg-slate-200">
            <div className="absolute left-0 top-0 h-1.5 w-1/3 rounded-full bg-violet-600" />
            <div className="absolute left-1/3 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-600 bg-white shadow" />
          </div>
          <p className="mt-1 text-[11px] text-violet-700">Sparki's voorstel voor je duurtraining: 62 km</p>
        </div>
      </div>

      {/* Statistiekbalk + Start */}
      <div className="absolute inset-x-0 bottom-0 bg-white pb-4 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
        <div className="flex justify-around px-4 pb-3">
          <div className="flex items-center gap-1.5"><Ruler className="h-4 w-4 text-slate-400" /><span className="text-[14px] font-semibold text-slate-800">62,4 km</span></div>
          <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /><span className="text-[14px] font-semibold text-slate-800">2:20</span></div>
          <div className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-slate-400" /><span className="text-[14px] font-semibold text-slate-800">210 hm</span></div>
        </div>
        <div className="flex gap-2 px-4">
          <button className="h-12 flex-1 rounded-full border border-slate-300 text-[14px] font-medium text-slate-700">Bewaar</button>
          <button className="h-12 flex-[2] rounded-full bg-violet-600 text-[15px] font-semibold text-white">Start navigatie</button>
        </div>
      </div>
    </div>
  );
}
