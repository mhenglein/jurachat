(function () {
  'use strict';

  // Unique ID creation requires a high quality random # generator. In the browser we therefore
  // require the crypto API and do not support built-in fallback to lower quality random number
  // generators (like Math.random()).
  let getRandomValues;
  const rnds8 = new Uint8Array(16);
  function rng() {
    // lazy load so that environments that need to polyfill have a chance to do so
    if (!getRandomValues) {
      // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
      getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);

      if (!getRandomValues) {
        throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
      }
    }

    return getRandomValues(rnds8);
  }

  /**
   * Convert array of 16 byte values to UUID string format of the form:
   * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   */

  const byteToHex = [];

  for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).slice(1));
  }

  function unsafeStringify(arr, offset = 0) {
    // Note: Be careful editing this code!  It's been tuned for performance
    // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
  }

  const randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
  var native = {
    randomUUID
  };

  function v4(options, buf, offset) {
    if (native.randomUUID && !buf && !options) {
      return native.randomUUID();
    }

    options = options || {};
    const rnds = options.random || (options.rng || rng)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

    rnds[6] = rnds[6] & 0x0f | 0x40;
    rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

    if (buf) {
      offset = offset || 0;

      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = rnds[i];
      }

      return buf;
    }

    return unsafeStringify(rnds);
  }

  document.querySelector("#answersArea");
  const sendButton = document.querySelector("#sendInput");
  document.querySelector("#sourceTemplate");
  document.querySelector("#addSourcesHere");
  document.querySelector("#answerTemplate");
  document.querySelector("#sourcesArea");
  const blurbText = document.querySelector("#blurbText");
  document.querySelector("#answersContainer");

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
      const newId = v4();
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

})();
