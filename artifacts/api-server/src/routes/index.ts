import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dailyRouter from "./daily";
import gameRouter from "./game";
import leaderboardRouter from "./leaderboard";
import wikipediaRouter from "./wikipedia";
import challengeRouter from "./challenge";
import friendsRouter from "./friends";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dailyRouter);
router.use(gameRouter);
router.use(leaderboardRouter);
router.use(wikipediaRouter);
router.use(challengeRouter);
router.use(friendsRouter);
router.use(profileRouter);

export default router;
