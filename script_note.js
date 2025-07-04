// Notion Integration Script
// This file handles all Notion-related functionality using the Notion API

// Notion configuration
let notionConfig = {
  integrationKey: '',
  pageId: '',
  databaseId: '',
  isConfigured: false
};

// Storage keys
const NOTION_CONFIG_KEY = 'notion_integration_config';

// DOM elements
let notionElements = {};

// Notion content cache
let notionContent = {
  pages: [],
  databases: [],
  currentPage: null
};

// Initialize Notion integration when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeNotionElements();
  loadNotionConfig();
  setupNotionEventListeners();
});

function initializeNotionElements() {
  notionElements = {
    config: document.getElementById('notionConfig'),
    content: document.getElementById('notionContent'),
    loading: document.getElementById('notionLoading'),
    error: document.getElementById('notionError'),
    errorMessage: document.getElementById('notionErrorMessage'),
    
    // Form elements
    integrationKeyInput: document.getElementById('notionIntegrationKey'),
    pageUrlInput: document.getElementById('notionPageUrl'),
    saveConfigBtn: document.getElementById('saveNotionConfig'),
    
    // Header buttons
    configureBtn: document.getElementById('configureNotionButton'),
    refreshBtn: document.getElementById('refreshNotionButton'),
    retryBtn: document.getElementById('retryNotionConnection')
  };
}

function setupNotionEventListeners() {
  // Configuration form
  if (notionElements.saveConfigBtn) {
    notionElements.saveConfigBtn.addEventListener('click', handleSaveConfig);
  }
  
  // Header buttons
  if (notionElements.configureBtn) {
    notionElements.configureBtn.addEventListener('click', showConfigPanel);
  }
  
  if (notionElements.refreshBtn) {
    notionElements.refreshBtn.addEventListener('click', refreshNotionContent);
  }
  
  if (notionElements.retryBtn) {
    notionElements.retryBtn.addEventListener('click', retryNotionConnection);
  }
  
  // Form inputs
  if (notionElements.integrationKeyInput) {
    notionElements.integrationKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveConfig();
      }
    });
  }
  
  if (notionElements.pageUrlInput) {
    notionElements.pageUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveConfig();
      }
    });
  }
}

async function handleSaveConfig() {
  const integrationKey = notionElements.integrationKeyInput.value.trim();
  const pageUrl = notionElements.pageUrlInput.value.trim();
  
  if (!integrationKey) {
    showError('Please enter your Notion integration key');
    return;
  }
  
  if (!integrationKey.startsWith('ntn_')) {
    showError('Integration key should start with "ntn_"');
    return;
  }
  
  // Show loading state
  notionElements.saveConfigBtn.disabled = true;
  notionElements.saveConfigBtn.innerHTML = `
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite; margin-right: 8px;">
      <path d="M12 2v4l-1.5-1.5L9 6l3-3 3 3-1.5 1.5L12 6V2z"/>
    </svg>
    Connecting...
  `;
  
  try {
    // Test the integration key
    const testResult = await testNotionIntegration(integrationKey);
    
    if (testResult.success) {
      // Extract page ID from URL if provided
      let pageId = '';
      if (pageUrl) {
        pageId = extractPageIdFromUrl(pageUrl);
      }
      
      // Save configuration
      notionConfig = {
        integrationKey: integrationKey,
        pageId: pageId,
        databaseId: testResult.databaseId || '',
        isConfigured: true
      };
      
      saveNotionConfig();
      
      // Show success and load content
      showSuccess('Notion integration configured successfully!');
      await loadNotionContent();
      
    } else {
      showError(testResult.message);
      notionElements.saveConfigBtn.disabled = false;
      notionElements.saveConfigBtn.innerHTML = 'Save & Connect';
    }
  } catch (error) {
    console.error('Error configuring Notion:', error);
    showError('Failed to configure Notion integration. Please try again.');
    notionElements.saveConfigBtn.disabled = false;
    notionElements.saveConfigBtn.innerHTML = 'Save & Connect';
  }
}

function extractPageIdFromUrl(url) {
  // Extract page ID from Notion URL
  const match = url.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
  return match ? match[0].replace(/-/g, '') : '';
}

async function testNotionIntegration(integrationKey) {
  try {
    // Test the integration by making a simple API call directly to Notion
    const response = await fetch('https://api.notion.com/v1/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${integrationKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return { 
        success: true, 
        message: 'Integration key is valid!',
        user: data
      };
    } else {
      const errorData = await response.json();
      return { 
        success: false, 
        message: `Notion API Error: ${errorData.message || 'Invalid integration key'}` 
      };
    }
  } catch (error) {
    console.error('Notion API test failed:', error);
    return { 
      success: false, 
      message: 'Failed to connect to Notion API. Please check your internet connection.' 
    };
  }
}

