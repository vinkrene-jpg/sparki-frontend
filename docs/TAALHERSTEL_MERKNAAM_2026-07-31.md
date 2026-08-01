# Taalherstel — merknaam uit UI-zinnen (31-07-2026)

Hoofdregel doorgevoerd: de interface spreekt rechtstreeks over actie/uitleg/analyse/uitkomst en verwijst niet in de derde persoon naar zichzelf. 121 bestanden, 379 gewijzigde regels.

Bewaking: `node scripts/check-brand-copy.mjs` (onderdeel van de typecheck-api-validatieketen) detecteert voortaan derde-persoons merkvermeldingen in UI-copy; bewuste uitzonderingen staan mét reden in `scripts/brand-copy-allowlist.json` (productnamen Sparki Go/Compleet, appnaam, juridische teksten, formele e-mails, organisatie-als-geheel, promptidentiteit, testbestanden).

## Alle gewijzigde teksten (oud → nieuw per vindplaats)

```diff

=== artifacts/api-server/src/engines/context-memory/detect.ts
-      `Je vertelde dat school of een toets in de weg zat${p}. Sparki onthoudt dit en vraagt er later naar.`,
+      `Je vertelde dat school of een toets in de weg zat${p}. Dit wordt onthouden; er wordt later naar gevraagd.`,
-      `Je hebt een wedstrijd${p}. Sparki houdt dit in de gaten en vraagt er na afloop naar.`,
+      `Je hebt een wedstrijd${p}. Dit wordt in de gaten gehouden; er wordt na afloop naar gevraagd.`,
-      `Je gaf aan je ziek of niet lekker te voelen${p}. Sparki vraagt later of je weer opgeknapt bent.`,
+      `Je gaf aan je ziek of niet lekker te voelen${p}. Er wordt later gevraagd of je weer opgeknapt bent.`,
-      `Je gaf aan last te hebben van een blessure of pijn${p}. Sparki vraagt later hoe je eerste training weer ging.`,
+      `Je gaf aan last te hebben van een blessure of pijn${p}. Er wordt later gevraagd hoe je eerste training weer ging.`,
-      `Werk zat je trainen in de weg${p}. Sparki onthoudt dit en vraagt later of er weer ruimte is.`,
+      `Werk zat je trainen in de weg${p}. Dit wordt onthouden; er wordt later gevraagd of er weer ruimte is.`,
-      `Er speelde iets in de familie of thuis${p}. Sparki onthoudt dit voorzichtig en vraagt er later rustig naar.`,
+      `Er speelde iets in de familie of thuis${p}. Dit wordt voorzichtig onthouden; er wordt later rustig naar gevraagd.`,
-      `Je sliep slecht${p}. Sparki checkt later of het beter gaat.`,
+      `Je sliep slecht${p}. Er wordt later gecheckt of het beter gaat.`,
-      `Je voelde spanning of stress${p}. Sparki checkt later rustig of het wat is gezakt.`,
+      `Je voelde spanning of stress${p}. Er wordt later rustig gecheckt of het wat is gezakt.`,
-      `Je had even weinig zin of motivatie${p}. Sparki onthoudt dit en vraagt er later rustig naar.`,
+      `Je had even weinig zin of motivatie${p}. Dit wordt onthouden; er wordt later rustig naar gevraagd.`,
-    detail: (p) => `Je bent of gaat op trainingskamp of vakantie${p}. Sparki vraagt er na afloop naar.`,
+    detail: (p) => `Je bent of gaat op trainingskamp of vakantie${p}. Er wordt na afloop naar gevraagd.`,
-      `Je hebt iets aan je materiaal veranderd${p}. Sparki vraagt later hoe het bevalt.`,
+      `Je hebt iets aan je materiaal veranderd${p}. Er wordt later gevraagd hoe het bevalt.`,
-      `Je training of herstel zat tegen${p}. Sparki vraagt later of je je weer fitter voelt.`,
+      `Je training of herstel zat tegen${p}. Er wordt later gevraagd of je je weer fitter voelt.`,

=== artifacts/api-server/src/engines/core-prediction/compare.ts
-      "Er is geen exacte belasting (TSS) vastgelegd, dus Sparki schatte je werkelijke belasting grof uit de duur van de sessie.",
+      "Er is geen exacte belasting (TSS) vastgelegd, dus je werkelijke belasting is grof geschat uit de duur van de sessie.",
-      "Voor deze sessie is geen belasting én geen duur vastgelegd, dus Sparki kan het werkelijke effect alleen ruw inschatten.",
+      "Voor deze sessie is geen belasting én geen duur vastgelegd, dus het werkelijke effect is alleen ruw in te schatten.",

=== artifacts/api-server/src/engines/core-prediction/index.ts
-          "Deze training is afgerond, maar er is nog geen rit aan gekoppeld — zodra je de sessie koppelt vergelijkt Sparki voorspeld met werkelijk.",
+          "Deze training is afgerond, maar er is nog geen rit aan gekoppeld — zodra je de sessie koppelt wordt voorspeld met werkelijk vergeleken.",

=== artifacts/api-server/src/engines/core-prediction/predict.ts
-    reading: "niet beschikbaar — weerdata is nog niet aan Sparki gekoppeld",
+    reading: "niet beschikbaar — er is nog geen weerdata gekoppeld",
-      headline: "Sparki kan het effect nog niet voorspellen",
+      headline: "Het effect is nog niet te voorspellen",
-        "Er is nog geen geplande belasting of opbouw voor deze training. Vul de belasting of de blokken in, dan voorspelt Sparki het effect op hoe je ervoor staat.",
+        "Er is nog geen geplande belasting of opbouw voor deze training. Vul de belasting of de blokken in, dan wordt het effect op hoe je ervoor staat voorspeld.",

=== artifacts/api-server/src/engines/data-hub/webhooks.ts
-            "Verwijdering op Strava — Sparki verwijdert nooit lokale trainingsdata op basis van een extern signaal.",
+            "Verwijdering op Strava — lokale trainingsdata wordt nooit verwijderd op basis van een extern signaal.",

=== artifacts/api-server/src/engines/memory-graph/correlations.ts
-    observationText: `Sparki vergeleek je slaap met hoe je trainingen voelden. Op ${shortNights.length} korte nachten was je gevoel gemiddeld ${feelShort.toFixed(1)}/5, tegenover ${feelNormal.toFixed(1)}/5 na normalere nachten. Dat is een verband, geen zekerheid — gebruik het als signaal, niet als regel.`,
+    observationText: `Je slaap is vergeleken met hoe je trainingen voelden. Op ${shortNights.length} korte nachten was je gevoel gemiddeld ${feelShort.toFixed(1)}/5, tegenover ${feelNormal.toFixed(1)}/5 na normalere nachten. Dat is een verband, geen zekerheid — gebruik het als signaal, niet als regel.`,
-    observationText: `Sparki vergeleek je ${metric.kind} in de drie dagen vóór ${metric.sample.length} afgeronde wedstrijden met je relatieve uitslag (positie binnen het deelnemersveld). In ${aligned} van de ${comparable} vergelijkbare wedstrijden viel een betere uitslag samen met beter herstel. Het is een verband, geen zekerheid — uitslagen hangen van veel meer af.`,
+    observationText: `Je ${metric.kind} in de drie dagen vóór ${metric.sample.length} afgeronde wedstrijden is vergeleken met je relatieve uitslag (positie binnen het deelnemersveld). In ${aligned} van de ${comparable} vergelijkbare wedstrijden viel een betere uitslag samen met beter herstel. Het is een verband, geen zekerheid — uitslagen hangen van veel meer af.`,

=== artifacts/api-server/src/engines/memory-graph/readiness.ts
-        "Op minimaal 4 trainingsdagen zowel een gevoel-score bij de training als slaapuren in je dagelijkse check-in. Dan kan Sparki slaap en trainingsgevoel vergelijken.",
+        "Op minimaal 4 trainingsdagen zowel een gevoel-score bij de training als slaapuren in je dagelijkse check-in. Dan kunnen slaap en trainingsgevoel vergeleken worden.",
-        "Op minimaal 6 dagen een rusthartslag of HRV. Dan kan Sparki je belasting naast je herstel leggen.",
+        "Op minimaal 6 dagen een rusthartslag of HRV. Dan kan je belasting naast je herstel gelegd worden.",

=== artifacts/api-server/src/engines/mental/index.ts
-          ? "De rit werd korter dan gepland. Dankzij wat je zelf noteerde hoeft Sparki niet te gissen of het je lichaam of je hoofd was."
+          ? "De rit werd korter dan gepland. Dankzij wat je zelf noteerde hoeft er niet gegist te worden of het je lichaam of je hoofd was."

=== artifacts/api-server/src/engines/observation/advice.ts
-      return "Hou het vandaag rustig en log je rit en gevoel; dan kan Sparki je vanaf morgen beter inschatten.";
+      return "Hou het vandaag rustig en log je rit en gevoel; dan kan ik je vanaf morgen beter inschatten.";
-      ? " Bij dit weer levert een zware buitenrit meer risico dan rendement, dus Sparki temt vandaag de intensiteit."
+      ? " Bij dit weer levert een zware buitenrit meer risico dan rendement, dus ik tem vandaag de intensiteit."
-  const watAlsHetAndersIs = `Wat als het anders is: ${alt}; daarom houdt Sparki ruimte om bij te sturen.`;
+  const watAlsHetAndersIs = `Wat als het anders is: ${alt}; daarom houd ik ruimte om bij te sturen.`;
-      return "Sparki heeft nog te weinig van je gezien om iets stevigs te zeggen.";
+      return "Ik heb nog te weinig van je gezien om iets stevigs te zeggen.";
-      return "zonder genoeg gegevens kiest Sparki bewust de veilige, rustige kant.";
+      return "zonder genoeg gegevens kies ik bewust de veilige, rustige kant.";
-      return "zodra je blessure pijnvrij is, bouwt Sparki je weer rustig op.";
+      return "zodra je blessure pijnvrij is, bouw ik je weer rustig op.";
-      return "zodra je je weer gezond voelt en je rusthartslag normaliseert, pakt Sparki de draad op.";
+      return "zodra je je weer gezond voelt en je rusthartslag normaliseert, pak ik de draad op.";

=== artifacts/api-server/src/engines/observation/analysis.ts
-    waaromAdvies += ` Sparki twijfelt nog op één punt: ${followUps[0]!.because}.`;
+    waaromAdvies += ` Er is nog twijfel op één punt: ${followUps[0]!.because}.`;
-        reason: "Sparki adviseert vandaag een lichtere prikkel",
+        reason: "Advies: vandaag een lichtere prikkel",
-      reason: "met een doel in zicht stemt Sparki je opbouw daarop af",
+      reason: "met een doel in zicht wordt je opbouw daarop afgestemd",

=== artifacts/api-server/src/engines/observation/contradiction.ts
-      because: "zonder check-in van vandaag mist Sparki je belangrijkste signaal",
+      because: "zonder check-in van vandaag ontbreekt je belangrijkste signaal",
-        "je traint stevig, maar Sparki kan je herstel nu niet objectief volgen",
+        "je traint stevig, maar je herstel is nu niet objectief te volgen",
-      return "Wil je dat Sparki je trainingen zwaarder maakt, of houd je deze belasting aan?";
+      return "Wil je zwaardere trainingen, of houd je deze belasting aan?";

=== artifacts/api-server/src/engines/observation/intake.ts
-          : "geen thuislocatie ingesteld; Sparki kan het weer niet ophalen",
+          : "geen thuislocatie ingesteld; het weer kan niet opgehaald worden",

=== artifacts/api-server/src/engines/observation/personality.ts
-  return withBasis("beginner", "Sparki kent je nog niet goed genoeg");
+  return withBasis("beginner", "je bent nog niet goed genoeg bekend");

=== artifacts/api-server/src/engines/observation/profile-consistency.ts
-        "met een te lage FTP rekent Sparki al je zones en belastingscores te licht",
+        "met een te lage FTP worden al je zones en belastingscores te licht berekend",
-        "je niveau bepaalt hoe voorzichtig Sparki je belasting opbouwt en hoe je uitleg klinkt",
+        "je niveau bepaalt hoe voorzichtig je belasting wordt opgebouwd en hoe je uitleg klinkt",
-            "Niets aangepast: je FTP is net gewijzigd — Sparki kijkt er bij de volgende analyse opnieuw naar.",
+            "Niets aangepast: je FTP is net gewijzigd — bij de volgende analyse wordt er opnieuw naar gekeken.",

=== artifacts/api-server/src/engines/reminders/build.ts
-    body: "Sparki heeft je avond-check-in nog niet. Een korte check-in (fris / oké / vermoeid) helpt Sparki je advies voor morgen scherp te krijgen.",
+    body: "Je avond-check-in ontbreekt nog. Een korte check-in (fris / oké / vermoeid) helpt je advies voor morgen scherp te krijgen.",
-    title: open === 1 ? "Sparki heeft een vraag voor je" : "Sparki heeft een paar vragen",
-    body: `Sparki heeft ${plural} openstaan om je advies preciezer te maken. Beantwoord ${open === 1 ? "die" : "ze"} kort in de app.`,
-    emailSubject: "Sparki heeft een vraag voor je",
+    title: open === 1 ? "Er staat een vraag voor je open" : "Er staan een paar vragen open",
+    body: `Er ${open === 1 ? "staat" : "staan"} ${plural} open om je advies preciezer te maken. Beantwoord ${open === 1 ? "die" : "ze"} kort in de app.`,
+    emailSubject: "Er staat een vraag voor je open",
-      body: `Je wedstrijd "${r.name}"${where} is op ${dutchDate(r.raceDate)}. Sparki helpt je met de voorbereiding in de app.`,
+      body: `Je wedstrijd "${r.name}"${where} is op ${dutchDate(r.raceDate)}. In de app vind je hulp bij de voorbereiding.`,
-      body: "Met je FTP berekent Sparki je trainingszones en je belasting. Geef je FTP door — of laat 'm schatten als je 'm niet weet.",
+      body: "Met je FTP worden je trainingszones en je belasting berekend. Geef je FTP door — of laat 'm schatten als je 'm niet weet.",
-      body: "Met je gewicht volgt Sparki je vermogen per kilo (W/kg) en je voedingsadvies. Geef even je gewicht door.",
+      body: "Met je gewicht worden je vermogen per kilo (W/kg) en je voedingsadvies bijgehouden. Geef even je gewicht door.",
-      body: "Met je geboortejaar stemt Sparki je zones en advies af op je leeftijd. Geef even je geboortejaar door.",
+      body: "Met je geboortejaar worden je zones en advies afgestemd op je leeftijd. Geef even je geboortejaar door.",
-      body: "Met je thuislocatie haalt Sparki het weer bij jou in de buurt op en stemt je training daarop af. Geef je thuislocatie door.",
+      body: "Met je thuislocatie wordt het weer bij jou in de buurt opgehaald en je training daarop afgestemd. Geef je thuislocatie door.",

=== artifacts/api-server/src/engines/social/index.ts
-        "Stel eerst je beschikbare trainingsdagen in bij Training, dan kan Sparki maatjes matchen.",
+        "Stel eerst je beschikbare trainingsdagen in bij Training, dan kunnen maatjes gematcht worden.",
-        "Selecteer eerst een paar trainingsmaatjes in je Circle, dan stelt Sparki samen trainen voor.",
+        "Selecteer eerst een paar trainingsmaatjes in je Circle, dan wordt samen trainen voorgesteld.",

=== artifacts/api-server/src/engines/today/orchestrate.ts
-        : "Je staat op geblesseerd. Volg je herstelplan; Sparki plant niets in tot je hersteld gemeld bent.",
+        : "Je staat op geblesseerd. Volg je herstelplan; er wordt niets ingepland tot je hersteld gemeld bent.",
-        { id: "propose", label: "Laat Sparki een training voorstellen", href: "/trainen/toevoegen" },
+        { id: "propose", label: "Laat een training voorstellen", href: "/trainen/toevoegen" },
-      title: "Waarom Sparki dit zegt",
+      title: "Waarom dit advies?",
-      body: `${lastSession.title ?? "Activiteit"} (${lastSession.sessionDate})${lastSession.tss != null ? ` · belasting ${lastSession.tss}` : ""}. Bekijk wat Sparki erin zag.`,
+      body: `${lastSession.title ?? "Activiteit"} (${lastSession.sessionDate})${lastSession.tss != null ? ` · belasting ${lastSession.tss}` : ""}. Bekijk wat erin te zien was.`,
-    body: "Laat Sparki een route voorstellen die past bij je fiets en je tijd.",
+    body: "Laat een route voorstellen die past bij je fiets en je tijd.",

=== artifacts/api-server/src/engines/today/roles.ts
-      body: `Sparki stelde aanpassingen voor op basis van echte feedback of signalen. Jij beslist — er verandert niets zonder jouw akkoord.`,
+      body: `Er zijn aanpassingen voorgesteld op basis van echte feedback of signalen. Jij beslist — er verandert niets zonder jouw akkoord.`,
-      body: `Sparki plant geen trainingen tot ${c.name} hersteld gemeld is. Je ziet dit omdat gezondheid tot het veiligheidsminimum hoort.`,
+      body: `Er worden geen trainingen ingepland tot ${c.name} hersteld gemeld is. Je ziet dit omdat gezondheid tot het veiligheidsminimum hoort.`,

=== artifacts/api-server/src/engines/voice/index.ts
-  nieuw: "Sparki houdt het rustig en maakt nog geen aannames.",
-  kennismaking: "Sparki wordt nieuwsgieriger naarmate hij je beter leert kennen.",
-  vertrouwd: "Sparki durft nu ook droge humor te gebruiken.",
-  maat: "Sparki kent je — droog, soms licht cynisch, altijd eerlijk.",
+  nieuw: "De toon blijft rustig en maakt nog geen aannames.",
+  kennismaking: "De toon wordt nieuwsgieriger naarmate je beter bekend raakt.",
+  vertrouwd: "Er is nu ook ruimte voor droge humor.",
+  maat: "Je bent goed bekend — droog, soms licht cynisch, altijd eerlijk.",

=== artifacts/api-server/src/lib/adjust-rules.ts
-          "Je meldt pijn. Sparki maakt hier een rustige hersteltraining van — korter en licht. Houdt de pijn aan, sla dan liever over en laat ernaar kijken.",
+          "Je meldt pijn. Hier wordt een rustige hersteltraining van gemaakt — korter en licht. Houdt de pijn aan, sla dan liever over en laat ernaar kijken.",
-          "Je bent niet hersteld genoeg voor de geplande belasting. Sparki stelt een kortere hersteltraining voor, zodat je morgen weer verder kunt bouwen.",
+          "Je bent niet hersteld genoeg voor de geplande belasting. Een kortere hersteltraining wordt voorgesteld, zodat je morgen weer verder kunt bouwen.",
-        basis.push("Bij RPE 9–10 kiest Sparki voor herstel in plaats van bijschaven.");
+        basis.push("Bij RPE 9–10 gaat de keuze naar herstel in plaats van bijschaven.");
-            "Dit was op het randje. Sparki zet de volgende prikkel om naar herstel zodat je lichaam de zware sessie kan verwerken.",
+            "Dit was op het randje. De volgende prikkel wordt omgezet naar herstel zodat je lichaam de zware sessie kan verwerken.",
-          "Te zwaar is een eerlijk signaal. Sparki stelt ongeveer 20% minder belasting voor, zodat je de training wél goed kunt afmaken.",
+          "Te zwaar is een eerlijk signaal. Er wordt ongeveer 20% minder belasting voorgesteld, zodat je de training wél goed kunt afmaken.",
-        basis.push("Geen belastingsdoel bekend — Sparki start voorzichtig op 60 TSS.");
+        basis.push("Geen belastingsdoel bekend — er wordt voorzichtig gestart op 60 TSS.");
-          "Goed teken dat dit makkelijk voelde. Sparki verhoogt de belasting met een kleine, veilige stap — groot genoeg om te prikkelen, klein genoeg om te herstellen.",
+          "Goed teken dat dit makkelijk voelde. De belasting gaat met een kleine, veilige stap omhoog — groot genoeg om te prikkelen, klein genoeg om te herstellen.",
-          "Sparki schuift de training één dag op. Komt die dag ook niet uit, kies dan zelf een andere datum — de inhoud blijft gelijk.",
+          "De training schuift één dag op. Komt die dag ook niet uit, kies dan zelf een andere datum — de inhoud blijft gelijk.",
-          "Een gemiste training haal je niet in door te stapelen. Sparki zet dezelfde training op morgen; de rest van de week blijft in balans.",
+          "Een gemiste training haal je niet in door te stapelen. Dezelfde training komt op morgen; de rest van de week blijft in balans.",
-          "Deze training is goed uitgevoerd. Sparki verandert niets; het schema klopt zo.",
+          "Deze training is goed uitgevoerd. Er verandert niets; het schema klopt zo.",

=== artifacts/api-server/src/lib/ai/gateway.ts
-          "Deze analyse is niet beschikbaar. Sparki is hier bewust terughoudend voor jonge sporters.",
+          "Deze analyse is niet beschikbaar. Voor jonge sporters is hier bewust terughoudendheid.",

=== artifacts/api-server/src/lib/coach-signals.ts
-      title: "Sparki stelt een schemawijziging voor",
+      title: "Voorstel voor een schemawijziging",
-        "Dit is een training van de coach — Sparki past die nooit zelf aan. Alleen de coach beslist.",
+        "Dit is een training van de coach — die wordt nooit automatisch aangepast. Alleen de coach beslist.",
-        "Zonder recente gegevens kan Sparki de toestand van de sporter niet betrouwbaar beoordelen.",
+        "Zonder recente gegevens kan de toestand van de sporter niet betrouwbaar beoordeeld worden.",

=== artifacts/api-server/src/lib/garage/knowledge-base.ts
-          : "Merk en model ontbreken nog — vul ze in, dan kan Sparki dit onderdeel beoordelen.",
+          : "Merk en model ontbreken nog — vul ze in, dan kan dit onderdeel beoordeeld worden.",

=== artifacts/api-server/src/lib/garage/material-test.ts
-        "Dit merk en type staan nog niet in de kennisbank — Sparki kan er geen schatting van maken. De vergelijkingstest met twee echte ritten werkt wél gewoon.",
+        "Dit merk en type staan nog niet in de kennisbank — er kan geen schatting van gemaakt worden. De vergelijkingstest met twee echte ritten werkt wél gewoon.",

=== artifacts/api-server/src/lib/intel-seed.ts
-        "FTP staat voor het hoogste gemiddelde vermogen dat je ongeveer een uur kunt volhouden. Het is een praktische maat voor je duurvermogen. Uit je FTP leidt Sparki je trainingszones af, zodat 'rustig' en 'hard' voor jou de juiste watts betekenen.",
+        "FTP staat voor het hoogste gemiddelde vermogen dat je ongeveer een uur kunt volhouden. Het is een praktische maat voor je duurvermogen. Uit je FTP worden je trainingszones afgeleid, zodat 'rustig' en 'hard' voor jou de juiste watts betekenen.",
-        "Ken je FTP, dan weten jij én Sparki precies hoe zwaar elke training voor jóu is. Weet je hem nog niet? Sparki kan een veilige schatting maken en die later bijstellen.",
+        "Ken je FTP, dan is precies bekend hoe zwaar elke training voor jóu is. Weet je hem nog niet? Er kan een veilige schatting gemaakt worden die later wordt bijgesteld.",

=== artifacts/api-server/src/lib/knowledge/governance.ts
-    "- Ontbreekt kennis over een vraag, zeg dan eerlijk dat Sparki daar geen gecontroleerde bron voor heeft.",
+    "- Ontbreekt kennis over een vraag, zeg dan eerlijk dat daar geen gecontroleerde bron voor is.",

=== artifacts/api-server/src/lib/material/nudge.ts
-    return `Je hebt zo'n ${shown} km gereden sinds Sparki je ${rule.label} voor het laatst zag. ${rule.reason} — laat 'm eens zien?`;
+    return `Je hebt zo'n ${shown} km gereden sinds je ${rule.label} voor het laatst is bekeken. ${rule.reason} — laat 'm eens zien?`;
-  return `Je hebt al zo'n ${shown} km in de benen en Sparki heeft je ${rule.label} nog nooit bekeken. ${rule.reason} — even laten checken?`;
+  return `Je hebt al zo'n ${shown} km in de benen en je ${rule.label} is nog nooit bekeken. ${rule.reason} — even laten checken?`;

