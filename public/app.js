// Antigravity Chat Browser Frontend Application with Modular i18n

// Application State
let currentProject = 'all';
let currentConvId = null;
let currentConvData = null;
let projects = [];
let conversations = [];

// Internationalization (i18n) State
let currentLang = localStorage.getItem('ag_lang') || 'ar';
let availableLocales = [];
const translations = {};

// DOM Elements
const projectsList = document.getElementById('projectsList');
const conversationsList = document.getElementById('conversationsList');
const searchInput = document.getElementById('searchInput');
const emptyState = document.getElementById('emptyState');
const activeChatContent = document.getElementById('activeChatContent');
const chatTitle = document.getElementById('chatTitle');
const chatProject = document.getElementById('chatProject');
const chatIdBadge = document.getElementById('chatIdBadge');
const messagesContainer = document.getElementById('messagesContainer');
const renameModal = document.getElementById('renameModal');
const renameInput = document.getElementById('renameInput');
const toast = document.getElementById('toast');

// Language Switcher Elements
const btnLangToggle = document.getElementById('btnLangToggle');
const currentLangLabel = document.getElementById('currentLangLabel');
const langMenu = document.getElementById('langMenu');

// Deletion Elements
const deleteModal = document.getElementById('deleteModal');
const deleteModalTitle = document.getElementById('deleteModalTitle');
const deleteModalType = document.getElementById('deleteModalType');
const deleteModalDesc = document.getElementById('deleteModalDesc');
const deleteModalInfo = document.getElementById('deleteModalInfo');
const deleteModalWarning = document.getElementById('deleteModalWarning');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');
const btnDeleteChat = document.getElementById('btnDeleteChat');
let deleteTarget = null;

// Export Elements
const exportProjectModal = document.getElementById('exportProjectModal');
const exportProjectName = document.getElementById('exportProjectName');
const exportDestInput = document.getElementById('exportDestInput');
const btnBrowseFolder = document.getElementById('btnBrowseFolder');
const chkIncludeMarkdown = document.getElementById('chkIncludeMarkdown');
const exportResultBox = document.getElementById('exportResultBox');
const exportResultStatus = document.getElementById('exportResultStatus');
const btnOpenExportedFolder = document.getElementById('btnOpenExportedFolder');
const btnCancelExport = document.getElementById('btnCancelExport');
const btnConfirmExport = document.getElementById('btnConfirmExport');
const exportModalActions = document.getElementById('exportModalActions');
let exportTargetProject = null;
let lastExportedPath = null;

// Stats Elements
const statProjects = document.getElementById('statProjects');
const statConvs = document.getElementById('statConvs');
const statStarred = document.getElementById('statStarred');
const projectsCountBadge = document.getElementById('projectsCountBadge');

// ==========================================
// 🌐 i18n Translation Engine
// ==========================================

// Translation lookup helper
function t(key, params = {}) {
  const keys = key.split('.');
  let val = translations[currentLang];
  for (const k of keys) {
    if (val && typeof val === 'object') {
      val = val[k];
    } else {
      val = null;
      break;
    }
  }

  // Fallback to Arabic if key missing in current language
  if (typeof val !== 'string') {
    let fallback = translations['ar'];
    for (const k of keys) {
      if (fallback && typeof fallback === 'object') {
        fallback = fallback[k];
      } else {
        fallback = null;
        break;
      }
    }
    val = typeof fallback === 'string' ? fallback : key;
  }

  // Parameter replacement
  for (const [pk, pv] of Object.entries(params)) {
    val = val.replaceAll(`{${pk}}`, pv);
  }
  return val;
}

// Fetch language JSON
async function loadLocale(lang) {
  if (translations[lang]) return translations[lang];
  try {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) throw new Error(`Locale file not found: ${lang}`);
    const data = await res.json();
    translations[lang] = data;
    return data;
  } catch (err) {
    console.error(`Error loading locale ${lang}:`, err);
    if (lang !== 'ar') return loadLocale('ar');
    return null;
  }
}

// Fetch list of available language files from backend
async function fetchAvailableLocales() {
  try {
    const res = await fetch('/api/locales');
    if (res.ok) {
      availableLocales = await res.json();
    }
  } catch (e) {}

  if (!availableLocales || availableLocales.length === 0) {
    availableLocales = [
      { code: 'ar', name: 'العربية', dir: 'rtl' },
      { code: 'en', name: 'English', dir: 'ltr' }
    ];
  }
  renderLangMenu();
}

