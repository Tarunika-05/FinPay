// Global state
let currentUser = null;
let token = null;
let transactions = [];
let isLoginMode = true;

// API Base URL
const API_BASE = "window.location.origin";

// DOM Elements
const authPage = document.getElementById("authPage");
const dashboardPage = document.getElementById("dashboardPage");
const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");
const loginBtn = document.getElementById("loginBtn");
const loginText = document.getElementById("loginText");
const loginLoading = document.getElementById("loginLoading");
const showRegisterBtn = document.getElementById("showRegisterBtn");
const sendForm = document.getElementById("sendForm");
const sendMessage = document.getElementById("sendMessage");
const sendText = document.getElementById("sendText");
const sendLoading = document.getElementById("sendLoading");
const logoutBtn = document.getElementById("logoutBtn");
const currentUserSpan = document.getElementById("currentUser");
const walletBalance = document.getElementById("walletBalance");
const transactionTableBody = document.getElementById("transactionTableBody");

// Initialize app
function init() {
  // Check if user is already logged in
  const savedToken = getStoredToken();
  if (savedToken) {
    token = savedToken;
    // Extract username from token (assuming JWT structure)
    try {
      const payload = JSON.parse(atob(savedToken.split(".")[1]));
      currentUser = payload.username;
      showDashboard();
      loadUserData();
    } catch (e) {
      // Invalid token, remove it
      removeStoredToken();
      showAuth();
    }
  } else {
    showAuth();
  }

  // Add event listeners
  authForm.addEventListener("submit", handleAuth);
  showRegisterBtn.addEventListener("click", toggleAuthMode);
  sendForm.addEventListener("submit", handleSendMoney);
  logoutBtn.addEventListener("click", handleLogout);
}

// Storage functions (using in-memory storage for Claude.ai compatibility)
let memoryStorage = {};

function storeToken(token) {
  memoryStorage.token = token;
}

function getStoredToken() {
  return memoryStorage.token;
}

function removeStoredToken() {
  delete memoryStorage.token;
}

// Auth functions
function showAuth() {
  authPage.classList.remove("hidden");
  dashboardPage.classList.add("hidden");
}

function showDashboard() {
  authPage.classList.add("hidden");
  dashboardPage.classList.remove("hidden");
}

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    loginText.textContent = "Login";
    showRegisterBtn.textContent = "Create Account";
  } else {
    loginText.textContent = "Register";
    showRegisterBtn.textContent = "Back to Login";
  }
  clearMessage(authMessage);
}

async function handleAuth(e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (!username || !password) {
    showMessage(authMessage, "Please fill in all fields", "error");
    return;
  }

  setLoading(loginBtn, loginText, loginLoading, true);

  try {
    let response;
    if (isLoginMode) {
      response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } else {
      response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || "Authentication failed");
    }

    if (isLoginMode) {
      token = data.token;
      currentUser = username;
      storeToken(token);
      currentUserSpan.textContent = `Welcome, ${currentUser}!`;
      showDashboard();
      loadUserData();
      showMessage(authMessage, "", "");
    } else {
      showMessage(
        authMessage,
        "Account created successfully! Please login.",
        "success"
      );
      isLoginMode = true;
      loginText.textContent = "Login";
      showRegisterBtn.textContent = "Create Account";
    }

    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
  } catch (error) {
    showMessage(authMessage, error.message, "error");
  }

  setLoading(loginBtn, loginText, loginLoading, false);
}

// Updated loadUserData function with real backend API calls
async function loadUserData() {
  if (!currentUser || !token) return;

  currentUserSpan.textContent = `Welcome, ${currentUser}!`;

  try {
    // Get real balance from backend
    const balanceRes = await fetch(`${API_BASE}/balance`, {
      headers: { Authorization: token },
    });

    if (balanceRes.ok) {
      const balanceData = await balanceRes.json();
      walletBalance.textContent = `₹${balanceData.balance.toLocaleString()}`;
    } else {
      throw new Error("Failed to load balance");
    }

    // Get transactions from backend
    const txRes = await fetch(`${API_BASE}/transactions`, {
      headers: { Authorization: token },
    });

    if (txRes.ok) {
      const txData = await txRes.json();
      transactions = txData || [];
      updateTransactionHistory();
    } else {
      // If unauthorized, redirect to login
      if (txRes.status === 401) {
        handleLogout();
        return;
      }
      throw new Error("Failed to load transactions");
    }
  } catch (error) {
    console.error("Error loading user data:", error);
    showMessage(sendMessage, "Failed to load user data", "error");

    // If there's an auth error, logout
    if (
      error.message.includes("401") ||
      error.message.includes("Unauthorized")
    ) {
      handleLogout();
    }
  }
}

