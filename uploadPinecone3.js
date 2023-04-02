"use strict";
require("dotenv").config();
const fs = require("fs");
const JSONStream = require("jsonstream");
const fetch = require("node-fetch");

const pineconeUrl = `https://main-fb20bc5.svc.us-west4-gcp.pinecone.io/vectors/upsert`;
const pineconeApiKey = process.env.PINECONE_API_KEY;

async function uploadToPinecone() {
  const batchSize = 50;
  let vectors = [];

  const readStream = fs.createReadStream("pinecone.json");
  const jsonStream = JSONStream.parse("vectors.*");

  readStream.pipe(jsonStream);

  jsonStream.on("data", async (vectorData) => {
    // Skip if vectorData.values is not defined
    if (!vectorData.values) {
      console.warn("Skipping a vector due to undefined values:", vectorData);
      return;
    }

    // Convert values to float32
    // const float32Values = Float32Array.from(vectorData.values);

    if (vectorData.values.length !== 1536) {
      // Tell me what it is, then skip it

      console.warn("Skipping a vector due to incorrect length:", vectorData.metadata.title);
      return;
    }

    vectors.push({
      ...vectorData,
      // values: Array.from(vectorData.values),
    });

    if (vectors.length === batchSize) {
      await upsertBatch(vectors);
      vectors = [];
    }
  });

  jsonStream.on("end", async () => {
    if (vectors.length > 0) {
      await upsertBatch(vectors);
    }
    console.log("Finished upserting vectors");
  });

  jsonStream.on("error", (error) => {
    console.error("Error while processing JSON data:", error);
  });
}

async function upsertBatch(vectors) {
  const upsertRequest = {
    namespace: "main",
    vectors,
  };

  const response = await fetch(pineconeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Api-Key": pineconeApiKey,
    },
    body: JSON.stringify(upsertRequest),
  });

  if (response.ok) {
    console.log("Batch upserted successfully");
  } else {
    console.error("Error while upserting batch:", await response.text(), upsertRequest.vectors[0]);
  }
}

main();
async function main() {
  try {
    await uploadToPinecone();
  } catch (err) {
    console.error(err);
    await main();
  }
}
