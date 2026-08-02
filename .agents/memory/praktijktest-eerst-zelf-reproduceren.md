---
name: Praktijktest-klachten eerst zelf reproduceren
description: Bij "het werkt niet" van René nooit beginnen met gebruikersinstructies (cache legen, opnieuw openen); eerst zelf reproduceren met eigen middelen.
---

**Regel:** Als René meldt dat iets niet werkt, is de EERSTE stap altijd zelf reproduceren met eigen middelen (Playwright + nix-chromium tegen de echte URL, testaccount via Clerk Backend API, log-inspectie op verzoekniveau). Pas als eigen reproductie slaagt waar het bij hem faalt, mogen gebruikersinstructies volgen — en dan mét een objectief controlepunt ("zie je X, dan zit je goed").

**Why:** Terugkerend patroon (o.a. FPS Connect, mobiele login 02-08-2026): meerdere beurten "sluit de app helemaal af / cache / andere link"-instructies terwijl de echte oorzaak een defect aan onze kant was (Clerk ging stil `needs_client_trust` vereisen; custom sign-in kende die status niet → eeuwige spinner zonder foutmelding). Kost René veel tijd en vertrouwen; "geen foutmelding + geen verzoek in de logs" betekent vrijwel altijd een client-side defect dat wij kunnen naspelen.

**How to apply:** Bij elke klacht zonder foutmelding: (1) check logs of het verzoek ons überhaupt bereikt; (2) speel de exacte flow zelf na (testgebruiker aanmaken kan via Clerk Backend API, daarna opruimen); (3) noem daarna pas eventuele stappen voor René, altijd met verifieerbaar controlepunt. Verwar de browser-voorproef van de Expo-app nooit met Expo Go — platform-gates (`Platform.OS !== "web"`) maken dat "ik zie geen verschil" daar terecht is.
