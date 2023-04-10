const sendButton = document.getElementById("sendButton");
const searchQuery = document.getElementById("searchQuery");

sendButton.addEventListener("click", () => {
  const query = searchQuery.value;
  const url = window.location.href + "search" + "?q=" + query;
  window.location.href = url;
});
