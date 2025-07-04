const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const messagesContainer = document.getElementById('messages');
const toastContainer = document.getElementById('toastContainer');
const newChatButton = document.getElementById('newChatButton');
const chatList = document.querySelector('.chat-list .chat-section');

// API Key will be set by user input
let OPENAI_API_KEY = '';

// Local storage keys
const CHATS_STORAGE_KEY = 'ai_assistant_chats';
const ACTIVE_CHAT_KEY = 'ai_assistant_active_chat';
const API_KEY_STORAGE = 'openai_api_key_secure';

// View management
let currentView = 'chat'; // 'chat' or 'note'

// Storage keys
const CURRENT_VIEW_KEY = 'ai_assistant_current_view';

// Chat management
let chats = {};
let currentChatId = 'default';
let chatHistory = [];
let uiHistory = [];

// Configure marked for better rendering
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {}
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

// Utility functions
function generateChatId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
}

// Toast notifications
function createToast(message, type = 'error', duration = 5000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconSvg = '';
  switch (type) {
    case 'error':
      iconSvg = `
        <svg class="toast-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
        </svg>
      `;
      break;
    case 'success':
      iconSvg = `
        <svg class="toast-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
        </svg>
      `;
      break;
    case 'info':
      iconSvg = `
        <svg class="toast-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
        </svg>
      `;
      break;
  }
  
  toast.innerHTML = `
    ${iconSvg}
    <span>${message}</span>
    <button class="toast-close" onclick="removeToast(this.parentElement)">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
      </svg>
    </button>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    removeToast(toast);
  }, duration);
  
  return toast;
}

function removeToast(toast) {
  if (toast && toast.parentElement) {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }
}

function showError(message) {
  createToast(message, 'error');
}

function showSuccess(message) {
  createToast(message, 'success');
}

function showInfo(message) {
  createToast(message, 'info');
}

// Copy functionality
function copyMessageContent(messageText, buttonElement) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(messageText).then(() => {
      showCopySuccess(buttonElement);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      fallbackCopyTextToClipboard(messageText, buttonElement);
    });
  } else {
    fallbackCopyTextToClipboard(messageText, buttonElement);
  }
}

function fallbackCopyTextToClipboard(text, buttonElement) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showCopySuccess(buttonElement);
    } else {
      showError('Failed to copy message');
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    showError('Failed to copy message');
  }
  
  document.body.removeChild(textArea);
}

function showCopySuccess(buttonElement) {
  const originalHTML = buttonElement.innerHTML;
  buttonElement.classList.add('copied');
  buttonElement.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
    </svg>
  `;
  
  showSuccess('Message copied to clipboard!');
  
  setTimeout(() => {
    buttonElement.classList.remove('copied');
    buttonElement.innerHTML = originalHTML;
  }, 2000);
}

// Chat management functions
function createNewChat() {
  console.log('createNewChat called'); // Debug log
  const chatId = generateChatId();
  const chatName = `New Chat`;
  
  console.log('Creating new chat:', { chatId, chatName }); // Debug log
  
  chats[chatId] = {
    id: chatId,
    name: chatName,
    messages: [],
    chatHistory: [],
    createdAt: new Date().toISOString(),
    lastMessage: 'New chat started...',
    isFirstMessage: true // Flag to track if this is the first message
  };
  
  console.log('Chats after creation:', chats); // Debug log
  
  saveChats();
  renderChatList();
  switchToChat(chatId);
  
  showSuccess('New chat created!');
}

function switchToChat(chatId) {
  // Save current chat state
  if (currentChatId && chats[currentChatId]) {
    chats[currentChatId].messages = [...uiHistory];
    chats[currentChatId].chatHistory = [...chatHistory];
  }
  
  // Switch to new chat
  currentChatId = chatId;
  
  // Load chat data
  if (chats[chatId]) {
    uiHistory = [...chats[chatId].messages];
    chatHistory = [...chats[chatId].chatHistory];
  } else {
    uiHistory = [];
    chatHistory = [];
  }
  
  // Update UI
  updateActiveChat();
  renderMessages();
  saveActiveChat();
  
  // Update main chat header
  const chatName = chats[chatId]?.name || 'AI Assistant';
  document.querySelector('.main-chat-info h2').textContent = chatName;
}

