import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import flagsRouter from "./flags";
import athleteRouter from "./athlete";
import racesRouter from "./races";
import invitationsRouter from "./invitations";
import aiRouter from "./ai";
import memoryRouter from "./memory";
import privacyRouter from "./privacy";
import onboardingRouter from "./onboarding";
import connectorsRouter from "./connectors";
import hubRouter from "./hub";
import coachRouter from "./coach";
import parentRouter from "./parent";
import linksRouter from "./links";
import nutritionRouter from "./nutrition";
import notificationsRouter from "./notifications";
import activityImportsRouter from "./activity-imports";
import routesRouter from "./routes";
import trainingPlanRouter from "./training-plan";
import bugReportsRouter from "./bug-reports";
import knowledgeRouter from "./knowledge";
import feedRouter from "./feed";
import socialRouter from "./social";
import voiceRouter from "./voice";
import insightsRouter from "./insights";
import adminRouter from "./admin";
import storageRouter from "./storage";
import inputCenterRouter from "./input-center";
import materialRouter from "./material";
import documentAnalysisRouter from "./document-analysis";
import calendarRouter from "./calendar";
import devRouter from "./dev";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/flags", flagsRouter);
router.use("/athlete", athleteRouter);
router.use("/races", racesRouter);
router.use("/invitations", invitationsRouter);
router.use("/ai", aiRouter);
router.use("/memory", memoryRouter);
router.use("/privacy", privacyRouter);
router.use("/onboarding", onboardingRouter);
router.use("/connectors", connectorsRouter);
router.use("/hub", hubRouter);
router.use("/coach", coachRouter);
router.use("/parent", parentRouter);
router.use("/links", linksRouter);
router.use("/nutrition", nutritionRouter);
router.use("/notifications", notificationsRouter);
router.use("/activity-imports", activityImportsRouter);
router.use("/routes", routesRouter);
router.use("/training-plan", trainingPlanRouter);
router.use("/bug-reports", bugReportsRouter);
router.use("/knowledge", knowledgeRouter);
router.use("/feed", feedRouter);
router.use("/social", socialRouter);
router.use("/voice", voiceRouter);
router.use(insightsRouter);
router.use("/admin", adminRouter);
router.use(storageRouter);
router.use(inputCenterRouter);
router.use("/material", materialRouter);
router.use("/document-analyses", documentAnalysisRouter);
router.use("/calendar", calendarRouter);

// Dev-only routes (preview-athlete switcher). Mounted ONLY outside production so
// these endpoints simply do not exist on a deployed build.
if (process.env.NODE_ENV !== "production") {
  router.use("/dev", devRouter);
}

export default router;
