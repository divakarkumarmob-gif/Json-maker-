import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import pdf from "pdf-parse";

dotenv.config();
const pdfParse = pdf;

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

let aiClient: GoogleGenAI | null = null;
let savedInstructions: Record<string, {id: number, example: string, json: string}[]> = {
    pdf: [],
    photo: [],
    'file-to-question': []
};
let savedGeneralInstructions: Record<string, string> = {
    pdf: '',
    photo: '',
    'file-to-question': ''
};

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

app.use(express.json());

// API route for conversion
app.post("/api/convert", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Read option early since we need it to decide how to handle the file
    const option = (req as any).body.option || 'pdf';
    const instructionsForOption = savedInstructions[option] || [];
    const generalInstruction = savedGeneralInstructions[option] || '';
    const instructionContext = instructionsForOption.map(i => `Example: ${i.example}\nFormat: ${i.json}`).join("\n\n");
    const instructions = (req as any).body.instructions || "Convert the following text into a JSON format.";

    const promptText = `${instructions}\n\nGeneral Instructions: ${generalInstruction}\n\nInstructions Context:\n${instructionContext}`;

    const ai = getAiClient();
    let stream;

    if (file.mimetype === "application/pdf") {
      // PDF: extract text, then send as plain text prompt
      let extractedText = "";
      try {
        console.log('Parsing PDF...');
        const data = await pdfParse(file.buffer);
        extractedText = data.text;
        console.log('PDF parsed successfully');
      } catch (e) {
        console.error('Error parsing PDF:', e);
        throw e;
      }

      stream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: `${promptText}\n\nText: ${extractedText}`
      });
    } else if (file.mimetype.startsWith("image/")) {
      // Photo: send image bytes directly to Gemini (vision input)
      stream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: file.mimetype,
                  data: file.buffer.toString("base64"),
                },
              },
            ],
          },
        ],
      });
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    res.setHeader('Content-Type', 'text/plain');

    for await (const chunk of stream) {
        res.write(chunk.text);
    }
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Conversion failed" });
  }
});

app.post("/api/save-instructions", upload.fields([{ name: 'fileExample' }, { name: 'fileJson' }]), (req, res) => {
    const { id, example, json, option } = req.body;
    if (option && savedInstructions[option]) {
        savedInstructions[option].push({ id: Number(id), example, json });
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Invalid option" });
    }
});

app.post("/api/save-general-instructions", (req, res) => {
    const { text, option } = req.body;
    if (option && savedGeneralInstructions.hasOwnProperty(option)) {
        savedGeneralInstructions[option] = text;
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Invalid option" });
    }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