function updateActiveChat() {
  const chatItems = document.querySelectorAll('.chat-item');
  chatItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.chatId === currentChatId) {
      item.classList.add('active');
    }
  });
}

function renderChatList() {
  const chatItems = Array.from(Object.values(chats))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Build only the chat items HTML, preserving the new chat button
  let chatListHTML = `
    <div class="new-chat-button" id="newChatButton" title="New Chat">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <span>New Chat</span>
    </div>
    <div class="chat-section-title">Chats</div>
  `;
  
  chatItems.forEach(chat => {
    const isActive = chat.id === currentChatId ? 'active' : '';
    const time = new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    chatListHTML += `
      <div class="chat-item ${isActive}" data-chat-id="${chat.id}">
        <button class="chat-close-button" onclick="deleteChat('${chat.id}', event)" title="Close chat">
          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        <div class="chat-avatar ai-message-avatar">AI</div>
        <div class="chat-info">
          <div class="chat-name" onclick="startRenameChat('${chat.id}', event)" title="Click to rename">${chat.name}</div>
          <div class="chat-preview">${chat.lastMessage}</div>
        </div>
        <div class="chat-time">${time}</div>
      </div>
    `;
  });
  
  chatList.innerHTML = chatListHTML;
  
  // Re-add event listener to the new chat button
  const newChatBtn = document.getElementById('newChatButton');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', function() {
      console.log('New chat button clicked!'); // Debug log
      createNewChat();
    });
  }
  
  // Add event listeners to chat items
  document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't switch chat if close button or chat name was clicked
      if (e.target.closest('.chat-close-button') || e.target.closest('.chat-name')) {
        return;
      }
      const chatId = item.dataset.chatId;
      switchToChat(chatId);
    });
  });
}

function renderMessages() {
  // Clear existing messages
  messagesContainer.innerHTML = '';
  
  if (uiHistory.length === 0) {
    // Show welcome message for new chats
    const welcomeMessageGroup = document.createElement('div');
    welcomeMessageGroup.className = 'message-group ai-message';
    welcomeMessageGroup.innerHTML = `
      <div class="message-avatar ai-message-avatar">AI</div>
      <div class="message-content-wrapper">
        <div class="message-header">
          <div class="message-name">AI Assistant</div>
          <div class="message-time">Now</div>
        </div>
        <div class="message-content">
          <p>👋 Hello! I'm your AI Assistant. How can I help you today?</p>
        </div>
      </div>
    `;
    messagesContainer.appendChild(welcomeMessageGroup);
  } else {
    // Render saved messages
    uiHistory.forEach(msg => {
      addMessage(msg.content, msg.isUser, msg.isError, false);
    });
  }
  
  // Scroll to bottom
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 100);
}

function removeWelcomeMessage() {
  const welcomeMessages = document.querySelectorAll('.message-group');
  welcomeMessages.forEach(msg => {
    if (msg.querySelector('.message-content p')?.textContent.includes('👋 Hello! I\'m your AI Assistant')) {
      msg.remove();
    }
  });
}

