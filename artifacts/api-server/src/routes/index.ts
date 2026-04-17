import { Router, type IRouter } from "express";
import healthRouter from "./health";
import traitsRouter from "./traits";
import lockerRouter from "./locker";
import nftsRouter from "./nfts";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(traitsRouter);
router.use(lockerRouter);
router.use(nftsRouter);
router.use(adminRouter);

export default router;
