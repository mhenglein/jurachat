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

module.exports.postChat = async (req, res) => {
  try {
    console.log("postChat");

    // Initialize the client
    await client.init({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
    });

    // Get all message
    const user_message_init = req.body.user_message;
    console.log(user_message_init.slice(0, 100));
    const vector = await getEmbedding(user_message_init);
    console.log(vector.length);

    const query = {
      includeValues: false,
      includeMetadata: true,
      vector,
      topK: 5,
    };

    console.log(query);
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

    // Filter out results with a low cosine similarity
    const results = json.matches.filter((result) => result.score > THRESHOLD);
    console.log("RESULTS", results);
    let sources = results && results.length ? results.map((result) => result.metadata) : [];
    console.log("SOURCES", sources);
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

    sources = sources.map((source) => {
      source.text = fixText(source.text);
      return source;
    });

    let sourcesText = sources.map((source) => source.text);

    // TODO Check the user's own embeddings
    // TODO Do as much in parallel as possible

    // SYSTEM MESSAGE
    const SYSTEM_MESSAGE = {
      role: "system",
      content: "Du er JuraGPT, en dansk juridisk co-pilot. Du analyserer dokumenter på engelsk og dansk og giver juridisk rådgivning. Du svarer altid på dansk",
    };

    // Use HTML to highlight key phrases that directly answers the user's query or question with <mark>...</mark>.
    // USER MESSAGE
    let user_message = "";
    if (sources && sources.length) {
      user_message = `Svar på dansk på den juridiske forespørgsel nederst i teksten. Træk på følgende kildemateriale efter behov: ${sourcesText.join("\n")}
      Spørgsmål: ${user_message_init}`;
    } else {
      user_message = `Svar på dansk på den juridiske forespørgsel.
      Spørgsmål: ${user_message_init}`;
    }

    console.log(user_message);

    // Final messages
    const messages = [SYSTEM_MESSAGE, { role: "user", content: user_message }];

    // Chat Completion
    let response = {};
    try {
      response = await openai.createChatCompletion({
        model: "gpt-4",
        messages,
        temperature: 0,
      });
    } catch (err) {
      console.log(err);
    }

    let result = response.data.choices[0].message.content;
    console.log({ result });

    return res.json({ result, sources });
  } catch (error) {
    console.log(error);
    return res.json({ error: error.message });
  }
};

//  // Find all documents in embeddings folder related to id, i.e. they start with ID, combine them ...
//   // const files = fs.readdirSync("./embeddings");
//   // if (files.length === 0) {
//   //   const filesFiltered = files.filter((file) => file.startsWith(id));
//   //   console.log("HERE1", filesFiltered);

//   //   // Merge into one
//   //   const embeddings = filesFiltered
//   //     .map((file) => {
//   //       const filePath = `./embeddings/${file}`;
//   //       const fileContent = fs.readFileSync(filePath, "utf8");
//   //       return JSON.parse(fileContent);
//   //     })
//   //     .flat();

//   //   console.log("HERE2", embeddings);

//   //   const df = embeddings;
//   //   const sourcesEmbeddings = await queryEmbeddings(df, user_message_init, 3);
//   // }

//   // Query pinecone

//     // const sourcesLaws = await queryEmbeddings(laws, user_message_init, 3);
//     // const sourcesLawsText = sourcesLaws.join("\n");
//     // const sourcesLawsTextEncoded = encode(sourceText);
//     // const sourcesLawsTextEncodedTruncated = sourcesLawsTextEncoded.slice(0, 6000);
//     // const sourcesLawsTextTruncated = decode(sourcesLawsTextEncodedTruncated);

//     // // mapping of all .texts together with a \n as join
//     // const sourceText = sources.join("\n");

//     // // Restrict sourceText to max 6000 tokens (encoded)
//     // const sourceTextEncoded = encode(sourceText);
//     // const sourceTextEncodedTruncated = sourceTextEncoded.slice(0, 6000);
//     // const sourceTextTruncated = decode(sourceTextEncodedTruncated);

//     const user_message_sources = `Answer, in Danish, the legal query at the bottom. Use HTML to highlight key phrases that directly answers the user's query or question with <mark>...</mark>. Draw on the following source material as needed: ${sourcesLawsText}

//   User query: ${user_message_init}`;

//     // Final messages
//     const messages = [SYSTEM_MESSAGE, { role: "user", content: user_message_sources }];

//     // Chat Completion
//     try {
//       const response = await openai.createChatCompletion({
//         model: "gpt-4",
//         messages,
//         temperature: 0,
//       });

//       let result = response.data.choices[0].message.content;
//       console.log({ result });

//       // Send result
//       res.json({ result, sources });
//     } catch (error) {
//       handleErrors(error);
//     }
// });

// .then((response) => response.json())
// .then((data) => {
//   console.log(data);
//   // show metadata console.log
//   console.log(data.matches[0].metadata);
//   console.log(data.matches[1].metadata);
//   console.log(data.matches[2].metadata);
//   console.log(data.matches[3].metadata);
//   console.log(data.matches[4].metadata);
// })
// .catch((error) => {
//   console.error("Error:", error);
// });
async function queryEmbeddings(df, query, n = 3, pprint = true) {
  const embeddedQuery = await getEmbedding(query);

  // Check that df is an array
  if (!Array.isArray(df)) {
    throw new Error("df must be an array");
  }

  df.forEach((row, index) => {
    row.similarity = computeCosineSimilarity(row.embedding, embeddedQuery);
  });

  df.sort((a, b) => b.similarity - a.similarity);
  const res = df.slice(0, n);

  if (pprint) {
    console.log(res);
  }

  return res.map((entry) => entry.text);
}

async function queryEmbeddings(df, query, n = 3, pprint = true) {
  const embeddedQuery = await getEmbedding(query);

  df.forEach((row, index) => {
    const embedding = row.embedding.embedding;
    row.similarity = computeCosineSimilarity(embedding, embeddedQuery);
  });

  df.sort((a, b) => b.similarity - a.similarity);
  const res = df.slice(0, n);

  if (pprint) {
    console.log(res);
  }

  return res.map((entry) => entry.text);
}

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

async function createDf(input) {
  const { data } = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input,
  });

  const embeddingsData = data.data.map((d, i) => ({
    text: input[i],
    embedding: d.embedding,
  }));

  fs.writeFileSync("embedding.json", JSON.stringify(embeddingsData));

  return embeddingsData;
}
