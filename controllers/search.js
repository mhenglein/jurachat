"use strict";
require("dotenv").config();

const fs = require("fs");
const { Configuration, OpenAIApi } = require("openai");
const computeCosineSimilarity = require("compute-cosine-similarity");
const { encode, decode } = require("gpt-3-encoder");
const { PineconeClient } = require("@pinecone-database/pinecone");
const fetch = require("node-fetch");
const url = "https://main-fb20bc5.svc.us-west4-gcp.pinecone.io/query";

const THRESHOLD = 0.8;
const headers = {
  "Api-Key": process.env.PINECONE_API_KEY,
  Accept: "application/json",
  "Content-Type": "application/json",
};

// Create a client
const client = new PineconeClient();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports.getSearch = async (req, res) => {
  // Initialize the client
  await client.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  // Get all message
  let searchQuery = req.query.q;
  console.log("Search query: ", searchQuery);

  let searchQueryWords = searchQuery.split(" ");
  const stopord = fs.readFileSync("stopwords.txt", "utf8").split("\n");
  console.log(stopord.length);
  searchQueryWords = searchQueryWords.filter((word) => !stopord.includes(word));

  // TODO Strip out stopord

  const vector = await getEmbedding(searchQuery);

  const query = {
    includeValues: false,
    includeMetadata: true,
    vector,
    topK: 20,
  };

  const pineconeResponse = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(query),
  });

  console.log(pineconeResponse);

  const json = await pineconeResponse.json();
  console.log(json);

  if (!json.matches || json.matches.length === 0) {
    return res.status(500).json({ error: "No results" });
  }

  // Fix all the metadata in matches using fixText on title, text
  const matches = json.matches
    .map((match) => {
      match.metadata.title = fixText(match.metadata.title);
      match.metadata.description = fixText(match.metadata.description);
      match.metadata.text = fixText(match.metadata.text);

      const section = match.metadata.section;
      if (section) {
        // Remove the section from the beginning of the string, e.g.
        // 66cMuseumsloven -> Museumsloven for section === 66c

        let sectionNumber = section.trim();
        // if sectionNumber contains a letter, add a space between the digits and the letter
        // e.g. 66c -> 66 c
        sectionNumber = sectionNumber.replace(/(\d+)([a-z])/i, "$1 $2");

        console.log("Section: ", sectionNumber);
        const regex = new RegExp(`^\\s*${sectionNumber}`);
        console.log("Regex: ", regex);
        match.metadata.text = match.metadata.text.replace(regex, "");
        console.log("Text: ", match.metadata.text.slice(0, 50)); // This should no longer contain the section
      }

      // Add linebreaks before every part that starts with Stk. # where # is a number
      match.metadata.text = match.metadata.text.replace(/Stk\.\s*\d+/g, "<br><br> $&");

      // For every searchQueryWords, add a <mark> tag around it
      searchQueryWords.forEach((word) => {
        // This should be case-insensitive and bounded by word boundaries
        // (remember that æøå are not bounded by \b)
        const regex = new RegExp(`(?<!\\w)(${word})(?!\\w)`, "gi");
        match.metadata.text = match.metadata.text.replace(regex, `<mark>$1</mark>`);

        if (match.metadata.description) {
          match.metadata.description = match.metadata.description.replace(regex, `<mark>$1</mark>`);
        }
      });

      return match;
    })
    .filter((match) => match.metadata.text !== "(Ophævet)") // Remove all entries where .text is = (Ophævet)
    .slice(0, 10); // Limit json.matches to 10

  return res.render("searchResults", { results: matches });
};

module.exports.postSearch = async (req, res) => {
  // Initialize the client
  await client.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  // Get all message
  let searchQuery = req.query.q;

  // TODO Strip out stopord
  const vector = await getEmbedding(searchQuery);

  const query = {
    includeValues: false,
    includeMetadata: true,
    vector,
    topK: 10,
  };

  const pineconeResponse = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(query),
  });

  console.log(pineconeResponse);

  const json = await pineconeResponse.json();
  console.log(json);

  if (!json.results) {
    return res.status(500).json({ error: "No results" });
  }

  return res.json({ results: json.matches });
};

async function getEmbedding(query) {
  console.log("Query: ", query);
  try {
    const response = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: query,
    });

    console.log(response.status);

    return response.data.data[0].embedding;
  } catch (error) {
    handleErrors(error);
  }
}

function handleErrors(error) {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.log(error.response.data);
    console.log(error.response.status);
    console.log(error.response.headers);
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.log(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.log("Error", error.message);
  }
  console.log(error.config);
}

// Fix all text
function fixText(text) {
  if (!text) return;
  // Ã¦
  text = text.replace(/Ã¦/g, "æ");
  // Ã¸
  text = text.replace(/Ã¸/g, "ø");
  // Ã¥
  text = text.replace(/Ã¥/g, "å");
  // Ã„
  text = text.replace(/Ã„/g, "Æ");
  // Ã˜
  text = text.replace(/Ã˜/g, "Ø");
  // Ã…
  text = text.replace(/Ã…/g, "Å");
  // Ã©
  text = text.replace(/Ã©/g, "é");
  //Â§
  text = text.replace(/Â§/g, "");

  return text;
}