=== artifacts/api-server/src/lib/onboarding-questions.ts
-    help: "Sparki kan je zelfstandig begeleiden, of je koppelt een menselijke coach.",
+    help: "Je kunt zelfstandig begeleid worden, of je koppelt een menselijke coach.",
-    help: "Je FTP — het vermogen dat je langdurig kunt volhouden — scherpt je trainingszones aan. Sparki gebruikt een schatting totdat je hem instelt.",
+    help: "Je FTP — het vermogen dat je langdurig kunt volhouden — scherpt je trainingszones aan. Tot je hem instelt wordt een schatting gebruikt.",
-    help: "Sparki past aan hoe stevig je week opbouwt.",
+    help: "Bepaalt hoe stevig je week wordt opgebouwd.",
-    help: "Sparki gebruikt dit om te bepalen wat het hierna vraagt en hoe het periodiseert.",
+    help: "Dit bepaalt wat er hierna wordt gevraagd en hoe er wordt geperiodiseerd.",
-    help: "Leeftijd helpt Sparki intensiteit en herstel af te stemmen.",
+    help: "Leeftijd helpt om intensiteit en herstel af te stemmen.",
-    prompt: "Blessures of beperkingen die Sparki moet weten?",
-    help: "Helpt Sparki je plan veilig te houden. Zeg \"geen\" als alles oké is.",
+    prompt: "Blessures of beperkingen om rekening mee te houden?",
+    help: "Helpt je plan veilig te houden. Zeg \"geen\" als alles oké is.",

