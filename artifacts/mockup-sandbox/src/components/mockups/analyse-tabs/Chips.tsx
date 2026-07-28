import React, { useState } from 'react';
import { Search, Menu, Calendar, Map, Activity, MoreHorizontal, Sun, Zap, TrendingUp, BarChart2 } from 'lucide-react';

type TabType = 'Vermogen' | 'Belasting' | 'Trends' | 'Records';

export default function AnalyseTabsChips() {
  const [activeTab, setActiveTab] = useState<TabType>('Vermogen');

  const tabs: TabType[] = ['Vermogen', 'Belasting', 'Trends', 'Records'];

  return (
    <div className="flex flex-col h-[844px] w-[390px] mx-auto bg-[#040609] text-white overflow-hidden relative font-sans border border-white/10 rounded-[3rem] shadow-2xl">
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 shrink-0 z-10 relative">
        <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-white/40">
          SPARKI
        </div>
        <div className="flex items-center gap-4 text-white/70">
          <Search className="w-5 h-5" />
          <Menu className="w-5 h-5" />
        </div>
      </header>

      {/* Tabs (Chips) */}
      <div className="shrink-0 relative z-10 mb-4">
        {/* Micro label for context (optional, or just tabs) */}
        <div className="px-6 mb-3 font-mono text-[10px] tracking-[0.16em] uppercase text-white/40">
          01 ANALYSE
        </div>
        <div className="flex overflow-x-auto px-6 pb-2 scrollbar-hide gap-2 snap-x">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-5 py-2 rounded-full text-[13px] font-medium whitespace-nowrap snap-start transition-all duration-300
                ${activeTab === tab 
                  ? 'border-[#7fe7f0] text-[#7fe7f0] bg-[#7fe7f0]/10 border' 
                  : 'border-white/10 text-white/60 bg-transparent border hover:text-white hover:border-white/30'
                }
              `}
            >
              {tab}
            </button>
          ))}
          {/* Add a tiny invisible spacer to ensure last item is cut off exactly how we want or fully scrollable */}
          <div className="w-4 shrink-0" />
        </div>
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto px-6 pb-24 relative z-0">
        
        {activeTab === 'Vermogen' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-[#070d16]/82 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white/90 font-medium text-lg flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#7fe7f0]" />
                  Wattage-lab
                </h2>
                <div className="text-right">
                  <div className="text-[10px] font-mono tracking-widest text-white/40 uppercase mb-1">Huidig FTP</div>
                  <div className="text-2xl font-semibold text-white/90">246 <span className="text-[12px] text-white/40 font-normal">W</span></div>
                </div>
              </div>

              {/* Simple Sparkline for Power Curve */}
              <div className="h-24 w-full mb-6 relative">
                <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="10" x2="100" y2="10" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="1 2" />
                  <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="1 2" />
                  <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="1 2" />
                  
                  {/* Fill */}
                  <path 
                    d="M 0 35 Q 5 15, 10 5 T 20 15 T 40 25 T 100 32 L 100 40 L 0 40 Z" 
                    fill="rgba(127, 231, 240, 0.05)" 
                  />
                  {/* Line */}
                  <path 
                    d="M 0 35 Q 5 15, 10 5 T 20 15 T 40 25 T 100 32" 
                    fill="none" 
                    stroke="#7fe7f0" 
                    strokeWidth="1.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="15" cy="11" r="2" fill="#070d16" stroke="#7fe7f0" strokeWidth="1" />
                </svg>
              </div>

              {/* Best Efforts */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '5s', val: '812' },
                  { label: '1m', val: '430' },
                  { label: '5m', val: '280' },
                  { label: '20m', val: '252' },
                ].map((item, i) => (
                  <div key={i} className="bg-white/[0.03] rounded-xl p-3 flex flex-col items-center justify-center border border-white/[0.02]">
                    <div className="text-[9px] font-mono tracking-widest text-white/40 mb-1">{item.label}</div>
                    <div className="text-[15px] font-medium text-white/90">{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-[#070d16]/82 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg flex items-start gap-4">
               <div className="w-8 h-8 rounded-full bg-[#7fe7f0]/10 border border-[#7fe7f0]/20 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-[#7fe7f0]" />
               </div>
               <div>
                  <h3 className="text-[13px] text-white/90 font-medium mb-1">Nieuw 5m PR!</h3>
                  <p className="text-[12px] text-white/50 leading-relaxed">
                    Tijdens je rit gisteren ("Heuvelrug lus") heb je een nieuw vermogensrecord gereden voor 5 minuten.
                  </p>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'Belasting' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-[#070d16]/82 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white/90 font-medium text-lg flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#7fe7f0]" />
                  Weekbelasting
                </h2>
                <div className="text-right">
                  <div className="text-[10px] font-mono tracking-widest text-white/40 uppercase mb-1">TSB Score</div>
                  <div className="text-2xl font-semibold text-[#7fe7f0]">+4</div>
                </div>
              </div>

              <p className="text-[13px] text-white/70 mb-8 border-b border-white/5 pb-4">
                Vorm licht stijgend. Je bent voldoende hersteld voor een pittige interval of lange duurrit.
              </p>

              {/* Bar Chart */}
              <div className="flex items-end justify-between h-32 px-2 mt-4">
                {[
                  { day: 'ma', h: '30%', active: false },
                  { day: 'di', h: '65%', active: false },
                  { day: 'wo', h: '20%', active: false },
                  { day: 'do', h: '85%', active: true },
                  { day: 'vr', h: '10%', active: false },
                  { day: 'za', h: '70%', active: false },
                  { day: 'zo', h: '40%', active: false },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <div className="w-6 h-24 flex items-end relative group cursor-pointer">
                      <div className="absolute inset-0 bg-white/5 rounded-sm" />
                      <div 
                        className={`w-full rounded-sm transition-all duration-500 ${item.active ? 'bg-[#7fe7f0] shadow-[0_0_12px_rgba(127,231,240,0.3)]' : 'bg-white/20'}`}
                        style={{ height: item.h }}
                      />
                    </div>
                    <div className={`text-[10px] font-mono uppercase ${item.active ? 'text-[#7fe7f0]' : 'text-white/40'}`}>
                      {item.day}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Trends' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-[#070d16]/82 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white/90 font-medium text-lg flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#7fe7f0]" />
                  6 Weken Trend
                </h2>
              </div>

              {/* Line Sparkline */}
              <div className="h-20 w-full mb-6 relative">
                <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  {/* Fill */}
                  <path 
                    d="M 0 35 L 10 32 L 20 28 L 30 30 L 40 25 L 50 20 L 60 22 L 70 15 L 80 12 L 90 10 L 100 5 L 100 40 L 0 40 Z" 
                    fill="url(#trendGrad)" 
                  />
                  {/* Line */}
                  <path 
                    d="M 0 35 L 10 32 L 20 28 L 30 30 L 40 25 L 50 20 L 60 22 L 70 15 L 80 12 L 90 10 L 100 5" 
                    fill="none" 
                    stroke="#7fe7f0" 
                    strokeWidth="1.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(127, 231, 240, 0.15)" />
                      <stop offset="100%" stopColor="rgba(127, 231, 240, 0)" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="space-y-3">
                <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl flex gap-3">
                  <div className="mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-[#7fe7f0]" /></div>
                  <div>
                    <div className="text-[13px] text-white/90 font-medium mb-0.5">Chronische belasting stijgt</div>
                    <div className="text-[12px] text-white/50">Je CTL is in 6 weken van 42 naar 58 gegaan. Mooie progressie.</div>
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl flex gap-3">
                  <div className="mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-white/40" /></div>
                  <div>
                    <div className="text-[13px] text-white/90 font-medium mb-0.5">Minder intensiteit</div>
                    <div className="text-[12px] text-white/50">Vorige week 12% minder in zone 4+ gereden ten opzichte van je gemiddelde.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'Records' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
           <div className="bg-[#070d16]/82 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg flex items-center justify-center min-h-[200px]">
             <p className="text-[13px] text-white/40">Nog geen records beschikbaar dit seizoen.</p>
           </div>
         </div>
        )}

      </main>

      {/* Bottom Tab Bar */}
      <nav className="absolute bottom-0 w-full h-[88px] bg-[#040609]/90 backdrop-blur-xl border-t border-white/10 flex items-start justify-between px-6 pt-4 pb-8 z-20">
        {[
          { icon: Sun, label: 'Vandaag', active: false },
          { icon: Calendar, label: 'Plan', active: false },
          { icon: Map, label: 'Rijden', active: false },
          { icon: Activity, label: 'Analyse', active: true },
          { icon: MoreHorizontal, label: 'Meer', active: false },
        ].map((item, i) => (
          <button key={i} className="flex flex-col items-center gap-1.5 w-12">
            <item.icon className={`w-5 h-5 ${item.active ? 'text-[#7fe7f0]' : 'text-white/40'}`} strokeWidth={item.active ? 2.5 : 2} />
            <span className={`text-[10px] font-medium ${item.active ? 'text-[#7fe7f0]' : 'text-white/40'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
      
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
