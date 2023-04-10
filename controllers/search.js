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

  // Fix all the metadata in matches using fixText on title, text
  json.matches.forEach((match) => {
    match.metadata.title = fixText(match.metadata.title);
    match.metadata.text = fixText(match.metadata.text);
  });

  if (!json.results) {
    return res.status(500).json({ error: "No results" });
  }

  return res.render("searchResults", { results: json.matches });
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
  text = text.replaceAll(/Ã¦/g, "æ");
  // Ã¸
  text = text.replaceAll(/Ã¸/g, "ø");
  // Ã¥
  text = text.replaceAll(/Ã¥/g, "å");
  // Ã„
  text = text.replaceAll(/Ã„/g, "Æ");
  // Ã˜
  text = text.replaceAll(/Ã˜/g, "Ø");
  // Ã…
  text = text.replaceAll(/Ã…/g, "Å");
  // Ã©
  text = text.replaceAll(/Ã©/g, "é");
  //Â§
  text = text.replaceAll("Â§", "");

  return text;
}