=== artifacts/api-server/src/lib/profile/coaching-profile.ts
-    help: "Zo weet Sparki hoeveel structuur je wil.",
+    help: "Zo is bekend hoeveel structuur je wilt.",
-    help: "Sparki stemt zijn toon af op wat jou motiveert.",
+    help: "De toon wordt afgestemd op wat jou motiveert.",
-    prompt: "Hoe wil je dat Sparki met je praat?",
-    help: "De stijl waarin Sparki je coacht.",
+    prompt: "Hoe wil je aangesproken worden?",
+    help: "De stijl waarin je gecoacht wordt.",
-    help: "Zo legt Sparki dingen uit op jouw manier.",
+    help: "Zo wordt alles uitgelegd op jouw manier.",
-    help: "Bepaalt hoeveel Sparki zelf invult of aan jou voorlegt.",
+    help: "Bepaalt hoeveel er zelf wordt ingevuld of aan jou wordt voorgelegd.",
-      { value: "autonomous", label: "Ik beslis zelf, Sparki adviseert" },
+      { value: "autonomous", label: "Ik beslis zelf, met advies" },
-      { value: "directed", label: "Sparki bepaalt, ik volg" },
+      { value: "directed", label: "Het plan bepaalt, ik volg" },
-    help: "Sparki kan je extra bemoedigen op zware dagen.",
+    help: "Je krijgt extra bemoediging op zware dagen.",
-    help: "Sparki weegt vooruitgang mee zoals jij dat ziet.",
+    help: "Vooruitgang wordt meegewogen zoals jij dat ziet.",

=== artifacts/api-server/src/lib/race-advice.ts
-      basis: "Gezondheidsstatus uit je eigen melding — Sparki stelt geen diagnose.",
+      basis: "Gezondheidsstatus uit je eigen melding — dit is geen diagnose.",

=== artifacts/api-server/src/lib/race-context.ts
-    question: "Sparki haalt het weer automatisch op zodra de dag binnen 16 dagen ligt.",
+    question: "Het weer wordt automatisch opgehaald zodra de dag binnen 16 dagen ligt.",
-    question: "Vul de locatie in, dan haalt Sparki het weer op.",
+    question: "Vul de locatie in, dan wordt het weer opgehaald.",
-    reason: "Sparki vindt deze locatie niet op de kaart.",
+    reason: "Deze locatie is niet op de kaart gevonden.",
-    question: "Vul je thuislocatie in je profiel in, dan berekent Sparki de reisafstand.",
+    question: "Vul je thuislocatie in je profiel in, dan wordt de reisafstand berekend.",
-    reason: "Sparki vindt deze locatie niet op de kaart.",
+    reason: "Deze locatie is niet op de kaart gevonden.",
-      question: "Vul de locatie in — dan haalt Sparki het weer en de reisafstand op.",
+      question: "Vul de locatie in — dan worden het weer en de reisafstand opgehaald.",
-          ? `Sparki leidt dit af uit de discipline "${race.discipline}".`
-          : `Sparki leidt dit af uit de naam van de wedstrijd.`,
+          ? `Afgeleid uit de discipline "${race.discipline}".`
+          : `Afgeleid uit de naam van de wedstrijd.`,
-        explanation: "Sparki kan het type niet uit de discipline of naam afleiden.",
+        explanation: "Het type is niet uit de discipline of naam af te leiden.",
-        "Sparki schat de duur uit de afstand en een gemiddeld wedstrijdtempo; pas aan op je eigen tempo.",
+        "De duur is geschat uit de afstand en een gemiddeld wedstrijdtempo; pas aan op je eigen tempo.",
-      explanation: "Zonder afstand kan Sparki de duur niet schatten.",
-      question: "Vul de afstand in, dan schat Sparki de duur en de voeding.",
+      explanation: "Zonder afstand is de duur niet te schatten.",
+      question: "Vul de afstand in, dan worden de duur en de voeding geschat.",
-      explanation: "Zonder starttijd kan Sparki geen aankomsttijd afleiden.",
+      explanation: "Zonder starttijd is er geen aankomsttijd af te leiden.",
-    explanation: "Reistijd over de weg kan Sparki niet automatisch berekenen.",
+    explanation: "Reistijd over de weg is niet automatisch te berekenen.",
-    explanation: "Sparki heeft hier geen bereikbare, toegestane bron voor.",
-    question: "Ken je een eerdere uitslag? Zet die in je notities, dan weegt Sparki die mee.",
+    explanation: "Hier is geen bereikbare, toegestane bron voor.",
+    question: "Ken je een eerdere uitslag? Zet die in je notities, dan wordt die meegewogen.",
-    `Sparki combineert wat bekend is over ${race.name}; ontbrekende gegevens staan als openstaande vraag.`,
+    `Alles wat bekend is over ${race.name} wordt gecombineerd; ontbrekende gegevens staan als openstaande vraag.`,

=== artifacts/api-server/src/lib/race-course.ts
-      question: "Koppel de parcoursroute; dan beoordeelt Sparki het profiel.",
+      question: "Koppel de parcoursroute; dan wordt het profiel beoordeeld.",

=== artifacts/api-server/src/lib/race-evaluation.ts
-  dnf: "Je hebt niet gefinisht (DNF). Noteer wat er gebeurde (lek, val, of de benen) zodat Sparki dat meeweegt.",
+  dnf: "Je hebt niet gefinisht (DNF). Noteer wat er gebeurde (lek, val, of de benen) zodat dat meegewogen wordt.",
-  dsq: "Je bent gediskwalificeerd (DSQ). Noteer kort wat er speelde zodat Sparki er rekening mee houdt.",
+  dsq: "Je bent gediskwalificeerd (DSQ). Noteer kort wat er speelde zodat daar rekening mee gehouden wordt.",
-          question: "Na de wedstrijd vergelijkt Sparki je resultaat met de verwachting.",
+          question: "Na de wedstrijd wordt je resultaat met de verwachting vergeleken.",
-          question: `Hoe ging ${race.name}? Vul je uitslag in zodat Sparki ervan leert.`,
+          question: `Hoe ging ${race.name}? Vul je uitslag in zodat er van geleerd kan worden.`,
-      question: "Vul de afstand in zodat Sparki je tijd met een verwachting kan vergelijken.",
+      question: "Vul de afstand in zodat je tijd met een verwachting vergeleken kan worden.",

