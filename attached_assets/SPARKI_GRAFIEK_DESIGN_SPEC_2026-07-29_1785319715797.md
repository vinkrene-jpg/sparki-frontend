# Sparki — Design-spec: grafieken & tabellen (Analyse-pagina)

**Doel:** de huidige Analyse/Belasting-weergave (dunne lijnen, lichtgrijze tekst, matte kleuren) optrekken naar het niveau van professionele coaching-apps (TrainingPeaks, WHOOP). Dit is een **specificatie**, geen build-vrijgave — implementatie loopt via de normale Master Plan-governance.

---

## 1. Kleur — design tokens

### Tekst
| Token | Hex | Gebruik |
|---|---|---|
| `--text-primary` | `#0F172A` | Labels, kaarttitels, waarden (was lichtgrijs) |
| `--text-secondary` | `#475569` | Subtekst, toelichting (nog steeds leesbaar, niet "vaag") |
| `--text-muted` | `#94A3B8` | Alleen voor echt secundaire info, spaarzaam gebruiken |

### Grafiek — lijnen
| Token | Hex | Gebruik |
|---|---|---|
| `--chart-ctl` | `#2563EB` | CTL / fitheid — verzadigd blauw (was lichtblauw) |
| `--chart-ctl-fill` | `#2563EB` @ 12% opacity | Area-fill onder CTL-lijn |
| `--chart-atl` | `#EA580C` | ATL / vermoeidheid — verzadigd oranje-rood (was pastel oranje) |
| `--chart-negative` | `#DC2626` | TSB-balken sterk negatief |
| `--chart-negative-light` | `#FCA5A5` | TSB-balken licht negatief |
| `--chart-positive` | `#16A34A` | TSB-balken positief |
| `--chart-grid` | `#E2E8F0` | Gridlijnen, subtiel maar zichtbaar |

### Kaarten
| Token | Waarde | Gebruik |
|---|---|---|
| `--card-shadow` | `0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)` | Vervangt de dunne gekleurde randjes |
| `--card-border` | geen border, of `1px solid #F1F5F9` als scheiding nodig is | — |
| `--card-radius` | `12px` | Consistente afronding |

---

## 2. Typografie

| Element | Font-weight | Grootte | Kleur |
|---|---|---|---|
| Kaart-label (bijv. "BELASTING") | 600 | 11px, uppercase, letter-spacing 0.05em | `--text-secondary` |
| Kern-waarde (bijv. "6 CTL") | 700 | 24–28px | `--text-primary` |
| Subwaarde (bijv. "vermoeidheid 8") | 500 | 13px | `--text-secondary` |
| Grafiektitel (bijv. "Fitheid & Vermoeidheid") | 600 | 15px | `--text-primary` |
| As-labels / datums | 400 | 11px | `--text-secondary` (niet `--text-muted`) |

---

## 3. Lijngrafieken (CTL/ATL, HRV, Readiness)

- **Lijndikte:** 2.5–3px (was ~1px)
- **Area-fill:** onder de CTL-lijn een lichte fill (12% opacity van de lijnkleur) — maakt trend in één oogopslag leesbaar
- **ATL-lijn:** i.p.v. stippellijn → een gevulde band of een dikkere doorgetrokken lijn in `--chart-atl`; als dash toch gewenst is: vaste dash-lengte `6px 4px`, geen "slordige" losse stippen
- **Punten op datapunten:** kleine dot (4px) alleen op hover/tap, niet permanent zichtbaar (voorkomt visuele ruis)
- **Gridlijnen:** horizontaal alleen, `--chart-grid`, 1px, geen verticale gridlines tenzij het een "vergelijk"-modus is
- **Tooltip on hover:** donkere achtergrond (`#0F172A`), witte tekst, toont exacte waarde + datum

## 4. Balkgrafieken (Vorm/TSB, Trainingsvolume)

- **Balkbreedte:** minimaal 60% van de beschikbare ruimte per dag/week (geen dunne streepjes)
- **Kleurgradatie naar intensiteit:** licht → donker naarmate de waarde verder van 0 afligt (zie tabel kleur hierboven)
- **Rounded top:** 2px radius bovenaan de balk voor een moderne look

## 5. Kaarten / layout

- Shadow i.p.v. gekleurde border (zie token hierboven)
- Witruimte tussen kaarten: minimaal 16px
- Micro-copy (bijv. "7 van 7 sessies met belastingsc...") **niet** standaard zichtbaar — alleen via een info-icoon/tooltip on-hover, om visuele "ruis" te verminderen
- Primaire waarde altijd linksboven in de kaart, groot en donker; context/subtekst eronder, kleiner

## 6. Tabellen (voor Overzicht/Sessies-secties)

- Header-rij: `--text-primary`, font-weight 600, lichte achtergrond `#F8FAFC`
- Rijen: alternerend geen zebra-striping nodig als er voldoende rij-hoogte is (min. 44px per rij, mobiel-vriendelijk)
- Numerieke kolommen: rechts uitgelijnd, tabular-nums font-feature voor nette decimalen
- Statuslabels (bijv. "Beperkt", "Neutraal"): als kleine gekleurde pill/badge i.p.v. losse gekleurde tekst — geeft meer "app"-gevoel dan "document"-gevoel

---

## 7. Referentie

Geïnspireerd op de visuele taal van TrainingPeaks (Performance Management Chart: dikke lijnen, duidelijke area-fills) en WHOOP (hoog contrast, donkere/vette tekst voor kernwaarden, kleur als functioneel signaal, niet decoratie).

---

*Status: kandidaat-spec, ter beoordeling. Nog geen build-autorisatie — volgt normale Master Plan-governance (addendum/toevoeging aan v3.00 na akkoord).*
