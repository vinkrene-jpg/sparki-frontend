import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import flagsRouter from "./flags";
import athleteRouter from "./athlete";
import racesRouter from "./races";
import racePointsRouter from "./race-points";
import raceExportsRouter from "./race-exports";
import invitationsRouter from "./invitations";
import aiRouter from "./ai";
import memoryRouter from "./memory";
import privacyRouter from "./privacy";
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
import navSettingsRouter from "./nav-settings";
import trainingPlanRouter from "./training-plan";
import bugReportsRouter from "./bug-reports";
import supportRouter from "./support";
import knowledgeRouter from "./knowledge";
import knowledgeAdminRouter from "./knowledge-admin";
import intelRouter from "./intel";
import feedRouter from "./feed";
import socialRouter from "./social";
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
import engagementRouter from "./engagement";
import clubRouter from "./club";
import rideStoryRouter from "./ride-story";
import sprintsRouter from "./sprints";
import climbsRouter from "./climbs";
import alertsRouter from "./alerts";
import shareRouter from "./share";
import devRouter from "./dev";
import accountRouter from "./account";
import legalRouter from "./legal";
import analysisFeedbackRouter from "./analysis-feedback";
import journeyRouter from "./journey";
import healthFlowRouter from "./health-flow";
import passportRouter from "./passport";
import releaseRouter from "./release";

import { killSwitchGuard } from "../lib/kill-switches";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/flags", flagsRouter);
router.use("/athlete", athleteRouter);
router.use("/races", racePointsRouter);
router.use("/races", raceExportsRouter);
router.use("/races", racesRouter);
router.use("/invitations", invitationsRouter);
router.use("/ai", killSwitchGuard("ai_processing"), aiRouter);
router.use("/memory", memoryRouter);
router.use("/privacy", privacyRouter);
router.use("/account", accountRouter);
router.use("/legal", legalRouter);
router.use("/analysis-feedback", analysisFeedbackRouter);
router.use("/journey", journeyRouter);
router.use("/health-flow", healthFlowRouter);
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
router.use("/routes", routeProposalsRouter);
router.use("/routes", routesRouter);
router.use("/nav-settings", navSettingsRouter);
router.use("/training-plan", trainingPlanRouter);
router.use("/bug-reports", bugReportsRouter);
router.use("/support", supportRouter);
router.use("/knowledge", knowledgeRouter);
router.use("/knowledge-beheer", knowledgeAdminRouter);
router.use("/intel", intelRouter);
router.use("/feed", feedRouter);
router.use("/social", socialRouter);
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
router.use("/engagement", engagementRouter);
router.use("/ride-story", rideStoryRouter);
router.use("/sprints", sprintsRouter);
router.use("/climbs", climbsRouter);
router.use("/alerts", alertsRouter);
router.use("/share", shareRouter);
router.use("/clubs", killSwitchGuard("club_features"), clubRouter);
router.use("/release", releaseRouter);

// Dev-only routes (preview-athlete switcher). Mounted ONLY outside production so
// these endpoints simply do not exist on a deployed build.
if (process.env.NODE_ENV !== "production") {
  router.use("/dev", devRouter);
}

export default router;
