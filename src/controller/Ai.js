import { ApiError } from "../utils/ApiError.js";
import { Apiresponse } from "../utils/Apiresponse.js";
import { AsyncHandler } from "../utils/Asynchandler.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const clientId = process.env.PICTORY_CLIENT_ID?.trim();
const clientSecret = process.env.PICTORY_API_SECREAT?.trim();

const videoGeneratorAi = AsyncHandler(async (req, res, next) => {
  const { prompt } = req.body;

  if (!prompt) {
    return next(new ApiError(400, "Prompt is required to generate a video!"));
  }

  try {
    // Step 1: Expand Prompt with Gemini AI
    const expandedScript = await expandPrompt(prompt);

    if (!expandedScript) {
      throw new ApiError(500, "There is an issue with Gemini AI.");
    }

    // Step 2: Authenticate with Pictory API
    const accessToken = await authenticateWithPictory();

    // Step 3: Generate Video
    const videoJobID = await generateVideoWithPictory(
      accessToken,
      expandedScript
    );
    console.log("videoJOBID", videoJobID);

    if (!videoJobID) {
      throw new ApiError(500, "There is an issue with Pictory AI.");
    }

    // Step 4: Poll for Video Completion
    const videoData = await pollForVideoCompletion(videoJobID, accessToken);
    console.log("videourldata", videoData.renderParams);


    
    if (videoData.status !== "in-progress") {
      // Step 5: Render Video
      const renderJobId = await renderVideo(videoJobID, accessToken,videoData.renderParams);
      const renderPutJobId = await renderPutVideo(videoJobID, accessToken,videoData.renderParams);
     


      if (renderPutJobId) {
        // Step 7: Get Video Download URL
        const videoURL = await getVideoDownloadURL(renderJobId, accessToken);
        console.log("Final Video URL:", videoURL);

        return res
          .status(200)
          .json(
            new Apiresponse(200, "Video generated and rendered successfully!", {
              videoURL,
            })
          );
      } else {
        throw new ApiError(500, "Video rendering failed or timed out.");
      }
    }

    // Response for "in-progress" status (fallback)
    return res
      .status(202)
      .json(
        new Apiresponse(202, "Video generation is in progress. Please try again later.", {
          status: videoData,
        })
      );
  } catch (error) {
    next(error);
  }
});

async function expandPrompt(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const result = await model.generateContent(`
    Expand the following prompt into a detailed twenty second script for a motivational video:
    "${prompt}"
    The script should be engaging, inspirational, and suitable for visual representation.
  `);
  return result.response.text();
}

async function authenticateWithPictory() {
  try {
    const response = await axios.post(
      "https://api.pictory.ai/pictoryapis/v1/oauth2/token",
      {
        client_id: clientId,
        client_secret: clientSecret,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("step-1 authentication creation:", response.data.access_token);
    if (response.data && response.data.access_token) {
      return response.data.access_token;
    } else {
      throw new Error("Failed to obtain access token from Pictory API.");
    }
  } catch (error) {
    console.error(
      "Authentication Error:",
      error.response?.data || error.message
    );
    throw new ApiError(500, "Authentication with Pictory API failed.");
  }
}

async function generateVideoWithPictory(accessToken, script) {
  try {
    const response = await axios.post(
      "https://api.pictory.ai/pictoryapis/v1/video/storyboard",
      {
        videoName: "Sino-Japanese-War", 
        videoDescription: "Santa Claus is coming to town", 
        language: "en", 
        webhook: "https://webhook.site/4f88f3a7-a10c-4bb3-a2d8-00efd6d76754",
        brandLogo: {
            url: "https://pictory.ai/wp-content/uploads/2022/03/logo-new-fon-2t.png",
            verticalAlignment: "top",
            horizontalAlignment: "right"
        },
        audio: {
            autoBackgroundMusic: true,
            backGroundMusicVolume: 0.5,
            aiVoiceOver: {
                speaker: "Jackson",
                speed: 100,
                amplifyLevel: 0
            }
        },
        scenes: [
            {
                text: "script",
                voiceOver: true,
                splitTextOnNewLine: false,
                splitTextOnPeriod: true
            }
        ],
        voiceOver: true, 
        splitTextOnNewLine: false, 
        splitTextOnPeriod: true 
    },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Pictory-User-Id": "PictoryCustomer",
        },
      }
    );

    console.log("Step 2: Generate Video Preview from Text:", response.data);

    if (response.data && response.data.data) {
      return response.data.jobId;
    } else {
      throw new Error("Failed to generate video preview.");
    }
  } catch (error) {
    console.error(
      "Video Generation Error:",
      error.response?.data || error.message
    );
    throw new ApiError(500, "Video generation with Pictory API failed.");
  }
}

