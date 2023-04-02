import { v4 as uuidv4 } from "uuid";

const answersArea = document.querySelector("#answersArea");
const sendButton = document.querySelector("#sendInput");
const sourceTemplate = document.querySelector("#sourceTemplate");
const addSourcesHere = document.querySelector("#addSourcesHere");
const answerTemplate = document.querySelector("#answerTemplate");
const sourcesArea = document.querySelector("#sourcesArea");
const blurbText = document.querySelector("#blurbText");
const answersContainer = document.querySelector("#answersContainer");

const chatArea = document.querySelector("#chatArea");
const userMessage = document.querySelector("#userMessage");
const assistantMessage = document.querySelector("#assistantMessage");

sendButton.addEventListener("click", async function () {
  console.log("Clicked");

  // Get chat message; add to chatArea; clear input
  let chatMessage = document.querySelector("#chatMessage");
  const chatMessageValue = chatMessage.value;
  const newUserMessage = userMessage.content.firstElementChild.cloneNode(true);
  newUserMessage.innerText = chatMessageValue;
  chatArea.appendChild(newUserMessage);
  chatMessage.value = "";

  // Get id
  let id = localStorage.getItem("id");
  if (!id) {
    const newId = uuidv4();
    id = newId;
    localStorage.setItem("id", newId);
  }

  // answersArea.classList.remove("d-none");
  // sourcesArea.classList.remove("d-none");
  blurbText.classList.add("d-none");
  // answersContainer.classList.remove("d-none");

  // Post
  const res = await fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_message: chatMessageValue, id }),
  });

  const json = await res.json();
  const { result, sources } = json;

  // Get the 5 titles from sources
  // const sourceTitles =

  // Add response  to ChatArea
  const newAssistantMessage = assistantMessage.content.firstElementChild.cloneNode(true);
  newAssistantMessage.innerText = result;

  chatArea.appendChild(newAssistantMessage);
});
