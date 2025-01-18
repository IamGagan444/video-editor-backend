import { ApiError } from "../utils/ApiError.js"; // Unchanged
import { Apiresponse } from "../utils/Apiresponse.js"; // Unchanged
import { AsyncHandler } from "../utils/Asynchandler.js"; // Unchanged
import { GoogleGenerativeAI } from "@google/generative-ai"; // Unchanged
import axios from "axios"; // Unchanged

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Unchanged
const clientId = process.env.PICTORY_CLIENT_ID?.trim(); // Unchanged
const clientSecret = process.env.PICTORY_API_SECREAT?.trim(); // Unchanged

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
    console.log("videourldata", videoData);

    if (videoData.status === "completed") {
      // Step 5: Get Video Download URL
      const videoURL = await getVideoDownloadURL(videoJobID, accessToken);
      console.log("Final Video URL:", videoURL);

      return res
        .status(200)
        .json(
          new Apiresponse(200, "Video generated successfully!", {
            videoURL,
          })
        );
    }

    // Response for "in-progress" status (fallback)
    return res
      .status(202)
      .json(
        new Apiresponse(202, "Video generation is in progress. Please try again later.", {
          status: videoData.status,
        })
      );
  } catch (error) {
    next(error);
  }
});




// Function to expand prompt using Gemini AI (Unchanged)
async function expandPrompt(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const result = await model.generateContent(`
    Expand the following prompt into a detailed one-minute script for a motivational video:
    "${prompt}"
    The script should be engaging, inspirational, and suitable for visual representation.
  `);
  return result.response.text();
}

// Function to authenticate with Pictory API (Unchanged)
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
    console.log("authentication creation::", response.data.access_token);
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

// Function to generate video using Pictory API (Unchanged)
async function generateVideoWithPictory(accessToken, script) {
  try {
    const response = await axios.post(
      "https://api.pictory.ai/pictoryapis/v1/video/storyboard",
      {
        videoName: "Santa Claus",
        videoDescription: "Santa Claus is coming to town",
        language: "en",
        audio: {
          autoBackgroundMusic: true,
          backGroundMusicVolume: 0.5,
          aiVoiceOver: {
            speaker: "Jackson",
            speed: 100,
            amplifyLevel: 0,
          },
        },
        scenes: [
          {
            text: script,
            voiceOver: true,
            splitTextOnNewLine: false,
            splitTextOnPeriod: true,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Pictory-User-Id": "PictoryCustomer",
        },
      }
    );

    console.log("Pictory API Response:", response.data);

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

// Function to poll for video completion (Unchanged)
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

      console.log("Polling Response:", response.data);

      const status = response.data?.data?.status;

      if (status !== "in-progress") {
        return response.data?.data; // Return video data
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

// Function to get the video download URL (New)
async function getVideoDownloadURL(jobId, accessToken) {
  try {
    const response = await axios.get(
      `https://api.pictory.ai/pictoryapis/v1/jobs/${jobId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Pictory-User-Id": "PictoryCustomer",
          responseType: 'stream' 
        },
      }
    );

    console.log("Get Video Download URL Response:", response.data);

    if (response.data && response.data.data && response.data.data.renderParams.output) {
      return response.data.data.renderParams.output.name;
    } else {
      throw new Error("Failed to retrieve video download URL.");
    }
  } catch (error) {
    console.error("Get Video Download URL Error:", error.response?.data || error.message);
    throw new ApiError(500, "Failed to retrieve video download URL.");
  }
}

export { videoGeneratorAi };