async function loadNotionContent() {
  showLoadingState();
  
  try {
    if (notionConfig.pageId) {
      // Load specific page
      await loadNotionPage(notionConfig.pageId);
    } else {
      // Load user's accessible pages
      await loadNotionWorkspace();
    }
  } catch (error) {
    console.error('Error loading Notion content:', error);
    showErrorState('Failed to load Notion content. Please try again.');
  }
}

async function loadNotionPage(pageId) {
  try {
    // Fetch page content
    const pageResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${notionConfig.integrationKey}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    if (!pageResponse.ok) {
      throw new Error('Failed to fetch page');
    }
    
    const pageData = await pageResponse.json();
    
    // Fetch page blocks (content)
    const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      headers: {
        'Authorization': `Bearer ${notionConfig.integrationKey}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    if (!blocksResponse.ok) {
      throw new Error('Failed to fetch page blocks');
    }
    
    const blocksData = await blocksResponse.json();
    
    // Render the page
    renderNotionPage(pageData, blocksData.results);
    
  } catch (error) {
    console.error('Error loading Notion page:', error);
    showErrorState(`Failed to load page: ${error.message}`);
  }
}

async function loadNotionWorkspace() {
  try {
    // Search for pages the integration has access to
    const searchResponse = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionConfig.integrationKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'object',
          value: 'page'
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time'
        }
      })
    });
    
    if (!searchResponse.ok) {
      throw new Error('Failed to search pages');
    }
    
    const searchData = await searchResponse.json();
    
    // Render workspace with available pages
    renderNotionWorkspace(searchData.results);
    
  } catch (error) {
    console.error('Error loading Notion workspace:', error);
    showErrorState(`Failed to load workspace: ${error.message}`);
  }
}

function renderNotionPage(pageData, blocks) {
  const contentHtml = `
    <div class="notion-page">
      <div class="notion-page-header">
        <h1 class="notion-page-title">${getPageTitle(pageData)}</h1>
        <div class="notion-page-meta">
          <span>Last edited: ${formatDate(pageData.last_edited_time)}</span>
        </div>
      </div>
      <div class="notion-page-content">
        ${blocks.map(block => renderNotionBlock(block)).join('')}
      </div>
    </div>
  `;
  
  showContentState(contentHtml);
}

function renderNotionWorkspace(pages) {
  const contentHtml = `
    <div class="notion-workspace">
      <div class="notion-workspace-header">
        <h1>Your Notion Workspace</h1>
        <p>Select a page to view its content</p>
      </div>
      <div class="notion-pages-list">
        ${pages.map(page => `
          <div class="notion-page-item" onclick="loadSpecificPage('${page.id}')">
            <div class="notion-page-icon">
              ${getPageIcon(page)}
            </div>
            <div class="notion-page-info">
              <h3>${getPageTitle(page)}</h3>
              <p>Last edited: ${formatDate(page.last_edited_time)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  showContentState(contentHtml);
}

function renderNotionBlock(block) {
  switch (block.type) {
    case 'paragraph':
      return `<p class="notion-paragraph">${renderRichText(block.paragraph.rich_text)}</p>`;
    
    case 'heading_1':
      return `<h1 class="notion-heading-1">${renderRichText(block.heading_1.rich_text)}</h1>`;
    
    case 'heading_2':
      return `<h2 class="notion-heading-2">${renderRichText(block.heading_2.rich_text)}</h2>`;
    
    case 'heading_3':
      return `<h3 class="notion-heading-3">${renderRichText(block.heading_3.rich_text)}</h3>`;
    
    case 'bulleted_list_item':
      return `<div class="notion-list-item">
        <span class="notion-bullet">•</span>
        <span>${renderRichText(block.bulleted_list_item.rich_text)}</span>
      </div>`;
    
    case 'numbered_list_item':
      return `<div class="notion-list-item numbered">
        <span class="notion-number">1.</span>
        <span>${renderRichText(block.numbered_list_item.rich_text)}</span>
      </div>`;
    
    case 'to_do':
      return `<div class="notion-todo">
        <input type="checkbox" ${block.to_do.checked ? 'checked' : ''} disabled>
        <span class="${block.to_do.checked ? 'completed' : ''}">${renderRichText(block.to_do.rich_text)}</span>
      </div>`;
    
    case 'toggle':
      return `<details class="notion-toggle">
        <summary>${renderRichText(block.toggle.rich_text)}</summary>
        <div class="notion-toggle-content">
          ${block.children ? block.children.map(child => renderNotionBlock(child)).join('') : ''}
        </div>
      </details>`;
    
    case 'quote':
      return `<blockquote class="notion-quote">${renderRichText(block.quote.rich_text)}</blockquote>`;
    
    case 'code':
      return `<pre class="notion-code"><code class="language-${block.code.language || 'text'}">${renderRichText(block.code.rich_text)}</code></pre>`;
    
    case 'divider':
      return `<hr class="notion-divider">`;
    
    default:
      return `<div class="notion-unsupported">Unsupported block type: ${block.type}</div>`;
  }
}

function renderRichText(richText) {
  return richText.map(text => {
    let content = text.plain_text;
    
    if (text.annotations.bold) content = `<strong>${content}</strong>`;
    if (text.annotations.italic) content = `<em>${content}</em>`;
    if (text.annotations.strikethrough) content = `<s>${content}</s>`;
    if (text.annotations.underline) content = `<u>${content}</u>`;
    if (text.annotations.code) content = `<code>${content}</code>`;
    
    if (text.href) {
      content = `<a href="${text.href}" target="_blank">${content}</a>`;
    }
    
    if (text.annotations.color && text.annotations.color !== 'default') {
      content = `<span class="notion-color-${text.annotations.color}">${content}</span>`;
    }
    
    return content;
  }).join('');
}

function getPageTitle(page) {
  if (page.properties && page.properties.title) {
    return renderRichText(page.properties.title.title) || 'Untitled';
  }
  return page.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
}

function getPageIcon(page) {
  if (page.icon) {
    if (page.icon.type === 'emoji') {
      return page.icon.emoji;
    } else if (page.icon.type === 'external') {
      return `<img src="${page.icon.external.url}" alt="icon" width="20" height="20">`;
    }
  }
  return '📄';
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function loadSpecificPage(pageId) {
  notionConfig.pageId = pageId;
  await loadNotionPage(pageId);
}

function showConfigPanel() {
  hideAllStates();
  notionElements.config.style.display = 'flex';
  
  // Focus on integration key input
  if (notionElements.integrationKeyInput) {
    notionElements.integrationKeyInput.focus();
  }
}

function showLoadingState() {
  hideAllStates();
  notionElements.loading.style.display = 'flex';
}

function showContentState(html) {
  hideAllStates();
  
  // Create content container if it doesn't exist
  let contentContainer = document.getElementById('notionContentContainer');
  if (!contentContainer) {
    contentContainer = document.createElement('div');
    contentContainer.id = 'notionContentContainer';
    contentContainer.className = 'notion-content-container';
    notionElements.content.appendChild(contentContainer);
  }
  
  contentContainer.innerHTML = html;
  contentContainer.style.display = 'block';
}

function showErrorState(message) {
  hideAllStates();
  notionElements.error.style.display = 'flex';
  if (notionElements.errorMessage) {
    notionElements.errorMessage.textContent = message;
  }
}

function hideAllStates() {
  notionElements.config.style.display = 'none';
  notionElements.loading.style.display = 'none';
  notionElements.error.style.display = 'none';
  
  const contentContainer = document.getElementById('notionContentContainer');
  if (contentContainer) {
    contentContainer.style.display = 'none';
  }
}

function refreshNotionContent() {
  if (notionConfig.isConfigured) {
    loadNotionContent();
  } else {
    showError('Please configure Notion integration first');
  }
}

function retryNotionConnection() {
  if (notionConfig.isConfigured) {
    loadNotionContent();
  } else {
    showConfigPanel();
  }
}

function saveNotionConfig() {
  try {
    // Simple obfuscation for the integration key
    const configToSave = {
      ...notionConfig,
      integrationKey: btoa(notionConfig.integrationKey)
    };
    localStorage.setItem(NOTION_CONFIG_KEY, JSON.stringify(configToSave));
  } catch (error) {
    console.error('Error saving Notion config:', error);
  }
}

function loadNotionConfig() {
  try {
    const saved = localStorage.getItem(NOTION_CONFIG_KEY);
    if (saved) {
      const config = JSON.parse(saved);
      notionConfig = {
        ...config,
        integrationKey: atob(config.integrationKey)
      };
      
      // Populate form fields
      if (notionElements.integrationKeyInput) {
        notionElements.integrationKeyInput.value = notionConfig.integrationKey;
      }
      if (notionElements.pageUrlInput && notionConfig.pageId) {
        notionElements.pageUrlInput.value = `https://notion.so/${notionConfig.pageId}`;
      }
      
      // If configured, load content
      if (notionConfig.isConfigured) {
        loadNotionContent();
      }
    }
  } catch (error) {
    console.error('Error loading Notion config:', error);
    notionConfig.isConfigured = false;
  }
}

// Initialize Notion view when switching to note view
function initializeNotionView() {
  if (notionConfig.isConfigured) {
    loadNotionContent();
  } else {
    showConfigPanel();
  }
}

// Export functions for use in main script
window.NotionIntegration = {
  initialize: initializeNotionView,
  isConfigured: () => notionConfig.isConfigured,
  refresh: refreshNotionContent,
  configure: showConfigPanel
};

// Toast notification functions (using existing toast system)
function showError(message) {
  if (window.createToast) {
    window.createToast(message, 'error');
  } else {
    console.error(message);
  }
}

function showSuccess(message) {
  if (window.createToast) {
    window.createToast(message, 'success');
  } else {
    console.log(message);
  }
}

function showInfo(message) {
  if (window.createToast) {
    window.createToast(message, 'info');
  } else {
    console.info(message);
  }
} 