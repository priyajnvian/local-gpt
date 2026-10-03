chrome.action.onClicked.addListener((tab) => {
  // Open the webpage directly from the extension
  chrome.tabs.create({ url: chrome.runtime.getURL('webpage.html') });
});