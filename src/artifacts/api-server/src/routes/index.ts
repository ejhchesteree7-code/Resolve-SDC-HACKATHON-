import { Router, type IRouter } from "express";
import healthRouter from "./health";
import resolveRouter from "./resolve";
import publicRouter from "./resolve-public";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use(resolveRouter);

export default router;
