import React, { useState } from 'react';
import { Search, Menu, Home, Calendar, Bike, Activity, MoreHorizontal, Zap, BarChart2 } from 'lucide-react';

export default function SegmentedTabs() {
  const [activeTab, setActiveTab] = useState('vermogen');

  return (
    <div className="relative w-full h-[844px] max-w-[390px] mx-auto overflow-hidden text-slate-200 font-sans shadow-2xl rounded-[40px] border-[8px] border-[#1a1c20]" style={{ backgroundColor: '#040609' }}>
      
      {/* Header */}
      <header className="flex justify-between items-center px-5 pt-12 pb-2">
        <span className="font-mono text-sm tracking-[0.2em] font-medium text-white/90">SPARKI</span>
        <div className="flex items-center gap-5 text-white/90">
          <Search className="w-5 h-5" />
          <Menu className="w-5 h-5" />
        </div>
      </header>

      {/* Title */}
      <div className="px-5 mt-4 mb-2">
        <p className="font-mono uppercase tracking-[0.16em] text-[10px] text-white/40 mb-1">01 ANALYSE</p>
        <h1 className="text-2xl font-semibold text-white/90">Prestaties</h1>
      </div>

      {/* Segmented Control */}
      <div className="mx-5 mt-5 p-1.5 rounded-2xl bg-[#070d16]/82 border border-white/10 flex items-center backdrop-blur-md relative z-10">
        {['vermogen', 'belasting', 'trends'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 text-[13px] font-semibold rounded-xl transition-all duration-300 ${
              activeTab === tab
                ? 'bg-[#7fe7f0] text-[#040609] shadow-sm'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Scrollable Content Area */}
      <div className="h-full overflow-y-auto pb-32 pt-6 scrollbar-hide">
        {activeTab === 'vermogen' && (
          <div className="space-y-4 px-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="p-5 rounded-3xl bg-[#070d16]/82 border border-white/10 backdrop-blur-md">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="font-mono uppercase tracking-[0.16em] text-[10px] text-[#7fe7f0]/80 mb-1.5">Wattage-lab</p>
                  <h2 className="text-lg font-medium text-white/90">Huidige FTP</h2>
                </div>
                <div className="flex items-baseline gap-1 text-[#7fe7f0]">
                  <span className="text-4xl font-light tracking-tight">246</span>
                  <span className="text-sm font-medium opacity-80">W</span>
                </div>
              </div>
              
              {/* Sparkline */}
              <div className="h-28 w-full mb-8 relative">
                <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="cyan-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7fe7f0" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#7fe7f0" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,40 L0,35 Q10,35 20,30 T40,25 T60,20 T80,10 T100,5 L100,40 Z" fill="url(#cyan-gradient)" />
                  <path d="M0,35 Q10,35 20,30 T40,25 T60,20 T80,10 T100,5" fill="none" stroke="#7fe7f0" strokeWidth="1.5" className="opacity-90" />
                  <circle cx="100" cy="5" r="2.5" fill="#040609" stroke="#7fe7f0" strokeWidth="1.5" />
                </svg>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { label: '5s', val: '840' }, 
                  { label: '1m', val: '412' }, 
                  { label: '5m', val: '285' }, 
                  { label: '20m', val: '254' }
                ].map(stat => (
                  <div key={stat.label} className="bg-white/5 rounded-2xl py-3 flex flex-col items-center justify-center border border-white/5">
                    <span className="font-mono text-[10px] text-white/40 mb-1">{stat.label}</span>
                    <span className="text-[15px] text-white/90 font-medium">{stat.val}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-5 rounded-3xl bg-[#070d16]/82 border border-white/10 backdrop-blur-md flex items-center justify-between">
              <div>
                <h3 className="text-white/90 font-medium mb-1">Krachtprofiel</h3>
                <p className="text-xs text-white/50">Jouw profiel: Allrounder</p>
              </div>
              <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 text-[#7fe7f0]">
                <Zap className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'belasting' && (
          <div className="space-y-4 px-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="p-5 rounded-3xl bg-[#070d16]/82 border border-white/10 backdrop-blur-md">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="font-mono uppercase tracking-[0.16em] text-[10px] text-[#7fe7f0]/80 mb-1.5">Weekoverzicht</p>
                  <h2 className="text-lg font-medium text-white/90">Vorm licht stijgend</h2>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[10px] font-mono tracking-widest text-white/40 mb-1">TSB</span>
                   <span className="text-2xl font-light text-[#7fe7f0]">+4</span>
                </div>
              </div>
              
              {/* Bar chart */}
              <div className="flex items-end justify-between h-36 pt-4 border-b border-white/5 pb-3">
                {[
                  { d: 'MA', h: '30%', active: false },
                  { d: 'DI', h: '60%', active: false },
                  { d: 'WO', h: '40%', active: false },
                  { d: 'DO', h: '85%', active: false },
                  { d: 'VR', h: '20%', active: false },
                  { d: 'ZA', h: '100%', active: true },
                  { d: 'ZO', h: '70%', active: false },
                ].map(bar => (
                  <div key={bar.d} className="flex flex-col items-center gap-2.5 w-full">
                    <div className="w-full flex justify-center h-full items-end">
                      <div className={`w-[14px] rounded-[3px] transition-all duration-500 ${bar.active ? 'bg-[#7fe7f0] shadow-[0_0_12px_rgba(127,231,240,0.3)]' : 'bg-white/10 hover:bg-white/20'}`} style={{ height: bar.h }}></div>
                    </div>
                    <span className={`font-mono text-[9px] ${bar.active ? 'text-[#7fe7f0]' : 'text-white/40'}`}>{bar.d}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-5 flex gap-4 text-xs">
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-white/40">Acute load (ATL)</span>
                  <span className="text-white/90 font-medium">84</span>
                </div>
                <div className="w-px bg-white/10"></div>
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-white/40">Chronic load (CTL)</span>
                  <span className="text-white/90 font-medium">80</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-4 px-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="p-5 rounded-3xl bg-[#070d16]/82 border border-white/10 backdrop-blur-md">
               <div className="mb-8">
                  <p className="font-mono uppercase tracking-[0.16em] text-[10px] text-[#7fe7f0]/80 mb-1.5">Lange termijn</p>
                  <h2 className="text-lg font-medium text-white/90">Trendlijn 6 weken</h2>
               </div>

               {/* Line sparkline */}
               <div className="h-28 w-full mb-8 relative">
                <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <path d="M0,25 L15,26 L30,22 L45,24 L60,18 L75,19 L90,10 L100,6" fill="none" stroke="#7fe7f0" strokeWidth="2" className="opacity-90" />
                  <circle cx="100" cy="6" r="2.5" fill="#040609" stroke="#7fe7f0" strokeWidth="1.5" />
                  <path d="M0,25 L15,26 L30,22 L45,24 L60,18 L75,19 L90,10 L100,6" fill="none" stroke="#7fe7f0" strokeWidth="6" className="opacity-20 blur-sm" />
                </svg>
              </div>

               <div className="space-y-3">
                 <div className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/5">
                   <div className="mt-0.5 p-1.5 rounded-full bg-[#7fe7f0]/10 text-[#7fe7f0]">
                    <Zap className="w-4 h-4" />
                   </div>
                   <p className="text-[13px] text-white/80 leading-relaxed font-medium">Je basisconditie is met 12% toegenomen vergeleken met vorige maand.</p>
                 </div>
                 <div className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/5">
                   <div className="mt-0.5 p-1.5 rounded-full bg-[#7fe7f0]/10 text-[#7fe7f0]">
                    <Activity className="w-4 h-4" />
                   </div>
                   <p className="text-[13px] text-white/80 leading-relaxed font-medium">Herstelvermogen na VO2-max intervallen toont snelle verbetering.</p>
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-[#070d16]/90 backdrop-blur-xl border-t border-white/5 px-6 flex justify-between items-start pt-4 z-50">
        {[
          { icon: Home, label: 'Vandaag' },
          { icon: Calendar, label: 'Plan' },
          { icon: Bike, label: 'Rijden' },
          { icon: BarChart2, label: 'Analyse', active: true },
          { icon: MoreHorizontal, label: 'Meer' }
        ].map(item => (
          <div key={item.label} className={`flex flex-col items-center gap-1.5 ${item.active ? 'text-[#7fe7f0]' : 'text-white/40'}`}>
            <item.icon className={`w-[22px] h-[22px] ${item.active ? 'opacity-100' : 'opacity-80'}`} />
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
          </div>
        ))}
      </div>
      
    </div>
  );
}
