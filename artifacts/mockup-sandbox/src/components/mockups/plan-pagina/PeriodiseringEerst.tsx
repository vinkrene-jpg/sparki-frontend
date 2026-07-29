import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Session {
  name: string;
  blocks: string;
  goal: string;
  tss: number;
  zones?: string;
}

interface Day {
  date: number;
  type: 'training' | 'rest' | 'unplanned';
  session?: Session;
  restReason?: string;
  isToday?: boolean;
  isPeak?: boolean;
}

interface Week {
  weekNumber: number;
  phase: 'opbouw' | 'belasting' | 'piek' | 'taper';
  volume: number; // 0-100
  days: Day[];
}

const DEMO_WEEKS: Week[] = [
  {
    weekNumber: 1,
    phase: 'opbouw',
    volume: 55,
    days: [
      { date: 1, type: 'rest', restReason: 'Hersteldag na vorige week' },
      { date: 2, type: 'training', session: { name: 'Duurrit Z2', blocks: '90 min Z2', goal: 'bouwt aerobe basis op', tss: 62 } },
      { date: 3, type: 'training', session: { name: 'Tempo Z3', blocks: '15 min Z2 · 3×12 min Z3 · 10 min Z2', goal: 'verhoogt drempeltoleratie', tss: 71 } },
      { date: 4, type: 'rest', restReason: 'Gepland herstel midden in de week' },
      { date: 5, type: 'training', session: { name: 'Intervallen Z4', blocks: '20 min Z2 · 4×6 min Z4 · 15 min Z2', goal: 'bouwt FTP-tolerantie op', tss: 68 } },
      { date: 6, type: 'training', session: { name: 'Lange duurrit', blocks: '2u30 Z2', goal: 'vergroot uithoudingsvermogen', tss: 98 } },
      { date: 7, type: 'rest', restReason: 'Weekendherstel' },
    ]
  },
  {
    weekNumber: 2,
    phase: 'belasting',
    volume: 78,
    days: [
      { date: 8, type: 'training', session: { name: 'Herstelrit Z1', blocks: '45 min Z1', goal: 'actief herstel', tss: 28 } },
      { date: 9, type: 'training', session: { name: 'Sweet Spot', blocks: '15 min Z2 · 3×15 min Z3+ · 10 min Z2', goal: 'verhoogt FTP-basis', tss: 84 } },
      { date: 10, type: 'training', session: { name: 'Intervallen 4×8 Z4', blocks: '20 min Z2 · 4×8 min Z4 · 15 min Z2', goal: 'bouwt FTP-tolerantie op richting de 285W-test', tss: 78, zones: '4×8 min Z4' }, isToday: true },
      { date: 11, type: 'rest', restReason: 'Herstel na intensieve intervaltraining' },
      { date: 12, type: 'training', session: { name: 'Tempo Long', blocks: '20 min Z2 · 40 min Z3 · 15 min Z2', goal: 'combineert duur met intensiteit', tss: 92 } },
      { date: 13, type: 'training', session: { name: 'Duurrit Z2 2u', blocks: '2u Z2', goal: 'ondersteunt volume in belastingweek', tss: 88 } },
      { date: 14, type: 'rest', restReason: 'Weekendherstel na zware belastingweek' },
    ]
  },
  {
    weekNumber: 3,
    phase: 'piek',
    volume: 82,
    days: [
      { date: 15, type: 'training', session: { name: 'Herstelrit Z1', blocks: '45 min Z1', goal: 'actief herstel', tss: 28 } },
      { date: 16, type: 'training', session: { name: 'VO₂max 5×5', blocks: '20 min Z2 · 5×5 min Z5 · 15 min Z2', goal: 'maximaliseert aerobe capaciteit', tss: 86 } },
      { date: 17, type: 'training', session: { name: 'Race Simulation', blocks: '15 min Z2 · 60 min variabel Z3-Z4 · 10 min Z2', goal: 'simuleert wedstrijdomstandigheden', tss: 94 } },
      { date: 18, type: 'rest', restReason: 'Cruciaal herstel in piekweek' },
      { date: 19, type: 'unplanned', isPeak: true },
      { date: 20, type: 'training', session: { name: 'FTP Test Prep', blocks: '20 min Z2 · 3×3 min Z4 · 15 min Z2', goal: 'bereidt voor op test zonder uitputting', tss: 58 } },
      { date: 21, type: 'rest', restReason: 'Rust voor piekweek finaliseert herstel' },
    ]
  },
  {
    weekNumber: 4,
    phase: 'taper',
    volume: 45,
    days: [
      { date: 22, type: 'rest', restReason: 'Taperweek — maximaal herstel voor FTP-test' },
      { date: 23, type: 'training', session: { name: 'Opener', blocks: '15 min Z2 · 3×90s Z4 · 10 min Z1', goal: 'houdt systeem wakker', tss: 32 } },
      { date: 24, type: 'rest', restReason: 'Onderdeel van taperweek. Herstel na de lange duurrit van gisteren' },
      { date: 25, type: 'training', session: { name: 'FTP Test', blocks: '20 min Z2 · 20 min ALL-OUT · 10 min Z1', goal: 'bepaalt nieuwe FTP naar 285W', tss: 78 } },
      { date: 26, type: 'rest', restReason: 'Volledig herstel na test' },
      { date: 27, type: 'training', session: { name: 'Recovery Spin', blocks: '30 min Z1', goal: 'actief herstel', tss: 18 } },
      { date: 28, type: 'rest', restReason: 'Afsluiting taperweek' },
    ]
  },
];

