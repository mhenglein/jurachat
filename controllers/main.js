"use strict";
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports.handleUpload = handleUpload;
async function handleUpload(req, res, next) {
  const fileName = req.file.originalname;
  const id = req.body.id;
  const title = `${id}-${fileName}`;

  try {
    const { path: docxPath } = req.file;
    const result = await mammoth.extractRawText({ path: docxPath });
    const text = result.value;

    // Get metadata, e.g. title
    const metadata = req.file.originalname;

    // Convert into chunks and embed.
    const chunks = createChunks(text, metadata, 300);
    const embeddings = await getEmbeddingArray(chunks);
    // const embeddings = [];

    console.log("Embeddings: ", embeddings);

    const workingDirectory = process.cwd();
    const embeddingsDirectory = path.join(workingDirectory, "embeddings");

    // Ensure the directory exists before writing the file
    if (!fs.existsSync(embeddingsDirectory)) {
      fs.mkdirSync(embeddingsDirectory);
    }

    fs.writeFileSync(`${embeddingsDirectory}/${title}.json`, JSON.stringify(embeddings));
    fs.unlinkSync(docxPath);

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

async function getEmbeddingArray(queryArray) {
  try {
    const response = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: queryArray,
    });
    console.log(response.status);

    const data = response.data.data;
    console.log({ data });

    // This is what data looks like
    //     {
    //   "object": "list",
    //   "data": [
    //     {
    //       "object": "embedding",
    //       "embedding": [
    //         0.0023064255,
    //         -0.009327292,
    //         .... (1536 floats total for ada-002)
    //         -0.0028842222,
    //       ],
    //       "index": 0
    //     }
    //   ],
    //   "model": "text-embedding-ada-002",
    //   "usage": {
    //     "prompt_tokens": 8,
    //     "total_tokens": 8
    //   }
    // }

    // Returned a combined object with text: ... for the original text in queryArray and embedding: ... for the result of text-embedding
    const embeddingArray = data.map((item, index) => ({
      text: queryArray[index],
      embedding: item,
    }));

    return embeddingArray;
  } catch (error) {
    console.error("Error in getEmbeddingArray:", error);
    return [];
  }
}

function createChunks(text, metadata = null, chunkSize = 300, overlap = 150) {
  text = cleanText(text);
  const words = text.split(" ");
  const totalWords = words.length;
  const chunks = [];

  for (let i = 0; i < totalWords; i += chunkSize - overlap) {
    const chunkWords = words.slice(i, i + chunkSize);
    let chunkText = chunkWords.join(" ");
    if (metadata) chunkText = metadata + "\n" + chunkText;
    chunks.push(chunkText);

    if (i + chunkSize >= totalWords) break;
  }

  return chunks;
}

function cleanText(text) {
  // Replace various line breaks with a single space
  text = text.replace(/(\r\n|\n|\r)/gm, " ");

  // Replace multiple consecutive spaces with a single space
  text = text.replace(/\s+/g, " ");

  // Remove leading and trailing spaces
  text = text.trim();

  // Replace common typographic errors, such as multiple hyphens with a single one
  text = text.replace(/-{2,}/g, "-");

  // Return the cleaned text
  return text;
}
