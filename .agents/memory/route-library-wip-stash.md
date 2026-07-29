---
name: Vreemde WIP vervuilt task-commits
description: De completion-commit veegt de HELE werkboom mee; losse, taakvreemde wijzigingen leiden tot code-review-afwijzingen.
---

De completion-review en auto-commit nemen de VOLLEDIGE werkboom mee, niet alleen de bestanden die jij bewerkte. Taakvreemde, niet-gecommitte wijzigingen (van eerdere sessies of andere experimenten) belanden dan in jouw taak-diff en veroorzaken afwijzingen.

**Why:** dit gebeurde eerder toen onafgemaakt routebibliotheek/plan-wizard-werk in de werkboom bleef staan en herhaaldelijk in andermans completion-commit werd meegeveegd.

**How to apply:** vóór `markTaskComplete` altijd `git status` controleren. Staan er taakvreemde wijzigingen: alleen je eigen taakbestanden committen en de rest stashen (`git stash -u`, met duidelijke omschrijving). Let op: zo'n stash kan verouderd raken t.o.v. latere merges — voorzichtig rebasen bij het poppen. (De destijds gestashte routebibliotheek-WIP is inmiddels via eigen taken gemerged.)
