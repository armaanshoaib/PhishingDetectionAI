document.addEventListener('DOMContentLoaded', async function() {
  const statusDiv = document.getElementById('status');
  const detailsDiv = document.getElementById('details');

  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab.url?.includes('mail.google.com')) {
      statusDiv.className = 'status dangerous';
      statusDiv.textContent = 'Please open Gmail to analyze emails';
      return;
    }

    // Inject content script if not already injected
    try {
      await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        files: ['content.js']
      });
    } catch (e) {
      console.log('Content script already injected or injection failed:', e);
    }

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {action: "analyze_email"}, function(response) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        statusDiv.className = 'status dangerous';
        statusDiv.textContent = 'Error: Please make sure an email is open';
        return;
      }

      if (response && response.result) {
        updateUI(response.result);
      } else {
        statusDiv.className = 'status suspicious';
        statusDiv.textContent = 'No email content found to analyze';
      }
    });
  } catch (error) {
    console.error('Error:', error);
    statusDiv.className = 'status dangerous';
    statusDiv.textContent = 'An error occurred. Please try again.';
  }
});

function updateUI(result) {
  const statusDiv = document.getElementById('status');
  const detailsDiv = document.getElementById('details');
  
  statusDiv.className = 'status ' + result.classification.toLowerCase();
  statusDiv.textContent = `Status: ${result.classification}`;
  
  // Since we're now sending HTML-formatted content, we can use innerHTML
  detailsDiv.innerHTML = `
    <h3>Analysis Details:</h3>
    <div class="analysis">${result.explanation}</div>
    ${result.warnings ? `<div class="warnings"><strong>Warnings:</strong><br>${result.warnings}</div>` : ''}
  `;
}