document.getElementById("show").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "showControls" });
  } catch (err) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "showControls" });
      }, 250);
    } catch (injectError) {
      alert("Cannot run on this page.\n\nPlease try on a normal website (not chrome:// pages).");
    }
  }
};