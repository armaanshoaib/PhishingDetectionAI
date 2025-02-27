// Notify that content script is loaded
console.log('Email Phishing Detector content script loaded');

// Function to extract email content
function extractEmailContent() {
  // Gmail specific selectors
  const subjectElement = document.querySelector('h2[data-thread-perm-id]');
  const bodyElement = document.querySelector('.a3s.aiL');
  const senderElement = document.querySelector('.gD');
  
  if (!subjectElement || !bodyElement || !senderElement) {
    console.log('Could not find email elements:', {
      subject: !!subjectElement,
      body: !!bodyElement,
      sender: !!senderElement
    });
    return null;
  }

  return {
    subject: subjectElement.textContent,
    body: bodyElement.textContent,
    sender: senderElement.getAttribute('email')
  };
}

// Function to format the analysis text with HTML
function formatAnalysis(text) {
  // Replace numbered points with formatted HTML
  text = text.replace(/(\d+\.\s+)([^:]+:)/g, '<br><strong>$1$2</strong>');
  
  // Bold important terms
  const termsToHighlight = [
    'DANGEROUS', 'SAFE',
    'Generic Greeting', 'Urgency', 'Threat',
    'Suspicious Links', 'Poor Grammar',
    'WARNING', 'ALERT', 'CRITICAL'
  ];
  
  termsToHighlight.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    text = text.replace(regex, '<strong>$1</strong>');
  });
  
  // Add line breaks for readability
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

// Function to analyze email using OpenAI API
async function analyzeEmail(emailContent) {
  // // main API key
  const OPENAI_API_KEY = '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';
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: "You are a cybersecurity expert analyzing emails for phishing attempts. Provide a classification (SAFE or DANGEROUS) and explanation. Format your response with numbered points and clear sections. Most of them that I provide will generally be safe from Google, Amazon, YouTube, Kotak Banks etc. So please try to be generous and be less strict. "
        }, {
          role: "user",
          content: `Analyze this email for phishing attempts:\nFrom: ${emailContent.sender}\nSubject: ${emailContent.subject}\nBody: ${emailContent.body}`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI API Response:', data);

    // Check if the response has the expected structure
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid API response structure');
    }

    const analysis = data.choices[0].message.content;
    
    // Parse the AI response
    const classification = analysis.includes("DANGEROUS") ? "DANGEROUS" : 
                         analysis.includes("SAFE") ? "SAFE" : "SAFE";
    
    return {
      classification,
      explanation: formatAnalysis(analysis),
      warnings: analysis.includes("WARNING:") ? formatAnalysis(analysis.split("WARNING:")[1].trim()) : null
    };
  } catch (error) {
    console.error('Error analyzing email:', error);
    return {
      classification: "ERROR",
      explanation: `Could not analyze email: ${error.message}. Please try again later.`,
      warnings: null
    };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  
  if (request.action === "analyze_email") {
    const emailContent = extractEmailContent();
    console.log('Extracted email content:', emailContent);
    
    if (emailContent) {
      analyzeEmail(emailContent).then(result => {
        console.log('Analysis result:', result);
        sendResponse({result});
      });
      return true; // Will respond asynchronously
    } else {
      sendResponse({
        result: {
          classification: "ERROR",
          explanation: "Could not find email content. Please make sure an email is open.",
          warnings: null
        }
      });
    }
  }
});