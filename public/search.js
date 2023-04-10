(function () {
  'use strict';

  const sendButton = document.getElementById("sendButton");
  const searchQuery = document.getElementById("searchQuery");

  sendButton.addEventListener("click", () => {
    const query = searchQuery.value;

    // Create a new URL object using the current origin and the 'search' path
    const url = new URL("search", window.location.origin);

    // Add the search query parameter to the URL
    url.searchParams.set("q", query);

    // Navigate to the constructed URL
    window.location.href = url.toString();
  });

})();
