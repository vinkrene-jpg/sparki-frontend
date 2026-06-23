// Sparki's phrase library. Authored deterministic Dutch lines, grouped per event
// and per tone. Slots: {sport} (sport flavour), {memory} (relational reference).
//
// Rules baked into the data:
//  - `empathy: true` events lead with care and NEVER carry humor.
//  - `safetyCheck` is prepended for events where wellbeing comes first (a fall).
//  - `needsMemory` / `openLoop` events refuse to fire without real input/evidence.
//  - Every string here is plain Dutch. No "AI", no English tech-jargon.

import type { VoiceEvent, VoiceTone } from "./types";

export type EventConfig = {
  empathy: boolean;
  safetyCheck?: string;
  defaultTone: VoiceTone;
  needsMemory?: boolean;
  openLoop?: boolean;
  lines: Partial<Record<VoiceTone, string[]>>;
};

// Sport flavour fragments. "general" → empty, cleaned away by fillSlots.
export const SPORT_NOUN: Record<string, string> = {
  wielrennen: "op de fiets",
  mtb: "in het bos",
  veldrijden: "in de cross",
  baan: "op de baan",
  gravel: "op het grind",
  general: "",
};

export const EVENTS: Record<VoiceEvent, EventConfig> = {
  greeting: {
    empathy: false,
    defaultTone: "observer",
    lines: {
      observer: ["Daar ben je weer.", "Je bent er weer.", "Welkom terug."],
      curious: ["Benieuwd wat vandaag laat zien.", "Eens kijken wat vandaag brengt."],
      dry_humor: ["Ah, je leeft nog.", "Ik had je later verwacht."],
      cynical: ["Ook goedemorgen.", "Verwachtingen laag. Verras me."],
      supportive: ["Fijn dat je er bent.", "Goed je weer te zien."],
    },
  },

  good_form: {
    empathy: false,
    defaultTone: "observer",
    lines: {
      observer: ["Je vorm loopt netjes op {sport}.", "De cijfers zien er stevig uit."],
      curious: ["Ik vraag me af hoe ver dit gaat.", "Hier zit meer in, denk ik."],
      dry_humor: ["Ik had kritiek voorbereid. Kan weg.", "Je fiets mag voorlopig blijven."],
      cynical: ["Dat escaleerde positiever dan verwacht.", "Mijn verwachtingen waren lager."],
      supportive: ["Mooi werk, dit mag je voelen.", "Precies de goede kant op."],
    },
  },

  improvement: {
    empathy: false,
    defaultTone: "observer",
    lines: {
      observer: ["Sinds vorige maand ben je gegroeid.", "Er zit duidelijk progressie in."],
      curious: ["Ik heb een theorie waarom dit werkt.", "Eén ding wil ik nog uitzoeken."],
      dry_humor: ["Niet slecht. Voor jouw doen.", "Ik raak bijna onder de indruk."],
      cynical: ["Toegegeven: beter dan ik dacht.", "Dat had ik niet zien aankomen."],
      supportive: ["Je werk betaalt zich uit.", "Dit is verdiend."],
    },
  },

  plateau: {
    empathy: false,
    defaultTone: "curious",
    lines: {
      observer: ["Je zit al even op hetzelfde niveau.", "De lijn is vlak de laatste weken."],
      curious: ["Ik twijfel tussen twee verklaringen.", "Ik mis nog één puzzelstuk."],
      dry_humor: ["Spannend is anders. Maar prima.", "De grafiek doet een dutje."],
      supportive: ["Een vlakke periode hoort erbij.", "Geen zorgen, dit trekt bij."],
    },
  },

  rest_day: {
    empathy: false,
    defaultTone: "observer",
    lines: {
      observer: ["Vandaag staat op rust.", "Rustdag vandaag."],
      curious: ["Benieuwd hoe de benen morgen voelen."],
      dry_humor: ["Niksen is ook trainen. Min of meer.", "De zwaarste oefening: stilzitten."],
      supportive: ["Goed dat je rust pakt.", "Herstel doet vandaag het werk."],
    },
  },

  streak: {
    empathy: false,
    defaultTone: "observer",
    lines: {
      observer: ["Mooie reeks aan het opbouwen.", "Je bent lekker consistent bezig."],
      curious: ["Benieuwd hoe lang je dit volhoudt."],
      dry_humor: ["Je maakt er een gewoonte van. Eng.", "Consistentie. Wie ben jij?"],
      cynical: ["Volhouden is het echte werk. Maar knap."],
      supportive: ["Consistentie is je grootste wapen.", "Zo werkt vooruitgang."],
    },
  },

  missed_training: {
    empathy: false,
    defaultTone: "observer",
    lines: {
      observer: ["Een dag overgeslagen, zie ik.", "Gisteren geen training."],
      dry_humor: ["De bank heeft ook gewonnen, soms.", "Rust is ook een wapen, zeggen ze."],
      supportive: ["Eén gemiste dag is niks. Echt.", "Morgen weer een kans."],
    },
  },

  race_upcoming: {
    empathy: false,
    defaultTone: "observer",
    lines: {
      observer: ["Je koers komt eraan {sport}.", "Nog even tot je wedstrijd."],
      curious: ["Benieuwd hoe je dit aanpakt.", "Ik heb er een goed gevoel over."],
      dry_humor: ["Tijd om de benen te laten zien.", "Geen druk. Behalve dan een beetje."],
      supportive: ["Je bent er klaar voor.", "Vertrouw op je werk."],
    },
  },

  race_done_good: {
    empathy: false,
    defaultTone: "observer",
    lines: {
      observer: ["Sterke koers gereden.", "Dat zag er solide uit."],
      curious: ["Ik wil weten waar dit vandaan kwam."],
      dry_humor: ["Ik had kritiek voorbereid. Kan weg.", "Knap. Zeg ik niet vaak."],
      cynical: ["Dat escaleerde positiever dan verwacht."],
      supportive: ["Dik verdiend, dit.", "Geniet er even van."],
    },
  },

  race_done_bad: {
    empathy: true,
    defaultTone: "supportive",
    lines: {
      supportive: [
        "Niet de dag waarop je gehoopt had.",
        "Zullen we kijken wat wél goed ging?",
        "Baal ervan, logisch. Morgen weer.",
      ],
    },
  },

  setback: {
    empathy: true,
    defaultTone: "supportive",
    lines: {
      supportive: [
        "Niet de dag waarop je gehoopt had.",
        "Zullen we kijken wat wél goed ging?",
        "Het hoort erbij, hoe rot ook.",
      ],
    },
  },

  fall: {
    empathy: true,
    safetyCheck: "Alles oké?",
    defaultTone: "supportive",
    lines: {
      supportive: [
        "Neem even rust, geen haast.",
        "Laat het lichaam eerst bijkomen.",
        "De rest komt later wel.",
      ],
    },
  },

  illness: {
    empathy: true,
    defaultTone: "supportive",
    lines: {
      supportive: [
        "Uitzieken eerst, de rest komt later.",
        "Rust nu, trainen kan wachten.",
        "Beter worden is nu de training.",
      ],
    },
  },

  injury: {
    empathy: true,
    defaultTone: "supportive",
    lines: {
      supportive: [
        "Geef het de tijd die het nodig heeft.",
        "Voorzichtig opbouwen, niet forceren.",
        "Eén stap per keer.",
      ],
    },
  },

  memory_followup: {
    empathy: false,
    needsMemory: true,
    defaultTone: "curious",
    lines: {
      curious: [
        "Je had {memory} toch? Hoe ging dat eigenlijk?",
        "Je zei laatst iets over {memory}. En, hoe liep het af?",
      ],
      observer: ["Ik moest nog denken aan {memory}. Hoe is dat gegaan?"],
      supportive: ["Je had {memory} — ik hoop dat het meeviel. Vertel?"],
    },
  },

  equipment_change: {
    empathy: false,
    defaultTone: "curious",
    lines: {
      observer: ["Je materiaal is gewijzigd, zie ik."],
      curious: ["Je veranderde iets aan je materiaal. Bevalt het?", "Nieuw aan de fiets — al verschil gemerkt?"],
      dry_humor: ["Je fiets mag voorlopig blijven.", "Nieuw materiaal lost niet alles op. Helpt soms wel."],
      supportive: ["Hopelijk rijdt het zo lekkerder."],
    },
  },

  pattern_found: {
    empathy: false,
    openLoop: true,
    defaultTone: "curious",
    lines: {
      curious: [
        "Ik heb iets gevonden.",
        "Ik zag een patroon.",
        "Ik denk dat ik je begin te begrijpen.",
        "Ik twijfel tussen twee verklaringen.",
      ],
      observer: ["Iets in je cijfers viel me op.", "Daar wil ik nog eens naar kijken."],
    },
  },
};
