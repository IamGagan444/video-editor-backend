const axios = require('axios');

const generateStoryboard = async (req, res) => {
  try {
    const { script } = req.body;
    const response = await axios.post('https://api.pictory.ai/pictoryapis/v1/video/storyboard', {
      videoName: "Generated Video",
      videoDescription: "AI Generated Video",
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
    }, {
      headers: {
        'Authorization': `Bearer ${req.pictoryToken}`,
        'X-Pictory-User-Id': process.env.PICTORY_CLIENT_ID,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error generating storyboard:', error);
    res.status(500).json({ error: 'Failed to generate storyboard' });
  }
};

const updateStoryboard = async (req, res) => {
  try {
    const { jobId, scenes } = req.body;
    const response = await axios.put(`https://api.pictory.ai/pictoryapis/v1/video/storyboard/${jobId}`, {
      scenes: scenes,
    }, {
      headers: {
        'Authorization': `Bearer ${req.pictoryToken}`,
        'X-Pictory-User-Id': process.env.PICTORY_CLIENT_ID,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error updating storyboard:', error);
    res.status(500).json({ error: 'Failed to update storyboard' });
  }
};

const renderVideo = async (req, res) => {
  try {
    const { jobId } = req.body;
    const response = await axios.post(`https://api.pictory.ai/pictoryapis/v1/video/render/${jobId}`, {}, {
      headers: {
        'Authorization': `Bearer ${req.pictoryToken}`,
        'X-Pictory-User-Id': process.env.PICTORY_CLIENT_ID,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error rendering video:', error);
    res.status(500).json({ error: 'Failed to render video' });
  }
};

module.exports = {
  generateStoryboard,
  updateStoryboard,
  renderVideo,
};