// Render Language Menu
function renderLangMenu() {
  if (!langMenu) return;
  langMenu.innerHTML = availableLocales.map(l => `
    <button class="lang-menu-item ${l.code === currentLang ? 'active' : ''}" onclick="setLanguage('${l.code}')">
      <span>${escapeHtml(l.name)}</span>
      ${l.code === currentLang ? '<span>✓</span>' : ''}
    </button>
  `).join('');
}

// Switch and Apply Language
async function setLanguage(lang) {
  await loadLocale(lang);
  currentLang = lang;
  localStorage.setItem('ag_lang', lang);

  const langMeta = translations[lang]?.app;
  const dir = langMeta?.dir || (lang === 'ar' ? 'rtl' : 'ltr');

  document.documentElement.lang = lang;
  document.documentElement.dir = dir;

  if (currentLangLabel) {
    currentLangLabel.textContent = langMeta?.language || lang.toUpperCase();
  }

  // Update all data-i18n elements in DOM
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  });

  // Re-render dynamic components
  renderLangMenu();
  renderProjects();
  renderConversations();
  if (currentConvData) {
    renderConversationView(currentConvData);
  }

  // Close dropdown if open
  document.querySelector('.lang-dropdown-wrapper')?.classList.remove('open');
  langMenu?.classList.remove('show');
}

// Toggle Language Dropdown
btnLangToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  const wrapper = document.querySelector('.lang-dropdown-wrapper');
  wrapper?.classList.toggle('open');
  langMenu?.classList.toggle('show');
});

document.addEventListener('click', () => {
  document.querySelector('.lang-dropdown-wrapper')?.classList.remove('open');
  langMenu?.classList.remove('show');
});

// Format relative date with i18n
function formatRelativeDate(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return t('list.time_moments');
  if (diffHours < 24) return t('list.time_hours', { hours: diffHours });
  if (diffDays === 1) return t('list.time_yesterday');
  if (diffDays === 2) return t('list.time_two_days');
  if (diffDays < 7) return t('list.time_days', { days: diffDays });

  const locale = currentLang === 'ar' ? 'ar-EG' : 'en-US';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// Markdown parser with simple fallback
function parseMarkdown(text) {
  if (!text) return '';
  if (window.marked && typeof window.marked.parse === 'function') {
    return window.marked.parse(text);
  }
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

// API Calls
async function fetchProjects() {
  try {
    const res = await fetch('/api/projects');
    projects = await res.json();
    renderProjects();
    statProjects.textContent = projects.length;
    projectsCountBadge.textContent = projects.length;
  } catch (err) {
    console.error('Error fetching projects:', err);
  }
}

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    statConvs.textContent = data.totalConversations;
    statStarred.textContent = data.starredCount;
  } catch (e) {}
}

async function fetchConversations(refresh = false) {
  try {
    const query = searchInput.value.trim();
    let url = `/api/conversations?project=${encodeURIComponent(currentProject)}&search=${encodeURIComponent(query)}`;
    if (refresh) url += '&refresh=true';
    if (currentProject === 'starred') {
      url = `/api/conversations?starred=true&search=${encodeURIComponent(query)}`;
    }
    const res = await fetch(url);
    conversations = await res.json();
    renderConversations();
  } catch (err) {
    console.error('Error fetching conversations:', err);
  }
}

async function fetchConversationDetails(id) {
  try {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    currentConvData = data;
    renderConversationView(data);
  } catch (err) {
    console.error('Error fetching conversation details:', err);
  }
}

