"use strict";
require("dotenv").config();
const { PineconeClient } = require("@pinecone-database/pinecone");
const fs = require("fs");
const { chain } = require("stream-chain");
const { parser } = require("stream-json");
const { streamValues } = require("stream-json/streamers/StreamValues");
const { promisify } = require("util");
const pipeline = promisify(require("stream").pipeline);

async function uploadToPinecone() {
  // Create a client
  console.log("Creating Pinecone client...");
  const client = new PineconeClient();

  // Initialize the client
  console.log("Initializing Pinecone client...");
  await client.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  const index = client.Index("main");
  const batchSize = 50;
  let vectors = [];

  // Read the contents of the pinecone.json file using a streaming JSON parser
  await pipeline(
    fs.createReadStream("pinecone.json"),
    parser(),
    streamValues(),
    chain([
      (data) => {
        const vectorArray = data.value;
        for (const vectorData of vectorArray) {
          const { id, metadata, values } = vectorData;
          vectors.push({ id, vector: values, metadata });
          if (vectors.length === batchSize) {
            upsertBatch(index, vectors);
            // Clear the vectors array for the next batch
            vectors = [];
          }
        }
      },
    ])
  );

  // Upsert the remaining vectors, if any
  if (vectors.length > 0) {
    upsertBatch(index, vectors);
  }

  console.log("Finished upserting vectors");

  async function upsertBatch(index, vectors) {
    try {
      // Create the upsert request for the current batch
      const upsertRequest = {
        vectors: vectors,
      };

      // Upsert the current batch of vectors
      console.log("Upsert request:", upsertRequest);
      const upsertResponse = await index.upsert({ upsertRequest });
      console.log(`Upserted batch of size ${vectors.length}`);
    } catch (error) {
      console.error("Error while upserting batch:", error);
    }
  }
}

uploadToPinecone().catch((error) => {
  console.error("Error while uploading data to Pinecone:", error);
});
