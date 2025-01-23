import { Router } from "express";
import { videoGeneratorAi } from "../controller/Ai.js";

const router=Router();

router.route("/generate-video").post(videoGeneratorAi)
// router.route("/generate-script").post(promptGenerator)



export default router