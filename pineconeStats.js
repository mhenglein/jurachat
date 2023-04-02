const fs = require("fs");
const { chain } = require("stream-chain");
const { parser } = require("stream-json");
const { pick } = require("stream-json/filters/Pick");
const { streamArray } = require("stream-json/streamers/StreamArray");

const readStream = fs.createReadStream("pinecone.json");
const jsonParser = parser();
const pickVectors = pick({ filter: "vectors" });
const arrayStream = streamArray();

let counter = 0;

chain([readStream, jsonParser, pickVectors, arrayStream])
  .on("data", () => {
    counter++;
  })
  .on("end", () => {
    console.log("The length of the vectors array is:", counter);
  })
  .on("error", (err) => {
    console.error("Error:", err);
  });