function addMessage(message, isUser = true, isError = false, saveToStorage = true) {
  // Remove welcome message on first user message
  if (isUser) {
    removeWelcomeMessage();
  }
  
  // Save to UI history if requested
  if (saveToStorage) {
    uiHistory.push({
      content: message,
      isUser: isUser,
      isError: isError,
      timestamp: new Date().toISOString()
    });
    
    // Update chat's last message
    if (chats[currentChatId]) {
      chats[currentChatId].lastMessage = isUser ? 
        (message.length > 50 ? message.substring(0, 50) + '...' : message) :
        'AI: ' + (message.length > 40 ? message.substring(0, 40) + '...' : message);
      chats[currentChatId].messages = [...uiHistory];
    }
    
    saveChats();
    renderChatList();
  }
  
  const messageGroup = document.createElement('div');
  messageGroup.className = `message-group ${isUser ? 'user-message' : 'ai-message'}`;
  
  const avatarClass = isUser ? 'user-message-avatar' : 'ai-message-avatar';
  const avatarText = isUser ? 'You' : 'AI';
  const messageName = isUser ? 'You' : 'AI Assistant';
  
  let processedMessage = message;
  
  // Process markdown for AI messages
  if (!isUser && !isError) {
    try {
      processedMessage = marked.parse(message);
    } catch (error) {
      console.error('Markdown parsing error:', error);
      processedMessage = message;
    }
  }
  
  // Create copy button for AI messages
  const copyButton = !isUser ? `
    <button class="copy-button" title="Copy message">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
    </button>
  ` : '';
  
  messageGroup.innerHTML = `
    <div class="message-avatar ${avatarClass}">${avatarText}</div>
    <div class="message-content-wrapper">
      <div class="message-header">
        <div class="message-name">${messageName}</div>
        <div class="message-time">${formatTime()}</div>
      </div>
      <div class="message-content ${isError ? 'error' : ''}">
        ${processedMessage}
      </div>
      ${copyButton}
    </div>
  `;
  
  messagesContainer.appendChild(messageGroup);
  
  // Add event listener to copy button if it exists
  if (!isUser) {
    const copyBtn = messageGroup.querySelector('.copy-button');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyMessageContent(message, copyBtn);
      });
    }
  }
  
  // Highlight code blocks
  if (!isUser && !isError) {
    messageGroup.querySelectorAll('pre code').forEach(block => {
      hljs.highlightBlock(block);
    });
  }
  
  // Scroll to bottom
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 100);
}

function addTypingIndicator() {
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.id = 'typing-indicator';
  
  typingIndicator.innerHTML = `
    <div class="message-avatar ai-message-avatar">AI</div>
    <div class="typing-content">
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <div class="typing-text">AI is typing...</div>
    </div>
  `;
  
  messagesContainer.appendChild(typingIndicator);
  
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 100);
}

function removeTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

async function getAIResponse(userMessage) {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Provide clear, concise, and helpful responses. Format your responses using markdown when appropriate for better readability.'
        },
        ...chatHistory,
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    
    if (error.response?.status === 401) {
      throw new Error('Invalid API key. Please check your OpenAI API key.');
    } else if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (error.response?.status === 500) {
      throw new Error('OpenAI server error. Please try again later.');
    } else if (!navigator.onLine) {
      throw new Error('No internet connection. Please check your connection.');
    } else {
      throw new Error('Failed to get AI response. Please try again.');
    }
  }
}

async function sendMessage() {
  const message = messageInput.value.trim();
  
  if (!message) {
    showError('Please enter a message');
    return;
  }
  
  if (!OPENAI_API_KEY) {
    showError('Please enter your API key first');
    showApiKeyModal();
    return;
  }
  
  // Check if this is the first message in the chat and rename it
  if (chats[currentChatId] && chats[currentChatId].isFirstMessage) {
    // Create a chat name from the first message (limit to 30 characters)
    const chatName = message.length > 30 ? message.substring(0, 30) + '...' : message;
    chats[currentChatId].name = chatName;
    chats[currentChatId].isFirstMessage = false;
    
    // Update the main chat header
    document.querySelector('.main-chat-info h2').textContent = chatName;
  }
  
  // Disable send button and show loading state
  sendButton.disabled = true;
  sendButton.innerHTML = `
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
      <path d="M12 2v4l-1.5-1.5L9 6l3-3 3 3-1.5 1.5L12 6V2z"/>
      <path d="M6 9l3 3-3 3 1.5 1.5L9 15l-3-3 3-3L6 9z"/>
      <path d="M18 9l-3 3 3 3-1.5 1.5L15 15l3-3-3-3L18 9z"/>
      <path d="M12 18v4l1.5-1.5L15 18l-3 3-3-3 1.5-1.5L12 18v-4z"/>
    </svg>
  `;
  
  // Clear input
  messageInput.value = '';
  autoResizeTextarea();
  
  // Add user message
  addMessage(message, true);
  
  // Add to conversation history
  chatHistory.push({
    role: 'user',
    content: message
  });
  
  // Add typing indicator
  addTypingIndicator();
  
  try {
    // Get AI response
    const aiResponse = await getAIResponse(message);
    
    // Remove typing indicator
    removeTypingIndicator();
    
    // Add to conversation history
    chatHistory.push({
      role: 'assistant',
      content: aiResponse
    });
    
    // Save chat history
    if (chats[currentChatId]) {
      chats[currentChatId].chatHistory = [...chatHistory];
    }
    
    // Add AI response
    addMessage(aiResponse, false);
    
  } catch (error) {
    // Remove typing indicator
    removeTypingIndicator();
    
    // Add error message and show notification
    addMessage(error.message, false, true);
    showError(error.message);
  }
  
  // Re-enable send button
  sendButton.disabled = false;
  sendButton.innerHTML = `
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  `;
  
  // Focus back on input
  messageInput.focus();
}

