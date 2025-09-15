import fs from "fs";
import path from "path";
import multer from "multer";
import { generateText } from "ai";
import { vercel } from "@ai-sdk/vercel";

// Multer must use /tmp on Vercel (ephemeral storage)
const upload = multer({ dest: "/tmp" });

// Disable bodyParser so Multer can handle form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  upload.single("screenshot")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const userPrompt = req.body.prompt || "Create HTML from screenshot.";
      const includeJS = req.body.include_javascript === "true";
      const makeInteractive = req.body.make_interactive === "true";

      let prompt = userPrompt;
      if (includeJS || makeInteractive) {
        prompt += `
IMPORTANT: Include full JavaScript functionality and interactivity.`;
      }

      const imageBuffer = fs.readFileSync(req.file.path);
      const imageBase64 = imageBuffer.toString("base64");
      const mimeType = `image/${path.extname(req.file.originalname).slice(1)}`;

      const response = await generateText({
        model: vercel("v0-1.0-md"),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", image: `data:${mimeType};base64,${imageBase64}` },
            ],
          },
        ],
        temperature: 0.7,
        maxTokens: 8000,
      });

      // Clean up file
      fs.unlink(req.file.path, () => {});

      return res.status(200).json({
        success: true,
        text: response.text,
        message: "HTML generated successfully!",
      });
    } catch (e) {
      console.error("Generation error:", e);
      return res.status(500).json({ error: "Failed to generate HTML" });
    }
  });
}