=== artifacts/api-server/src/lib/ride-story.ts
-        reason: `Omdat je na deze rit "${label}" aangaf, kan Sparki een aanpassing van je schema voorstellen.`,
+        reason: `Omdat je na deze rit "${label}" aangaf, kan een aanpassing van je schema worden voorgesteld.`,
-        reason: `Je reed duidelijk ${richting} dan gepland (belasting ${session.tss} om ${workout.targetTSS}). Of je schema aanpassing nodig heeft hangt af van hoe het voelde — geef je feedback op deze training, dan bepaalt Sparki het gevolg.`,
+        reason: `Je reed duidelijk ${richting} dan gepland (belasting ${session.tss} om ${workout.targetTSS}). Of je schema aanpassing nodig heeft hangt af van hoe het voelde — geef je feedback op deze training, dan wordt het gevolg bepaald.`,
-        "Nog niet te bepalen: er zijn geen vergelijkbare belastingcijfers (gepland én gereden). Geef je feedback op deze training, dan bepaalt Sparki het gevolg.",
+        "Nog niet te bepalen: er zijn geen vergelijkbare belastingcijfers (gepland én gereden). Geef je feedback op deze training, dan wordt het gevolg bepaald.",

=== artifacts/api-server/src/lib/route-surfaces.ts
-      "De metingen spreken elkaar tegen: de actuele kaart vindt (half)onverharde stukken die de motorkaart niet kent. Sparki kiest niet stil één bron — houd voor het wegdek dít scherm aan: de motorkaart kan verouderd zijn.",
+      "De metingen spreken elkaar tegen: de actuele kaart vindt (half)onverharde stukken die de motorkaart niet kent. Er wordt niet stil één bron gekozen — houd voor het wegdek dít scherm aan: de motorkaart kan verouderd zijn.",
-      "De metingen spreken elkaar tegen: de motor kent hier meer wegdek dan de actuele kaarttags tonen. Het verschil zit vooral in ontbrekende tags — niet in aantoonbaar onverhard. Sparki kiest niet stil één bron: onbekend blijft eerlijk onbekend, de motor-meting staat er ter context naast.",
+      "De metingen spreken elkaar tegen: de motor kent hier meer wegdek dan de actuele kaarttags tonen. Het verschil zit vooral in ontbrekende tags — niet in aantoonbaar onverhard. Er wordt niet stil één bron gekozen: onbekend blijft eerlijk onbekend, de motor-meting staat er ter context naast.",

=== artifacts/api-server/src/lib/season-goal.ts
-        "Sturen op gewicht doet Sparki bewust niet onder de 17. Op jouw leeftijd geldt: genoeg en gevarieerd eten, op tijd rond je trainingen — je lichaam is nog volop in ontwikkeling.",
+        "Onder de 17 wordt er bewust niet op gewicht gestuurd. Op jouw leeftijd geldt: genoeg en gevarieerd eten, op tijd rond je trainingen — je lichaam is nog volop in ontwikkeling.",
-    return `${kern}: zonder je huidige gewicht kan Sparki richting en tempo nog niet berekenen — vul je gewicht in bij je profiel. Trainingen blijven altijd volledig gevoed.`;
+    return `${kern}: zonder je huidige gewicht zijn richting en tempo nog niet te berekenen — vul je gewicht in bij je profiel. Trainingen blijven altijd volledig gevoed.`;
-        : ` — let op: het gevraagde tempo is hoger dan het veilige maximum van ${SAFE_KG_PER_WEEK.toString().replace(".", ",")} kg per week, dus Sparki stuurt niet sneller dan dat`
+        : ` — let op: het gevraagde tempo is hoger dan het veilige maximum van ${SAFE_KG_PER_WEEK.toString().replace(".", ",")} kg per week, dus er wordt niet sneller gestuurd dan dat`

=== artifacts/api-server/src/lib/share/ride-share.ts
-        "Van deze rit is geen echte starttijd bekend. Strava heeft een starttijd nodig en die verzint Sparki niet.";
+        "Van deze rit is geen echte starttijd bekend. Strava heeft een starttijd nodig en die wordt niet verzonnen.";

=== artifacts/api-server/src/routes/activity-imports.ts
-        "Dit bestandstype wordt niet ondersteund. Sparki leest FIT-, GPX- en TCX-bestanden.",
+        "Dit bestandstype wordt niet ondersteund. Ondersteund worden FIT-, GPX- en TCX-bestanden.",

=== artifacts/api-server/src/routes/ai.ts
-      res.status(500).json({ error: "Unexpected Sparki response" });
+      res.status(500).json({ error: "Er kwam een onverwacht antwoord terug. Probeer het opnieuw." });
-    res.status(500).json({ error: "Sparki service unavailable" });
+    res.status(500).json({ error: "De coach-dienst is tijdelijk niet beschikbaar. Probeer het straks opnieuw." });
-      res.status(500).json({ error: "Unexpected Sparki response" });
+      res.status(500).json({ error: "Er kwam een onverwacht antwoord terug. Probeer het opnieuw." });
-    res.status(500).json({ error: "Sparki service unavailable" });
+    res.status(500).json({ error: "De coach-dienst is tijdelijk niet beschikbaar. Probeer het straks opnieuw." });
-      res.status(500).json({ error: "Unexpected Sparki response" });
+      res.status(500).json({ error: "Er kwam een onverwacht antwoord terug. Probeer het opnieuw." });
-      res.status(502).json({ error: "Sparki could not form an explanation" });
+      res.status(502).json({ error: "Er kon geen uitleg worden gevormd. Probeer het opnieuw." });
-    res.status(500).json({ error: "Sparki service unavailable" });
+    res.status(500).json({ error: "De coach-dienst is tijdelijk niet beschikbaar. Probeer het straks opnieuw." });
-      res.status(500).json({ error: "Unexpected Sparki response" });
+      res.status(500).json({ error: "Er kwam een onverwacht antwoord terug. Probeer het opnieuw." });
-      res.status(502).json({ error: "Sparki could not form an explanation" });
+      res.status(502).json({ error: "Er kon geen uitleg worden gevormd. Probeer het opnieuw." });
-    res.status(500).json({ error: "Sparki service unavailable" });
+    res.status(500).json({ error: "De coach-dienst is tijdelijk niet beschikbaar. Probeer het straks opnieuw." });
-          "Deze training staat in het schema van je coach. Sparki past coachtrainingen niet zelf aan. Je feedback ligt nu als voorstel bij je coach — die beslist of de training anders moet.",
+          "Deze training staat in het schema van je coach. Coachtrainingen worden niet automatisch aangepast. Je feedback ligt nu als voorstel bij je coach — die beslist of de training anders moet.",
-    res.status(500).json({ error: "Sparki service unavailable" });
+    res.status(500).json({ error: "De coach-dienst is tijdelijk niet beschikbaar. Probeer het straks opnieuw." });

=== artifacts/api-server/src/routes/athlete.ts
-          "Deze training komt van je coach. Sparki past die niet aan — bespreek een wijziging met je coach.",
+          "Deze training komt van je coach. Die wordt niet automatisch aangepast — bespreek een wijziging met je coach.",
-          "Deze training komt van je coach. Sparki annuleert die niet — bespreek dit met je coach.",
+          "Deze training komt van je coach. Die wordt niet automatisch geannuleerd — bespreek dit met je coach.",
-          "Stel eerst je FTP en wekelijkse uren in zodat Sparki een schema kan opbouwen.",
+          "Stel eerst je FTP en wekelijkse uren in zodat er een schema opgebouwd kan worden.",

=== artifacts/api-server/src/routes/bug-reports.ts
-    body: (s) => `Sparki is met je melding aan de slag: "${s}"`,
+    body: (s) => `Je melding wordt bekeken: "${s}"`,
-    body: (s) => `Sparki pakt deze melding niet verder op: "${s}"`,
+    body: (s) => `Deze melding wordt niet verder opgepakt: "${s}"`,
-        title: "Sparki heeft op je melding gereageerd",
+        title: "Er is op je melding gereageerd",

=== artifacts/api-server/src/routes/core-prediction.ts
-      .json({ error: "Sparki kon de voorspelling nu niet maken" });
+      .json({ error: "De voorspelling kon nu niet gemaakt worden" });

=== artifacts/api-server/src/routes/document-analysis.ts
-            "Sparki kon dit document niet lezen. Probeer een duidelijkere scan of een ander bestand.",
+            "Dit document kon niet gelezen worden. Probeer een duidelijkere scan of een ander bestand.",

=== artifacts/api-server/src/routes/input-center.ts
-      res.status(500).json({ error: "Sparki kon niet antwoorden. Probeer het opnieuw." });
+      res.status(500).json({ error: "Er kon geen antwoord gegeven worden. Probeer het opnieuw." });

=== artifacts/api-server/src/routes/material.ts
-      .json({ error: "Sparki kon de foto nu niet beoordelen. Probeer opnieuw." });
+      .json({ error: "De foto kon nu niet beoordeeld worden. Probeer opnieuw." });
-      .json({ error: "Sparki kon de extra foto nu niet beoordelen." });
+      .json({ error: "De extra foto kon nu niet beoordeeld worden." });