// Local storage functions
function saveChats() {
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error('Error saving chats:', error);
  }
}

function loadChats() {
  try {
    const saved = localStorage.getItem(CHATS_STORAGE_KEY);
    if (saved) {
      chats = JSON.parse(saved);
      
      // Ensure backward compatibility - add isFirstMessage property to existing chats
      Object.values(chats).forEach(chat => {
        if (chat.isFirstMessage === undefined) {
          // If chat has no messages, it's a new chat
          chat.isFirstMessage = !chat.messages || chat.messages.length === 0;
        }
      });
      
    } else {
      // Create default chat if none exists
      chats = {
        'default': {
          id: 'default',
          name: 'AI Assistant',
          messages: [],
          chatHistory: [],
          createdAt: new Date().toISOString(),
          lastMessage: 'Ready to help you with anything...',
          isFirstMessage: true
        }
      };
      saveChats();
    }
  } catch (error) {
    console.error('Error loading chats:', error);
    chats = {
      'default': {
        id: 'default',
        name: 'AI Assistant',
        messages: [],
        chatHistory: [],
        createdAt: new Date().toISOString(),
        lastMessage: 'Ready to help you with anything...',
        isFirstMessage: true
      }
    };
  }
}

function saveActiveChat() {
  try {
    localStorage.setItem(ACTIVE_CHAT_KEY, currentChatId);
  } catch (error) {
    console.error('Error saving active chat:', error);
  }
}

function loadActiveChat() {
  try {
    const saved = localStorage.getItem(ACTIVE_CHAT_KEY);
    if (saved && chats[saved]) {
      currentChatId = saved;
    } else {
      currentChatId = 'default';
    }
  } catch (error) {
    console.error('Error loading active chat:', error);
    currentChatId = 'default';
  }
}

