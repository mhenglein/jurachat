const fs = require("fs");
const fsExtra = require("fs-extra");

// Read the JSON file
fs.readFile("pinecone.json", "utf8", (err, jsonString) => {
  if (err) {
    console.log("Error reading file from disk:", err);
    return;
  }

  try {
    const data = JSON.parse(jsonString);
    const vectors = data.vectors;

    // Create a directory to store the smaller JSON files
    const outputDirectory = "output2";
    fsExtra.ensureDirSync(outputDirectory);

    // Set the number of files and entries per file
    const numFiles = 10;
    const entriesPerFile = Math.ceil(vectors.length / numFiles);

    // Split the data and write to smaller JSON files
    for (let i = 0; i < numFiles; i++) {
      const start = i * entriesPerFile;
      const end = start + entriesPerFile;

      const partialData = {
        vectors: vectors.slice(start, end),
      };

      fs.writeFile(`${outputDirectory}/pinecone_part_${i}.json`, JSON.stringify(partialData, null, 2), (err) => {
        if (err) {
          console.log("Error writing file:", err);
        } else {
          console.log(`File pinecone_part_${i}.json written successfully.`);
        }
      });
    }
  } catch (err) {
    console.log("Error parsing JSON string:", err);
  }
});
