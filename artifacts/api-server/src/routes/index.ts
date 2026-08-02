import { Router, type IRouter } from "express";
import healthRouter from "./health";
import e2eProofRouter from "./e2e-proof";
import authRouter from "./auth";
import mobileWebSessionRouter from "./mobile-web-session";
import flagsRouter from "./flags";
import athleteRouter from "./athlete";
import racesRouter from "./races";
import racePointsRouter from "./race-points";
import raceExportsRouter from "./race-exports";
import invitationsRouter from "./invitations";
import aiRouter from "./ai";
import memoryRouter from "./memory";
import privacyRouter from "./privacy";
import consentRouter from "./consent";
import onboardingRouter from "./onboarding";
import connectorsRouter from "./connectors";
import deviceSyncRouter from "./device-sync";
import webhooksRouter from "./webhooks";
import hubRouter from "./hub";
import coachRouter from "./coach";
import coachCockpitRouter from "./coach-cockpit";
import parentRouter from "./parent";
import linksRouter from "./links";
import nutritionRouter from "./nutrition";
import notificationsRouter from "./notifications";
import activityImportsRouter from "./activity-imports";
import routesRouter from "./routes";
import routeProposalsRouter from "./route-proposals";
import routeCandidatesRouter from "./route-candidates";
import routeUsageRouter from "./route-usage";
import volgautoRouter from "./volgauto";
import navSettingsRouter from "./nav-settings";
import uiPreferencesRouter from "./ui-preferences";
import mediaStatusRouter from "./media-status";
import trainingPlanRouter from "./training-plan";
import bugReportsRouter from "./bug-reports";
import supportRouter from "./support";
import knowledgeRouter from "./knowledge";
import knowledgeAdminRouter from "./knowledge-admin";
import intelRouter from "./intel";
import feedRouter from "./feed";
import socialRouter from "./social";
import liveLocationRouter from "./live-location";
import voiceRouter from "./voice";
import insightsRouter from "./insights";
import mentalRouter from "./mental";
import adminRouter from "./admin";
import storageRouter from "./storage";
import inputCenterRouter from "./input-center";
import materialRouter from "./material";
import garageRouter from "./garage";
import bikeScanRouter from "./bike-scan";
import documentAnalysisRouter from "./document-analysis";
import calendarRouter from "./calendar";
import stateRouter from "./state";
import todayRouter from "./today";
import photoStyleRouter from "./photo-style";
import corePredictionRouter from "./core-prediction";
import telemetryRouter from "./telemetry";
import roadObjectsRouter from "./road-objects";
import weatherRouter from "./weather";
import audioRouter from "./audio";
import sparkiWorldRouter from "./sparki-world";
import worldSocialRouter from "./world-social";
import raceRoomsRouter from "./race-rooms";
import goalsRouter from "./goals";
import adviceDossiersRouter from "./advice-dossiers";
import engagementRouter from "./engagement";
import clubRouter from "./club";
import workObjectsRouter from "./work-objects";
import clubRaceLogisticsRouter from "./club-race-logistics";
import clubRaceDocumentsRouter from "./club-race-documents";
import clubDocumentsRouter from "./club-documents";
import clubRaceDayRouter, { raceGuestPublicRouter } from "./club-race-day";
import coachMessagesRouter from "./coach-messages";
import rideStoryRouter from "./ride-story";
import sprintsRouter from "./sprints";
import climbsRouter from "./climbs";
import alertsRouter from "./alerts";
import shareRouter from "./share";
import devRouter from "./dev";
import accountRouter from "./account";
import legalRouter from "./legal";
import analysisFeedbackRouter from "./analysis-feedback";
import buildRatingsRouter from "./build-ratings";
import journeyRouter from "./journey";
import healthFlowRouter from "./health-flow";
import passportRouter from "./passport";
import releaseRouter from "./release";
import entitlementsRouter from "./entitlements";
import billingRouter from "./billing";
import subscriptionPayersRouter from "./subscription-payers";
import trainerRouter from "./trainer";
import trainerClientsRouter from "./trainer-clients";
import trainerGroupsRouter from "./trainer-groups";
import trainerDocumentsRouter from "./trainer-documents";
import trainerBillingRouter from "./trainer-billing";
import trainerLetterheadRouter from "./trainer-letterhead";
import trainerAiDraftsRouter from "./trainer-ai-drafts";
import dataOriginRouter from "./data-origin";
import aiFoundationRouter from "./ai-foundation";
import searchRouter from "./search";
import attentionRouter from "./attention";

import { killSwitchGuard } from "../lib/kill-switches";
import { consentGate } from "../middlewares/consentGate";
import { blockParentSporterWrites } from "../lib/parent-write-block";

