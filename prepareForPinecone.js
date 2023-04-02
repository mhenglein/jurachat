const { pipeline, Transform } = require("stream");
const { parser } = require("stream-json/Parser");
const { streamArray } = require("stream-json/streamers/StreamArray");
const fs = require("fs");

const pinecone = {
  vectors: [],
};

// Define a custom transform stream to process JSON objects
class ProcessJson extends Transform {
  constructor(options) {
    super({ ...options, objectMode: true });
    this.counter = 0;
  }

  _transform(chunk, encoding, callback) {
    this.counter++;

    let description = chunk.value.description;

    const newEntryToVectors = {
      id: String(this.counter),
      metadata: {
        title: chunk.value.title,
        link: chunk.value.link,
        section: chunk.value.section,
        text: chunk.value.text,
      },
      values: chunk.value.embedding,
    };

    if (description) {
      newEntryToVectors.metadata.description = description;
    }

    // isEmbeddings
    const isEmbedded = chunk.value.embedding && chunk.value.embedding.length === 1536;
    if (!isEmbedded) {
      console.warn("Skipping a vector due to incorrect length:", chunk.value.title);
      callback();
      return;
    }

    pinecone.vectors.push(newEntryToVectors);
    callback();
  }
}

const processJson = new ProcessJson();

// Create a pipeline to read, parse, and process the JSON file
pipeline(fs.createReadStream("./database/laws.json"), parser(), streamArray(), processJson, (err) => {
  if (err) {
    console.error("Pipeline failed:", err);
  } else {
    // This is the final file for upload to Pinecone
    fs.writeFileSync("pinecone.json", JSON.stringify(pinecone));
    console.log("Pipeline succeeded.");
  }
});
