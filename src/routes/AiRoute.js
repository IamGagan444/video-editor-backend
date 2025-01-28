import { Router } from "express";
import { videoGeneratorAi ,promptGenerator} from "../controller/NewController.js";

const router=Router();

router.route("/generate-video").post(videoGeneratorAi)
router.route("/generate-script").post(promptGenerator)



export default router