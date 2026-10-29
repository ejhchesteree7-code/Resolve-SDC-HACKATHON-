import { Router, type IRouter } from "express";
import healthRouter from "./health";
import resolveRouter from "./resolve";
import publicRouter from "./resolve-public";
import authRouter from "./resolve-auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use(authRouter);
router.use(resolveRouter);

export default router;
