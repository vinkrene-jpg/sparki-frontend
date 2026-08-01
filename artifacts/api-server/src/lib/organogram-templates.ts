// TEAM_ONBOARDING_01 — organogram-kaarten (bindende regels besluitendoc §3):
// - kaarten tonen uitsluitend rollen die server-side bestaan (clubRoles);
// - een kaart maakt uitsluitend een CONCEPTstructuur (selecties + stafplekken)
//   en leidt NOOIT rechten af;
// - een kaart bevat rolplekken, geen voorbeeldpersonen of mocknamen;
// - toepassen is additief en idempotent — nooit destructief, bestaande
//   personen, rollen en selecties verdwijnen nooit.

import { clubRoles, type ClubRole, type MedicalSpecialty } from "@workspace/db";

export type OrganogramStafSlot = {
  role: ClubRole;
  aantal: number;
  medicalSpecialty?: MedicalSpecialty;
};

export type OrganogramTemplate = {
  key: string;
  naam: string;
  beschrijving: string;
  selecties: string[];
  staf: OrganogramStafSlot[];
};

export const ORGANOGRAM_TEMPLATES: OrganogramTemplate[] = [
  {
    key: "compact_wedstrijdteam",
    naam: "Compact wedstrijdteam",
    beschrijving:
      "Eén wedstrijdselectie met een kleine vaste staf. Geschikt voor een team dat met één groep renners koerst.",
    selecties: ["Wedstrijdselectie"],
    staf: [
      { role: "teammanager", aantal: 1 },
      { role: "ploegleider", aantal: 1 },
      { role: "mechanieker", aantal: 1 },
      { role: "soigneur", aantal: 1 },
    ],
  },
  {
    key: "prestatieploeg",
    naam: "Prestatieploeg",
    beschrijving:
      "Hoofdselectie plus development-selectie, met trainer en medische staf naast de wegstaf.",
    selecties: ["Hoofdselectie", "Development"],
    staf: [
      { role: "teammanager", aantal: 1 },
      { role: "ploegleider", aantal: 2 },
      { role: "trainer", aantal: 1 },
      { role: "mechanieker", aantal: 1 },
      { role: "soigneur", aantal: 2 },
      { role: "medical_staff", aantal: 1 },
    ],
  },
  {
    key: "etappe_koersorganisatie",
    naam: "Etappe-/koersorganisatie",
    beschrijving:
      "Bezetting voor meerdaagse koersen: meerdere ploegleiders, dubbele materiaal- en verzorgingsstaf en een arts.",
    selecties: ["Wedstrijdselectie"],
    staf: [
      { role: "teammanager", aantal: 1 },
      { role: "ploegleider", aantal: 3 },
      { role: "mechanieker", aantal: 2 },
      { role: "soigneur", aantal: 3 },
      { role: "medical_staff", aantal: 1, medicalSpecialty: "arts" },
    ],
  },
  {
    key: "zelf_samenstellen",
    naam: "Zelf samenstellen",
    beschrijving:
      "Start zonder voorgestelde structuur en bouw selecties en stafplekken volledig zelf op.",
    selecties: [],
    staf: [],
  },
];

export function getOrganogramTemplate(key: string): OrganogramTemplate | null {
  return ORGANOGRAM_TEMPLATES.find((t) => t.key === key) ?? null;
}

// Zelfcontrole (fail-closed bij toekomstige wijzigingen): elke kaart mag
// uitsluitend bestaande server-side rollen bevatten.
for (const t of ORGANOGRAM_TEMPLATES) {
  for (const s of t.staf) {
    if (!clubRoles.includes(s.role)) {
      throw new Error(`Organogram-kaart ${t.key} bevat onbekende rol: ${s.role}`);
    }
  }
}