=== artifacts/api-server/src/routes/nutrition.ts
-      res.status(502).json({ error: "Sparki kon de dag nu niet beoordelen" });
+      res.status(502).json({ error: "De dag kon nu niet beoordeeld worden" });
-      res.status(502).json({ error: "Sparki kon de dag nu niet beoordelen" });
+      res.status(502).json({ error: "De dag kon nu niet beoordeeld worden" });
-    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
+    res.status(500).json({ error: "De dienst is even niet bereikbaar" });
-      why: "Dan weet Sparki tegen wanneer je gewicht goed moet zitten en hoeveel tijd er is om rustig bij te sturen.",
+      why: "Dan is bekend tegen wanneer je gewicht goed moet zitten en hoeveel tijd er is om rustig bij te sturen.",
-    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
+    res.status(500).json({ error: "De dienst is even niet bereikbaar" });
-    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
+    res.status(500).json({ error: "De dienst is even niet bereikbaar" });
-      res.status(502).json({ error: "Sparki kon nu geen voedingsplan maken" });
+      res.status(502).json({ error: "Er kon nu geen voedingsplan gemaakt worden" });
-      res.status(502).json({ error: "Sparki kon nu geen voedingsplan maken" });
+      res.status(502).json({ error: "Er kon nu geen voedingsplan gemaakt worden" });
-    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
+    res.status(500).json({ error: "De dienst is even niet bereikbaar" });
-    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
+    res.status(500).json({ error: "De dienst is even niet bereikbaar" });
-    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
+    res.status(500).json({ error: "De dienst is even niet bereikbaar" });
-    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
+    res.status(500).json({ error: "De dienst is even niet bereikbaar" });
-        .json({ error: "Sparki kon nu geen voedingsbegeleiding maken" });
+        .json({ error: "Er kon nu geen voedingsbegeleiding gemaakt worden" });
-    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
+    res.status(500).json({ error: "De dienst is even niet bereikbaar" });

=== artifacts/api-server/src/routes/parent.ts
-      body: `Je ouder/verzorger heeft een ${kindLabel} gedaan. Sparki past niets automatisch aan — bekijk de melding.`,
+      body: `Je ouder/verzorger heeft een ${kindLabel} gedaan. Er wordt niets automatisch aangepast — bekijk de melding.`,

=== artifacts/api-server/src/routes/photo-style.ts
-      "Sparki kon de sfeer nu niet toepassen. Je originele foto blijft bruikbaar.";
+      "De sfeer kon nu niet toegepast worden. Je originele foto blijft bruikbaar.";

=== artifacts/api-server/src/routes/race-exports.ts
-        "Garmin: zet het FIT Course-bestand in de map Garmin/NewFiles of importeer het via Garmin Connect. Wahoo en Hammerhead Karoo lezen GPX- en FIT-routes via hun eigen app (bestand delen of uploaden). Sparki heeft geen directe synchronisatie met deze diensten en doet daar ook geen beloftes over.",
+        "Garmin: zet het FIT Course-bestand in de map Garmin/NewFiles of importeer het via Garmin Connect. Wahoo en Hammerhead Karoo lezen GPX- en FIT-routes via hun eigen app (bestand delen of uploaden). Er is geen directe synchronisatie met deze diensten en daar worden ook geen beloftes over gedaan.",

=== artifacts/api-server/src/routes/routes.ts
-        "De routebron gaf voor deze route geen wegtype-meting terug, dus Sparki kan niet controleren of het vermijden gelukt is.",
+        "De routebron gaf voor deze route geen wegtype-meting terug, dus er kan niet gecontroleerd worden of het vermijden gelukt is.",

=== artifacts/api-server/src/routes/state.ts
-    res.status(500).json({ error: "Sparki kon je toestand nu niet bepalen" });
+    res.status(500).json({ error: "Je toestand kon nu niet bepaald worden" });

=== artifacts/api-server/src/routes/today.ts
-      .json({ error: "Sparki kon je startpagina nu niet samenstellen" });
+      .json({ error: "Je startpagina kon nu niet samengesteld worden" });

=== artifacts/api-server/src/scripts/seed-social.ts
-        "Je vertelde dat je afgelopen weekend een wedstrijd had. Sparki vraagt hoe het ging.",
+        "Je vertelde dat je afgelopen weekend een wedstrijd had. Er wordt gevraagd hoe het ging.",
-        "Je hebt iets aan je materiaal veranderd. Sparki vraagt later hoe het bevalt.",
+        "Je hebt iets aan je materiaal veranderd. Er wordt later gevraagd hoe het bevalt.",

=== artifacts/api-server/src/tests/core-prediction.ts
-    assert(/Sparki kan het effect nog niet voorspellen/.test(p.headline), "honest headline");
+    assert(/Het effect is nog niet te voorspellen/.test(p.headline), "honest headline");

=== artifacts/api-server/src/tests/material-nudge.ts
-      /voor het laatst zag/.test(nudge!.message),
-      "checked message should reference the last time Sparki saw it",
+      /voor het laatst is bekeken/.test(nudge!.message),
+      "checked message should reference the last check moment",

=== artifacts/sparki-mobile/app/(app)/gpx-import.tsx
-              Open een .gpx-bestand met Sparki vanuit een e-mail, chat of je
+              Open een .gpx-bestand met deze app vanuit een e-mail, chat of je

=== artifacts/sparki-mobile/app/(app)/index.tsx
-              Sparki zoekt eerst je bekende routes, daarna nieuwe voorstellen
+              Eerst je bekende routes, daarna nieuwe voorstellen

=== artifacts/sparki-mobile/app/(app)/route-aanvraag.tsx
-  berekenen: "Sparki berekent nieuwe voorstellen…",
+  berekenen: "Nieuwe voorstellen worden berekend…",
-              {FASE_LABEL[genFase ?? ""] ?? "Sparki berekent nieuwe voorstellen…"}
+              {FASE_LABEL[genFase ?? ""] ?? "Nieuwe voorstellen worden berekend…"}

=== artifacts/sparki/src/components/ds/upgrade-nudge.tsx
-      "Automatische trainingsplannen die met je meegroeien — opbouw, aanpassing en herstel, door Sparki gepland.",
+      "Automatische trainingsplannen die met je meegroeien — opbouw, aanpassing en herstel, automatisch gepland.",
-      "Wedstrijdvoorbereiding, voedingsplan en wedstrijddossier — Sparki denkt met je mee naar de startstreep.",
+      "Wedstrijdvoorbereiding, voedingsplan en wedstrijddossier — alles denkt met je mee naar de startstreep.",

=== artifacts/sparki/src/components/sparki/account-privacy-panel.tsx
-                Eén bestand met alles wat Sparki over jou bewaart. Toegangssleutels van gekoppelde diensten zitten er om veiligheidsredenen niet in.
+                Eén bestand met alles wat er over jou wordt bewaard. Toegangssleutels van gekoppelde diensten zitten er om veiligheidsredenen niet in.

=== artifacts/sparki/src/components/sparki/add-training.tsx
-        Sparki koppelt deze training automatisch aan je geplande training van
+        Deze training wordt automatisch gekoppeld aan je geplande training van
-              "Een training die al is gedaan en die Sparki nog niet heeft.",
+              "Een training die al is gedaan en die nog niet is geregistreerd.",

=== artifacts/sparki/src/components/sparki/ai-memory-panel.tsx
-        Sparki legt verbanden tussen je training, slaap, herstel, wedstrijden en
+        Hier worden verbanden gelegd tussen je training, slaap, herstel, wedstrijden en
-        Sparki is en — onder "Uitgebreid" — welke signalen zijn gebruikt en welke
+        het is en — onder "Uitgebreid" — welke signalen zijn gebruikt en welke
-          {runConnections.isPending ? "Sparki zoekt…" : "Verbanden zoeken"}
+          {runConnections.isPending ? "Bezig met zoeken…" : "Verbanden zoeken"}

=== artifacts/sparki/src/components/sparki/coach-decision-card.tsx
-  consistentiecoach: "Sparki coacht op consistentie",
-  wedstrijdcoach: "Sparki coacht op je wedstrijd",
-  prestatiecoach: "Sparki coacht op prestatie",
+  consistentiecoach: "Coaching op consistentie",
+  wedstrijdcoach: "Coaching op je wedstrijd",
+  prestatiecoach: "Coaching op prestatie",
-              Sparki let vandaag op
+              Vandaag ligt de focus op

=== artifacts/sparki/src/components/sparki/coach-input-actions.tsx
-            Sparki vult aan
+            Automatisch aangevuld
-          Sparki heeft nog gegevens nodig
+          Er zijn nog gegevens nodig

=== artifacts/sparki/src/components/sparki/coach/coach-analysis-card.tsx
-      title="Hoe zeker Sparki is — nooit 100%"
+      title="Hoe zeker deze analyse is — nooit 100%"
-          Sparki kon je antwoord niet verwerken. Probeer het zo nog eens.
+          Je antwoord kon niet worden verwerkt. Probeer het zo nog eens.
-      Sparki coacht je als{" "}
+      Je wordt gecoacht als{" "}
-          Sparki kon je analyse nu niet samenstellen. Probeer het later opnieuw.
+          Je analyse kon nu niet worden samengesteld. Probeer het later opnieuw.
-                Sparki vandaag
+                Vandaag
-              Waarom zegt Sparki dit?
+              Waarom dit advies?
-          Sparki vandaag
+          Vandaag
-          Waarom zegt Sparki dit?
+          Waarom dit advies?
-            Sparki wil dit nog van je weten
+            Dit is nog nodig van jou

=== artifacts/sparki/src/components/sparki/connections-section.tsx
-              ? `Je wordt doorgestuurd naar ${connector.displayName} om toestemming te geven. Daarna haalt Sparki je gegevens automatisch op.`
-              : "Na je toestemming haalt Sparki je gegevens automatisch op."}
+              ? `Je wordt doorgestuurd naar ${connector.displayName} om toestemming te geven. Daarna worden je gegevens automatisch opgehaald.`
+              : "Na je toestemming worden je gegevens automatisch opgehaald."}
-              Tijdelijk niet beschikbaar — Sparki probeert het vanzelf opnieuw
+              Tijdelijk niet beschikbaar — er wordt vanzelf opnieuw geprobeerd

=== artifacts/sparki/src/components/sparki/context-memory-panel.tsx
-          setFeedback("Sparki onthoudt dit en vraagt er later naar.")
+          setFeedback("Dit wordt onthouden en komt later terug.")
-            "Sparki herkende dit, maar je geheugen staat uit. Zet het aan bij Profiel.",
+            "Dit is herkend, maar je geheugen staat uit. Zet het aan bij Profiel.",
-            "Sparki kon hier geen vervolgmoment in herkennen. Probeer bijvoorbeeld: \u201cik heb een wedstrijd dit weekend\u201d.",
+            "Hier kon geen vervolgmoment in worden herkend. Probeer bijvoorbeeld: \u201cik heb een wedstrijd dit weekend\u201d.",
-      <SectionLabel n="09" title="Sparki onthoudt" />
+      <SectionLabel n="09" title="Wat er speelt" />
-        Vertel Sparki wat er speelt — school, werk, familie, een wedstrijd, een
-        blessure of een slechte nacht. Sparki onthoudt het en vraagt er op het
-        juiste moment rustig naar. Jij houdt de regie: delen, pauzeren of
+        Vertel wat er speelt — school, werk, familie, een wedstrijd, een
+        blessure of een slechte nacht. Het wordt onthouden en komt op het
+        juiste moment rustig terug. Jij houdt de regie: delen, pauzeren of
-            {capture.isPending ? "Sparki luistert\u2026" : "Vertel Sparki"}
+            {capture.isPending ? "Bezig\u2026" : "Vertel het"}
-          Nog niets onthouden · Vertel Sparki hierboven wat er speelt
+          Nog niets onthouden · Vertel hierboven wat er speelt