// Render Projects List
function renderProjects() {
  let totalCount = 0;
  projects.forEach(p => totalCount += p.count);

  let html = `
    <li class="project-item ${currentProject === 'all' ? 'active' : ''}" onclick="selectProject('all')">
      <div class="project-info">
        <span class="project-icon">📁</span>
        <span class="project-name">${t('sidebar.all_chats')}</span>
      </div>
      <span class="project-count">${totalCount}</span>
    </li>
    <li class="project-item ${currentProject === 'starred' ? 'active' : ''}" onclick="selectProject('starred')">
      <div class="project-info">
        <span class="project-icon">⭐</span>
        <span class="project-name">${t('sidebar.starred_pinned')}</span>
      </div>
      <span class="project-count" id="starredSideCount">-</span>
    </li>
    <div style="height: 1px; background: var(--border-subtle); margin: 8px 0;"></div>
  `;

  projects.forEach(p => {
    const isAct = currentProject === p.name ? 'active' : '';
    html += `
      <li class="project-item ${isAct}" onclick="selectProject('${escapeHtml(p.name)}')">
        <div class="project-info">
          <span class="project-icon">📂</span>
          <span class="project-name" title="${escapeHtml(p.path)}">${escapeHtml(p.name)}</span>
        </div>
        <div class="project-actions-row">
          <span class="project-count">${p.count}</span>
          <button class="export-project-btn" onclick="openExportProjectModal(event, '${escapeHtml(p.name)}', ${p.count})" title="${t('sidebar.export_tooltip', { project: escapeHtml(p.name) })}">
            📦
          </button>
          <button class="delete-project-btn" onclick="openDeleteProjectModal(event, '${escapeHtml(p.name)}', ${p.count})" title="${t('sidebar.delete_tooltip', { project: escapeHtml(p.name) })}">
            🗑️
          </button>
        </div>
      </li>
    `;
  });

  projectsList.innerHTML = html;
}

function selectProject(proj) {
  currentProject = proj;
  renderProjects();
  fetchConversations();
}

// Render Conversations List
function renderConversations() {
  if (conversations.length === 0) {
    conversationsList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
        <p>${t('list.no_matches')}</p>
      </div>
    `;
    return;
  }

  let html = '';
  conversations.forEach(c => {
    const isAct = currentConvId === c.id ? 'active' : '';
    const isCust = c.customTitle ? 'customized' : '';
    const starCls = c.starred ? 'starred' : '';
    const starIcon = c.starred ? '★' : '☆';

    html += `
      <div class="conv-card ${isAct}" onclick="selectConversation('${c.id}')">
        <div class="conv-card-top">
          <div class="conv-title ${isCust}" title="${escapeHtml(c.title)}">
            ${escapeHtml(c.title)}
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="star-btn ${starCls}" onclick="toggleStar(event, '${c.id}')" title="${t('list.star_tooltip')}">
              ${starIcon}
            </button>
            <button class="delete-btn" onclick="openDeleteConvModal(event, '${c.id}', '${escapeHtml(c.title)}')" title="${t('list.delete_chat_tooltip')}">
              🗑️
            </button>
          </div>
        </div>
        <div class="conv-card-meta">
          <span class="conv-project-badge" title="${escapeHtml(c.projectPath)}">
            ${escapeHtml(c.project)}
          </span>
          <span class="conv-time">${formatRelativeDate(c.updatedAt)}</span>
        </div>
      </div>
    `;
  });

  conversationsList.innerHTML = html;
}

function selectConversation(id) {
  currentConvId = id;
  renderConversations();
  emptyState.style.display = 'none';
  activeChatContent.style.display = 'flex';
  fetchConversationDetails(id);
}

// Render Active Chat View
function renderConversationView(data) {
  chatTitle.textContent = data.title;
  chatProject.textContent = data.project;
  chatProject.title = data.projectPath;
  chatIdBadge.textContent = data.id.slice(0, 8) + '...';
  chatIdBadge.title = t('viewer.copy_id_full_toast', { id: data.id });

  if (!data.messages || data.messages.length === 0) {
    messagesContainer.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 40px;">${t('viewer.no_messages')}</div>`;
    return;
  }

  const locale = currentLang === 'ar' ? 'ar-EG' : 'en-US';
  let html = '';
  data.messages.forEach(m => {
    if (m.type === 'user') {
      html += `
        <div class="message-bubble user">
          <div class="msg-header">
            <div class="msg-author">
              <span class="author-badge-user">${t('viewer.user_author')}</span>
            </div>
            <span>${m.time ? new Date(m.time).toLocaleTimeString(locale) : ''}</span>
          </div>
          <div class="msg-body">
            <div style="white-space: pre-wrap;">${escapeHtml(m.text)}</div>
          </div>
        </div>
      `;
    } else if (m.type === 'assistant') {
      html += `
        <div class="message-bubble assistant">
          <div class="msg-header">
            <div class="msg-author">
              <span class="author-badge-assistant">${t('viewer.agent_author')}</span>
            </div>
            <span>${m.time ? new Date(m.time).toLocaleTimeString(locale) : ''}</span>
          </div>
          <div class="msg-body markdown-content">
            ${parseMarkdown(m.text)}
          </div>
        </div>
      `;
    } else if (m.type === 'tool') {
      const summary = m.details && m.details.args && m.details.args.toolSummary 
        ? m.details.args.toolSummary.replace(/^"|"$/g, '') 
        : m.toolName;
      const action = m.details && m.details.args && m.details.args.toolAction 
        ? m.details.args.toolAction.replace(/^"|"$/g, '') 
        : '';

      html += `
        <div class="tool-bubble">
          <div class="tool-card">
            <div class="tool-info">
              <span class="tool-icon">🛠️</span>
              <span class="tool-name">${escapeHtml(summary)}</span>
              ${action ? `<span style="color: #64748b;">(${escapeHtml(action)})</span>` : ''}
            </div>
            <span class="tool-status">${m.status}</span>
          </div>
        </div>
      `;
    }
  });

  messagesContainer.innerHTML = html;
  messagesContainer.scrollTop = 0;
}

