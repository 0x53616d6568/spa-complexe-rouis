import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import authRouter from "./auth";
import healthRouter from "./health";
import managerRouter from "./manager";
import publicRouter from "./public";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(publicRouter);
router.use(managerRouter);
router.use(adminRouter);

export default router;
