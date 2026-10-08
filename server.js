/**
 * Antigravity Chat Browser & Project Organizer Server
 * Zero external dependencies - uses Node.js 24 built-in modules
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const { exec } = require('node:child_process');

const PORT = 4949;
const HOME_DIR = os.homedir();
const BRAIN_DIR = path.join(HOME_DIR, '.gemini', 'antigravity-ide', 'brain');
const CONV_DIR = path.join(HOME_DIR, '.gemini', 'antigravity-ide', 'conversations');
const DATA_DIR = path.join(__dirname, 'data');
const META_FILE = path.join(DATA_DIR, 'custom_meta.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load custom metadata (renames, stars, tags)
function loadCustomMeta() {
  if (fs.existsSync(META_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    } catch (e) {
      console.error('Error loading custom metadata:', e);
    }
  }
  return {};
}

function saveCustomMeta(meta) {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving custom metadata:', e);
  }
}

// In-memory cache
let cachedConversations = null;
let lastCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

function getWorkspaceFromDb(convId) {
  const dbPath = path.join(CONV_DIR, `${convId}.db`);
  if (!fs.existsSync(dbPath)) return { name: 'Unknown Project', path: 'Unknown' };

  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare("SELECT data FROM trajectory_metadata_blob WHERE id = 'main'").get();
    db.close();
    if (row && row.data) {
      const str = Buffer.from(row.data).toString('utf8');
      const match = str.match(/file:\/\/\/[^\x00-\x1F\x7F-\x9F"'\s]+/);
      if (match) {
        let cleanPath = decodeURIComponent(match[0].replace('file:///', '')).replace(/\\/g, '/');
        // remove trailing slashes
        cleanPath = cleanPath.replace(/\/+$/, '');
        const parts = cleanPath.split('/').filter(Boolean);
        const name = parts[parts.length - 1] || cleanPath;
        return { name, path: cleanPath };
      }
    }
  } catch (e) {
    // Ignore db lock or read errors
  }
  return { name: 'Unknown Project', path: 'Unknown' };
}

function scanConversations(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedConversations && (now - lastCacheTime < CACHE_TTL)) {
    return cachedConversations;
  }

  const customMeta = loadCustomMeta();
  const list = [];

  if (!fs.existsSync(BRAIN_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(BRAIN_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const convId = entry.name;
    const transcriptPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(transcriptPath)) continue;

    try {
      const stat = fs.statSync(transcriptPath);
      // Read first chunk of transcript to get initial prompt and date
      const fd = fs.openSync(transcriptPath, 'r');
      const buf = Buffer.alloc(16384);
      const bytesRead = fs.readSync(fd, buf, 0, 16384, 0);
      fs.closeSync(fd);

      const chunk = buf.toString('utf8', 0, bytesRead);
      const lines = chunk.split('\n');

      let defaultTitle = 'Untitled Conversation';
      let createdAt = stat.mtime;
      let userRequestsCount = 0;

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line);
          if (item.created_at && !createdAt) {
            createdAt = new Date(item.created_at);
          }
          if (item.type === 'USER_INPUT' && item.content) {
            userRequestsCount++;
            if (defaultTitle === 'Untitled Conversation') {
              const reqMatch = item.content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
              const raw = reqMatch ? reqMatch[1] : item.content;
              const cleanPrompt = raw.replace(/@\[[^\]]+\]/g, '').trim();
              const firstLine = cleanPrompt.split('\n').map(l => l.trim()).filter(Boolean)[0] || raw.trim().split('\n')[0];
              defaultTitle = firstLine.replace(/^[\s#*->]+/, '').trim();
              if (defaultTitle.length > 120) defaultTitle = defaultTitle.slice(0, 120) + '...';
            }
          }
        } catch (e) {}
      }

      const workspace = getWorkspaceFromDb(convId);
      const meta = customMeta[convId] || {};

      list.push({
        id: convId,
        defaultTitle: defaultTitle || 'محادثة بدون عنوان',
        customTitle: meta.customTitle || '',
        title: meta.customTitle || defaultTitle || 'محادثة بدون عنوان',
        starred: !!meta.starred,
        tags: meta.tags || [],
        project: workspace.name,
        projectPath: workspace.path,
        createdAt: createdAt ? new Date(createdAt).toISOString() : stat.mtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        userRequestsCount
      });
    } catch (e) {}
  }

  // Sort by updatedAt desc
  list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  cachedConversations = list;
  lastCacheTime = now;
  return list;
}

// Parse full conversation details
function getConversationDetails(convId) {
  const transcriptPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) return null;

  const content = fs.readFileSync(transcriptPath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  const messages = [];

  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      if (item.type === 'USER_INPUT') {
        const raw = item.content || '';
        const match = raw.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
        const userText = match ? match[1].trim() : raw.trim();
        messages.push({
          type: 'user',
          step: item.step_index,
          time: item.created_at,
          text: userText
        });
      } else if (item.type === 'PLANNER_RESPONSE' && item.content) {
        messages.push({
          type: 'assistant',
          step: item.step_index,
          time: item.created_at,
          text: item.content
        });
      } else if (['RUN_COMMAND', 'VIEW_FILE', 'CODE_ACTION', 'LIST_DIRECTORY', 'REPLACE_FILE_CONTENT'].includes(item.type)) {
        let details = null;
        if (item.tool_calls && item.tool_calls.length > 0) {
          details = item.tool_calls[0];
        }
        messages.push({
          type: 'tool',
          step: item.step_index,
          time: item.created_at,
          toolName: item.type,
          status: item.status || 'DONE',
          details: details
        });
      }
    } catch (e) {}
  }

  const workspace = getWorkspaceFromDb(convId);
  const customMeta = loadCustomMeta();
  const meta = customMeta[convId] || {};

  return {
    id: convId,
    title: meta.customTitle || (messages[0] ? messages[0].text.slice(0, 100) : 'محادثة'),
    customTitle: meta.customTitle || '',
    starred: !!meta.starred,
    project: workspace.name,
    projectPath: workspace.path,
    messagesCount: messages.length,
    messages
  };
}

// Delete a single conversation from disk and cache
function deleteSingleConversation(convId) {
  let deletedSomething = false;

  // 1. Delete Brain Directory
  const brainPath = path.join(BRAIN_DIR, convId);
  if (fs.existsSync(brainPath)) {
    try {
      fs.rmSync(brainPath, { recursive: true, force: true });
      deletedSomething = true;
    } catch (err) {
      console.error(`Failed to delete brain directory for ${convId}:`, err);
    }
  }

  // 2. Delete conversations DB and related files
  const dbBase = path.join(CONV_DIR, convId);
  const extensions = ['.db', '.db-wal', '.db-shm', '.db-journal'];
  for (const ext of extensions) {
    const fPath = dbBase + ext;
    if (fs.existsSync(fPath)) {
      try {
        fs.unlinkSync(fPath);
        deletedSomething = true;
      } catch (err) {
        console.error(`Failed to delete db file ${fPath}:`, err);
      }
    }
  }

  // 3. Remove metadata entry
  const meta = loadCustomMeta();
  if (meta[convId]) {
    delete meta[convId];
    saveCustomMeta(meta);
  }

  // 4. Invalidate / update cachedConversations
  if (cachedConversations) {
    cachedConversations = cachedConversations.filter(c => c.id !== convId);
  }

  return deletedSomething;
}

// Delete all conversations belonging to a project
function deleteProjectConversations(projectName) {
  const convs = scanConversations(true);
  const toDelete = convs.filter(c => c.project === projectName);
  let count = 0;

  for (const c of toDelete) {
    try {
      deleteSingleConversation(c.id);
      count++;
    } catch (err) {
      console.error(`Error deleting conversation ${c.id}:`, err);
    }
  }

  // Force cache refresh
  scanConversations(true);
  return { deletedCount: count, totalFound: toDelete.length };
}

// Helper to sanitize file/folder names
function sanitizeName(name) {
  return (name || 'unnamed')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim();
}

// Generate Markdown transcript for export
function generateMarkdownForConv(details) {
  let md = `# ${details.title}\n\n`;
  md += `**المشروع:** ${details.project} (${details.projectPath})\n`;
  md += `**معرف الجلسة (ID):** \`${details.id}\`\n\n---\n\n`;

  if (details.messages && details.messages.length > 0) {
    for (const m of details.messages) {
      if (m.type === 'user') {
        const timeStr = m.time ? new Date(m.time).toLocaleString('ar-EG') : '';
        md += `### 👤 المستخدم (${timeStr}):\n\n${m.text}\n\n---\n\n`;
      } else if (m.type === 'assistant') {
        md += `### ⚡ المساعد (Antigravity Agent):\n\n${m.text}\n\n---\n\n`;
      }
    }
  }
  return md;
}

// Export all conversations belonging to a project to destination directory
function exportProjectConversations(projectName, targetDir, includeMarkdown = true) {
  const safeProjectName = sanitizeName(projectName);
  const projectExportDir = path.join(targetDir, safeProjectName);

  if (!fs.existsSync(projectExportDir)) {
    fs.mkdirSync(projectExportDir, { recursive: true });
  }

  const brainExportDir = path.join(projectExportDir, 'brain');
  const convsDbExportDir = path.join(projectExportDir, 'conversations_db');
  const mdExportDir = path.join(projectExportDir, 'transcripts_markdown');

  fs.mkdirSync(brainExportDir, { recursive: true });
  fs.mkdirSync(convsDbExportDir, { recursive: true });
  if (includeMarkdown) {
    fs.mkdirSync(mdExportDir, { recursive: true });
  }

  const convs = scanConversations(true);
  const toExport = convs.filter(c => c.project === projectName);
  let exportedCount = 0;
  const exportedMeta = [];

  for (const c of toExport) {
    const convId = c.id;

    // 1. Copy Brain Directory (recursively)
    const srcBrain = path.join(BRAIN_DIR, convId);
    const destBrain = path.join(brainExportDir, convId);
    if (fs.existsSync(srcBrain)) {
      try {
        fs.cpSync(srcBrain, destBrain, { recursive: true, force: true });
      } catch (err) {
        console.error(`Error copying brain for ${convId}:`, err);
      }
    }

    // 2. Copy SQLite DB files (.db, .db-wal, .db-shm)
    const dbExts = ['.db', '.db-wal', '.db-shm', '.db-journal'];
    for (const ext of dbExts) {
      const srcDb = path.join(CONV_DIR, convId + ext);
      if (fs.existsSync(srcDb)) {
        try {
          fs.copyFileSync(srcDb, path.join(convsDbExportDir, convId + ext));
        } catch (err) {
          console.error(`Error copying db for ${convId}:`, err);
        }
      }
    }

    // 3. Generate Markdown if enabled
    if (includeMarkdown) {
      try {
        const details = getConversationDetails(convId);
        if (details) {
          const mdContent = generateMarkdownForConv(details);
          const safeTitle = sanitizeName(details.title).slice(0, 50);
          const mdFileName = `${safeTitle}_${convId.slice(0, 8)}.md`;
          fs.writeFileSync(path.join(mdExportDir, mdFileName), mdContent, 'utf8');
        }
      } catch (err) {
        console.error(`Error generating MD for ${convId}:`, err);
      }
    }

    exportedCount++;
    exportedMeta.push({
      id: convId,
      title: c.title,
      customTitle: c.customTitle,
      starred: c.starred,
      updatedAt: c.updatedAt
    });
  }

  // 4. Save metadata & Index file
  const indexInfo = {
    projectName,
    exportedAt: new Date().toISOString(),
    totalConversations: exportedCount,
    conversations: exportedMeta
  };
  fs.writeFileSync(path.join(projectExportDir, 'index.json'), JSON.stringify(indexInfo, null, 2), 'utf8');

  // Write README.md in the exported folder
  let readmeContent = `# أرشيف محادثات المشروع: ${projectName}\n\n`;
  readmeContent += `- **تاريخ التصدير:** ${new Date().toLocaleString('ar-EG')}\n`;
  readmeContent += `- **إجمالي المحادثات:** ${exportedCount} محادثة\n\n`;
  readmeContent += `## محتويات المجلد:\n`;
  readmeContent += `1. **\`brain/\`**: يحتوي على مجلدات الجلسات بكافة سجلاتها الأصلية (JSONL) والملفات المنشأة داخل كل جلسة.\n`;
  readmeContent += `2. **\`conversations_db/\`**: يحتوي على قواعد بيانات SQLite الأصلية لكل محادثة.\n`;
  if (includeMarkdown) {
    readmeContent += `3. **\`transcripts_markdown/\`**: نصوص المحادثات بصيغة Markdown سهلة القراءة مباشرة بأي محرر.\n`;
  }
  readmeContent += `4. **\`index.json\`**: فهرس بيانات المحادثات وتواريخها.\n\n`;
  readmeContent += `## قائمة المحادثات المرفقة:\n`;
  for (const item of exportedMeta) {
    readmeContent += `- **${item.title}** (ID: \`${item.id}\` - ${item.updatedAt})\n`;
  }
  fs.writeFileSync(path.join(projectExportDir, 'README.md'), readmeContent, 'utf8');

  return {
    success: true,
    projectName,
    projectExportDir,
    exportedCount
  };
}

// Native Windows folder picker
function browseFolderDialog(callback) {
  const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'اختر مجلد حفظ محادثات المشروع'; $d.ShowNewFolderButton = $true; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }"`;
  exec(psCommand, { windowsHide: true }, (error, stdout) => {
    if (error) {
      return callback(null);
    }
    const folder = (stdout || '').trim();
    callback(folder || null);
  });
}

// HTTP Server
const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // Enable CORS & JSON headers helper
  const sendJson = (data, code = 200) => {
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
  };

  // API Routes
  if (pathname === '/api/projects') {
    const convs = scanConversations();
    const projectsMap = {};
    for (const c of convs) {
      if (!projectsMap[c.project]) {
        projectsMap[c.project] = {
          name: c.project,
          path: c.projectPath,
          count: 0,
          latestDate: c.updatedAt
        };
      }
      projectsMap[c.project].count++;
      if (new Date(c.updatedAt) > new Date(projectsMap[c.project].latestDate)) {
        projectsMap[c.project].latestDate = c.updatedAt;
      }
    }
    const projects = Object.values(projectsMap).sort((a, b) => b.count - a.count);
    return sendJson(projects);
  }

  if (pathname === '/api/conversations') {
    const project = urlObj.searchParams.get('project');
    const search = (urlObj.searchParams.get('search') || '').toLowerCase().trim();
    const starredOnly = urlObj.searchParams.get('starred') === 'true';
    const refresh = urlObj.searchParams.get('refresh') === 'true';

    let convs = scanConversations(refresh);

    if (project && project !== 'all') {
      convs = convs.filter(c => c.project === project);
    }
    if (starredOnly) {
      convs = convs.filter(c => c.starred);
    }
    if (search) {
      convs = convs.filter(c => 
        c.title.toLowerCase().includes(search) ||
        c.id.toLowerCase().includes(search) ||
        c.project.toLowerCase().includes(search)
      );
    }

    return sendJson(convs);
  }

  const convMatch = pathname.match(/^\/api\/conversations\/([a-zA-Z0-9_-]+)$/);
  if (convMatch && req.method === 'GET') {
    const convId = convMatch[1];
    const details = getConversationDetails(convId);
    if (!details) return sendJson({ error: 'Conversation not found' }, 404);
    return sendJson(details);
  }

  // Rename endpoint
  const renameMatch = pathname.match(/^\/api\/conversations\/([a-zA-Z0-9_-]+)\/rename$/);
  if (renameMatch && req.method === 'POST') {
    const convId = renameMatch[1];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const meta = loadCustomMeta();
        if (!meta[convId]) meta[convId] = {};
        meta[convId].customTitle = (parsed.title || '').trim();
        saveCustomMeta(meta);
        if (cachedConversations) {
          const item = cachedConversations.find(c => c.id === convId);
          if (item) {
            item.customTitle = meta[convId].customTitle;
            item.title = meta[convId].customTitle || item.defaultTitle;
          }
        }
        return sendJson({ success: true, customTitle: meta[convId].customTitle });
      } catch (e) {
        return sendJson({ error: 'Invalid JSON' }, 400);
      }
    });
    return;
  }

  // Star endpoint
  const starMatch = pathname.match(/^\/api\/conversations\/([a-zA-Z0-9_-]+)\/star$/);
  if (starMatch && req.method === 'POST') {
    const convId = starMatch[1];
    const meta = loadCustomMeta();
    if (!meta[convId]) meta[convId] = {};
    meta[convId].starred = !meta[convId].starred;
    saveCustomMeta(meta);
    if (cachedConversations) {
      const item = cachedConversations.find(c => c.id === convId);
      if (item) item.starred = meta[convId].starred;
    }
    return sendJson({ success: true, starred: meta[convId].starred });
  }

  // Open folder in Windows explorer
  const openMatch = pathname.match(/^\/api\/conversations\/([a-zA-Z0-9_-]+)\/open-folder$/);
  if (openMatch && req.method === 'POST') {
    const convId = openMatch[1];
    const folder = path.join(BRAIN_DIR, convId);
    if (fs.existsSync(folder)) {
      exec(`explorer.exe "${folder}"`);
      return sendJson({ success: true });
    }
    return sendJson({ error: 'Folder not found' }, 404);
  }

  // Delete single conversation endpoint
  const deleteMatch = pathname.match(/^\/api\/conversations\/([a-zA-Z0-9_-]+)\/delete$/);
  if ((deleteMatch && req.method === 'POST') || (pathname.startsWith('/api/conversations/') && req.method === 'DELETE')) {
    const convId = deleteMatch ? deleteMatch[1] : pathname.split('/')[3];
    const success = deleteSingleConversation(convId);
    return sendJson({ success: true, id: convId, deleted: success });
  }

  // Delete entire project conversations endpoint
  if (pathname === '/api/projects/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const projectName = (parsed.project || '').trim();
        if (!projectName) {
          return sendJson({ error: 'اسم المشروع مطلوب' }, 400);
        }
        const result = deleteProjectConversations(projectName);
        return sendJson({ success: true, project: projectName, ...result });
      } catch (e) {
        return sendJson({ error: 'بيانات غير صالحة' }, 400);
      }
    });
    return;
  }

  // Browse folder endpoint (Native Windows Dialog)
  if (pathname === '/api/browse-folder' && req.method === 'POST') {
    browseFolderDialog((selectedPath) => {
      return sendJson({ path: selectedPath });
    });
    return;
  }

  // Export project conversations endpoint
  if (pathname === '/api/projects/export' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const projectName = (parsed.project || '').trim();
        let destination = (parsed.destination || '').trim();
        const includeMarkdown = parsed.includeMarkdown !== false;

        if (!projectName) {
          return sendJson({ error: 'اسم المشروع مطلوب' }, 400);
        }
        if (!destination) {
          destination = path.join(HOME_DIR, 'Desktop', 'Antigravity_Exports');
        }

        const result = exportProjectConversations(projectName, destination, includeMarkdown);
        return sendJson(result);
      } catch (e) {
        console.error('Export error:', e);
        return sendJson({ error: e.message || 'خطأ أثناء عملية التصدير' }, 500);
      }
    });
    return;
  }

  // Open any specified folder in Windows Explorer
  if (pathname === '/api/open-folder-path' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const folder = (parsed.path || '').trim();
        if (folder && fs.existsSync(folder)) {
          exec(`explorer.exe "${folder}"`);
          return sendJson({ success: true });
        }
        return sendJson({ error: 'المجلد غير موجود' }, 404);
      } catch (e) {
        return sendJson({ error: 'بيانات غير صالحة' }, 400);
      }
    });
    return;
  }

  // Stats
  if (pathname === '/api/stats') {
    const convs = scanConversations();
    const projects = new Set(convs.map(c => c.project));
    const starred = convs.filter(c => c.starred).length;
    return sendJson({
      totalConversations: convs.length,
      totalProjects: projects.size,
      starredCount: starred
    });
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(data);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Antigravity Chat Browser is running!`);
  console.log(`👉 Open in browser: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
