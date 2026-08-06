import { Search, MoreVertical, Bike, Mountain, LocateFixed, ChevronUp, Sparkles } from "lucide-react";

// Variant C — Komoot-indeling in Sparki-stijl: zelfde opbouw als A maar met de
// Sparki-kleuren (slate/violet) én de trainingslaag prominent: het onderblad
// leidt met Sparki's voorstel-van-vandaag en één grote actieknop.
export function SparkiStijl() {
  return (
    <div className="relative mx-auto h-screen w-full max-w-[390px] overflow-hidden bg-slate-100 font-sans">
      <img src="/__mockup/images/kaart-licht.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 390 844">
        <path d="M130 500 C 180 420, 280 390, 290 290 S 200 160, 140 220 S 90 430, 130 500" fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
        <circle cx="130" cy="500" r="9" fill="#0f172a" stroke="white" strokeWidth="3" />
      </svg>

      {/* Zoek + menu */}
      <div className="absolute inset-x-3 top-3 flex items-center gap-2">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-white px-4 shadow-lg">
          <Search className="h-4 w-4 text-slate-400" />
          <span className="text-[14px] text-slate-400">Zoek plaats, klim of route…</span>
        </div>
        <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg">
          <MoreVertical className="h-5 w-5 text-slate-700" />
        </button>
      </div>

      {/* Bolletjes: trainingstype vooraan, dan fietstype, dan afstand */}
      <div className="absolute inset-x-0 top-[68px] flex gap-2 overflow-x-auto px-3 py-1">
        <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-900 px-4 text-[13px] font-medium text-white shadow"><Sparkles className="h-3.5 w-3.5" /> Duurtraining</span>
        <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 text-[13px] text-slate-700 shadow"><Bike className="h-4 w-4" /> Gravel</span>
        <span className="flex h-10 items-center whitespace-nowrap rounded-full bg-white px-4 text-[13px] text-slate-700 shadow">± 62 km</span>
        <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 text-[13px] text-slate-700 shadow"><Mountain className="h-4 w-4" /> Vlak</span>
      </div>

      <div className="absolute right-3 top-1/3 flex flex-col gap-2">
        <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg"><LocateFixed className="h-5 w-5 text-slate-600" /></button>
      </div>

      {/* Onderblad: Sparki's voorstel leidt */}
      <div className="absolute inset-x-0 bottom-16 rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
        <div className="flex justify-center pt-2"><ChevronUp className="h-4 w-4 text-slate-300" /></div>
        <div className="px-4 pb-4">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Vandaag · duurtraining</p>
            <p className="mt-0.5 text-[15px] font-semibold text-slate-900">Gravelronde vanuit huis — 62 km</p>
            <p className="text-[12px] text-slate-600">210 hm · ±2:20 · rustig wegdek, past bij zone 2</p>
            <button className="mt-3 h-12 w-full rounded-full bg-slate-900 text-[15px] font-semibold text-white">Maak deze route</button>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="h-12 flex-1 rounded-full border border-slate-300 text-[13px] text-slate-700">Zelf plannen</button>
            <button className="h-12 flex-1 rounded-full border border-slate-300 text-[13px] text-slate-700">Bewaard</button>
            <button className="h-12 flex-1 rounded-full border border-slate-300 text-[13px] text-slate-700">Ontdekken</button>
          </div>
        </div>
      </div>

      {/* Tabbalk in Sparki-stijl */}
      <div className="absolute inset-x-0 bottom-0 flex h-16 items-center justify-around border-t border-slate-200 bg-white pb-1">
        {["Vandaag", "Trainen", "Route", "Samen", "Meer"].map((t, i) => (
          <div key={t} className={`flex flex-col items-center gap-0.5 text-[11px] ${i === 2 ? "font-semibold text-violet-700" : "text-slate-500"}`}>
            <div className={`h-6 w-6 rounded-md ${i === 2 ? "bg-violet-600" : "bg-slate-200"}`} />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
