import { Dropzone } from "dropzone";
import { v4 as uuidv4 } from "uuid";

const dropzone = new Dropzone(".file-dropzone", { url: "/upload", acceptedFiles: ".docx,.doc" });
const fileDropzone = document.querySelector(".file-dropzone");
const html = document.querySelector("html");
const uploadSection = document.querySelector("#uploadRows");

// Function to create a div block for uploaded files
function createFileBlock(filename) {
  const template = document.getElementById("fileUpload");
  const fileBlockFragment = template.content.firstElementChild.cloneNode(true);

  const titleElement = fileBlockFragment.querySelector("code[title]");
  titleElement.textContent = filename;

  const appendedChild = uploadSection.appendChild(fileBlockFragment);
  return appendedChild;
}

// when the user is dragging a file on the screen, increment the drag counter and show the dropzone
html.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (fileDropzone.classList.contains("d-none")) {
    fileDropzone.classList.remove("d-none");
  }
});

fileDropzone.addEventListener("mouseleave", () => {
  fileDropzone.classList.add("d-none");
});

fileDropzone.addEventListener("mouseenter", () => {
  fileDropzone.classList.remove("d-none");
});

// add event listeners for success and error events
dropzone.on("success", function (file, response) {
  fileDropzone.classList.add("d-none");
  // TODO Remove any loading screens
  console.log("File uploaded successfully. Server response:", response);
  const { error } = response;

  if (error) {
    return showWarning(error);
  } else {
    // Update the file block with a "success" label
    const successLabel = document.createElement("span");
    successLabel.classList.add("badge", "bg-success", "rounde-pill", "tiny");
    successLabel.textContent = "Uploaded";

    // Rmove [spinner]
    const spinner = file.fileBlock.querySelector("[spinner]");
    if (spinner) spinner.remove();

    const cardBody = file.fileBlock.querySelector(".card-body");
    if (cardBody) cardBody.appendChild(successLabel);
    else {
      // ERROR TO FIX: We end up here with cardbody undefined
      console.log("Could not find card body", cardBody);
    }
  }

  // Remove any loaders TODO
});

// On upload, while waiting
dropzone.on("sending", function (file, xhr, formData) {
  // if no localstorage id, then create one, then set const id = localstorage id
  let id = localStorage.getItem("id");
  if (!id) {
    const newId = uuidv4();
    id = newId;
    localStorage.setItem("id", newId);
  }

  // Append the unique ID to the form data
  formData.append("id", id);

  // Create the file block immediately upon upload
  file.fileBlock = createFileBlock(file.name);
  fileDropzone.classList.add("d-none");
});

// TODO when completed, the div.block should have the filename. This is so people can see what documents they currently have uploaded.

dropzone.on("error", function (file, errorMessage) {
  console.log(errorMessage);
  setTimeout(() => {
    fileDropzone.classList.add("d-none");
    dropzone.removeAllFiles();
  }, 2000);
});

export function showWarning(optionalText = "", delay = 5000) {
  if (typeof bootstrap === "undefined") return;

  try {
    const warningToast = document.querySelector("#warningToast");
    if (!warningToast) {
      alert(optionalText);
      return;
    }

    // if optionaltext is an object, extract the messaage compnonent
    if (typeof optionalText === "object") optionalText = optionalText.message;

    if (optionalText && optionalText.length > 0) {
      warningToast.querySelector(".toast-body").innerHTML = optionalText;
      warningToast.querySelector("#timing").innerText = new Date().toLocaleTimeString();
    }

    const newToast = new bootstrap.Toast(warningToast, { delay: delay });
    newToast.show();
    // window.scrollTo(0, 0);
  } catch (e) {
    console.log(e);
  }
}

export function showSuccess(optionalText = "", delay = 2500) {
  if (typeof bootstrap === "undefined") return;

  try {
    const successToast = document.querySelector("#successToast");
    if (!successToast) {
      alert(optionalText);
      return;
    }

    if (optionalText.length > 0) {
      successToast.querySelector(".toast-body").innerHTML = optionalText;
      successToast.querySelector("#timing").innerText = new Date().toLocaleTimeString();
    }

    const newToast = new bootstrap.Toast(successToast, { delay });
    newToast.show();
  } catch (e) {
    console.log(e);
  }
}

export async function postRequest(url, data, timeout = 30000) {
  // Remove all queries and hashes from the url
  url = url.split("?")[0].split("#")[0];

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(id);

    try {
      return await response.json();
    } catch (error) {
      console.error(`Error parsing response body: ${error}`);
      return { error: "Error parsing response body" };
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.error(`Request timed out after ${timeout}ms`);
      showWarning("Der gik noget frygteligt galt i processen. Prøv igen senere.");
      return { error: "Request timed out" };
    } else {
      console.error(`Request failed: ${error}`);
      return { error: "Request failed" };
    }
  }
}