async function pollForVideoCompletion(jobId, accessToken) {
  const pollingInterval = 15000; // 15 seconds
  const maxRetries = 20; // Stop polling after 20 attempts

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(
        `https://api.pictory.ai/pictoryapis/v1/jobs/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Pictory-User-Id": "PictoryCustomer",
          },
        }
      );

      console.log("Step 3: GET Video Preview:", response.data);

      const status = response.data?.data?.status;

      if (status !== "in-progress") {
        return response.data?.data;
      } else if (status === "in-progress") {
        console.log("Video generation is still in progress...");
      } else {
        throw new Error(`Unexpected job status: ${status}`);
      }
    } catch (error) {
      console.error("Polling Error:", error.response?.data || error.message);
    }

    await new Promise(resolve => setTimeout(resolve, pollingInterval));
  }

  throw new ApiError(500, "Polling exceeded maximum retries.");
}

async function renderVideo(jobId, accessToken,videoData) {
  try {
    const response = await axios.post(
      "https://api.pictory.ai/pictoryapis/v1/video/render",
      {
       videoData
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Pictory-User-Id": "PictoryCustomer",
        },
      }
    );

    console.log("STEP-4, Render Video Response:", response.data);

    if (response.data && response.data.data.job_id) {
      return response.data.data.job_id;
    } else {
      throw new Error("Failed to initiate video rendering.");
    }
  } catch (error) {
    console.error("Render Video Error:", error.response?.data || error.message);
    throw new ApiError(500, "Video rendering with Pictory API failed.");
  }
}

async function renderPutVideo(jobId, accessToken,videoData) {
  try {
    const response = await axios.put(
      `https://api.pictory.ai/pictoryapis/v1/video/render/${jobId}`,
      {
        videoData
      },
    
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Pictory-User-Id": "PictoryCustomer",
        },
      }
    );

    console.log("STEP-4, Render put Video Response:", response.data);

    if (response.data && response.data.data.job_id) {
      return response.data.data.job_id;
    } else {
      throw new Error("Failed to initiate video rendering.");
    }
  } catch (error) {
    console.error("Render Video Error:", error.response?.data || error.message);
    throw new ApiError(500, "Video rendering with Pictory API failed.");
  }
}

async function getVideoDownloadURL(jobId, accessToken) {
  const pollingInterval = 10000; // 15 seconds
  let maxRetries = 50; // Maximum polling attempts

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(
        `https://api.pictory.ai/pictoryapis/v1/jobs/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Pictory-User-Id": "PictoryCustomer",
            
          },
        }
      );

      console.log("Step-5 Get Video Download URL Response :", response.data);

      const jobStatus = response.data?.data?.status;
      const videoUrl = response.data?.data?.output?.name; 

      if (jobStatus === "completed" && videoUrl) {
      
        return videoUrl;
      } else if (jobStatus === "failed" || jobStatus === "canceled") {
        throw new ApiError(500, `Video job failed with status: ${jobStatus}`);
      } else if (jobStatus === "in-progress") {
        maxRetries+=1
        console.log("Video rendering is still in progress, polling again...");
      } else {
        throw new Error(`Unexpected job status: ${jobStatus}`);
      }
    } catch (error) {
      console.error("Get Video Download URL Error:", error.response?.data || error.message);
      throw new ApiError(500, "Failed to retrieve video download URL.");
    }

    // Wait for the polling interval before the next attempt
    await new Promise(resolve => setTimeout(resolve, pollingInterval));
  }

  throw new ApiError(500, "Polling exceeded maximum retries for video download URL.");
}



export { videoGeneratorAi };

