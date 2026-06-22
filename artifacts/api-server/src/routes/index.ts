import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import flagsRouter from "./flags";
import athleteRouter from "./athlete";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/flags", flagsRouter);
router.use("/athlete", athleteRouter);
router.use("/ai", aiRouter);

export default router;
