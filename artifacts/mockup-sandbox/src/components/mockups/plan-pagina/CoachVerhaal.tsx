import React from 'react';
import { Activity, Flame, Battery, TrendingUp, Calendar, Info, CheckCircle2, AlertTriangle, ArrowRight, Wind } from 'lucide-react';

export function CoachVerhaal() {
  return (
    <div className="min-h-screen bg-[#05080f] text-slate-300 font-sans selection:bg-cyan-500/30 pb-20">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}} />
      
      <div className="max-w-[1280px] mx-auto p-8 font-outfit">
        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <span className="text-slate-900 font-bold text-sm">S</span>
            </div>
            <h1 className="text-xl font-medium text-white tracking-wide">Sparki<span className="text-slate-500 ml-2 font-light">Coach</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#1e293b] border border-white/10 flex items-center justify-center overflow-hidden">
              <span className="text-sm font-medium text-slate-300">TJ</span>
            </div>
          </div>
        </header>

        {/* 1. VANDAAG BLOK */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold tracking-widest text-slate-500 mb-4 uppercase">Vandaag · 21 Sept</h2>
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0a1220] to-[#05080f] border border-[#1e293b] rounded-3xl p-8 md:p-12 shadow-2xl">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
              <div className="max-w-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <span className="px-4 py-1.5 text-xs font-semibold bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20 tracking-wide">
                    Training
                  </span>
                  <span className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-slate-500" />
                    1u 15m
                  </span>
                  <span className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-cyan-600" />
                    78 TSS
                  </span>
                </div>
                
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight leading-tight">Intervallen 4×8 Z4</h1>
                <p className="text-lg md:text-xl text-slate-300 mb-10 font-light leading-relaxed">
                  Deze sessie bouwt je FTP-tolerantie op richting de 285W-test.
                </p>
                
                <div className="flex flex-col gap-4 mb-12">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Sessie Opbouw</h3>
                  <div className="flex flex-wrap gap-2.5 font-mono text-sm">
                    <div className="px-4 py-2.5 bg-[#1e293b]/40 rounded-xl text-slate-300 border border-white/5 shadow-inner">20m Z2 Opwarmen</div>
                    <div className="px-4 py-2.5 bg-cyan-950/40 rounded-xl text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-medium">4 × 8m Z4</div>
                    <div className="px-4 py-2.5 bg-[#1e293b]/40 rounded-xl text-slate-300 border border-white/5 shadow-inner">15m Z2 Afkoelen</div>
                  </div>
                </div>
                
                <button className="flex items-center gap-3 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-2xl transition-all hover:scale-[1.02] shadow-[0_0_30px_rgba(6,182,212,0.25)]">
                  <Activity className="w-5 h-5" />
                  Sessie Starten
                  <ArrowRight className="w-5 h-5 ml-2 opacity-70" />
                </button>
              </div>
              
              <div className="w-full md:w-72 h-56 flex items-end gap-2 opacity-90 shrink-0">
                <div className="w-full bg-slate-800/80 h-[25%] rounded-t-sm" />
                <div className="w-full bg-cyan-500/90 h-[75%] rounded-t-sm shadow-[0_0_15px_rgba(6,182,212,0.4)] relative">
                  <div className="absolute -top-6 w-full text-center text-xs font-mono text-cyan-400">Z4</div>
                </div>
                <div className="w-full bg-slate-800/80 h-[25%] rounded-t-sm" />
                <div className="w-full bg-cyan-500/90 h-[75%] rounded-t-sm shadow-[0_0_15px_rgba(6,182,212,0.4)]" />
                <div className="w-full bg-slate-800/80 h-[25%] rounded-t-sm" />
                <div className="w-full bg-cyan-500/90 h-[75%] rounded-t-sm shadow-[0_0_15px_rgba(6,182,212,0.4)]" />
                <div className="w-full bg-slate-800/80 h-[25%] rounded-t-sm" />
                <div className="w-full bg-cyan-500/90 h-[75%] rounded-t-sm shadow-[0_0_15px_rgba(6,182,212,0.4)]" />
                <div className="w-full bg-slate-800/80 h-[20%] rounded-t-sm" />
              </div>
            </div>
          </div>
        </section>

        {/* 2. WEEK & PERIODISERING */}
        <section className="mb-12">
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-sm font-semibold tracking-widest text-slate-500 uppercase">Deze Week</h2>
            <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-500/20">
              Week 2 van 2 resterende piekweken
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {/* Ma */}
            <div className="bg-[#0a1220] border border-[#1e293b] rounded-2xl p-5 flex flex-col opacity-50 transition-opacity hover:opacity-100 cursor-default">
              <span className="text-xs text-slate-500 font-medium mb-2">Ma 19</span>
              <span className="text-sm font-medium text-slate-300">Bewuste rustdag</span>
              <div className="mt-auto pt-8 flex gap-1.5 items-center">
                <Battery className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-slate-400">Herstel</span>
              </div>
            </div>
            
            {/* Di */}
            <div className="bg-[#0a1220] border border-[#1e293b] rounded-2xl p-5 flex flex-col opacity-70 transition-opacity hover:opacity-100 cursor-default">
              <span className="text-xs text-slate-500 font-medium mb-2">Di 20</span>
              <span className="text-sm font-medium text-slate-300">Duurrit Z2 2u</span>
              <div className="mt-auto pt-8 flex gap-1.5 items-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-slate-400">Voltooid</span>
              </div>
            </div>
            
            {/* Wo (Today) */}
            <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-2xl p-5 flex flex-col relative overflow-hidden ring-1 ring-cyan-500/20 shadow-[0_8px_30px_rgba(6,182,212,0.12)] cursor-default scale-[1.02] z-10 transform origin-bottom">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-cyan-500" />
              <span className="text-xs text-cyan-400 font-bold mb-2 tracking-wide uppercase">Wo 21 · Vandaag</span>
              <span className="text-sm font-semibold text-white leading-snug">Intervallen 4×8 Z4</span>
              <div className="mt-auto pt-8 flex gap-1.5 items-center">
                <Flame className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-400">78 TSS</span>
              </div>
            </div>
            
            {/* Do */}
            <div className="bg-[#0a1220] border border-[#1e293b] rounded-2xl p-5 flex flex-col hover:bg-[#0e1629] transition-colors cursor-pointer">
              <span className="text-xs text-slate-500 font-medium mb-2">Do 22</span>
              <span className="text-sm font-medium text-slate-300">Herstelrit Z1 45 min</span>
              <div className="mt-auto pt-8 flex gap-1.5 items-center">
                <Activity className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500">22 TSS</span>
              </div>
            </div>
            
            {/* Vr */}
            <div className="bg-[#0a1220] border border-[#1e293b] rounded-2xl p-5 flex flex-col hover:bg-[#0e1629] transition-colors cursor-pointer relative overflow-hidden">
              <span className="text-xs text-slate-500 font-medium mb-2">Vr 23</span>
              <span className="text-sm font-medium text-slate-300 leading-relaxed">Rustdag — onderdeel van taperweek.</span>
              <div className="mt-auto pt-6 flex gap-1.5 items-center">
                <Battery className="w-4 h-4 text-emerald-500/70" />
                <span className="text-xs font-medium text-slate-500">Herstel</span>
              </div>
            </div>
            
            {/* Za */}
            <div className="bg-[#0a1220] border border-[#1e293b] rounded-2xl p-5 flex flex-col hover:bg-[#0e1629] transition-colors cursor-pointer">
              <span className="text-xs text-slate-500 font-medium mb-2">Za 24</span>
              <span className="text-sm font-medium text-slate-300">Activering FTP Test</span>
              <div className="mt-auto pt-8 flex gap-1.5 items-center">
                <Activity className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500">45 TSS</span>
              </div>
            </div>
            
            {/* Zo */}
            <div className="bg-[#120c08] border border-amber-900/50 rounded-2xl p-5 flex flex-col hover:border-amber-700/60 transition-colors cursor-pointer">
              <span className="text-xs text-amber-500/60 font-medium mb-2">Zo 25</span>
              <span className="text-sm font-medium text-amber-200/80">Nog niet ingepland</span>
              <div className="mt-auto pt-6 flex gap-2 items-start bg-amber-950/40 p-2.5 rounded-xl -mx-1 -mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-[11px] text-amber-400/90 leading-tight font-medium">Gat in piekfase wijkt af van schema</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 px-2">
            <div className="flex items-center h-2 w-full bg-[#0a1220] rounded-full overflow-hidden border border-[#1e293b]">
              <div className="h-full bg-cyan-500/50 w-[57%]" title="Piek belasting" />
              <div className="h-full bg-emerald-500/50 w-[43%]" title="Start taper" />
            </div>
            <div className="flex justify-between mt-3 text-[11px] text-slate-500 font-bold uppercase tracking-widest">
              <span>← Piek (Belasting)</span>
              <span>Start Taper (Herstel) →</span>
            </div>
          </div>
        </section>

        {/* 3. INZICHTEN & DOEL */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Doel */}
          <div className="bg-[#0a1220] border border-[#1e293b] rounded-3xl p-8 relative overflow-hidden flex flex-col transition-all hover:bg-[#0e1629]">
            <div className="absolute -top-4 -right-4 p-6 opacity-5 mix-blend-screen">
              <TrendingUp className="w-40 h-40" />
            </div>
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Op koers</span>
            </div>
            <h3 className="text-slate-400 text-sm font-medium mb-2">Je traint voor</h3>
            <p className="text-3xl font-bold text-white mb-10 tracking-tight">FTP naar 285W</p>
            
            <div className="mt-auto flex items-center gap-4 bg-[#1e293b]/30 p-5 rounded-2xl border border-white/5 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/50 flex items-center justify-center border border-cyan-500/20">
                <Calendar className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">FTP-test</p>
                <p className="text-xs text-slate-400 mt-1">1 oktober</p>
              </div>
            </div>
          </div>

          {/* Inzichten (Wat over tijd opvalt) */}
          <div className="bg-[#0a1220] border border-[#1e293b] rounded-3xl p-8 flex flex-col transition-all hover:bg-[#0e1629]">
            <h3 className="text-sm font-semibold tracking-widest text-slate-500 uppercase mb-6 flex items-center gap-2">
              <Wind className="w-4 h-4 text-cyan-500/70" />
              Wat over tijd opvalt
            </h3>
            
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-5 mb-5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-3.5 relative z-10">
                <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-100/80 leading-relaxed font-light">
                  Je hersteltijd na intervaltrainingen is de laatste 3 weken opgelopen. Dit valt samen met een dalende TSB. Overweeg een extra rustdag deze week.
                </p>
              </div>
            </div>
            
            <div className="mt-auto border-t border-[#1e293b] pt-6">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-full bg-[#1e293b]/50 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Nog 4 trainingen nodig voor een betrouwbaar slaap/herstel-verband.
                </p>
              </div>
            </div>
          </div>

          {/* Ontwikkeling */}
          <div className="bg-[#0a1220] border border-[#1e293b] rounded-3xl p-8 flex flex-col transition-all hover:bg-[#0e1629]">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-sm font-semibold tracking-widest text-slate-500 uppercase">Je Ontwikkeling</h3>
              <div className="text-right">
                <span className="text-3xl font-bold text-white block leading-none mb-1.5">35</span>
                <span className="text-xs text-cyan-400 font-semibold tracking-wide uppercase">CTL • +10 in 43 dgn</span>
              </div>
            </div>
            
            {/* SVG Sparkline */}
            <div className="h-24 w-full mb-6 relative">
              <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                {/* Planned curve */}
                <path d="M0,35 Q20,32 40,25 T80,15 T100,10" fill="none" stroke="rgba(148, 163, 184, 0.2)" strokeWidth="1.5" strokeDasharray="3 3" />
                {/* Actual curve */}
                <path d="M0,35 Q20,33 40,28 T70,22" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
                {/* Drop shadow/glow */}
                <path d="M0,35 Q20,33 40,28 T70,22" fill="none" stroke="rgba(6,182,212,0.4)" strokeWidth="8" className="blur-sm" strokeLinecap="round" />
                {/* Current point */}
                <circle cx="70" cy="22" r="3.5" fill="#05080f" stroke="#06b6d4" strokeWidth="2.5" />
              </svg>
            </div>
            
            <p className="text-sm text-slate-300 leading-relaxed font-light mb-5">
              Je fitheid bouwt volgens schema op voor de FTP-test van 1 oktober.
            </p>
            
            <div className="mt-auto flex items-start gap-3 bg-amber-950/20 p-4 rounded-xl border border-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-500/90 leading-snug font-medium">
                Waarschuwing: Je actuele belasting ligt 5% onder de geplande curve. Blijf consistent.
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
