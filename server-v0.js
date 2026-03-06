// server-v0.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateText } from 'ai'; // Your v0 SDK

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend

// ---- /api/generate ----
app.post('/api/generate', upload.single('screenshot'), async (req, res) => {
  try {
    const userPrompt = req.body.prompt || 'Create HTML from screenshot.';
    const includeJS = req.body.include_javascript === 'true';
    const makeInteractive = req.body.make_interactive === 'true';

    let prompt = userPrompt;
    if (includeJS || makeInteractive) {
      prompt += `
IMPORTANT: Include full JavaScript functionality and interactivity.`;
    }

    // Read and encode the uploaded screenshot
    const imageBuffer = fs.readFileSync(req.file.path);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Build messages array for the current v0 API
    const messages = [
      {
        role: "user",
        content: `Create HTML from this screenshot: data:${mimeType};base64,${imageBase64}\n\n${prompt}`,
      },
    ];

    // Call the AI API
    const response = await generateText({
      model: "v0-1.5-md",
      messages,
      temperature: 0.7,
      maxTokens: 4000, // safer temporary value
    });

    // Delete the temporary uploaded file
    fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      text: response.text,
      message: "HTML generated successfully!",
    });
  } catch (e) {
    console.error("Generation error:", e);
    res.status(500).json({ error: "Failed to generate HTML" });
  }
});

// ---- /api/chat ----
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [], currentHtml = "" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }

    // Rebuild messages array for the model
    const messages = conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const contextPrompt = `Here is the current HTML:

\`\`\`html
${currentHtml}
\`\`\`

User request: ${message}

Please return the complete updated HTML with only the requested changes, preserving all other functionality. At the end, include a brief summary of changes.`;

    messages.push({ role: "user", content: contextPrompt });

    const response = await generateText({
      model: "v0-1.5-md",
      messages,
      temperature: 0.7,
      maxTokens: 4000,
    });

    let changesDescription = "Updated based on request.";
    const match = response.text.match(/(?:changes made|summary|modifications):\s*(.+?)(?:\n|$)/i);
    if (match) changesDescription = match[1].trim();

    res.json({
      success: true,
      text: response.text,
      message: "Revised HTML generated successfully!",
      changesDescription,
    });
  } catch (e) {
    console.error("Chat error:", e);
    res.status(500).json({ error: "Failed to process chat request" });
  }
});

// ---- HEALTH CHECK ----
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});