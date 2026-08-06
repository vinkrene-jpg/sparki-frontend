import { Search, Menu, Bike, Mountain, Footprints, LocateFixed, Layers, ChevronUp } from "lucide-react";

// Variant A — Komoot-klassiek: beeldvullende kaart, zoek-pil bovenaan,
// sport+fietstype als bolletjesrij, onderblad met suggesties, tabbalk onderin.
export function KomootKlassiek() {
  return (
    <div className="relative mx-auto h-screen w-full max-w-[390px] overflow-hidden bg-slate-100 font-sans">
      {/* Kaart */}
      <img src="/__mockup/images/kaart-licht.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      {/* Routelijn */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 390 844">
        <path d="M120 560 C 160 460, 260 430, 290 330 S 220 180, 150 240 S 90 480, 120 560" fill="none" stroke="#059669" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
        <circle cx="120" cy="560" r="9" fill="#059669" stroke="white" strokeWidth="3" />
      </svg>

      {/* Zoek-pil + menu */}
      <div className="absolute inset-x-3 top-3 flex items-center gap-2">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-white px-4 shadow-lg">
          <Search className="h-4 w-4 text-slate-400" />
          <span className="text-[14px] text-slate-400">Zoek een plaats of klim…</span>
        </div>
        <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg">
          <Menu className="h-5 w-5 text-slate-700" />
        </button>
      </div>

      {/* Sport + fietstype bolletjes */}
      <div className="absolute inset-x-0 top-[68px] flex gap-2 overflow-x-auto px-3 py-1">
        <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-600 px-4 text-[13px] font-medium text-white shadow"><Bike className="h-4 w-4" /> Gravel</span>
        <span className="flex h-10 items-center whitespace-nowrap rounded-full bg-white px-4 text-[13px] text-slate-700 shadow">Racefiets</span>
        <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 text-[13px] text-slate-700 shadow"><Mountain className="h-4 w-4" /> MTB</span>
        <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 text-[13px] text-slate-700 shadow"><Footprints className="h-4 w-4" /> Wandelen</span>
      </div>

      {/* Kaartknoppen rechts */}
      <div className="absolute right-3 top-1/3 flex flex-col gap-2">
        <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg"><Layers className="h-5 w-5 text-slate-600" /></button>
        <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg"><LocateFixed className="h-5 w-5 text-slate-600" /></button>
      </div>

      {/* Onderblad met suggesties */}
      <div className="absolute inset-x-0 bottom-16 rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
        <div className="flex justify-center pt-2"><ChevronUp className="h-4 w-4 text-slate-300" /></div>
        <div className="px-4 pb-4">
          <p className="text-[15px] font-semibold text-slate-900">Voor jou, vandaag</p>
          <p className="text-[12px] text-slate-500">Duurtraining · Sparki stelt ±62 km voor</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {[
              { n: "Ronde langs de Maas", d: "62 km · 210 hm", t: "Past bij je training" },
              { n: "Gravelrondje Bos", d: "48 km · 150 hm", t: "Rustig alternatief" },
              { n: "Klimlus Zuid", d: "74 km · 540 hm", t: "Meer klimmen" },
            ].map((r) => (
              <div key={r.n} className="w-52 shrink-0 rounded-2xl border border-slate-200 p-3">
                <div className="h-20 rounded-xl bg-emerald-50" style={{ backgroundImage: "url(/__mockup/images/kaart-licht.png)", backgroundSize: "300%", backgroundPosition: "center" }} />
                <p className="mt-2 text-[13px] font-semibold text-slate-800">{r.n}</p>
                <p className="text-[12px] text-slate-500">{r.d}</p>
                <p className="text-[11px] font-medium text-emerald-700">{r.t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabbalk */}
      <div className="absolute inset-x-0 bottom-0 flex h-16 items-center justify-around border-t border-slate-200 bg-white pb-1">
        {["Ontdekken", "Plannen", "Rijden", "Profiel"].map((t, i) => (
          <div key={t} className={`flex flex-col items-center gap-0.5 text-[11px] ${i === 1 ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
            <div className={`h-6 w-6 rounded-md ${i === 1 ? "bg-emerald-600" : "bg-slate-200"}`} />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
