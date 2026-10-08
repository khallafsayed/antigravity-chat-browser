// Antigravity Chat Browser Frontend Application

let currentProject = 'all';
let currentConvId = null;
let currentConvData = null;
let projects = [];
let conversations = [];

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

// Format relative date in Arabic
function formatRelativeDate(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'منذ لحظات';
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays === 1) return 'أمس';
  if (diffDays === 2) return 'منذ يومين';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' });
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
  // Simple fallback
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Line breaks
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
        <span class="project-name">جميع المحادثات</span>
      </div>
      <span class="project-count">${totalCount}</span>
    </li>
    <li class="project-item ${currentProject === 'starred' ? 'active' : ''}" onclick="selectProject('starred')">
      <div class="project-info">
        <span class="project-icon">⭐</span>
        <span class="project-name">المفضلة والمميزة</span>
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
          <button class="export-project-btn" onclick="openExportProjectModal(event, '${escapeHtml(p.name)}', ${p.count})" title="تصدير جميع محادثات مشروع ${escapeHtml(p.name)} إلى مجلد">
            📦
          </button>
          <button class="delete-project-btn" onclick="openDeleteProjectModal(event, '${escapeHtml(p.name)}', ${p.count})" title="حذف جميع محادثات مشروع ${escapeHtml(p.name)}">
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
        <p>لا توجد محادثات مطابقة</p>
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
            <button class="star-btn ${starCls}" onclick="toggleStar(event, '${c.id}')" title="إضافة للمفضلة">
              ${starIcon}
            </button>
            <button class="delete-btn" onclick="openDeleteConvModal(event, '${c.id}', '${escapeHtml(c.title)}')" title="حذف هذه المحادثة">
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
  chatIdBadge.title = `انقر لنسخ المعرف: ${data.id}`;

  if (!data.messages || data.messages.length === 0) {
    messagesContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 40px;">لا توجد رسائل مسجلة في هذه الجلسة.</div>';
    return;
  }

  let html = '';
  data.messages.forEach(m => {
    if (m.type === 'user') {
      html += `
        <div class="message-bubble user">
          <div class="msg-header">
            <div class="msg-author">
              <span class="author-badge-user">👤 المستخدم</span>
            </div>
            <span>${m.time ? new Date(m.time).toLocaleTimeString('ar-EG') : ''}</span>
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
              <span class="author-badge-assistant">⚡ Antigravity Agent</span>
            </div>
            <span>${m.time ? new Date(m.time).toLocaleTimeString('ar-EG') : ''}</span>
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
  // scroll to top
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
      showToast(data.starred ? 'تمت الإضافة إلى المفضلة ⭐' : 'تمت الإزالة من المفضلة');
    }
  } catch (err) {
    console.error('Error toggling star:', err);
  }
}

// Rename Modal
document.getElementById('btnOpenRename').addEventListener('click', () => {
  if (!currentConvData) return;
  renameInput.value = currentConvData.customTitle || currentConvData.title;
  renameModal.classList.add('active');
  renameInput.focus();
});

document.getElementById('btnCancelRename').addEventListener('click', () => {
  renameModal.classList.remove('active');
});

document.getElementById('btnSaveRename').addEventListener('click', async () => {
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
      showToast('تم حفظ الاسم الجديد بنجاح! ✏️');
    }
  } catch (err) {
    console.error('Error renaming conversation:', err);
  }
});

// Copy ID
document.getElementById('btnCopyId').addEventListener('click', () => {
  if (!currentConvData) return;
  navigator.clipboard.writeText(currentConvData.id).then(() => {
    showToast(`تم نسخ المعرف: ${currentConvData.id.slice(0, 8)}... لاستدعائه في Antigravity`);
  });
});

chatIdBadge.addEventListener('click', () => {
  if (!currentConvData) return;
  navigator.clipboard.writeText(currentConvData.id).then(() => {
    showToast(`تم نسخ المعرف: ${currentConvData.id}`);
  });
});

// Open Folder in Explorer
document.getElementById('btnOpenFolder').addEventListener('click', async () => {
  if (!currentConvData) return;
  try {
    await fetch(`/api/conversations/${currentConvData.id}/open-folder`, { method: 'POST' });
    showToast('تم فتح مجلد الجلسة في Windows Explorer 📂');
  } catch (e) {}
});

// Export as Markdown
document.getElementById('btnExportMd').addEventListener('click', () => {
  if (!currentConvData) return;
  let md = `# ${currentConvData.title}\n\n`;
  md += `**المشروع:** ${currentConvData.project} (${currentConvData.projectPath})\n`;
  md += `**معرف الجلسة:** \`${currentConvData.id}\`\n\n---\n\n`;

  currentConvData.messages.forEach(m => {
    if (m.type === 'user') {
      md += `### 👤 المستخدم:\n${m.text}\n\n`;
    } else if (m.type === 'assistant') {
      md += `### ⚡ المساعد (Antigravity):\n${m.text}\n\n`;
    }
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentConvData.title.slice(0, 30).replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}_transcript.md`;
  a.click();
  showToast('تم تصدير ملف Markdown بنجاح! 📥');
});

// Search input
let searchTimeout = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchConversations();
  }, 300);
});

// Refresh button
document.getElementById('btnRefresh').addEventListener('click', () => {
  fetchProjects();
  fetchConversations(true);
  fetchStats();
  showToast('تم تحديث البيانات من الجلسات');
});

// Open Delete Modal for Single Conversation
function openDeleteConvModal(e, id, title) {
  if (e) e.stopPropagation();
  deleteTarget = { type: 'conversation', id, title };
  deleteModalTitle.textContent = 'تأكيد حذف المحادثة';
  deleteModalType.textContent = 'حذف محادثة مفردة';
  deleteModalDesc.textContent = 'هل أنت متأكد من رغبتك في حذف هذه المحادثة نهائياً من سجلات Antigravity؟';
  deleteModalInfo.innerHTML = `
    <div><strong>العنوان:</strong> ${escapeHtml(title)}</div>
    <div style="margin-top: 6px; font-size: 0.8rem; color: #94a3b8;"><strong>معرف الجلسة (ID):</strong> <code>${id}</code></div>
  `;
  deleteModalWarning.textContent = '⚠️ سيتم حذف ملفات الجلسة وسجلاتها ومجلد الـ brain وقاعدة البيانات المرتبطة بها نهائياً.';
  btnConfirmDelete.textContent = 'حذف المحادثة نهائياً';
  deleteModal.classList.add('active');
}

// Open Delete Modal for Entire Project
function openDeleteProjectModal(e, projectName, count) {
  if (e) e.stopPropagation();
  deleteTarget = { type: 'project', projectName, count };
  deleteModalTitle.textContent = 'تأكيد حذف محادثات المشروع';
  deleteModalType.textContent = 'حذف مشروع كامل';
  deleteModalDesc.textContent = `هل أنت متأكد من رغبتك في حذف جميع المحادثات التابعة لمشروع "${projectName}"؟`;
  deleteModalInfo.innerHTML = `
    <div><strong>المشروع:</strong> ${escapeHtml(projectName)}</div>
    <div style="margin-top: 6px;"><strong>إجمالي المحادثات:</strong> <span style="color: #ef4444; font-weight: bold;">${count} محادثة</span></div>
    <div style="margin-top: 10px; font-size: 0.82rem; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.2);">
      💡 <strong>تنبيه للأمان:</strong> هذا الإجراء يحذف سجلات ومحادثات Antigravity فقط، ولن يتم المساس أو حذف أي من ملفات الكود البرمجي للمشروع المخزنة على جهازك.
    </div>
  `;
  deleteModalWarning.textContent = '⚠️ سيتم حذف ملفات الـ brain وسجلات كافة محادثات هذا المشروع نهائياً.';
  btnConfirmDelete.textContent = `حذف المشروع (${count} محادثة)`;
  deleteModal.classList.add('active');
}

// Delete Chat Button in Header
btnDeleteChat.addEventListener('click', () => {
  if (!currentConvData) return;
  openDeleteConvModal(null, currentConvData.id, currentConvData.title);
});

// Cancel Delete
btnCancelDelete.addEventListener('click', () => {
  deleteModal.classList.remove('active');
  deleteTarget = null;
});

// Close modal on background click
deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    deleteModal.classList.remove('active');
    deleteTarget = null;
  }
});

// Confirm Delete Execution
btnConfirmDelete.addEventListener('click', async () => {
  if (!deleteTarget) return;

  btnConfirmDelete.disabled = true;
  const originalText = btnConfirmDelete.textContent;
  btnConfirmDelete.textContent = 'جاري الحذف...';

  try {
    if (deleteTarget.type === 'conversation') {
      const id = deleteTarget.id;
      const res = await fetch(`/api/conversations/${id}/delete`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('تم حذف المحادثة وسجلاتها بنجاح 🗑️');
        deleteModal.classList.remove('active');

        // If the deleted conversation is the currently viewed one, reset the viewer
        if (currentConvId === id) {
          currentConvId = null;
          currentConvData = null;
          activeChatContent.style.display = 'none';
          emptyState.style.display = 'flex';
        }

        // Refresh lists
        await fetchProjects();
        await fetchConversations(true);
        await fetchStats();
      } else {
        showToast('تعذر حذف المحادثة: ' + (data.error || 'خطأ غير معروف'));
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
        showToast(`تم حذف مشروع "${projectName}" (${data.deletedCount} محادثة) بنجاح 🗑️`);
        deleteModal.classList.remove('active');

        // Reset view if we were filtering by this project or viewing a chat from it
        if (currentProject === projectName) {
          currentProject = 'all';
        }
        if (currentConvData && currentConvData.project === projectName) {
          currentConvId = null;
          currentConvData = null;
          activeChatContent.style.display = 'none';
          emptyState.style.display = 'flex';
        }

        // Refresh lists
        await fetchProjects();
        await fetchConversations(true);
        await fetchStats();
      } else {
        showToast('تعذر حذف المشروع: ' + (data.error || 'خطأ غير معروف'));
      }
    }
  } catch (err) {
    console.error('Error during deletion:', err);
    showToast('حدث خطأ أثناء الاتصال بالخادم للحذف');
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
  exportProjectName.textContent = `مشروع: ${projectName} (${count} محادثة)`;
  
  if (!exportDestInput.value.trim()) {
    exportDestInput.value = 'D:\\Antigravity_Exports';
  }

  exportResultBox.style.display = 'none';
  btnConfirmExport.disabled = false;
  btnConfirmExport.textContent = 'بدء التصدير 📥';
  exportProjectModal.classList.add('active');
}

// Cancel / Close Export Modal
btnCancelExport.addEventListener('click', () => {
  exportProjectModal.classList.remove('active');
  exportTargetProject = null;
});

exportProjectModal.addEventListener('click', (e) => {
  if (e.target === exportProjectModal) {
    exportProjectModal.classList.remove('active');
    exportTargetProject = null;
  }
});

// Browse Folder via Windows Native Dialog
btnBrowseFolder.addEventListener('click', async () => {
  btnBrowseFolder.disabled = true;
  btnBrowseFolder.textContent = 'جاري الفتح...';
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
    btnBrowseFolder.textContent = '📁 تصفح...';
  }
});

// Confirm Project Export Execution
btnConfirmExport.addEventListener('click', async () => {
  if (!exportTargetProject) return;
  const dest = exportDestInput.value.trim();
  if (!dest) {
    showToast('يرجى كتابة أو اختيار مسار مجلد الوجهة');
    exportDestInput.focus();
    return;
  }

  btnConfirmExport.disabled = true;
  btnConfirmExport.textContent = 'جاري النسخ والتصدير... ⏳';

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
        ✅ <strong>تم التصدير بنجاح!</strong><br>
        تم نسخ <strong>${data.exportedCount}</strong> محادثة بكافة ملفاتها إلى:<br>
        <code style="display:inline-block; margin-top:6px; background:#0f172a; padding:4px 8px; border-radius:4px; color:#fff; word-break:break-all;">${data.projectExportDir}</code>
      `;
      exportResultBox.style.display = 'block';
      btnConfirmExport.textContent = 'تم التصدير بنجاح ✅';
      showToast(`تم تصدير مشروع "${exportTargetProject.projectName}" بنجاح! 📦`);
    } else {
      showToast('حدث خطأ أثناء التصدير: ' + (data.error || 'خطأ غير معروف'));
      btnConfirmExport.disabled = false;
      btnConfirmExport.textContent = 'بدء التصدير 📥';
    }
  } catch (err) {
    console.error('Export error:', err);
    showToast('فشل الاتصال بالخادم أثناء التصدير');
    btnConfirmExport.disabled = false;
    btnConfirmExport.textContent = 'بدء التصدير 📥';
  }
});

// Open Exported Folder in Windows Explorer
btnOpenExportedFolder.addEventListener('click', async () => {
  if (!lastExportedPath) return;
  try {
    await fetch('/api/open-folder-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: lastExportedPath })
    });
    showToast('تم فتح المجلد في Windows Explorer 📂');
  } catch (e) {
    showToast('تعذر فتح المجلد');
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

// Initial Boot
fetchProjects();
fetchConversations();
fetchStats();
