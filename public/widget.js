// Self-executing function that checks if DOM is ready
(function() {
  function init() {
    const CHATBOT_URL = "https://doorbot.onrender.com"; // <-- your working chatbot
  
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
      transition: "transform 0.2s ease",
      userSelect: "none"
    });

    // Add hover effect
    button.onmouseover = () => button.style.transform = "scale(1.05)";
    button.onmouseout = () => button.style.transform = "scale(1)";
  
    document.body.appendChild(button);
  
    // Fullscreen modal overlay
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "none",
      zIndex: "9998",
      opacity: "0",
      transition: "opacity 0.3s ease"
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
      transition: "opacity 0.3s ease"
    });

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
    };
  
    const closeChat = () => {
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.style.display = "none";
        document.body.style.overflow = "";
        mobileCloseButton.style.display = "none";
        button.style.display = "block"; // Show the button again when chat is closed
        // Reset iframe
        iframe.style.opacity = "0";
        spinner.style.display = "block";
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
  
    overlay.appendChild(iframe);
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
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
  