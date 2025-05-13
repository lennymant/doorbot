// Self-executing function that checks if DOM is ready
(function() {
  async function init() {
    // Get the script tag
    const script = document.currentScript || document.querySelector('script[src*="widget.js"]');
    
    // Get base URL from server or use override from script attribute
    let baseUrl;
    try {
      // Get the current script's src to determine API endpoint
      const scriptSrc = script.src;
      const apiBase = scriptSrc.substring(0, scriptSrc.indexOf('/widget.js'));
      const response = await fetch(`${apiBase}/api/v1/chatbot-url`);
      const data = await response.json();
      baseUrl = script.getAttribute('data-chatbot-url') || data.url;
    } catch (e) {
      console.warn('Failed to fetch chatbot URL from server:', e);
      baseUrl = script.getAttribute('data-chatbot-url') || "https://doorbot.onrender.com";
    }
    
    // Get additional parameters
    const botType = script.getAttribute('data-bot-type');
    const params = new URLSearchParams();
    
    // Add bot type if specified
    if (botType) {
      params.append('botType', botType);
    }
    
    // Allow for additional custom parameters
    const customParams = script.getAttribute('data-params');
    if (customParams) {
      try {
        const additionalParams = JSON.parse(customParams);
        Object.entries(additionalParams).forEach(([key, value]) => {
          params.append(key, value);
        });
      } catch (e) {
        console.warn('Invalid data-params format:', e);
      }
    }
    
    // Construct final URL
    const CHATBOT_URL = `${baseUrl}${params.toString() ? '?' + params.toString() : ''}`;
  
    // Check for URL parameter to open chat
    const urlParams = new URLSearchParams(window.location.search);
    const shouldOpenChat = urlParams.get('openchat') === 'true';

    // Floating button
    const button = document.createElement("div");
    button.innerText = "💬 Chat with Mac";
    Object.assign(button.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      backgroundColor: "#0078d4",
      color: "#fff",
      padding: "12px 18px",
      borderRadius: "24px",
      fontSize: "16px",
      fontFamily: "sans-serif",
      cursor: "pointer",
      zIndex: "9999",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      transition: "transform 0.2s ease, width 0.3s ease, right 0.3s ease, border-radius 0.3s ease",
      userSelect: "none",
      animation: "initialExpand 3.75s ease-in-out"
    });

    // Add hover effect (but only after initial animation)
    setTimeout(() => {
      button.onmouseover = () => button.style.transform = "scale(1.05)";
      button.onmouseout = () => button.style.transform = "scale(1)";
    }, 3750); // Match animation duration
  
    document.body.appendChild(button);
  
    // Fullscreen modal overlay
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(0,0,0,0.75)", // 75% black opacity
      display: "none",
      zIndex: "9998",
      opacity: "0",
      transition: "opacity 0.3s ease",
      padding: "10px" // Add 10px margin all around
    });
  
    // Create a container for the iframe to control max-width
    const iframeContainer = document.createElement("div");
    Object.assign(iframeContainer.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      maxWidth: "1000px",
      margin: "0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box" // Ensure padding doesn't affect final size
    });
  
    // Loading spinner
    const spinner = document.createElement("div");
    Object.assign(spinner.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "40px",
      height: "40px",
      border: "4px solid #f3f3f3",
      borderTop: "4px solid #0078d4",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
      zIndex: "10001"
    });

    // Add spinner animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes spin {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
      }

      @keyframes initialExpand {
        0% { 
          width: 90%;
          right: 5%;
          border-radius: 24px;
          transform: scale(1);
        }
        85% { 
          width: 90%;
          right: 5%;
          border-radius: 24px;
          transform: scale(1);
        }
        100% { 
          width: auto;
          right: 20px;
          border-radius: 24px;
          transform: scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  
    // Fullscreen iframe
    const iframe = document.createElement("iframe");
    iframe.src = CHATBOT_URL;
    Object.assign(iframe.style, {
      width: "100%",
      height: "100%",
      border: "none",
      display: "block",
      opacity: "0",
      transition: "opacity 0.3s ease",
      backgroundColor: "#fff",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
    });

    // Add iframe to container
    iframeContainer.appendChild(iframe);
    
    // Handle iframe load
    iframe.onload = () => {
      spinner.style.display = "none";
      iframe.style.opacity = "1";
    };

    // Handle iframe error
    iframe.onerror = () => {
      spinner.style.display = "none";
      showError();
    };
    
    // Close button (desktop)
    const closeButton = document.createElement("div");
    closeButton.innerText = "✖";
    Object.assign(closeButton.style, {
      position: "absolute",
      top: "20px",
      right: "20px",
      fontSize: "24px",
      color: "#fff",
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: "6px 12px",
      borderRadius: "8px",
      cursor: "pointer",
      zIndex: "10000",
      transition: "background-color 0.2s ease"
    });

    // Mobile-friendly close button
    const mobileCloseButton = document.createElement("div");
    mobileCloseButton.innerText = "Close Chat";
    Object.assign(mobileCloseButton.style, {
      position: "absolute",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "#0078d4",
      color: "#fff",
      padding: "12px 24px",
      borderRadius: "24px",
      fontSize: "16px",
      cursor: "pointer",
      zIndex: "10000",
      display: "none", // Hidden by default, shown on mobile
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      transition: "background-color 0.2s ease"
    });

    // Error message
    const errorMessage = document.createElement("div");
    errorMessage.innerHTML = `
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        max-width: 80%;
      ">
        <h3 style="color: #d32f2f; margin: 0 0 10px 0;">Connection Error</h3>
        <p style="margin: 0 0 20px 0;">Unable to connect to the chat service. Please try again later.</p>
        <button onclick="this.parentElement.parentElement.style.display='none'" 
                style="
                  background: #0078d4;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 4px;
                  cursor: pointer;
                ">Close</button>
      </div>
    `;
    errorMessage.style.display = "none";
    overlay.appendChild(errorMessage);

    function showError() {
      errorMessage.style.display = "block";
    }
  
    button.onclick = () => {
      overlay.style.display = "block";
      // Trigger reflow
      overlay.offsetHeight;
      overlay.style.opacity = "1";
      document.body.style.overflow = "hidden";
      button.style.display = "none"; // Hide the button when chat is open
      
      // Show mobile close button on small screens
      if (window.innerWidth <= 768) {
        mobileCloseButton.style.display = "block";
      }

      // Focus management for mobile
      setTimeout(() => {
        try {
          // Try to focus the iframe first
          iframe.focus();
          // Then try to find and focus the input inside the iframe
          const iframeDoc = iframe.contentWindow.document;
          const input = iframeDoc.getElementById("userInput");
          if (input) {
            input.focus();
            // Scroll to input if needed
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } catch (e) {
          console.warn('Focus management error:', e);
        }
      }, 400); // Slightly longer timeout to ensure iframe is fully loaded
    };
  
    const closeChat = () => {
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.style.display = "none";
        document.body.style.overflow = "";
        mobileCloseButton.style.display = "none";
        button.style.display = "block"; // Show the button again when chat is closed
        
        // Don't reset iframe opacity, just ensure it's ready for next open
        iframe.style.display = "block";
        spinner.style.display = "none";
        
        // Ensure iframe is still loaded and visible
        if (iframe.style.opacity === "0") {
          iframe.style.opacity = "1";
        }
      }, 300);
    };

    closeButton.onclick = closeChat;
    mobileCloseButton.onclick = closeChat;

    // Add hover effects
    closeButton.onmouseover = () => closeButton.style.backgroundColor = "rgba(0,0,0,0.8)";
    closeButton.onmouseout = () => closeButton.style.backgroundColor = "rgba(0,0,0,0.6)";
    mobileCloseButton.onmouseover = () => mobileCloseButton.style.backgroundColor = "#006cbd";
    mobileCloseButton.onmouseout = () => mobileCloseButton.style.backgroundColor = "#0078d4";

    // Handle window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth <= 768) {
        mobileCloseButton.style.display = overlay.style.display === "block" ? "block" : "none";
      } else {
        mobileCloseButton.style.display = "none";
      }
    });
  
    // Update spinner positioning
    Object.assign(spinner.style, {
      position: "absolute",
      left: "50%",
      top: "50%"
    });

    overlay.appendChild(iframeContainer);
    overlay.appendChild(closeButton);
    overlay.appendChild(mobileCloseButton);
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);

    // If URL parameter is present, open chat automatically
    if (shouldOpenChat) {
      button.click();
    }

    // Add function to window for external access
    window.openDoorbotChat = function() {
      button.click();
    };
  }

  // Check if DOM is already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch(e => console.error('Failed to initialize widget:', e));
    });
  } else {
    init().catch(e => console.error('Failed to initialize widget:', e));
  }
})();
  