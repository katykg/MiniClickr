chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: "hotkey",
      command: command
    });
  } catch (err) {
    console.log("MiniClickr: Could not send hotkey to tab", err);
  }
});