const router: IRouter = Router();

router.use(healthRouter);
// Verplichte juridische acceptatie — blokkeert alles behalve de allowlist
// (health, /auth, /legal, /webhooks, /release) tot alle actieve document-
// versies geaccepteerd zijn. Zie middlewares/consentGate.ts.
router.use(consentGate);
router.use("/auth", authRouter);
router.use("/mobile-web", mobileWebSessionRouter);
router.use("/flags", flagsRouter);
// WP-R1: in de ouderrol zijn sporter-schrijfroutes (training/rit/doel/
// wedstrijd) server-side geblokkeerd — zie lib/parent-write-block.ts.
router.use("/athlete", blockParentSporterWrites);
router.use("/races", blockParentSporterWrites);
router.use("/goals", blockParentSporterWrites);
router.use("/training-plan", blockParentSporterWrites);
// Ritten komen óók binnen via bestandsimports — zelfde blokkade, anders is
// "geen rit aanmaken als ouder" via een upload alsnog te omzeilen.
router.use("/activity-imports", blockParentSporterWrites);
router.use("/athlete", athleteRouter);
router.use("/races", racePointsRouter);
router.use("/races", raceExportsRouter);
router.use("/races", racesRouter);
router.use("/invitations", invitationsRouter);
router.use("/ai", killSwitchGuard("ai_processing"), aiRouter);
router.use("/memory", memoryRouter);
router.use("/privacy", privacyRouter);
router.use("/consent", consentRouter);
router.use("/account", accountRouter);
router.use("/legal", legalRouter);
router.use("/analysis-feedback", analysisFeedbackRouter);
router.use("/build-ratings", buildRatingsRouter);
router.use("/data-origin", dataOriginRouter);
router.use("/search", searchRouter);
router.use("/foundation", aiFoundationRouter);
router.use("/journey", journeyRouter);
router.use("/health-flow", healthFlowRouter);
// Bewijs-endpoint (fail-closed: 404 zonder E2E_PROOF_TOKEN/E2E_PROOF_EMAIL)
router.use("/e2e", e2eProofRouter);
router.use("/passport", passportRouter);
router.use("/onboarding", onboardingRouter);
router.use("/connectors", connectorsRouter);
router.use("/device-sync", deviceSyncRouter);
router.use("/webhooks", webhooksRouter);
router.use("/hub", hubRouter);
router.use("/coach", coachRouter);
router.use("/coach", coachCockpitRouter);
router.use("/parent", parentRouter);
router.use("/links", linksRouter);
router.use("/nutrition", nutritionRouter);
router.use("/notifications", notificationsRouter);
// Bestandsimports vallen onder de imports-noodstop; uploads vanaf de telefoon
// hebben daarnaast een eigen noodstop (mobile_upload) op basis van het
// X-Sparki-Platform-header.
router.use(
  "/activity-imports",
  killSwitchGuard("imports_sync"),
  (req, res, next) => {
    if ((req.get("x-sparki-platform") ?? "").toLowerCase() === "mobiel") {
      killSwitchGuard("mobile_upload")(req, res, next);
      return;
    }
    next();
  },
  activityImportsRouter,
);
router.use("/route-candidates", routeCandidatesRouter);
// ROUTE_PAKKET_02A — uitleesbare teller van routegebruik (alleen meten).
router.use("/route-usage", routeUsageRouter);
router.use("/routes", routeProposalsRouter);
router.use("/routes", volgautoRouter);
router.use("/routes", routesRouter);
router.use("/nav-settings", navSettingsRouter);
router.use("/ui-preferences", uiPreferencesRouter);
router.use("/media-status", mediaStatusRouter);
router.use("/training-plan", trainingPlanRouter);
router.use("/bug-reports", bugReportsRouter);
router.use("/support", supportRouter);
router.use("/knowledge", knowledgeRouter);
router.use("/knowledge-beheer", knowledgeAdminRouter);
router.use("/intel", intelRouter);
router.use("/feed", feedRouter);
router.use("/social", socialRouter);
router.use("/live-location", liveLocationRouter);
router.use("/voice", killSwitchGuard("ai_processing"), voiceRouter);
router.use(insightsRouter);
router.use(mentalRouter);
router.use("/admin", adminRouter);
router.use(storageRouter);
router.use(inputCenterRouter);
router.use("/material", materialRouter);
router.use("/garage", garageRouter);
router.use("/bike-scan", bikeScanRouter);
router.use("/document-analyses", killSwitchGuard("ai_processing"), documentAnalysisRouter);
router.use("/calendar", calendarRouter);
router.use("/state", stateRouter);
router.use("/today", todayRouter);
router.use("/photo-style", photoStyleRouter);
router.use("/core-prediction", corePredictionRouter);
router.use("/telemetry", telemetryRouter);
router.use("/road-objects", roadObjectsRouter);
router.use("/weather", weatherRouter);
router.use("/audio", audioRouter);
router.use("/world", sparkiWorldRouter);
router.use("/world-social", worldSocialRouter);
router.use(raceRoomsRouter);
router.use("/goals", goalsRouter);
router.use("/advice-dossiers", adviceDossiersRouter);
router.use("/engagement", engagementRouter);
router.use("/ride-story", rideStoryRouter);
router.use("/sprints", sprintsRouter);
router.use("/climbs", climbsRouter);
router.use("/alerts", alertsRouter);
router.use("/attention", attentionRouter);
router.use("/share", shareRouter);
router.use("/clubs", killSwitchGuard("club_features"), clubRouter);
// SPARKI_BUILD_01 F7 lijn 3b: zelfstandige trainer ↔ gekoppelde sporter.
// Buiten de club, twee richtingen, ouder <16 leest mee. Zelfde berichtenlaag.
router.use("/coach-messages", coachMessagesRouter);
// Werkobjectlaag (SPARKI_INHAAL_01 BUILD_02): één gedeelde plan-laag voor de
// club — zelfde kill-switch en clubrechten als de rest van de clubomgeving.
router.use(
  "/clubs/:clubId/work-objects",
  killSwitchGuard("club_features"),
  workObjectsRouter,
);
// BUILD_03: dagschema, vervoer en materiaal per clubwedstrijd.
router.use(
  "/clubs/:clubId/races/:eventId",
  killSwitchGuard("club_features"),
  clubRaceLogisticsRouter,
);
// HERSTEL_EN_AANVULLING_01 F6: clubdocumenten (gedragscode, reglement, …).
router.use(
  "/clubs/:clubId/documents",
  killSwitchGuard("club_features"),
  clubDocumentsRouter,
);
// HERSTEL_EN_AANVULLING_01 F4: documentuitdraai (RT-12/13/14) per wedstrijd.
router.use(
  "/clubs/:clubId/races/:eventId/documents",
  killSwitchGuard("club_features"),
  clubRaceDocumentsRouter,
);
// BUILD_03: briefings, opdrachten, uitslag, evaluatie en gasten.
router.use(
  "/clubs/:clubId/races/:eventId",
  killSwitchGuard("club_features"),
  clubRaceDayRouter,
);
// Publieke gastweergave (zonder account) — token is de enige sleutel.
router.use("/race-guest", killSwitchGuard("club_features"), raceGuestPublicRouter);
router.use("/release", releaseRouter);
router.use("/entitlements", entitlementsRouter);
router.use("/billing", billingRouter);
// HERSTEL_EN_AANVULLING_01 F7: betaler ≠ gebruiker (club/ouder betaalt).
router.use("/billing/payers", subscriptionPayersRouter);
// SPARKI_BUILD_04: zelfstandige trainer (registratie zonder club, profiel,
// bedrijfsgegevens). Rechten blijven bij resolveEntitlements (tier TRAINER).
router.use("/trainer", trainerRouter);
// SPARKI_BUILD_04 F2: klant ≠ sporter ≠ betaler (BB-62); geen geldstromen.
router.use("/trainer/clients", trainerClientsRouter);
// SPARKI_BUILD_04 F3: sportergroepen — organisatie, géén rechtenbron.
router.use("/trainer/groups", trainerGroupsRouter);
// SPARKI_BUILD_04 F4: trainerdocumenten op de gedeelde werkobjectlaag.
router.use("/trainer/documents", trainerDocumentsRouter);
// SPARKI_BUILD_04 F5: diensten, cycli, conceptfacturen (nooit blind verzenden).
router.use("/trainer/billing", trainerBillingRouter);
// SPARKI_BUILD_04 F7: briefpapier met marge-/leesbaarheidscontrole.
router.use("/trainer/letterhead", trainerLetterheadRouter);
// SPARKI_BUILD_04 F13: AI-concepten (tekst-only, nooit bedragen/verzenden).
router.use("/trainer/ai-drafts", trainerAiDraftsRouter);

// Dev-only routes (preview-athlete switcher). Mounted ONLY outside production so
// these endpoints simply do not exist on a deployed build.
if (process.env.NODE_ENV !== "production" && !process.env.REPLIT_DEPLOYMENT) {
  router.use("/dev", devRouter);
}

export default router;