=== artifacts/sparki/src/components/sparki/day-home.tsx
-        gaan voor. Meld je weer beter zodra het kan, dan bouwt Sparki rustig op.
+        gaan voor. Meld je weer beter zodra het kan, dan bouwt je plan rustig op.

=== artifacts/sparki/src/components/sparki/day-homes/general-day-home.tsx
-                    Log je check-in van vandaag, dan zet Sparki hier een concreet
-                    advies neer op basis van je vorm, FTP en doel.
+                    Log je check-in van vandaag, dan verschijnt hier een concreet
+                    advies op basis van je vorm, FTP en doel.

=== artifacts/sparki/src/components/sparki/document-analysis-panel.tsx
-            Sparki vraagt
+            Nog even dit
-        tijdschema (PDF of foto). Sparki haalt de kerninfo eruit en vraagt door
-        wat nog ontbreekt.
+        tijdschema (PDF of foto). De kerninfo wordt eruit gehaald en er wordt
+        doorgevraagd wat nog ontbreekt.

=== artifacts/sparki/src/components/sparki/feedback-sheet.tsx
-        en Sparki laat het je weten wanneer het opgepakt of opgelost is.
+        en je krijgt bericht wanneer het opgepakt of opgelost is.
-              Verstuurd — bedankt. Sparki neemt het mee.
+              Verstuurd — bedankt. We nemen het mee.

=== artifacts/sparki/src/components/sparki/follow-up-prompt.tsx
-            Sparki vraagt na
+            Nog een vraag
-          placeholder="Vertel Sparki hoe het ging…"
+          placeholder="Vertel hoe het ging…"

=== artifacts/sparki/src/components/sparki/ftp-estimate-wizard.tsx
-                Hoe ervaren ben je op de fiets? Dit helpt Sparki een eerste
-                inschatting maken.
+                Hoe ervaren ben je op de fiets? Dit helpt bij een eerste
+                inschatting.
-                      : "Vul je gewicht in zodat Sparki een betere inschatting kan maken op basis van je niveau."}
+                      : "Vul je gewicht in voor een betere inschatting op basis van je niveau."}

=== artifacts/sparki/src/components/sparki/goals-worksheet.tsx
-          wedstrijd meet Sparki je opbouw af aan waar je naartoe wilt.
+          wedstrijd wordt je opbouw gemeten aan waar je naartoe wilt.
-                Dan meet Sparki je training daaraan af.
+                Dan wordt je training daaraan gemeten.

=== artifacts/sparki/src/components/sparki/health-flow-section.tsx
-        Dit is een registratie, geen diagnose. Sparki past je begeleiding erop
-        aan; bij twijfel is een arts of fysiotherapeut de juiste plek.
+        Dit is een registratie, geen diagnose. Je begeleiding wordt erop
+        aangepast; bij twijfel is een arts of fysiotherapeut de juiste plek.
-                  : "Je staat geblesseerd gemeld — Sparki past je begeleiding aan."}
+                  : "Je staat geblesseerd gemeld — je begeleiding wordt hierop aangepast."}

=== artifacts/sparki/src/components/sparki/health-status-control.tsx
-        Markeer je status — Sparki schakelt dan over naar een rustige
+        Markeer je status — dan schakelt de begeleiding over naar een rustige

=== artifacts/sparki/src/components/sparki/import-from-calendar.tsx
-        Kies een kalender, zoek je wedstrijd en tik erop. Sparki vult het
-        formulier voor je in — je controleert daarna alles zelf.
+        Kies een kalender, zoek je wedstrijd en tik erop. Het
+        formulier wordt automatisch ingevuld — je controleert daarna alles zelf.

=== artifacts/sparki/src/components/sparki/intel-reader.tsx
-          Kies een antwoord om te zien wat Sparki erover weet.
+          Kies een antwoord om te zien wat hierover bekend is.

=== artifacts/sparki/src/components/sparki/material-coach.tsx
-            Sparki wil een extra foto
+            Een extra foto is nodig
-          setError("Sparki kon de foto nu niet beoordelen. Probeer opnieuw."),
+          setError("De foto kon nu niet worden beoordeeld. Probeer opnieuw."),

=== artifacts/sparki/src/components/sparki/material-test.tsx
-          opstelling, één met de nieuwe. Sparki zet de metingen naast elkaar.
+          opstelling, één met de nieuwe. De metingen worden naast elkaar gezet.

=== artifacts/sparki/src/components/sparki/onboarding-check-failed.tsx
-        Sparki kan je accountstatus tijdelijk niet controleren
+        Je accountstatus kan tijdelijk niet worden gecontroleerd

=== artifacts/sparki/src/components/sparki/privacy-settings.tsx
-              desc="Sta Sparki toe om observaties over jouw training te onthouden en te gebruiken in toekomstige adviezen."
+              desc="Sta toe dat observaties over jouw training worden onthouden en gebruikt in toekomstige adviezen."

=== artifacts/sparki/src/components/sparki/profile-prompt-card.tsx
-            Sparki wil weten
+            Nog even dit

=== artifacts/sparki/src/components/sparki/profile-settings.tsx
-        Hoeveel droge humor mag Sparki gebruiken? Dit geldt overal in de app.
+        Hoeveel droge humor mag er zijn? Dit geldt overal in de app.
-        blijft Sparki altijd zakelijk — ongeacht deze instelling.
+        blijft de toon altijd zakelijk — ongeacht deze instelling.
-              Sparki haalt je HRV automatisch op uit {hrvSupplier.displayName}
+              Je HRV wordt automatisch opgehaald uit {hrvSupplier.displayName}
-          Sparki haalt dit op uit {weightSupplier.displayName}
+          Dit wordt opgehaald uit {weightSupplier.displayName}
-        <SectionLabel n="04" title="Hoe Sparki klinkt" />
+        <SectionLabel n="04" title="Hoe de app klinkt" />

=== artifacts/sparki/src/components/sparki/race-wizard.tsx
-          Dit haalde Sparki zelf op — uit de kalender, je profiel en live databronnen.
+          Dit is automatisch opgehaald — uit de kalender, je profiel en live databronnen.
-            Sparki haalde erbij
+            Er automatisch bij gezocht
-                    ? "Voorspelling beschikbaar vanaf ~16 dagen voor de koers — Sparki vult later aan."
+                    ? "Voorspelling beschikbaar vanaf ~16 dagen voor de koers — dit wordt later aangevuld."
-                    ? "Geef een locatie op, dan haalt Sparki het weer erbij."
+                    ? "Geef een locatie op, dan wordt het weer erbij gehaald."
-            Sparki kon niets afleiden — geen locatie of datum beschikbaar.
+            Er kon niets worden afgeleid — geen locatie of datum beschikbaar.
-            Sparki kon geen voorstel opstellen voor deze wedstrijd. Je kunt de velden zelf invullen in stap 5.
+            Er kon geen voorstel worden opgesteld voor deze wedstrijd. Je kunt de velden zelf invullen in stap 5.

=== artifacts/sparki/src/components/sparki/race/prep-checklist.tsx
-          Sparki vinkte {autoCount} {autoCount === 1 ? "punt" : "punten"} alvast
-          af op basis van je recente materiaalcheck. Klopt het niet? Tik het uit.
+          {autoCount} {autoCount === 1 ? "punt is" : "punten zijn"} alvast
+          afgevinkt op basis van je recente materiaalcheck. Klopt het niet? Tik het uit.
-                  aria-label="Door Sparki gecheckt"
+                  aria-label="Automatisch afgevinkt"

=== artifacts/sparki/src/components/sparki/race/race-intel.tsx
-          Sparki vinkte {autoCount} {autoCount === 1 ? "punt" : "punten"} alvast
-          af op basis van je recente materiaalcheck. Klopt het niet? Tik het uit.
+          {autoCount} {autoCount === 1 ? "punt is" : "punten zijn"} alvast
+          afgevinkt op basis van je recente materiaalcheck. Klopt het niet? Tik het uit.
-                        aria-label="Door Sparki gecheckt"
+                        aria-label="Automatisch afgevinkt"

=== artifacts/sparki/src/components/sparki/reminder-settings.tsx
-              desc="De hoofdschakelaar. Staat deze uit, dan stuurt Sparki je geen enkele herinnering — in de app of per e-mail."
+              desc="De hoofdschakelaar. Staat deze uit, dan krijg je geen enkele herinnering — in de app of per e-mail."
-              desc="Een herinnering als Sparki nog een korte vraag voor je heeft openstaan om je advies preciezer te maken."
+              desc="Een herinnering als er nog een korte vraag voor je openstaat om je advies preciezer te maken."
-              desc="Eén korte vraag per keer als Sparki nog een belangrijk gegeven mist (bijv. je FTP, gewicht of lengte), zodat je advies klopt."
+              desc="Eén korte vraag per keer als er nog een belangrijk gegeven ontbreekt (bijv. je FTP, gewicht of lengte), zodat je advies klopt."
-            desc="Meldingen op je telefoon (push). Zet dit uit en Sparki stuurt niets meer naar je telefoon — behalve bij privacy of veiligheid."
+            desc="Meldingen op je telefoon (push). Zet dit uit en er komt niets meer op je telefoon — behalve bij privacy of veiligheid."
-                : "Kies een venster waarin Sparki je niet stoort met push of e-mail. In de app blijft alles gewoon staan."
+                : "Kies een venster waarin je niet gestoord wordt met push of e-mail. In de app blijft alles gewoon staan."
-    ? `Je opent Sparki meestal rond ${fmtHour(r.receptiveHour as number)}. Een tik over iets nieuws komt daarom rond dat moment.`
-    : `Sparki kent je ritme nog niet goed genoeg, dus een tik komt op een rustig moment in de avond (tussen ${fmtHour(r.receptiveWindow.startHour)} en ${fmtHour(r.receptiveWindow.endHour)}).`
+    ? `Je opent de app meestal rond ${fmtHour(r.receptiveHour as number)}. Een tik over iets nieuws komt daarom rond dat moment.`
+    : `Je ritme is nog niet goed genoeg bekend, dus een tik komt op een rustig moment in de avond (tussen ${fmtHour(r.receptiveWindow.startHour)} en ${fmtHour(r.receptiveWindow.endHour)}).`

