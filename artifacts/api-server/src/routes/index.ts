import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import traitsRouter from "./traits";
import lockerRouter from "./locker";
import nftsRouter from "./nfts";
import adminRouter from "./admin";
import storageRouter from "./storage";
import swapRouter from "./swap";
import marketRouter from "./market";
import legendsRouter from "./legends";
import metadataRouter from "./metadata";
import bountiesRouter from "./bounties";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(traitsRouter);
router.use(lockerRouter);
router.use(nftsRouter);
router.use(adminRouter);
router.use(swapRouter);
router.use(marketRouter);
router.use(legendsRouter);
router.use(metadataRouter);
router.use(bountiesRouter);

export default router;