async function handleSendMoney(e) {
  e.preventDefault();

  const receiverUsername = document.getElementById("receiverUsername").value;
  const amount = parseFloat(document.getElementById("amount").value);

  if (!receiverUsername || !amount || amount <= 0) {
    showMessage(
      sendMessage,
      "Please fill in all fields with valid values",
      "error"
    );
    return;
  }

  if (receiverUsername === currentUser) {
    showMessage(sendMessage, "You cannot send money to yourself", "error");
    return;
  }

  setLoading(sendForm.querySelector("button"), sendText, sendLoading, true);

  try {
    const response = await fetch(`${API_BASE}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ to: receiverUsername, amount }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || "Transaction failed");
    }

    showMessage(
      sendMessage,
      `✅ Successfully sent ₹${amount} to ${receiverUsername}`,
      "success"
    );

    // Clear form
    document.getElementById("receiverUsername").value = "";
    document.getElementById("amount").value = "";

    // Reload user data (balance and transactions) from backend
    loadUserData();

    // Clear message after 3 seconds
    setTimeout(() => {
      clearMessage(sendMessage);
    }, 3000);
  } catch (error) {
    showMessage(sendMessage, error.message, "error");
  }

  setLoading(sendForm.querySelector("button"), sendText, sendLoading, false);
}

function updateTransactionHistory() {
  if (transactions.length === 0) {
    transactionTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            <div class="empty-state-icon">📋</div>
                            <div>No transactions yet</div>
                        </td>
                    </tr>
                `;
    return;
  }

  transactionTableBody.innerHTML = transactions
    .map((transaction) => {
      // Handle different response formats from backend
      const fromUser = transaction.from || transaction.sender;
      const toUser = transaction.to || transaction.receiver;
      const isOutgoing = fromUser === currentUser;
      const amountClass = isOutgoing ? "amount-negative" : "amount-positive";
      const amountPrefix = isOutgoing ? "-" : "+";

      // Handle different timestamp formats
      let transactionDate =
        transaction.timestamp || transaction.createdAt || transaction.date;
      if (typeof transactionDate === "string") {
        transactionDate = new Date(transactionDate);
      }

      return `
                    <tr class="transaction-row">
                        <td>${fromUser}</td>
                        <td>${toUser}</td>
                        <td class="${amountClass}">${amountPrefix}₹${transaction.amount.toLocaleString()}</td>
                        <td>${formatDate(transactionDate)}</td>
                        <td>
                            <span style="background: ${
                              isOutgoing ? "#ffebee" : "#e8f5e8"
                            }; 
                                         color: ${
                                           isOutgoing ? "#c62828" : "#2e7d32"
                                         }; 
                                         padding: 0.25rem 0.75rem; 
                                         border-radius: 20px; 
                                         font-size: 0.8rem; 
                                         font-weight: 500;">
                                ${isOutgoing ? "Sent" : "Received"}
                            </span>
                        </td>
                    </tr>
                `;
    })
    .join("");
}

function handleLogout() {
  removeStoredToken();
  currentUser = null;
  token = null;
  transactions = [];
  showAuth();

  // Reset forms
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("receiverUsername").value = "";
  document.getElementById("amount").value = "";
  clearMessage(authMessage);
  clearMessage(sendMessage);
}

// Utility functions
function showMessage(container, message, type) {
  if (!message) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `<div class="message ${type}">${message}</div>`;
}

function clearMessage(container) {
  container.innerHTML = "";
}

function setLoading(button, textElement, loadingElement, isLoading) {
  if (isLoading) {
    textElement.classList.add("hidden");
    loadingElement.classList.remove("hidden");
    button.disabled = true;
  } else {
    textElement.classList.remove("hidden");
    loadingElement.classList.add("hidden");
    button.disabled = false;
  }
}

function formatDate(date) {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// Initialize the app
init();
