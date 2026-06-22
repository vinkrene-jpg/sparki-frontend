import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import flagsRouter from "./flags";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/flags", flagsRouter);

export default router;