const PHASE_CONFIG = {
  opbouw: { label: 'Opbouw', color: 'bg-blue-500/20 border-blue-500/40', textColor: 'text-blue-400' },
  belasting: { label: 'Belasting', color: 'bg-purple-500/20 border-purple-500/40', textColor: 'text-purple-400' },
  piek: { label: 'Piek', color: 'bg-amber-500/20 border-amber-500/40', textColor: 'text-amber-400' },
  taper: { label: 'Taper', color: 'bg-emerald-500/20 border-emerald-500/40', textColor: 'text-emerald-400' },
};

export function PeriodiseringEerst() {
  const [selectedDay, setSelectedDay] = useState<Day>(DEMO_WEEKS[1].days[2]); // Today (10th)

  return (
    <div className="min-h-screen bg-[#05080f] text-slate-100 p-8">
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Header met doel */}
        <Card className="bg-slate-900/40 border-slate-800/60 backdrop-blur-sm p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-50">FTP naar 285W</h1>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Op koers
                </Badge>
              </div>
              <p className="text-sm text-slate-400">FTP-test · 1 oktober · Week 3 van 4 (piekfase)</p>
            </div>
            <div className="text-right space-y-1">
              <div className="text-2xl font-semibold text-sky-400">CTL 45</div>
              <div className="text-xs text-emerald-400">+10 in 28 dagen</div>
            </div>
          </div>
        </Card>

        {/* Main layout: Calendar + Detail Panel */}
        <div className="grid grid-cols-[1fr,380px] gap-6">
          {/* Calendar */}
          <Card className="bg-slate-900/40 border-slate-800/60 backdrop-blur-sm p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-medium text-slate-50">Trainingskalender</h2>
                <span className="text-sm text-slate-500 ml-2">September 2024</span>
              </div>

              {/* Week headers */}
              <div className="grid grid-cols-[60px,repeat(7,1fr)] gap-2 text-xs text-slate-500 font-medium mb-2">
                <div></div>
                <div className="text-center">Ma</div>
                <div className="text-center">Di</div>
                <div className="text-center">Wo</div>
                <div className="text-center">Do</div>
                <div className="text-center">Vr</div>
                <div className="text-center">Za</div>
                <div className="text-center">Zo</div>
              </div>

              {/* Weeks */}
              <div className="space-y-1">
                {DEMO_WEEKS.map((week, weekIdx) => (
                  <React.Fragment key={week.weekNumber}>
                    {/* Phase transition marker */}
                    {weekIdx > 0 && DEMO_WEEKS[weekIdx - 1].phase !== week.phase && (
                      <div className="relative h-8 flex items-center my-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-700/60"></div>
                        </div>
                        <div className="relative px-3 bg-[#05080f]">
                          <span className={`text-xs font-medium ${PHASE_CONFIG[week.phase].textColor}`}>
                            → {PHASE_CONFIG[week.phase].label}fase
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-[60px,repeat(7,1fr)] gap-2">
                      {/* Week indicator */}
                      <div className="flex flex-col items-center justify-start pt-2 gap-2">
                        <div className={`text-[10px] font-medium px-2 py-1 rounded border ${PHASE_CONFIG[week.phase].color} ${PHASE_CONFIG[week.phase].textColor}`}>
                          W{week.weekNumber}
                        </div>
                        <div className="w-2 h-16 rounded-full bg-slate-800 overflow-hidden">
                          <div 
                            className={`w-full transition-all ${
                              week.phase === 'opbouw' ? 'bg-blue-500' :
                              week.phase === 'belasting' ? 'bg-purple-500' :
                              week.phase === 'piek' ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ height: `${week.volume}%` }}
                          />
                        </div>
                      </div>

                      {/* Days */}
                      {week.days.map((day, dayIdx) => (
                        <button
                          key={dayIdx}
                          onClick={() => setSelectedDay(day)}
                          className={`
                            min-h-[88px] p-2 rounded-lg border transition-all text-left
                            ${day.isToday ? 'ring-2 ring-sky-500/60 border-sky-500/40 bg-sky-500/5' :
                              day.type === 'unplanned' && day.isPeak ? 'border-amber-500/60 bg-amber-500/5' :
                              day.type === 'training' ? 'border-slate-700/60 bg-slate-800/30 hover:bg-slate-800/50' :
                              'border-slate-800/40 bg-slate-900/20 hover:bg-slate-800/30'}
                            ${selectedDay === day ? 'ring-2 ring-slate-500/60' : ''}
                          `}
                        >
                          <div className="flex flex-col gap-1 h-full">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${day.isToday ? 'text-sky-400' : 'text-slate-300'}`}>
                                {day.date}
                              </span>
                              {day.type === 'training' && (
                                <Activity className="w-3 h-3 text-sky-400" />
                              )}
                            </div>
                            <div className="text-[10px] leading-tight">
                              {day.type === 'training' && day.session && (
                                <>
                                  <div className="font-medium text-slate-200 mb-0.5">{day.session.name}</div>
                                  <div className="text-slate-500">{day.session.zones || day.session.blocks.split('·')[0].trim()}</div>
                                </>
                              )}
                              {day.type === 'rest' && (
                                <div className="text-slate-500 italic">Rustdag</div>
                              )}
                              {day.type === 'unplanned' && (
                                <div className="text-amber-400 flex items-start gap-1">
                                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span>Nog niet ingepland</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </Card>

          {/* Detail Panel */}
          <div className="space-y-4">
            {/* Selected Day Detail */}
            <Card className="bg-slate-900/40 border-slate-800/60 backdrop-blur-sm p-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">
                      {selectedDay.isToday ? 'Vandaag' : `${selectedDay.date} september`}
                    </div>
                    {selectedDay.type === 'training' && selectedDay.session && (
                      <h3 className="text-lg font-semibold text-slate-50">{selectedDay.session.name}</h3>
                    )}
                    {selectedDay.type === 'rest' && (
                      <h3 className="text-lg font-semibold text-slate-50">Rustdag</h3>
                    )}
                    {selectedDay.type === 'unplanned' && (
                      <h3 className="text-lg font-semibold text-amber-400">Nog niet ingepland</h3>
                    )}
                  </div>
                  {selectedDay.type === 'training' && selectedDay.session && (
                    <Badge variant="outline" className="border-sky-500/40 text-sky-400 bg-sky-500/10">
                      TSS {selectedDay.session.tss}
                    </Badge>
                  )}
                </div>

                {selectedDay.type === 'training' && selectedDay.session && (
                  <div className="space-y-3">
                    {/* Blocks */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Structuur</div>
                      <div className="space-y-1">
                        {selectedDay.session.blocks.split('·').map((block, idx) => (
                          <div key={idx} className="text-sm text-slate-300 flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-sky-500/60"></div>
                            {block.trim()}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Goal */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Doel</div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Deze training {selectedDay.session.goal}.
                      </p>
                    </div>
                  </div>
                )}

                {selectedDay.type === 'rest' && selectedDay.restReason && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Reden</div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedDay.restReason}
                    </p>
                  </div>
                )}

                {selectedDay.type === 'unplanned' && selectedDay.isPeak && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-amber-300 leading-relaxed">
                        Dit gat in je piekweek wijkt af van het schema. Voeg een training toe of markeer als rustdag.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Development Graph */}
            <Card className="bg-slate-900/40 border-slate-800/60 backdrop-blur-sm p-5">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-50">Je ontwikkeling</h3>
                </div>

                {/* Simple CTL sparkline */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-1 h-16">
                    {[28, 30, 32, 33, 35, 37, 38, 40, 42, 43, 45].map((value, idx) => (
                      <div key={idx} className="flex-1 flex items-end">
                        <div 
                          className="w-full bg-gradient-to-t from-emerald-500/80 to-emerald-500/40 rounded-t"
                          style={{ height: `${(value / 50) * 100}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>4 weken geleden</span>
                    <span>Vandaag</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    Je fitheid bouwt volgens schema op voor de FTP-test van 1 oktober.
                  </p>
                </div>

                <div className="text-xs text-slate-400">
                  CTL 35 → 45 (+10 in 28 dagen)
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Automatic Insights */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-slate-900/40 border-slate-800/60 backdrop-blur-sm p-5">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-medium text-slate-200">Wat over tijd opvalt</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Je hersteltijd na intervaltrainingen is de laatste 3 weken opgelopen. Dit valt samen met een dalende TSB. Overweeg een extra rustdag deze week.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/60 backdrop-blur-sm p-5">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-sky-400" />
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-medium text-slate-200">Voortgang verbanden</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Nog 4 trainingen nodig voor een betrouwbaar slaap/herstel-verband. Continue zoals je bezig bent.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
