import { generateText } from "ai";
import { vercel } from "@ai-sdk/vercel";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
      model: vercel("v0-1.0-md"),
      messages,
      temperature: 0.7,
      maxTokens: 8000,
    });

    let changesDescription = "Updated based on request.";
    const match = response.text.match(/(?:changes made|summary|modifications):\s*(.+?)(?:\n|$)/i);
    if (match) changesDescription = match[1].trim();

    return res.status(200).json({
      success: true,
      text: response.text,
      message: "Revised HTML generated successfully!",
      changesDescription,
    });
  } catch (e) {
    console.error("Chat error:", e);
    return res.status(500).json({ error: "Failed to process chat request" });
  }
}
