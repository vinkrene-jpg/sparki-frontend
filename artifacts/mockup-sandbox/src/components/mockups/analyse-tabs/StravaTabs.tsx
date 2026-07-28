import React, { useState } from 'react';
import { Search, Menu, Home, Calendar, Bike, Activity, MoreHorizontal, Zap, TrendingUp, BarChart2 } from 'lucide-react';

export default function StravaTabs() {
  const [activeTab, setActiveTab] = useState<'Vermogen' | 'Belasting' | 'Trends'>('Vermogen');

  return (
    <div className="w-[390px] h-[844px] relative overflow-hidden flex flex-col font-sans" style={{ backgroundColor: '#040609', color: 'rgba(255,255,255,0.9)' }}>
      {/* Header */}
      <header className="flex-none px-5 py-4 flex items-center justify-between z-10 pt-12">
        <div className="font-mono text-sm tracking-[0.2em] font-medium text-white/90">SPARKI</div>
        <div className="flex items-center gap-4 text-white/70">
          <Search className="w-5 h-5" />
          <Menu className="w-5 h-5" />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex-none px-2 flex justify-between relative border-b border-white/10 z-10">
        {['Vermogen', 'Belasting', 'Trends'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${
              activeTab === tab ? 'text-[#7fe7f0]' : 'text-white/50 hover:text-white/70'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#7fe7f0] rounded-t-full shadow-[0_0_8px_rgba(127,231,240,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto pb-24 pt-6 px-4 custom-scrollbar">
        {activeTab === 'Vermogen' && <VermogenTab />}
        {activeTab === 'Belasting' && <BelastingTab />}
        {activeTab === 'Trends' && <TrendsTab />}
      </main>

      {/* Bottom Nav Bar */}
      <nav className="absolute bottom-0 left-0 right-0 h-24 bg-[#070d16]/90 backdrop-blur-md border-t border-white/5 flex items-start justify-between px-6 pt-4 z-20">
        <NavItem icon={<Home className="w-6 h-6" />} label="Vandaag" />
        <NavItem icon={<Calendar className="w-6 h-6" />} label="Plan" />
        <NavItem icon={<Bike className="w-6 h-6" />} label="Rijden" />
        <NavItem icon={<Activity className="w-6 h-6" />} label="Analyse" active />
        <NavItem icon={<MoreHorizontal className="w-6 h-6" />} label="Meer" />
      </nav>
      
      {/* Home indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full z-30" />
    </div>
  );
}

function VermogenTab() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 mb-2 px-1">01 WATTAGE-LAB</div>
      
      <div className="rounded-2xl border border-white/10 p-5 relative overflow-hidden" style={{ backgroundColor: 'rgba(7, 13, 22, 0.82)', backdropFilter: 'blur(12px)' }}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-white/60 text-xs mb-1">Geschatte FTP</div>
            <div className="text-4xl font-light tracking-tight text-[#7fe7f0]">246<span className="text-base text-[#7fe7f0]/60 ml-1 font-normal">W</span></div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#7fe7f0]/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#7fe7f0]" />
          </div>
        </div>

        {/* Vermogenscurve SVG sparkline */}
        <div className="h-32 w-full relative mb-8">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[1000, 750, 500, 250, 0].map(val => (
              <div key={val} className="w-full h-px bg-white/5 flex items-center">
                {val > 0 && <span className="absolute left-0 -mt-3 text-[9px] text-white/20">{val}</span>}
              </div>
            ))}
          </div>
          <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path 
              d="M 10 20 Q 15 20 20 40 T 40 65 T 70 80 T 100 85" 
              fill="none" 
              stroke="#7fe7f0" 
              strokeWidth="2" 
              className="drop-shadow-[0_0_8px_rgba(127,231,240,0.3)]"
            />
            {/* Fill under the curve */}
            <path 
              d="M 10 20 Q 15 20 20 40 T 40 65 T 70 80 T 100 85 L 100 100 L 10 100 Z" 
              fill="url(#fade)" 
              opacity="0.2"
            />
            <defs>
              <linearGradient id="fade" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#7fe7f0" stopOpacity="1" />
                <stop offset="100%" stopColor="#7fe7f0" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute -bottom-5 left-0 w-full flex justify-between text-[9px] text-white/30 pt-2 border-t border-white/10 mt-1 pl-10 pr-2">
            <span>1s</span>
            <span>1m</span>
            <span>5m</span>
            <span>20m</span>
            <span>1u</span>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <div className="text-[11px] font-mono tracking-widest uppercase text-white/40 mb-3">Persoonlijke records (seizoen)</div>
          {[
            { label: '5 sec', val: '842', pct: 'Sprint', w: 84 },
            { label: '1 min', val: '415', pct: 'Anaeroob', w: 41 },
            { label: '5 min', val: '290', pct: 'VO2 Max', w: 29 },
            { label: '20 min', val: '258', pct: 'Threshold', w: 25 }
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between bg-white/[0.02] rounded-lg p-2.5">
              <span className="text-white/60 text-sm w-16">{row.label}</span>
              <div className="flex-1 px-3">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-white/20 rounded-full" style={{ width: `${row.w}%` }} />
                </div>
              </div>
              <div className="flex flex-col items-end w-20">
                <span className="text-white/90 font-medium text-sm">{row.val} <span className="text-[10px] text-white/40">W</span></span>
                <span className="text-[9px] text-white/40 uppercase">{row.pct}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BelastingTab() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 mb-2 px-1">02 WEEKBELASTING</div>

      <div className="rounded-2xl border border-white/10 p-5" style={{ backgroundColor: 'rgba(7, 13, 22, 0.82)', backdropFilter: 'blur(12px)' }}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-white/60 text-xs mb-1">Training Stress Balance</div>
            <div className="text-2xl font-light text-white/90">
              Vorm <span className="text-[#7fe7f0]">licht stijgend</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#7fe7f0]/10 flex items-center justify-center text-[#7fe7f0] font-medium text-sm border border-[#7fe7f0]/20">
            +4
          </div>
        </div>

        <div className="h-44 flex items-end justify-between gap-2 mb-6 mt-8 relative">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
             <div className="w-full h-px border-t border-dashed border-white/50"></div>
             <div className="w-full h-px border-t border-dashed border-white/50"></div>
             <div className="w-full h-px border-t border-dashed border-white/50"></div>
             <div className="w-full h-px border-t border-dashed border-white/50"></div>
          </div>
          
          {[
            { day: 'Ma', h: 30, color: 'bg-white/10' },
            { day: 'Di', h: 65, color: 'bg-[#7fe7f0]/40' },
            { day: 'Wo', h: 40, color: 'bg-white/20' },
            { day: 'Do', h: 80, color: 'bg-[#7fe7f0]/80' },
            { day: 'Vr', h: 5,  color: 'bg-white/5' },
            { day: 'Za', h: 100, color: 'bg-[#7fe7f0]' },
            { day: 'Zo', h: 50, color: 'bg-white/30' },
          ].map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full">
              <div className="w-full relative flex-1 flex items-end justify-center">
                <div 
                  className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 ${bar.color}`} 
                  style={{ height: `${bar.h}%` }}
                />
              </div>
              <span className="text-[10px] text-white/40">{bar.day}</span>
            </div>
          ))}
        </div>

        <div className="bg-white/5 rounded-xl p-4 flex items-start gap-3 mt-4 border border-white/5">
          <BarChart2 className="w-5 h-5 text-white/40 shrink-0 mt-0.5" />
          <p className="text-[13px] text-white/70 leading-relaxed">
            Je chronische trainingsbelasting (CTL) zit op <span className="text-white font-medium">68</span>. Dit is 4 punten hoger dan begin deze maand. Goed op weg.
          </p>
        </div>
      </div>
    </div>
  );
}

function TrendsTab() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 mb-2 px-1">03 LANGE TERMIJN</div>

      <div className="rounded-2xl border border-white/10 p-5" style={{ backgroundColor: 'rgba(7, 13, 22, 0.82)', backdropFilter: 'blur(12px)' }}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-white/60 text-xs mb-1">Progressie (6 weken)</div>
            <div className="text-xl text-white/90 font-medium">Hartslag vs Vermogen</div>
          </div>
          <TrendingUp className="w-5 h-5 text-[#7fe7f0]" />
        </div>

        <div className="h-36 w-full relative mb-8">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            {/* Hartslag lijn (dashed) */}
            <path 
              d="M 0 80 Q 20 70 40 60 T 80 40 T 100 30" 
              fill="none" 
              stroke="rgba(255,255,255,0.2)" 
              strokeWidth="2" 
              strokeDasharray="4 4"
            />
            {/* Vermogen lijn (cyan) */}
            <path 
              d="M 0 90 Q 20 85 40 60 T 80 30 T 100 20" 
              fill="none" 
              stroke="#7fe7f0" 
              strokeWidth="2" 
              className="drop-shadow-[0_0_6px_rgba(127,231,240,0.4)]"
            />
          </svg>
          <div className="absolute inset-0 flex justify-between items-end pb-2 pointer-events-none">
            <div className="w-px h-full border-l border-dashed border-white/10 relative ml-8">
              <span className="absolute -bottom-5 -left-3 text-[9px] text-white/30">Okt</span>
            </div>
            <div className="w-px h-full border-l border-dashed border-white/10 relative mr-8">
              <span className="absolute -bottom-5 -left-3 text-[9px] text-white/30">Nov</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 mt-8">
          <div className="bg-white/5 rounded-xl p-4 flex gap-3 border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#7fe7f0] mt-1.5 shrink-0 shadow-[0_0_4px_rgba(127,231,240,0.8)]" />
            <p className="text-[13px] text-white/80 leading-relaxed">
              Je aerobe efficiëntie is met <strong className="text-white font-medium">4.2%</strong> verbeterd. Je trapt nu 210W op Zone 2 hartslag (was 201W).
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 flex gap-3 border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 mt-1.5 shrink-0" />
            <p className="text-[13px] text-white/70 leading-relaxed">
              Hersteltijd na zware blokken (Z5) is afgenomen met gemiddeld 12 seconden per interval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-1.5 transition-colors ${active ? 'text-[#7fe7f0]' : 'text-white/40 hover:text-white/70'}`}>
      {icon}
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </button>
  );
}