=== artifacts/sparki/src/components/sparki/ride-story.tsx
-      setError("Sparki kon nu geen voorstel maken. Probeer het zo nog eens.")
+      setError("Er kon nu geen voorstel worden gemaakt. Probeer het zo nog eens.")
-            Sparki krijgt deze rit als context mee — dat zie je in het gesprek.
+            Deze rit gaat als context mee — dat zie je in het gesprek.

=== artifacts/sparki/src/components/sparki/route-candidates-section.tsx
-        Routes die Sparki herkende in je geïmporteerde ritgeschiedenis. Bewaren
+        Routes die herkend zijn in je geïmporteerde ritgeschiedenis. Bewaren

=== artifacts/sparki/src/components/sparki/route-library-section.tsx
-            ? "Sparki heeft vandaag het maximum aan nieuwe gebieden bereikt — probeer het morgen opnieuw."
-            : "Sparki maakt op de achtergrond routes voor dit gebied. Kom over een paar minuten terug en druk dan opnieuw op 'Laat hier de routes zien'.",
+            ? "Het maximum aan nieuwe gebieden is vandaag bereikt — probeer het morgen opnieuw."
+            : "Er worden op de achtergrond routes gemaakt voor dit gebied. Kom over een paar minuten terug en druk dan opnieuw op 'Laat hier de routes zien'.",
-          Kant-en-klare routes van Sparki
+          Kant-en-klare routes
-        Sparki maakt per gebied uitgewerkte routes voor racefiets, gravel, MTB
+        Per gebied worden uitgewerkte routes gemaakt voor racefiets, gravel, MTB
-            {vulGebied.isPending ? "Starten…" : "Vraag Sparki dit gebied te vullen"}
+            {vulGebied.isPending ? "Starten…" : "Vul dit gebied met routes"}
-                of kies een ander startpunt, of laat Sparki dit gebied vullen.
+                of kies een ander startpunt, of vul dit gebied met routes.
-                        volgens de routemotor. Sparki beveelt deze route
-                        daarom niet aan als racefietsroute — overnemen kan
+                        volgens de routemotor. Deze route wordt
+                        daarom niet aanbevolen als racefietsroute — overnemen kan

=== artifacts/sparki/src/components/sparki/route-library.tsx
-                        volgens de routemotor. Sparki beveelt deze route
-                        daarom niet aan als racefietsroute — gebruiken kan
+                        volgens de routemotor. Deze route wordt
+                        daarom niet aanbevolen als racefietsroute — gebruiken kan

=== artifacts/sparki/src/components/sparki/route-panel.tsx
-              <p>Sparki registreert tijdens het navigeren ook je rit.</p>
+              <p>Tijdens het navigeren wordt ook je rit geregistreerd.</p>
-                Op dit apparaat moet Sparki geopend blijven — met het scherm
+                Op dit apparaat moet de app geopend blijven — met het scherm
-                  Sparki kiest de kandidaat die hier het dichtst bij komt — een
+                  De kandidaat die hier het dichtst bij komt wordt gekozen — een
-              lukt het niet, dan meldt Sparki dat eerlijk bij het resultaat.
+              lukt het niet, dan staat dat eerlijk bij het resultaat.
-                  Sparki stuurt de route waar mogelijk om doorgaande wegen
+                  De route gaat waar mogelijk om doorgaande wegen
-                  garantie. Lukt het in dit gebied niet, dan zegt Sparki dat
+                  garantie. Lukt het in dit gebied niet, dan staat dat
-                  ? "Sparki plant nieuwe voorstellen…"
-                  : "Maak óók nieuwe voorstellen van Sparki"}
+                  ? "Nieuwe voorstellen worden gemaakt…"
+                  : "Maak óók nieuwe voorstellen"}
-                . Sparki beveelt deze route daarom niet aan als
+                . Deze route wordt daarom niet aanbevolen als
-              N-wegen niet in dit gebied, dan zegt Sparki dat expliciet —
+              N-wegen niet in dit gebied, dan staat dat er expliciet bij —
-          Upload een GPX-bestand (max 11 MB) — Sparki leest de echte lijn en het
-          hoogteprofiel en zet hem bij je bewaarde routes.
+          Upload een GPX-bestand (max 11 MB) — de echte lijn en het
+          hoogteprofiel worden ingelezen en bij je bewaarde routes gezet.

=== artifacts/sparki/src/components/sparki/sparki-input-center.tsx
-      setError("Sparki kon niet antwoorden. Probeer het opnieuw.")
+      setError("Er kon geen antwoord komen. Probeer het opnieuw.")
-              Geef Sparki een foto, afbeelding, PDF, bestand of link, of stel je
-              vraag. Je begint elke keer met een schoon gesprek — Sparki onthoudt
-              wel alles uit eerdere gesprekken om je beter te leren kennen.
+              Deel een foto, afbeelding, PDF, bestand of link, of stel je
+              vraag. Je begint elke keer met een schoon gesprek — alles uit
+              eerdere gesprekken wordt wel onthouden om je beter te leren kennen.
-              placeholder="Stel Sparki een vraag of beschrijf wat je deelt…"
+              placeholder="Stel een vraag of beschrijf wat je deelt…"

=== artifacts/sparki/src/components/sparki/state-card.tsx
-          Sparki kon je toestand nu niet ophalen.
+          Je toestand kon nu niet worden opgehaald.
-            Hoe voel je je vandaag? Sparki past je beeld er direct op aan.
+            Hoe voel je je vandaag? Je beeld wordt er direct op aangepast.
-                Dit is waar Sparki vandaag naar kijkt:
+                Dit weegt vandaag mee in je beeld:
-                Sparki heeft nog te weinig data om je beeld te onderbouwen.
+                Er is nog te weinig data om je beeld te onderbouwen.

=== artifacts/sparki/src/components/sparki/training-builder.tsx
-          Op basis van je signalen stelt Sparki vandaag rust voor. Zelf toch
+          Op basis van je signalen is rust vandaag het advies. Zelf toch

=== artifacts/sparki/src/components/sparki/training-day-home.tsx
-                        Geen notities van je coach — Sparki interpreteert het doel
-                        hieronder.
+                        Geen notities van je coach — het doel wordt hieronder
+                        geïnterpreteerd.
-                Geen training gepland — voeg een wedstrijd toe en Sparki plant je
-                opbouw.
+                Geen training gepland — voeg een wedstrijd toe, dan wordt je
+                opbouw ingepland.

=== artifacts/sparki/src/components/sparki/training-plan-panel.tsx
-            ? "Sparki kon de wedstrijdlocatie niet op de kaart vinden — controleer de plaatsnaam."
+            ? "De wedstrijdlocatie kon niet op de kaart worden gevonden — controleer de plaatsnaam."
-            Je hebt een coach. Sparki schrijft je trainingen niet zelf, maar geeft
-            een <span className="text-white/85">vrijblijvend advies</span> dat je
+            Je hebt een coach. Je trainingen worden hier niet zelf geschreven, wel
+            krijg je een <span className="text-white/85">vrijblijvend advies</span> dat je

=== artifacts/sparki/src/components/sparki/voeding-screen.tsx
-            Gelogd — Sparki neemt het mee.
+            Gelogd — het wordt meegenomen.
-            Sparki kon nu geen voedingsbegeleiding maken. Probeer het zo opnieuw.
+            Er kon nu geen voedingsbegeleiding worden gemaakt. Probeer het zo opnieuw.
-              Voor jonge sporters houdt Sparki het licht: eten is brandstof én
+              Voor jonge sporters blijft het licht: eten is brandstof én
-        toestemming gebruikt Sparki dit in je voedingsplan en analyses.
+        toestemming wordt dit gebruikt in je voedingsplan en analyses.
-              Sparki kon nu geen voedingsplan maken. Probeer het zo opnieuw.
+              Er kon nu geen voedingsplan worden gemaakt. Probeer het zo opnieuw.
-              Sparki kon je dag nu niet beoordelen. Probeer het zo opnieuw.
+              Je dag kon nu niet worden beoordeeld. Probeer het zo opnieuw.

=== artifacts/sparki/src/components/sparki/workout-detail-drawer.tsx
-                  Sparki is even niet bereikbaar. Probeer het zo opnieuw.
+                  Even niet bereikbaar. Probeer het zo opnieuw.
-                  ? "Deze training komt er nog aan. Klopt er iets niet of past het beter op een andere dag? Dan stemt Sparki je plan er vast op af."
-                  : "Laat weten hoe het ging — Sparki past je plan zo nodig aan."}
+                  ? "Deze training komt er nog aan. Klopt er iets niet of past het beter op een andere dag? Dan wordt je plan er vast op afgestemd."
+                  : "Laat weten hoe het ging — je plan wordt zo nodig aangepast."}
-                    ? "Wat moet Sparki weten? (optioneel)…"
+                    ? "Wat is goed om te weten? (optioneel)…"
-                  Sparki kon nu geen voorstel maken. Je feedback is wel bewaard.
+                  Er kon nu geen voorstel worden gemaakt. Je feedback is wel bewaard.
-                          binnenkomt, koppelt Sparki die automatisch — of koppel
+                          binnenkomt, wordt die automatisch gekoppeld — of koppel

=== artifacts/sparki/src/lib/core-profile.ts
-        "Sparki heeft minstens een paar weken aan ritten nodig om dit betrouwbaar in te schatten. Koppel je sportdata of log meer ritten.",
+        "Er zijn minstens een paar weken aan ritten nodig om dit betrouwbaar in te schatten. Koppel je sportdata of log meer ritten.",
-    ? `${baseMeaning} Omdat je nu ${profile?.healthStatus === "injured" ? "geblesseerd" : "ziek"} bent, houdt Sparki je belastbaarheid bewust laag tot je hersteld bent.`
+    ? `${baseMeaning} Omdat je nu ${profile?.healthStatus === "injured" ? "geblesseerd" : "ziek"} bent, wordt je belastbaarheid bewust laag gehouden tot je hersteld bent.`
-      "Sparki heeft minstens twee FTP-metingen nodig om je groeiruimte in te schatten. Doe een FTP-test of koppel je sportdata zodat metingen binnenkomen.",
+      "Er zijn minstens twee FTP-metingen nodig om je groeiruimte in te schatten. Doe een FTP-test of koppel je sportdata zodat metingen binnenkomen.",

=== artifacts/sparki/src/lib/day-advice.ts
-      weatherNote = `Door ${reason} (${weatherText(w)}) zet Sparki je geplande ${was === "intervals" ? "intervallen" : "tempotraining"} om naar een rustigere duurrit; binnen op de trainer kun je wel intensief.`
+      weatherNote = `Door ${reason} (${weatherText(w)}) wordt je geplande ${was === "intervals" ? "intervallen" : "tempotraining"} omgezet naar een rustigere duurrit; binnen op de trainer kun je wel intensief.`