function clearCurrentChat() {
  if (confirm('Are you sure you want to clear this chat? This action cannot be undone.')) {
    // Reset current chat
    uiHistory = [];
    chatHistory = [];
    
    if (chats[currentChatId]) {
      chats[currentChatId].messages = [];
      chats[currentChatId].chatHistory = [];
      chats[currentChatId].lastMessage = 'Ready to help you with anything...';
    }
    
    saveChats();
    renderMessages();
    renderChatList();
    
    showSuccess('Chat cleared successfully!');
  }
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

document.getElementById('clearChatButton').addEventListener('click', clearCurrentChat);

document.getElementById('apiKeyButton').addEventListener('click', function() {
  showApiKeyModal();
});

// Add debugging for the newChatButton
document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOM loaded, looking for newChatButton'); // Debug log
  const newChatBtn = document.getElementById('newChatButton');
  console.log('newChatButton found:', newChatBtn); // Debug log
  
  if (newChatBtn) {
    newChatBtn.addEventListener('click', function() {
      console.log('New chat button clicked!'); // Debug log
      createNewChat();
    });
  } else {
    console.error('newChatButton not found!');
  }
  
  // Add navigation event listeners
  const chatNavButton = document.getElementById('chatNavButton');
  const noteNavButton = document.getElementById('noteNavButton');
  
  if (chatNavButton) {
    chatNavButton.addEventListener('click', function() {
      switchToView('chat');
    });
  }
  
  if (noteNavButton) {
    noteNavButton.addEventListener('click', function() {
      switchToView('note');
    });
  }
  
  // Load current view preference
  loadCurrentView();
  
  // Check for API key and initialize interface
  const storedKey = getStoredApiKey();
  if (storedKey) {
    // If we have a stored key, trust it and enable interface immediately
    OPENAI_API_KEY = storedKey;
    enableInterface();
    showSuccess('Welcome back! Ready to chat.');
  } else {
    // No stored key, disable interface and show modal
    disableInterface();
    setTimeout(() => {
      showApiKeyModal();
    }, 500);
  }
  
  messageInput.focus();
  autoResizeTextarea();
  
  // Load chats and set up UI
  loadChats();
  loadActiveChat();
  
  // Load current chat data
  if (chats[currentChatId]) {
    uiHistory = [...chats[currentChatId].messages];
    chatHistory = [...chats[currentChatId].chatHistory];
  }
  
  renderChatList();
  renderMessages();
  updateActiveChat();
  
  // Initialize the correct view
  switchToView(currentView);
  
  // Handle navigation items (remove old handler)
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const viewType = this.dataset.view;
      if (viewType) {
        switchToView(viewType);
      }
    });
  });
});

messageInput.addEventListener('input', autoResizeTextarea);

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Disable Grammarly
messageInput.addEventListener('focus', function() {
  this.setAttribute('data-gramm', 'false');
  this.setAttribute('data-gramm_editor', 'false');
  this.setAttribute('data-enable-grammarly', 'false');
});

// Handle window resize
window.addEventListener('resize', function() {
  autoResizeTextarea();
});

// Global function for toast close button
window.removeToast = removeToast;

// Add CSS animation for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

function deleteChat(chatId, event) {
  event.stopPropagation(); // Prevent chat switching when clicking close button
  
  const chatName = chats[chatId]?.name || 'this chat';
  
  if (confirm(`Are you sure you want to delete "${chatName}"? This action cannot be undone.`)) {
    // If deleting the current chat, switch to another chat or create default
    if (chatId === currentChatId) {
      const remainingChats = Object.keys(chats).filter(id => id !== chatId);
      
      if (remainingChats.length > 0) {
        // Switch to the first remaining chat
        switchToChat(remainingChats[0]);
      } else {
        // Create a new default chat if no chats remain
        const defaultChat = {
          id: 'default',
          name: 'AI Assistant',
          messages: [],
          chatHistory: [],
          createdAt: new Date().toISOString(),
          lastMessage: 'Ready to help you with anything...',
          isFirstMessage: true
        };
        chats['default'] = defaultChat;
        switchToChat('default');
      }
    }
    
    // Delete the chat from storage
    delete chats[chatId];
    saveChats();
    
    // Re-render the chat list
    renderChatList();
    
    showSuccess(`Chat "${chatName}" deleted successfully!`);
  }
}

function startRenameChat(chatId, event) {
  event.stopPropagation(); // Prevent chat switching
  
  const chatNameElement = event.target;
  const currentName = chatNameElement.textContent;
  
  // Create input element
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.className = 'chat-name-input';
  input.maxLength = 50;
  
  // Replace the chat name with input
  chatNameElement.style.display = 'none';
  chatNameElement.parentNode.insertBefore(input, chatNameElement);
  
  // Focus and select text
  input.focus();
  input.select();
  
  // Handle save on Enter or blur
  const saveRename = () => {
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      // Update chat name
      if (chats[chatId]) {
        chats[chatId].name = newName;
        saveChats();
        
        // Update main chat header if this is the current chat
        if (chatId === currentChatId) {
          document.querySelector('.main-chat-info h2').textContent = newName;
        }
        
        renderChatList();
      }
    } else {
      // Restore original name
      chatNameElement.textContent = currentName;
      chatNameElement.style.display = '';
      input.remove();
    }
  };
  
  // Handle cancel on Escape
  const cancelRename = () => {
    chatNameElement.style.display = '';
    input.remove();
  };
  
  // Event listeners
  input.addEventListener('blur', saveRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  });
}

