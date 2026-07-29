import React from 'react';
import { Target, Activity, Calendar, AlertTriangle, CheckCircle2, Clock, Info, TrendingUp } from 'lucide-react';

export function Cockpit() {
  return (
    <div className="min-h-screen bg-[#05080f] text-slate-300 font-sans p-8 flex justify-center">
      <div className="w-full max-w-[1280px]">
        {/* Header / Status Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#0a1220]/60 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-400" />
              <span className="text-white font-medium">Doel: FTP naar 285W</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-white/20"></div>
            <span className="text-slate-400 text-sm">FTP-test · 1 oktober</span>
          </div>
          <div className="flex items-center gap-6 mt-4 sm:mt-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              <span className="text-emerald-400 text-sm font-medium">Op koers</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm">
              Fase: <span className="text-white font-medium">Piek</span>
            </div>
          </div>
        </div>

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Kolom 1: Vandaag */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              Vandaag
            </h2>
            
            {/* Actieve Sessie Detail */}
            <div className="bg-[#0a1220]/80 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-xl shadow-black/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1.5">Trainingsdag</div>
                  <h3 className="text-xl text-white font-medium">Intervallen 4×8 Z4</h3>
                </div>
                <div className="bg-[#05080f] px-3 py-1.5 rounded-lg border border-white/5 flex flex-col items-end">
                  <span className="text-white font-medium text-sm">1u 15m</span>
                  <span className="text-xs text-slate-500 mt-0.5">78 TSS</span>
                </div>
              </div>
              
              <p className="text-sm text-slate-300 leading-relaxed">
                Bouwt FTP-tolerantie op richting de 285W-test. Focus op een vloeiende pedaalslag in de blokken.
              </p>

              <div className="bg-[#05080f] rounded-xl p-4 border border-white/5 flex flex-col gap-3 mt-1">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                  <span className="text-sm">20 min Z2 opwarming</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                  <span className="text-sm text-white font-medium">
                    4×8 min Z4 <span className="text-slate-500 font-normal ml-1">(2 min Z1 rust)</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                  <span className="text-sm">15 min Z2 afkoelen</span>
                </div>
              </div>

              <button className="mt-2 w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors py-2.5 rounded-xl text-sm font-medium border border-cyan-500/20 flex items-center justify-center gap-2">
                Naar Wahoo sturen
              </button>
            </div>

            {/* Preview Morgen - Bewuste rustdag */}
            <div className="bg-[#0a1220]/40 border border-dashed border-white/10 rounded-2xl p-4 flex flex-col gap-3 opacity-70 hover:opacity-100 transition-opacity">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Morgen</div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-white font-medium text-sm mb-0.5">Bewuste rustdag</div>
                  <div className="text-xs text-slate-400 leading-snug">Rustdag — onderdeel van taperweek. Herstel na de lange duurrit van gisteren.</div>
                </div>
              </div>
            </div>

            {/* Preview Overmorgen - Ongepland gat */}
            <div className="bg-[#0a1220]/40 border border-dashed border-amber-500/20 rounded-2xl p-4 flex flex-col gap-3 opacity-70 hover:opacity-100 transition-opacity">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Donderdag</div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <div className="text-amber-500 font-medium text-sm mb-0.5">Nog niet ingepland</div>
                  <div className="text-xs text-amber-500/70 leading-snug">Actie vereist: in deze piekfase mis je nog een intervaltraining.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom 2: De opbouw */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              De opbouw
            </h2>
            
            <div className="bg-[#0a1220]/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/50 flex flex-col h-[calc(100%-2.5rem)]">
              <div className="mb-6">
                <h3 className="text-white font-medium">Week 2 van 2 resterende piekweken</h3>
                <p className="text-sm text-slate-400 mt-1">Je bouwt volume af en houdt intensiteit hoog.</p>
              </div>

              <div className="flex flex-col gap-1.5 flex-1 justify-center">
                
                {/* Wk 36 */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 text-xs text-slate-500 text-right">Wk 36</div>
                  <div className="flex-1 flex items-center gap-2 border-l-2 border-white/5 pl-4 py-2 relative">
                    <div className="h-7 bg-slate-800 rounded-md w-3/4 flex items-center px-3">
                      <span className="text-[10px] text-slate-400 font-medium tracking-wide">OPBOUW · 5u 30m</span>
                    </div>
                  </div>
                </div>

                {/* Wk 37 */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 text-xs text-slate-500 text-right">Wk 37</div>
                  <div className="flex-1 flex items-center gap-2 border-l-2 border-white/5 pl-4 py-2 relative">
                    <div className="h-7 bg-slate-800 rounded-md w-4/5 flex items-center px-3">
                      <span className="text-[10px] text-slate-400 font-medium tracking-wide">OPBOUW · 6u 15m</span>
                    </div>
                  </div>
                </div>
                
                {/* Overgang Piek */}
                <div className="relative mt-3 mb-3">
                  <div className="absolute left-[3.25rem] -top-3 w-4 h-px bg-white/20"></div>
                  <div className="text-[10px] text-cyan-400 font-bold tracking-widest ml-[4.5rem]">PIEKFASE</div>
                </div>

                {/* Wk 38 - Huidig */}
                <div className="flex items-center gap-4 group relative">
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-cyan-500 rounded-r-md shadow-[0_0_12px_rgba(6,182,212,0.5)]"></div>
                  <div className="w-12 text-sm text-cyan-400 font-medium text-right">Nu</div>
                  <div className="flex-1 flex items-center gap-2 border-l-2 border-cyan-500/50 pl-4 py-2 relative">
                    <div className="absolute -left-[3px] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-cyan-500"></div>
                    <div className="h-7 bg-cyan-500/20 border border-cyan-500/30 rounded-md w-full flex items-center px-3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                      <span className="text-[10px] text-cyan-300 font-bold tracking-wide relative z-10">PIEK · 7u 45m</span>
                    </div>
                  </div>
                </div>

                {/* Wk 39 */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 text-xs text-slate-500 text-right">Wk 39</div>
                  <div className="flex-1 flex items-center gap-2 border-l-2 border-white/5 pl-4 py-2 relative">
                    <div className="h-7 bg-slate-800/80 rounded-md w-[45%] flex items-center px-3">
                      <span className="text-[10px] text-slate-400 font-medium tracking-wide">TAPER · 3u 30m</span>
                    </div>
                  </div>
                </div>

                {/* Doel / Event */}
                <div className="relative mt-5 pt-3 border-t border-white/5">
                   <div className="text-[10px] text-emerald-400 font-bold tracking-widest ml-[4.5rem] flex items-center gap-2">
                      <Target className="w-3.5 h-3.5" /> FTP-TEST (1 OKT)
                   </div>
                   <div className="absolute left-[3.25rem] -top-3 w-px h-6 bg-white/10"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom 3: Werkt het? */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Werkt het?
            </h2>
            
            <div className="bg-[#0a1220]/80 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col gap-6 shadow-xl shadow-black/50">
              
              {/* Je ontwikkeling */}
              <div>
                <div className="flex items-end justify-between mb-4">
                  <h3 className="text-white font-medium">Je ontwikkeling</h3>
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <span className="text-xs text-slate-400 font-medium">CTL Fitheid</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl text-white font-bold leading-none">35</span>
                      <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">+10 in 43 dagen</span>
                    </div>
                  </div>
                </div>
                
                {/* CTL Sparkline SVG */}
                <div className="h-20 w-full relative bg-[#05080f] rounded-xl border border-white/5 p-3">
                  <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                     {/* Y-axis soft gridlines */}
                     <line x1="0" y1="10" x2="100" y2="10" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2 2" />
                     <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2 2" />
                     
                     {/* Line chart past */}
                     <path d="M0,35 C15,33 25,28 40,25 C55,22 70,18 85,10 L100,5" fill="none" stroke="rgba(16,185,129,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                     
                     {/* Gradient under line */}
                     <path d="M0,35 C15,33 25,28 40,25 C55,22 70,18 85,10 L100,5 L100,40 L0,40 Z" fill="url(#ctlGradient)" />
                     <defs>
                       <linearGradient id="ctlGradient" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="0%" stopColor="rgba(16,185,129,0.25)" />
                         <stop offset="100%" stopColor="rgba(16,185,129,0)" />
                       </linearGradient>
                     </defs>
                     
                     {/* Future projection dashed */}
                     <path d="M100,5 C105,3 110,2 120,0" fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth="1.5" strokeDasharray="2 2" />

                     {/* Current dot */}
                     <circle cx="100" cy="5" r="2.5" fill="#10b981" />
                     <circle cx="100" cy="5" r="6" fill="none" stroke="#10b981" strokeWidth="1.5" className="animate-[ping_3s_infinite]" opacity="0.5" />
                  </svg>
                </div>

                <div className="mt-4 flex gap-3 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-100/90 leading-snug">
                    Je fitheid bouwt volgens schema op voor de FTP-test van 1 oktober.
                  </p>
                </div>
              </div>

              <div className="h-px bg-white/10 w-full my-1"></div>

              {/* Automatische Verbanden */}
              <div className="flex flex-col gap-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Automatische Inzichten</h4>
                
                {/* Insight Card 1 (Active Insight) */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <span className="text-white font-medium block mb-1">Herstel duurt langer</span>
                    <span className="text-amber-200/80 leading-relaxed block">
                      Je hersteltijd na intervaltrainingen is de laatste 3 weken opgelopen. Dit valt samen met een dalende TSB. Overweeg een extra rustdag deze week.
                    </span>
                  </div>
                </div>

                {/* Insight Card 2 (Pending Insight) */}
                <div className="bg-[#05080f] border border-white/5 rounded-xl p-4 flex gap-3 items-center">
                  <Info className="w-5 h-5 text-slate-600 shrink-0" />
                  <div className="text-sm text-slate-400 leading-snug">
                    Nog 4 trainingen nodig voor een betrouwbaar slaap/herstel-verband.
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}} />
    </div>
  );
}
