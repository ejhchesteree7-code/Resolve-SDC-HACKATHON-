import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { authorize } from "../lib/resolve-permissions";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  authorize(null, "health", null);
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