window.deleteChat = deleteChat; // Make deleteChat globally available
window.startRenameChat = startRenameChat; // Make startRenameChat globally available

// API Key management functions
async function testApiKey(apiKey) {
  try {
    // Make a minimal test call to OpenAI API
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Hello'
        }
      ],
      max_tokens: 1,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true, message: 'API key is valid and working!' };
  } catch (error) {
    console.error('API key test failed:', error);
    
    if (error.response?.status === 401) {
      return { success: false, message: 'Invalid API key. Please check your key and try again.' };
    } else if (error.response?.status === 429) {
      return { success: false, message: 'Rate limit exceeded. Your key is valid but you\'ve hit usage limits.' };
    } else if (error.response?.status === 403) {
      return { success: false, message: 'API key doesn\'t have permission to access this endpoint.' };
    } else if (error.response?.status === 402) {
      return { success: false, message: 'Insufficient quota. Please check your OpenAI billing.' };
    } else if (!navigator.onLine) {
      return { success: false, message: 'No internet connection. Please check your connection and try again.' };
    } else {
      return { success: false, message: 'Failed to connect to OpenAI. Please try again.' };
    }
  }
}

function getStoredApiKey() {
  try {
    const stored = localStorage.getItem(API_KEY_STORAGE);
    if (stored) {
      // Simple obfuscation (not true encryption, but better than plain text)
      return atob(stored);
    }
    return null;
  } catch (error) {
    console.error('Error retrieving API key:', error);
    return null;
  }
}

function storeApiKey(apiKey) {
  try {
    // Simple obfuscation (not true encryption, but better than plain text)
    localStorage.setItem(API_KEY_STORAGE, btoa(apiKey));
    OPENAI_API_KEY = apiKey;
  } catch (error) {
    console.error('Error storing API key:', error);
  }
}

function clearApiKey() {
  try {
    localStorage.removeItem(API_KEY_STORAGE);
    OPENAI_API_KEY = '';
  } catch (error) {
    console.error('Error clearing API key:', error);
  }
}

function showApiKeyModal() {
  const modal = document.createElement('div');
  modal.className = 'api-key-modal';
  modal.innerHTML = `
    <div class="api-key-modal-content">
      <div class="api-key-modal-header">
        <h3>Welcome to AI Assistant</h3>
        <p>Please enter your OpenAI API key to get started.</p>
      </div>
      <div class="api-key-modal-body">
        <input type="password" id="apiKeyInput" placeholder="sk-..." class="api-key-input" />
        <div class="api-key-help">
          <p><strong>Don't have an API key?</strong> <a href="https://platform.openai.com/api-keys" target="_blank">Get one here</a></p>
          <p><small>🔒 Your API key is stored locally and only sent to OpenAI.</small></p>
        </div>
        <div id="apiKeyStatus" class="api-key-status" style="display: none;"></div>
      </div>
      <div class="api-key-modal-actions">
        <button id="saveApiKey" class="api-key-save-btn">Test & Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveBtn = document.getElementById('saveApiKey');
  const statusDiv = document.getElementById('apiKeyStatus');
  
  // Focus on input
  setTimeout(() => apiKeyInput.focus(), 100);
  
  // Handle save
  const handleSave = async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showError('Please enter a valid API key');
      return;
    }
    
    if (!apiKey.startsWith('sk-')) {
      showError('API key should start with "sk-"');
      return;
    }
    
    // Disable button and show testing state
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite; margin-right: 8px;">
        <path d="M12 2v4l-1.5-1.5L9 6l3-3 3 3-1.5 1.5L12 6V2z"/>
        <path d="M6 9l3 3-3 3 1.5 1.5L9 15l-3-3 3-3L6 9z"/>
        <path d="M18 9l-3 3 3 3-1.5 1.5L15 15l3-3-3-3L18 9z"/>
        <path d="M12 18v4l1.5-1.5L15 18l-3 3-3-3 1.5-1.5L12 18v-4z"/>
      </svg>
      Testing API Key...
    `;
    
    // Show status
    statusDiv.style.display = 'block';
    statusDiv.className = 'api-key-status testing';
    statusDiv.innerHTML = '🔄 Testing your API key with OpenAI...';
    
    // Test the API key
    const testResult = await testApiKey(apiKey);
    
    if (testResult.success) {
      // Success - store key and close modal
      storeApiKey(apiKey);
      statusDiv.className = 'api-key-status success';
      statusDiv.innerHTML = '✅ ' + testResult.message;
      
      setTimeout(() => {
        document.body.removeChild(modal);
        showSuccess('API key validated and saved successfully!');
        enableInterface();
      }, 1500);
    } else {
      // Failed - show error and reset button
      statusDiv.className = 'api-key-status error';
      statusDiv.innerHTML = '❌ ' + testResult.message;
      
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Test & Save';
      
      showError(testResult.message);
    }
  };
  
  // Event listeners
  saveBtn.addEventListener('click', handleSave);
  
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  });
}