// Toggle Star
async function toggleStar(e, id) {
  e.stopPropagation();
  try {
    const res = await fetch(`/api/conversations/${id}/star`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      const item = conversations.find(c => c.id === id);
      if (item) item.starred = data.starred;
      renderConversations();
      fetchStats();
      showToast(data.starred ? t('toasts.star_added') : t('toasts.star_removed'));
    }
  } catch (err) {
    console.error('Error toggling star:', err);
  }
}

// Rename Modal
document.getElementById('btnOpenRename')?.addEventListener('click', () => {
  if (!currentConvData) return;
  renameInput.value = currentConvData.customTitle || currentConvData.title;
  renameModal.classList.add('active');
  renameInput.focus();
});

document.getElementById('btnCancelRename')?.addEventListener('click', () => {
  renameModal.classList.remove('active');
});

document.getElementById('btnSaveRename')?.addEventListener('click', async () => {
  if (!currentConvData) return;
  const newTitle = renameInput.value.trim();
  if (!newTitle) return;

  try {
    const res = await fetch(`/api/conversations/${currentConvData.id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    });
    const data = await res.json();
    if (data.success) {
      currentConvData.title = newTitle;
      currentConvData.customTitle = newTitle;
      chatTitle.textContent = newTitle;
      const item = conversations.find(c => c.id === currentConvData.id);
      if (item) {
        item.customTitle = newTitle;
        item.title = newTitle;
      }
      renderConversations();
      renameModal.classList.remove('active');
      showToast(t('toasts.rename_saved'));
    }
  } catch (err) {
    console.error('Error renaming conversation:', err);
  }
});

// Copy ID
document.getElementById('btnCopyId')?.addEventListener('click', () => {
  if (!currentConvData) return;
  navigator.clipboard.writeText(currentConvData.id).then(() => {
    showToast(t('viewer.copy_id_toast', { id: currentConvData.id.slice(0, 8) }));
  });
});

chatIdBadge?.addEventListener('click', () => {
  if (!currentConvData) return;
  navigator.clipboard.writeText(currentConvData.id).then(() => {
    showToast(t('viewer.copy_id_full_toast', { id: currentConvData.id }));
  });
});

// Open Folder in Explorer
document.getElementById('btnOpenFolder')?.addEventListener('click', async () => {
  if (!currentConvData) return;
  try {
    await fetch(`/api/conversations/${currentConvData.id}/open-folder`, { method: 'POST' });
    showToast(t('toasts.folder_opened'));
  } catch (e) {}
});

// Export as Markdown
document.getElementById('btnExportMd')?.addEventListener('click', () => {
  if (!currentConvData) return;
  let md = `# ${currentConvData.title}\n\n`;
  md += `**${t('viewer.project_label')}** ${currentConvData.project} (${currentConvData.projectPath})\n`;
  md += `**${t('viewer.id_label')}** \`${currentConvData.id}\`\n\n---\n\n`;

  currentConvData.messages.forEach(m => {
    if (m.type === 'user') {
      md += `### ${t('viewer.user_author')}:\n${m.text}\n\n`;
    } else if (m.type === 'assistant') {
      md += `### ${t('viewer.agent_author')}:\n${m.text}\n\n`;
    }
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentConvData.title.slice(0, 30).replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}_transcript.md`;
  a.click();
  showToast(t('toasts.md_exported'));
});

// Search input
let searchTimeout = null;
searchInput?.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchConversations();
  }, 300);
});

// Refresh button
document.getElementById('btnRefresh')?.addEventListener('click', () => {
  fetchProjects();
  fetchConversations(true);
  fetchStats();
  showToast(t('toasts.refreshed'));
});

// Open Delete Modal for Single Conversation
function openDeleteConvModal(e, id, title) {
  if (e) e.stopPropagation();
  deleteTarget = { type: 'conversation', id, title };
  deleteModalTitle.textContent = t('modals.delete.title');
  deleteModalType.textContent = t('modals.delete.subtitle_chat');
  deleteModalDesc.textContent = t('modals.delete.desc_chat');
  deleteModalInfo.innerHTML = `
    <div><strong>${t('modals.delete.title_label')}</strong> ${escapeHtml(title)}</div>
    <div style="margin-top: 6px; font-size: 0.8rem; color: #94a3b8;"><strong>${t('modals.delete.id_label')}</strong> <code>${id}</code></div>
  `;
  deleteModalWarning.textContent = t('modals.delete.warning_chat');
  btnConfirmDelete.textContent = t('modals.delete.confirm_chat_btn');
  deleteModal.classList.add('active');
}

// Open Delete Modal for Entire Project
function openDeleteProjectModal(e, projectName, count) {
  if (e) e.stopPropagation();
  deleteTarget = { type: 'project', projectName, count };
  deleteModalTitle.textContent = t('modals.delete.title');
  deleteModalType.textContent = t('modals.delete.subtitle_project');
  deleteModalDesc.textContent = t('modals.delete.desc_project', { project: projectName });
  deleteModalInfo.innerHTML = `
    <div><strong>${t('modals.delete.project_label')}</strong> ${escapeHtml(projectName)}</div>
    <div style="margin-top: 6px;"><strong>${t('modals.delete.chats_count_label')}</strong> <span style="color: #ef4444; font-weight: bold;">${count}</span></div>
    <div style="margin-top: 10px; font-size: 0.82rem; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.2);">
      ${t('modals.delete.project_safe_notice')}
    </div>
  `;
  deleteModalWarning.textContent = t('modals.delete.warning_project');
  btnConfirmDelete.textContent = t('modals.delete.confirm_project_btn', { count });
  deleteModal.classList.add('active');
}

// Delete Chat Button in Header
btnDeleteChat?.addEventListener('click', () => {
  if (!currentConvData) return;
  openDeleteConvModal(null, currentConvData.id, currentConvData.title);
});

// Cancel Delete
btnCancelDelete?.addEventListener('click', () => {
  deleteModal.classList.remove('active');
  deleteTarget = null;
});

// Close modal on background click
deleteModal?.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    deleteModal.classList.remove('active');
    deleteTarget = null;
  }
});

// Confirm Delete Execution
btnConfirmDelete?.addEventListener('click', async () => {
  if (!deleteTarget) return;

  btnConfirmDelete.disabled = true;
  const originalText = btnConfirmDelete.textContent;
  btnConfirmDelete.textContent = t('modals.delete.deleting_state');

  try {
    if (deleteTarget.type === 'conversation') {
      const id = deleteTarget.id;
      const res = await fetch(`/api/conversations/${id}/delete`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(t('toasts.chat_deleted'));
        deleteModal.classList.remove('active');

        if (currentConvId === id) {
          currentConvId = null;
          currentConvData = null;
          activeChatContent.style.display = 'none';
          emptyState.style.display = 'flex';
        }

        await fetchProjects();
        await fetchConversations(true);
        await fetchStats();
      } else {
        showToast(t('toasts.error_delete_chat'));
      }
    } else if (deleteTarget.type === 'project') {
      const projectName = deleteTarget.projectName;
      const res = await fetch('/api/projects/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: projectName })
      });
      const data = await res.json();
      if (data.success) {
        showToast(t('toasts.project_deleted', { project: projectName, count: data.deletedCount }));
        deleteModal.classList.remove('active');

        if (currentProject === projectName) {
          currentProject = 'all';
        }
        if (currentConvData && currentConvData.project === projectName) {
          currentConvId = null;
          currentConvData = null;
          activeChatContent.style.display = 'none';
          emptyState.style.display = 'flex';
        }

        await fetchProjects();
        await fetchConversations(true);
        await fetchStats();
      } else {
        showToast(t('toasts.error_delete_project'));
      }
    }
  } catch (err) {
    console.error('Error during deletion:', err);
    showToast(t('toasts.error_delete_project'));
  } finally {
    btnConfirmDelete.disabled = false;
    btnConfirmDelete.textContent = originalText;
    deleteTarget = null;
  }
});

// Open Export Modal for Project
function openExportProjectModal(e, projectName, count) {
  if (e) e.stopPropagation();
  exportTargetProject = { projectName, count };
  exportProjectName.textContent = t('modals.export.subtitle', { project: projectName, count });
  
  if (!exportDestInput.value.trim()) {
    exportDestInput.value = 'D:\\Antigravity_Exports';
  }

  exportResultBox.style.display = 'none';
  btnConfirmExport.disabled = false;
  btnConfirmExport.textContent = t('modals.export.start_btn');
  exportProjectModal.classList.add('active');
}

// Cancel / Close Export Modal
btnCancelExport?.addEventListener('click', () => {
  exportProjectModal.classList.remove('active');
  exportTargetProject = null;
});

exportProjectModal?.addEventListener('click', (e) => {
  if (e.target === exportProjectModal) {
    exportProjectModal.classList.remove('active');
    exportTargetProject = null;
  }
});

// Browse Folder via Windows Native Dialog
btnBrowseFolder?.addEventListener('click', async () => {
  btnBrowseFolder.disabled = true;
  btnBrowseFolder.textContent = t('modals.export.browsing_btn');
  try {
    const res = await fetch('/api/browse-folder', { method: 'POST' });
    const data = await res.json();
    if (data.path) {
      exportDestInput.value = data.path;
    }
  } catch (err) {
    console.error('Browse folder error:', err);
  } finally {
    btnBrowseFolder.disabled = false;
    btnBrowseFolder.textContent = t('modals.export.browse_btn');
  }
});

// Confirm Project Export Execution
btnConfirmExport?.addEventListener('click', async () => {
  if (!exportTargetProject) return;
  const dest = exportDestInput.value.trim();
  if (!dest) {
    showToast(t('toasts.prompt_select_dest'));
    exportDestInput.focus();
    return;
  }

  btnConfirmExport.disabled = true;
  btnConfirmExport.textContent = t('modals.export.exporting_btn');

  try {
    const res = await fetch('/api/projects/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: exportTargetProject.projectName,
        destination: dest,
        includeMarkdown: chkIncludeMarkdown.checked
      })
    });
    const data = await res.json();
    if (data.success) {
      lastExportedPath = data.projectExportDir;
      exportResultStatus.innerHTML = `
        ${t('modals.export.success_msg', { count: data.exportedCount })}<br>
        <code style="display:inline-block; margin-top:6px; background:#0f172a; padding:4px 8px; border-radius:4px; color:#fff; word-break:break-all;">${data.projectExportDir}</code>
      `;
      exportResultBox.style.display = 'block';
      btnConfirmExport.textContent = t('modals.export.done_btn');
      showToast(t('toasts.project_exported', { project: exportTargetProject.projectName }));
    } else {
      showToast(t('toasts.error_export') + ': ' + (data.error || ''));
      btnConfirmExport.disabled = false;
      btnConfirmExport.textContent = t('modals.export.start_btn');
    }
  } catch (err) {
    console.error('Export error:', err);
    showToast(t('toasts.error_export_connection'));
    btnConfirmExport.disabled = false;
    btnConfirmExport.textContent = t('modals.export.start_btn');
  }
});

// Open Exported Folder in Windows Explorer
btnOpenExportedFolder?.addEventListener('click', async () => {
  if (!lastExportedPath) return;
  try {
    await fetch('/api/open-folder-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: lastExportedPath })
    });
    showToast(t('toasts.folder_opened'));
  } catch (e) {
    showToast(t('toasts.error_open_folder'));
  }
});

// Helper Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initial Boot Sequence
async function boot() {
  await fetchAvailableLocales();
  await setLanguage(currentLang);
  fetchProjects();
  fetchConversations();
  fetchStats();
}

boot();