=== artifacts/sparki/src/lib/day-type.ts
-    why: "Sparki heeft een gezondheidssignaal opgepikt. Training is vandaag geblokkeerd tot je hersteld bent.",
+    why: "Er is een gezondheidssignaal opgepikt. Training is vandaag geblokkeerd tot je hersteld bent.",
-    why: "Sparki heeft deze sessie afgestemd op je vorm en herstel.",
+    why: "Deze sessie is afgestemd op je vorm en herstel.",

=== artifacts/sparki/src/lib/material-advice.ts
-  "Sparki kan dit op basis van deze foto('s) niet beoordelen en geeft daarom nog geen advies. Voeg een extra of scherpere foto toe voor een eerlijke inschatting."
+  "Dit is op basis van deze foto('s) niet te beoordelen, daarom nog geen advies. Voeg een extra of scherpere foto toe voor een eerlijke inschatting."

=== artifacts/sparki/src/lib/missing-input.ts
-      "Sparki heeft je FTP nodig om je trainingszones en belasting te berekenen.",
+      "Je FTP is nodig om je trainingszones en belasting te berekenen.",
-      "Sparki verdeelt je training over de week op basis van hoeveel uur je beschikbaar hebt.",
+      "Je training wordt over de week verdeeld op basis van hoeveel uur je beschikbaar hebt.",
-      "Zonder doel weet Sparki niet waar je naartoe traint. Geef aan waar je naartoe wilt.",
+      "Zonder doel is niet duidelijk waar je naartoe traint. Geef aan waar je naartoe wilt.",
-      "Kies waar je op de lange termijn naartoe wilt — recreatief, een toertocht, wedstrijden of hoger. Sparki weegt elk advies af tegen dat doel.",
+      "Kies waar je op de lange termijn naartoe wilt — recreatief, een toertocht, wedstrijden of hoger. Elk advies wordt afgewogen tegen dat doel.",
-      "Met je geboortedatum stemt Sparki je zones en advies af op je exacte leeftijd.",
+      "Met je geboortedatum worden je zones en advies afgestemd op je exacte leeftijd.",
-      "Vertel Sparki welke discipline je rijdt, zodat het advies bij jouw sport past.",
+      "Geef aan welke discipline je rijdt, zodat het advies bij jouw sport past.",

=== artifacts/sparki/src/lib/train-intelligence.ts
-        "Zonder doel of wedstrijd is er geen maatstaf voor of je training de goede kant op gaat. Met een doel weegt Sparki je opbouw, je vermoeidheid en je planning af tegen waar je naartoe wilt.",
+        "Zonder doel of wedstrijd is er geen maatstaf voor of je training de goede kant op gaat. Met een doel worden je opbouw, je vermoeidheid en je planning afgewogen tegen waar je naartoe wilt.",
-        "Sparki heeft minimaal twee weken aan gelogde trainingen nodig om je opbouw richting dit doel te beoordelen. Log je trainingen of koppel een platform, dan wordt je koers zichtbaar.",
+        "Er zijn minimaal twee weken aan gelogde trainingen nodig om je opbouw richting dit doel te beoordelen. Log je trainingen of koppel een platform, dan wordt je koers zichtbaar.",

=== artifacts/sparki/src/lib/uitleg-content.ts
-    waarom: "Dit doel weegt overal mee waar Sparki een keuze maakt: in je voedingsplan, je dagadvies, je trainingsschema en je analyse. Waar het meeweegt, wordt het ook benoemd — zo zie je dat het doel echt iets doet.",
-    hoe: "De sturing is bewust rustig: maximaal 0,5 kg per week, alleen via je gewone maaltijden op rustige momenten. Trainingen worden altijd volledig gevoed — het doel snijdt nooit in je trainingsvoeding. Onder de 17 stuurt Sparki bewust helemaal niet op gewicht.",
+    waarom: "Dit doel weegt overal mee waar een keuze wordt gemaakt: in je voedingsplan, je dagadvies, je trainingsschema en je analyse. Waar het meeweegt, wordt het ook benoemd — zo zie je dat het doel echt iets doet.",
+    hoe: "De sturing is bewust rustig: maximaal 0,5 kg per week, alleen via je gewone maaltijden op rustige momenten. Trainingen worden altijd volledig gevoed — het doel snijdt nooit in je trainingsvoeding. Onder de 17 wordt bewust helemaal niet op gewicht gestuurd.",

=== artifacts/sparki/src/lib/workout-blocks.ts
-    supportsGoal: "Zelf gekozen training — Sparki bewaakt de belasting mee.",
+    supportsGoal: "Zelf gekozen training — de belasting wordt mee bewaakt.",

=== artifacts/sparki/src/pages/club.tsx
-              : " Sparki past niets automatisch aan; kies zelf wat je doet."}
+              : " Er wordt niets automatisch aangepast; kies zelf wat je doet."}

=== artifacts/sparki/src/pages/coach-cockpit.tsx
-              Sparki past jouw trainingen nooit zelf aan — jij beslist.
+              Jouw trainingen worden nooit automatisch aangepast — jij beslist.

=== artifacts/sparki/src/pages/core-plan.tsx
-            <p className="type-label text-accent-cyan uppercase tracking-wider mb-1">Sparki wil iets weten</p>
+            <p className="type-label text-accent-cyan uppercase tracking-wider mb-1">Nog even dit</p>
-              Sparki vergelijkt je belasting, herstel en gevoel op verbanden…
+              Je belasting, herstel en gevoel worden vergeleken op verbanden…

=== artifacts/sparki/src/pages/feed.tsx
-      text: "Nog niets te tonen. Vul je dagelijkse check-in in zodat Sparki iets te melden heeft.",
+      text: "Nog niets te tonen. Vul je dagelijkse check-in in zodat er iets te melden is.",
-      text: "Nog geen nieuws beschikbaar — Sparki stemt dit af op jouw sport en doelen zodra er iets relevants is.",
+      text: "Nog geen nieuws beschikbaar — dit wordt afgestemd op jouw sport en doelen zodra er iets relevants is.",
-      text: "Sparki heeft nog te weinig gegevens om je te coachen. Vul je check-in in zodat er iets te analyseren is.",
+      text: "Er zijn nog te weinig gegevens om je te coachen. Vul je check-in in zodat er iets te analyseren is.",
-            Door Sparki afgestemd op jouw sport en doelen
+            Afgestemd op jouw sport en doelen

=== artifacts/sparki/src/pages/geluid.tsx
-                  Wekt je op de ingestelde tijd terwijl Sparki openstaat.
+                  Wekt je op de ingestelde tijd terwijl de app openstaat.
-            staat of Sparki dicht is. Deze wekker werkt nu volledig zolang Sparki
+            staat of de app dicht is. Deze wekker werkt nu volledig zolang de app

=== artifacts/sparki/src/pages/kalender.tsx
-          Sparki weegt dit mee zodra je schema opnieuw wordt opgebouwd. Wil je
+          Dit weegt mee zodra je schema opnieuw wordt opgebouwd. Wil je

=== artifacts/sparki/src/pages/lab.tsx
-        description="Sparki heeft je FTP nodig om je vooruitgang te volgen. Stel je FTP in of log een test."
+        description="Je FTP is nodig om je vooruitgang te volgen. Stel je FTP in of log een test."
-            Sparki je capaciteitsprofiel kan opbouwen.
+            je capaciteitsprofiel kan worden opgebouwd.

=== artifacts/sparki/src/pages/photo-lab.tsx
-                    Sparki bewerkt je foto…
+                    Je foto wordt bewerkt…
-                      "Sparki kon de sfeer nu niet toepassen. Je originele foto blijft bruikbaar."}
+                      "De sfeer kon nu niet worden toegepast. Je originele foto blijft bruikbaar."}

=== artifacts/sparki/src/pages/races.tsx
-      return "Het weer is er nog niet — een voorspelling bestaat pas vanaf ~16 dagen voor de wedstrijd. Sparki vult het later automatisch aan."
+      return "Het weer is er nog niet — een voorspelling bestaat pas vanaf ~16 dagen voor de wedstrijd. Het wordt later automatisch aangevuld."
-      return "Geef hieronder een locatie op, dan haalt Sparki het weer erbij."
+      return "Geef hieronder een locatie op, dan wordt het weer erbij gehaald."
-      return "Sparki kon deze locatie niet op de kaart vinden — controleer de plaatsnaam."
+      return "Deze locatie kon niet op de kaart worden gevonden — controleer de plaatsnaam."
-      return "Sparki kent je thuislocatie nog niet — stel die in bij je profiel, dan rekent Sparki de afstand uit."
+      return "Je thuislocatie is nog niet bekend — stel die in bij je profiel, dan wordt de afstand uitgerekend."
-      return "Vul de locatie in, dan berekent Sparki de afstand vanaf huis."
+      return "Vul de locatie in, dan wordt de afstand vanaf huis berekend."
-      return "Sparki kon de locatie niet op de kaart vinden — controleer de plaatsnaam."
+      return "De locatie kon niet op de kaart worden gevonden — controleer de plaatsnaam."
-          Sparki heeft alvast gekeken
+          Alvast bekeken
-        Dit haalde Sparki er zelf bij. Controleer het en vul alleen aan wat
+        Dit is automatisch erbij gezocht. Controleer het en vul alleen aan wat
-          Sparki vulde alvast een voorstel in op basis van je discipline en
+          Er is alvast een voorstel ingevuld op basis van je discipline en

=== artifacts/sparki/src/pages/samen.tsx
-            Sparki vraagt
+            Nog even dit
-              placeholder="Vertel Sparki kort hoe het ging…"
+              placeholder="Vertel kort hoe het ging…"
-          wedstrijd plant of Sparki iets wil weten, verschijnt het hier.
+          wedstrijd plant of er nog een vraag voor je is, verschijnt het hier.
-                : "Sparki zoekt naar momenten om samen te trainen."}
+                : "Er wordt gezocht naar momenten om samen te trainen."}

=== artifacts/sparki/src/pages/support.tsx
-          Stel je vraag. Sparki antwoordt op basis van de beheerde kennisbank;
+          Stel je vraag. Je krijgt antwoord op basis van de beheerde kennisbank;
-          <p className="mt-3 text-[12px] text-white/35">Sparki zoekt het uit…</p>
+          <p className="mt-3 text-[12px] text-white/35">Bezig met uitzoeken…</p>

=== artifacts/sparki/src/pages/you.tsx
-                    hoger. Sparki weegt elk advies af tegen dat doel.
+                    hoger. Elk advies wordt afgewogen tegen dat doel.
```