function checkApiKey() {
  const stored = getStoredApiKey();
  if (stored) {
    OPENAI_API_KEY = stored;
    return true;
  }
  return false;
}

function disableInterface() {
  // Disable input and buttons
  messageInput.disabled = true;
  sendButton.disabled = true;
  newChatButton.style.pointerEvents = 'none';
  newChatButton.style.opacity = '0.5';
  
  // Add overlay to prevent interaction
  const overlay = document.createElement('div');
  overlay.id = 'interface-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.1);
    z-index: 999;
    pointer-events: none;
  `;
  document.body.appendChild(overlay);
}

function enableInterface() {
  // Enable input and buttons
  messageInput.disabled = false;
  sendButton.disabled = false;
  newChatButton.style.pointerEvents = 'auto';
  newChatButton.style.opacity = '1';
  
  // Remove overlay
  const overlay = document.getElementById('interface-overlay');
  if (overlay) {
    overlay.remove();
  }
  
  // Focus on input
  messageInput.focus();
}

// View switching functions
function switchToView(viewName) {
  console.log('Switching to view:', viewName);
  
  // Update current view
  currentView = viewName;
  
  // Update navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const teamsLayout = document.querySelector('.teams-layout');
  
  if (viewName === 'chat') {
    document.getElementById('chatNavButton').classList.add('active');
    document.getElementById('chatSidebar').style.display = 'flex';
    document.getElementById('noteSidebar').style.display = 'none';
    document.getElementById('chatArea').style.display = 'flex';
    document.getElementById('noteArea').style.display = 'none';
    teamsLayout.classList.remove('note-view');
  } else if (viewName === 'note') {
    document.getElementById('noteNavButton').classList.add('active');
    document.getElementById('chatSidebar').style.display = 'none';
    document.getElementById('noteSidebar').style.display = 'none'; // Hide note sidebar too
    document.getElementById('chatArea').style.display = 'none';
    document.getElementById('noteArea').style.display = 'flex';
    teamsLayout.classList.add('note-view');
    
    // Initialize Notion integration
    if (window.NotionIntegration) {
      window.NotionIntegration.initialize();
    }
  }
  
  // Save current view preference
  saveCurrentView();
}

function saveCurrentView() {
  try {
    localStorage.setItem(CURRENT_VIEW_KEY, currentView);
  } catch (error) {
    console.error('Error saving current view:', error);
  }
}

function loadCurrentView() {
  try {
    const saved = localStorage.getItem(CURRENT_VIEW_KEY);
    if (saved && (saved === 'chat' || saved === 'note')) {
      currentView = saved;
    } else {
      currentView = 'chat';
    }
  } catch (error) {
    console.error('Error loading current view:', error);
    currentView = 'chat';
  }
} 