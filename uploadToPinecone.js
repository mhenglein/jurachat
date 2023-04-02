"use strict";
require("dotenv").config();
const { PineconeClient } = require("@pinecone-database/pinecone");
const fs = require("fs");
const { parser } = require("stream-json/Parser");
const { streamObject } = require("stream-json/streamers/StreamObject");
const { Writable } = require("stream");

uploadToPinecone();

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

  console.log("Pinecone client initialized");

  const index = client.Index("main");

  // Define a custom writable stream to upsert vectors
  class UpsertStream extends Writable {
    constructor(options) {
      super({ ...options, objectMode: true });
      this.batchSize = 50; // Set chunk size to 50 vectors
      this.batch = [];
    }

    async _write(chunk, encoding, callback) {
      this.batch.push(chunk.value);

      if (this.batch.length >= this.batchSize) {
        try {
          await this.upsertBatch(this.batch);
          this.batch = [];
          callback();
        } catch (err) {
          callback(err);
        }
      } else {
        callback();
      }
    }

    async _final(callback) {
      if (this.batch.length > 0) {
        try {
          await this.upsertBatch(this.batch);
          this.batch = [];
          callback();
        } catch (err) {
          callback(err);
        }
      } else {
        callback();
      }
    }

    async upsertBatch(batch) {
      console.log(`Upserting batch of size ${batch.length}...`);
      const chunkSize = 50; // Set max chunk size
      for (let i = 0; i < batch.length; i += chunkSize) {
        const chunk = batch.slice(i, i + chunkSize);
        const upsertRequest = { vectors: chunk };
        console.log("Upserting chunk:", upsertRequest);
        await index.upsert(upsertRequest); // Call upsert function correctly
      }
      console.log("Batch upserted");
    }
  }

  const upsertStream = new UpsertStream();

  // Create a pipeline to read, parse, and upsert the JSON file
  console.log("Creating pipeline...");
  fs.createReadStream("pinecone.json")
    .pipe(parser())
    .pipe(streamObject())
    .pipe(upsertStream)
    .on("finish", () => {
      console.log("Upsert completed.");
    })
    .on("error", (err) => {
      console.error("Pipeline failed:", err);
    });
}
