// Notion Integration Script
// This file handles all Notion-related functionality using the Notion API

// CORS proxy configuration - Using Solution 1: Public CORS proxy

// Option 1: Public CORS proxy (Solution 1)
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const USE_SERVERLESS_PROXY = false;

// Alternative public proxies you can try if the above doesn't work:
// const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
// const CORS_PROXY = 'https://corsproxy.io/?';
// const CORS_PROXY = 'https://cors.sh/';

// Option 2: Your own serverless proxy (for future reference)
// const SERVERLESS_PROXY_URL = 'https://your-project.vercel.app/api/notion-proxy';
// const USE_SERVERLESS_PROXY = true;

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

// Navigation history
let navigationHistory = {
  pages: [],
  currentIndex: -1,
  breadcrumbs: []
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
    retryBtn: document.getElementById('retryNotionConnection'),
    
    // Navigation elements
    breadcrumbContainer: document.getElementById('notionBreadcrumb'),
    backBtn: document.getElementById('notionBackButton'),
    forwardBtn: document.getElementById('notionForwardButton')
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
  
  // Navigation buttons
  if (notionElements.backBtn) {
    notionElements.backBtn.addEventListener('click', navigateBack);
  }
  
  if (notionElements.forwardBtn) {
    notionElements.forwardBtn.addEventListener('click', navigateForward);
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

// Helper function to make API calls through proxy
async function makeNotionAPICall(endpoint, options = {}) {
  const { method = 'GET', body } = options;
  
  if (USE_SERVERLESS_PROXY) {
    // Use serverless proxy
    const response = await fetch(SERVERLESS_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${notionConfig.integrationKey}`
      },
      body: JSON.stringify({
        endpoint: endpoint,
        method: method,
        body: body
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'API call failed');
    }
    
    return await response.json();
  } else {
    // Use public CORS proxy
    const url = `${CORS_PROXY}https://api.notion.com/v1${endpoint}`;
    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${notionConfig.integrationKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'API call failed');
    }
    
    return await response.json();
  }
}

async function testNotionIntegration(integrationKey) {
  try {
    // Temporarily set the integration key for testing
    const originalKey = notionConfig.integrationKey;
    notionConfig.integrationKey = integrationKey;
    
    // Test the integration by making a simple API call
    const data = await makeNotionAPICall('/users/me');
    
    // Restore original key
    notionConfig.integrationKey = originalKey;
    
    return { 
      success: true, 
      message: 'Integration key is valid!',
      user: data
    };
  } catch (error) {
    console.error('Notion API test failed:', error);
    return { 
      success: false, 
      message: `Failed to connect to Notion API: ${error.message}` 
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

async function loadNotionPage(pageId, addToHistory = true) {
  try {
    // Fetch page content
    const pageData = await makeNotionAPICall(`/pages/${pageId}`);
    
    // Update page title in navigation history
    if (addToHistory && navigationHistory.pages.length > 0) {
      const currentPageIndex = navigationHistory.pages.length - 1;
      navigationHistory.pages[currentPageIndex].title = getPageTitle(pageData);
      updateBreadcrumbs();
    } else if (!addToHistory && navigationHistory.currentIndex >= 0) {
      // Update current page title when navigating back/forward
      navigationHistory.pages[navigationHistory.currentIndex].title = getPageTitle(pageData);
      updateBreadcrumbs();
    }
    
    // Fetch page blocks (content) with child blocks
    const blocks = await fetchBlocksWithChildren(pageId);
    
    // Render the page
    renderNotionPage(pageData, blocks);
    
  } catch (error) {
    console.error('Error loading Notion page:', error);
    showErrorState(`Failed to load page: ${error.message}`);
  }
}

async function fetchBlocksWithChildren(blockId) {
  try {
    const blocksData = await makeNotionAPICall(`/blocks/${blockId}/children`);
    const blocks = blocksData.results;
    
    // For each block, check if it has children and fetch them
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      // Check if block has children (tables, toggles, etc.)
      if (block.has_children) {
        try {
          const childBlocks = await fetchBlocksWithChildren(block.id);
          block.children = childBlocks;
        } catch (error) {
          console.warn(`Failed to fetch children for block ${block.id}:`, error);
          block.children = [];
        }
      }
    }
    
    return blocks;
  } catch (error) {
    console.error('Error fetching blocks:', error);
    return [];
  }
}

async function loadNotionWorkspace() {
  try {
    // Clear navigation history when returning to workspace
    navigationHistory.pages = [];
    navigationHistory.currentIndex = -1;
    updateNavigationButtons();
    
    // Search for pages the integration has access to
    const searchData = await makeNotionAPICall('/search', {
      method: 'POST',
      body: {
        filter: {
          property: 'object',
          value: 'page'
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time'
        }
      }
    });
    
    // Render workspace with available pages
    renderNotionWorkspace(searchData.results);
    
  } catch (error) {
    console.error('Error loading Notion workspace:', error);
    showErrorState(`Failed to load workspace: ${error.message}`);
  }
}

function renderNotionPage(pageData, blocks) {
  const pageTitle = getPageTitle(pageData);
  const pageIcon = getPageIcon(pageData);
  const lastEdited = formatDate(pageData.last_edited_time);
  
  // Update navigation history with actual page title
  if (navigationHistory.pages.length > 0) {
    const currentPage = navigationHistory.pages[navigationHistory.currentIndex];
    if (currentPage && currentPage.title === 'Loading...') {
      currentPage.title = pageTitle;
      updateBreadcrumbs();
    }
  }
  
  let content = `
    <div class="notion-page">
      <div class="notion-page-header">
        <h1 class="notion-page-title">${pageIcon} ${pageTitle}</h1>
        <div class="notion-page-meta">Last edited: ${lastEdited}</div>
      </div>
      <div class="notion-page-content">
        ${blocks.map(block => renderNotionBlock(block)).join('')}
      </div>
    </div>
  `;
  
  showContentState(content);
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
      const toggleContent = block.children && block.children.length > 0 
        ? block.children.map(child => renderNotionBlock(child)).join('')
        : '';
      
      return `<details class="notion-toggle">
        <summary>${renderRichText(block.toggle.rich_text)}</summary>
        <div class="notion-toggle-content">
          ${toggleContent}
        </div>
      </details>`;
    
    case 'quote':
      return `<blockquote class="notion-quote">${renderRichText(block.quote.rich_text)}</blockquote>`;
    
    case 'code':
      return `<pre class="notion-code"><code class="language-${block.code.language || 'text'}">${renderRichText(block.code.rich_text)}</code></pre>`;
    
    case 'divider':
      return `<hr class="notion-divider">`;
    
    case 'child_page':
      return `<div class="notion-child-page" onclick="loadSpecificPage('${block.id}')">
        <div class="notion-child-page-icon">📄</div>
        <div class="notion-child-page-title">${block.child_page.title}</div>
        <div class="notion-child-page-arrow">→</div>
      </div>`;
    
    case 'child_database':
      return `<div class="notion-child-database">
        <div class="notion-child-database-icon">🗃️</div>
        <div class="notion-child-database-title">${block.child_database.title}</div>
        <div class="notion-child-database-note">(Database view not supported)</div>
      </div>`;
    
    case 'image':
      const imageUrl = block.image.type === 'external' ? block.image.external.url : block.image.file.url;
      const imageCaption = block.image.caption && block.image.caption.length > 0 ? renderRichText(block.image.caption) : '';
      return `<div class="notion-image">
        <img src="${imageUrl}" alt="${imageCaption}" loading="lazy">
        ${imageCaption ? `<div class="notion-image-caption">${imageCaption}</div>` : ''}
      </div>`;
    
    case 'video':
      const videoUrl = block.video.type === 'external' ? block.video.external.url : block.video.file.url;
      const videoCaption = block.video.caption && block.video.caption.length > 0 ? renderRichText(block.video.caption) : '';
      return `<div class="notion-video">
        <video controls>
          <source src="${videoUrl}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
        ${videoCaption ? `<div class="notion-video-caption">${videoCaption}</div>` : ''}
      </div>`;
    
    case 'file':
      const fileUrl = block.file.type === 'external' ? block.file.external.url : block.file.file.url;
      const fileName = block.file.name || 'Download File';
      return `<div class="notion-file">
        <a href="${fileUrl}" target="_blank" rel="noopener noreferrer">
          <div class="notion-file-icon">📎</div>
          <div class="notion-file-name">${fileName}</div>
        </a>
      </div>`;
    
    case 'bookmark':
      return `<div class="notion-bookmark">
        <a href="${block.bookmark.url}" target="_blank" rel="noopener noreferrer">
          <div class="notion-bookmark-title">${block.bookmark.url}</div>
          <div class="notion-bookmark-url">${block.bookmark.url}</div>
        </a>
      </div>`;
    
    case 'embed':
      return `<div class="notion-embed">
        <iframe src="${block.embed.url}" frameborder="0" allowfullscreen></iframe>
      </div>`;
    
    case 'table':
      // For tables, we now have the child blocks (table rows)
      if (!block.children || block.children.length === 0) {
        return `<div class="notion-table-container">
          <table class="notion-table">
            <tbody>
              <tr><td>No table data available</td></tr>
            </tbody>
          </table>
        </div>`;
      }
      
      const hasColumnHeader = block.table?.has_column_header || false;
      const rows = block.children.filter(child => child.type === 'table_row');
      
      let tableHtml = '<div class="notion-table-container"><table class="notion-table">';
      
      if (hasColumnHeader && rows.length > 0) {
        // First row as header
        const headerRow = rows[0];
        if (headerRow.table_row && headerRow.table_row.cells) {
          tableHtml += '<thead><tr>';
          headerRow.table_row.cells.forEach(cell => {
            const cellContent = Array.isArray(cell) ? renderRichText(cell) : (cell || '');
            tableHtml += `<th>${cellContent}</th>`;
          });
          tableHtml += '</tr></thead>';
        }
        
        // Remaining rows as body
        tableHtml += '<tbody>';
        rows.slice(1).forEach(row => {
          if (row.table_row && row.table_row.cells) {
            tableHtml += '<tr>';
            row.table_row.cells.forEach(cell => {
              const cellContent = Array.isArray(cell) ? renderRichText(cell) : (cell || '');
              tableHtml += `<td>${cellContent}</td>`;
            });
            tableHtml += '</tr>';
          }
        });
        tableHtml += '</tbody>';
      } else {
        // All rows as body
        tableHtml += '<tbody>';
        rows.forEach(row => {
          if (row.table_row && row.table_row.cells) {
            tableHtml += '<tr>';
            row.table_row.cells.forEach(cell => {
              const cellContent = Array.isArray(cell) ? renderRichText(cell) : (cell || '');
              tableHtml += `<td>${cellContent}</td>`;
            });
            tableHtml += '</tr>';
          }
        });
        tableHtml += '</tbody>';
      }
      
      tableHtml += '</table></div>';
      return tableHtml;
    
    case 'table_row':
      // This case is now handled within the table block rendering
      // But we'll keep it for standalone table rows
      if (!block.table_row || !block.table_row.cells) {
        return '<tr><td>Invalid table row data</td></tr>';
      }
      
      const cells = block.table_row.cells.map(cell => {
        const cellContent = Array.isArray(cell) ? renderRichText(cell) : (cell || '');
        return `<td>${cellContent}</td>`;
      }).join('');
      
      return `<tr>${cells}</tr>`;
    
    case 'callout':
      const calloutIcon = block.callout.icon ? 
        (block.callout.icon.type === 'emoji' ? block.callout.icon.emoji : '💡') : '💡';
      return `<div class="notion-callout">
        <div class="notion-callout-icon">${calloutIcon}</div>
        <div class="notion-callout-content">${renderRichText(block.callout.rich_text)}</div>
      </div>`;
    
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
  // Add to navigation history
  addToNavigationHistory(pageId);
  
  notionConfig.pageId = pageId;
  await loadNotionPage(pageId);
}

// Navigation functions
function addToNavigationHistory(pageId, pageTitle = null) {
  // Remove any forward history when navigating to a new page
  if (navigationHistory.currentIndex < navigationHistory.pages.length - 1) {
    navigationHistory.pages = navigationHistory.pages.slice(0, navigationHistory.currentIndex + 1);
  }
  
  // Add new page to history
  navigationHistory.pages.push({
    id: pageId,
    title: pageTitle || 'Loading...',
    timestamp: Date.now()
  });
  
  navigationHistory.currentIndex = navigationHistory.pages.length - 1;
  updateNavigationButtons();
}

function navigateBack() {
  if (navigationHistory.currentIndex > 0) {
    navigationHistory.currentIndex--;
    const page = navigationHistory.pages[navigationHistory.currentIndex];
    notionConfig.pageId = page.id;
    loadNotionPage(page.id, false); // false = don't add to history
    updateNavigationButtons();
  }
}

function navigateForward() {
  if (navigationHistory.currentIndex < navigationHistory.pages.length - 1) {
    navigationHistory.currentIndex++;
    const page = navigationHistory.pages[navigationHistory.currentIndex];
    notionConfig.pageId = page.id;
    loadNotionPage(page.id, false); // false = don't add to history
    updateNavigationButtons();
  }
}

function updateNavigationButtons() {
  if (notionElements.backBtn) {
    notionElements.backBtn.disabled = navigationHistory.currentIndex <= 0;
    notionElements.backBtn.style.opacity = navigationHistory.currentIndex <= 0 ? '0.5' : '1';
  }
  
  if (notionElements.forwardBtn) {
    notionElements.forwardBtn.disabled = navigationHistory.currentIndex >= navigationHistory.pages.length - 1;
    notionElements.forwardBtn.style.opacity = navigationHistory.currentIndex >= navigationHistory.pages.length - 1 ? '0.5' : '1';
  }
  
  updateBreadcrumbs();
}

function updateBreadcrumbs() {
  if (!notionElements.breadcrumbContainer) return;
  
  // Always show workspace as first item
  let breadcrumbHtml = `
    <div class="notion-breadcrumb-item" onclick="navigateToWorkspace()" data-title="Return to Workspace">
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
      <span>Workspace</span>
    </div>
  `;
  
  // Show full path from navigation history
  if (navigationHistory.pages.length > 0) {
    // Show all pages in the path up to current page
    const currentIndex = navigationHistory.currentIndex;
    const pagesToShow = navigationHistory.pages.slice(0, currentIndex + 1);
    
    pagesToShow.forEach((page, index) => {
      const isCurrentPage = index === currentIndex;
      const actualIndex = index; // Index in the original history array
      
      // Add separator
      breadcrumbHtml += `
        <div class="notion-breadcrumb-separator">
          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </div>
      `;
      
      // Add page item
      if (isCurrentPage) {
        // Current page - not clickable
        breadcrumbHtml += `
          <div class="notion-breadcrumb-item current">
            <span>${page.title}</span>
          </div>
        `;
      } else {
        // Previous page - clickable with tooltip
        breadcrumbHtml += `
          <div class="notion-breadcrumb-item" onclick="navigateToHistoryIndex(${actualIndex})" data-title="${page.title}">
            <span>${page.title}</span>
          </div>
        `;
      }
    });
  }
  
  notionElements.breadcrumbContainer.innerHTML = breadcrumbHtml;
}

function navigateToWorkspace() {
  // Clear navigation history when going back to workspace
  navigationHistory.pages = [];
  navigationHistory.currentIndex = -1;
  updateNavigationButtons();
  loadNotionWorkspace();
}

function navigateToHistoryIndex(index) {
  if (index >= 0 && index < navigationHistory.pages.length) {
    navigationHistory.currentIndex = index;
    const page = navigationHistory.pages[index];
    notionConfig.pageId = page.id;
    loadNotionPage(page.id, false); // false = don't add to history
    updateNavigationButtons();
  }
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

// Make navigation functions globally available for onclick handlers
window.navigateToWorkspace = navigateToWorkspace;
window.loadSpecificPage = loadSpecificPage;
window.navigateToHistoryIndex = navigateToHistoryIndex;

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