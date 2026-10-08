# ⚡ Antigravity Chat Studio & Project Organizer

<div align="center">

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Node](https://img.shields.io/badge/Node.js-22%2B-green.svg)
![Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Node.js)-brightgreen)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-orange)
![Antigravity](https://img.shields.io/badge/Compatible%20with-Google%20Antigravity%20IDE-purple)

**A high-performance local dashboard & manager for Google Antigravity IDE sessions.**  
Organize by project, rename conversations, live search, preview full transcripts, star favorites, safely delete, and batch export full project archives with zero external dependencies.

[English Documentation](#english) • [الوثائق باللغة العربية](#arabic)

</div>

---

<a name="english"></a>
## 🌟 Why Antigravity Chat Studio?

**Google Antigravity IDE** provides an AI-driven pair-programming agent that stores all conversation logs, tool calls, and trajectories locally on your machine (`~/.gemini/antigravity-ide/brain` and `~/.gemini/antigravity-ide/conversations`).

However, the default sidebar in Antigravity IDE lacks:
- Automatic categorization by workspace/project.
- Renaming conversations to memorable titles.
- Pinning favorite/starred conversations.
- Browsing older sessions that fall off the IDE history list.
- Batch exporting project conversations into offline-readable files.
- Safe deletion of obsolete or temporary sessions.

**Antigravity Chat Studio** solves all of these needs directly through a clean, blazing-fast web dashboard running 100% locally on your machine.

---

## ✨ Features

- 📁 **Automatic Project Categorization:** Automatically inspects session trajectory metadata and groups conversations by their respective workspace/project folders.
- ✏️ **Custom Renaming:** Rename any conversation to an intuitive name (e.g. `[Auth] Refactor JWT validation`). Renames are saved persistently in `data/custom_meta.json`.
- ⭐ **Favorites & Pinning:** Star critical architectural chats and access them with one click.
- 🔍 **Live Search:** Instant, reactive search across conversation titles, project names, and session IDs.
- 💬 **Rich Transcript Reader:** Renders conversation history with clean Markdown formatting, syntax highlighting, and collapsible tool action cards.
- 📋 **One-Click ID Copying:** Quickly copy session UUIDs to reference or resume them directly inside Antigravity IDE using the `@` mention shortcut.
- 📥 **Export to Markdown:** Export any individual conversation to a standalone `.md` file.
- 📂 **Quick Explorer Access:** Open the underlying session brain directory directly in Windows Explorer.
- 🗑️ **Safe Deletion:**
  - **Single Conversation:** Removes brain directory, SQLite trajectory database (`.db`, `.db-wal`, `.db-shm`), and metadata.
  - **Entire Project:** Batch-deletes all sessions belonging to a specific project.  
    *(Safety guarantee: Never touches or deletes the actual source code of your project).*
- 📦 **Full Project Backup & Export:**
  - Copy all session files (`brain/`), trajectory databases (`conversations_db/`), and generate offline-readable Markdown files (`transcripts_markdown/`).
  - Native Windows Folder Browser (`FolderBrowserDialog`) allows picking any destination folder on your machine with one click.
- ⚡ **Zero External Dependencies:** Built entirely with Node.js standard libraries (`node:http`, `node:fs`, `node:sqlite`, `node:child_process`). No `npm install` needed!

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** version 22.0.0 or higher ([Download Node.js](https://nodejs.org/)).
- **Google Antigravity IDE** installed on your system.

### Running on Windows
Simply double-click the included batch script:
```cmd
start.bat
```
This will launch the local server and automatically open your default browser at:  
👉 **`http://localhost:4949`**

### Running via Terminal (Cross-Platform)
```bash
# Clone the repository
git clone https://github.com/khallafsayed/antigravity-chat-browser.git
cd antigravity-chat-browser

# Start the dashboard (No npm install required!)
node server.js
```
*(Or use `npm start`)*

---

## 📁 Project Architecture

```
antigravity-chat-browser/
├── public/                 # Modern web frontend (Vanilla JS, CSS & HTML)
│   ├── index.html          # Main application dashboard layout & modals
│   ├── style.css           # Premium Win11 Fluent dark-theme styling
│   └── app.js              # Reactive state, API integrations & UI handling
├── data/
│   ├── custom_meta.json    # Local store for custom conversation titles & stars
│   └── custom_meta.example.json
├── server.js               # Zero-dependency Node.js HTTP server & API backend
├── start.bat               # 1-click Windows launcher
├── start.sh                # 1-click Linux / macOS launcher
├── package.json            # Project manifest
├── LICENSE                 # MIT License
└── README.md               # Documentation
```

---

<a name="arabic"></a>
## 🌍 الوثائق باللغة العربية (Arabic Documentation)

### ما هو تطبيق Antigravity Chat Studio؟
تطبيق **Antigravity Chat Studio** هو لوحة تحكم محلية ومفتوحة المصدر مصممة خصيصاً لمطوري **Google Antigravity IDE**. يقوم التطبيق بفهرسة، وتنظيم، واستعراض كافة سجلات المحادثات والقرارات البرمجية وجلسات الذكاء الاصطناعي المخزنة محلياً على جهازك.

---

### أبرز المميزات:
1. **تصنيف تلقائي حسب المشاريع:** تجميع كافة المحادثات والجلسات تلقائياً حسب مسار المشروع الذي تم العمل عليه (`Workspace`).
2. **إعادة تسمية مخصصة:** إمكانية تعديل عناوين المحادثات لحفظ أسماء معبرة وسهلة التذكر.
3. **المفضلة ⭐:** تمييز المحادثات الهامة بنجمة للوصول الفوري إليها.
4. **بحث حي وسريع:** فلترة وبحث فوري في العناوين والمعرفات وأسماء المشاريع أثناء الكتابة.
5. **قارئ محادثات غني:** استعراض الحوارات البرمجية والأكواد بتنسيق Markdown مع عرض خطوات الأدوات (`Tool Calls`) في بطاقات منظمة.
6. **نسخ المعرفات بضغطة واحدة:** نسخ الـ `Conversation ID` لاستدعائه ومواصلة الجلسة في Antigravity عبر الـ `@`.
7. **حذف محادثة أو مشروع بالكامل:**
   - حذف المحادثات غير المرغوبة وإخلاء مساحة القرص.
   - حذف جميع محادثات مشروع معين دفعة واحدة مع نافذة تأكيد آمنة (لا يتم مساس أي من ملفات الكود البرمجي للمشروع نفسه).
8. **تصدير مجلد مشروع بالكامل (Backup & Export):**
   - نسخ كافة ملفات الـ `brain` وقواعد بيانات SQLite.
   - توليد ملفات Markdown لكل محادثة للقراءة والتوثيق خارج التطبيق.
   - نافذة اختيار المجلدات الرسمية من نظام ويندوز (`📁 تصفح...`).
9. **يعمل بدون أي حزم خارجية (Zero Dependencies):** يعتمد بالكامل على محرك Node.js القياسي ولا يتطلب تنزيل أو تثبيت أي مكتبات `npm`.

---

### طريقة التشغيل على ويندوز:
1. تأكد من توفر [Node.js](https://nodejs.org/) (إصدار 22 أو أحدث).
2. انقر نقراً مزدوجاً على الملف:
   ```cmd
   start.bat
   ```
3. سيفتح المتصفح تلقائياً على الرابط:  
   👉 **`http://localhost:4949`**

---

## 🔒 Privacy & Local-First Guarantee

- **100% Offline & Private:** هذا التطبيق لا يتصل بأي خوادم خارجية ولا يرفع أي بيانات إلى السحابة. كافة البيانات تُقرأ وتُعالج محلياً من مجلد `.gemini` الموجود على جهاز المستخدم فقط.
- **Read-Safe:** لا يقوم التطبيق بتعديل أي ملفات كود أو بيانات مشروعك الأصلي.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [Issues page](https://github.com/khallafsayed/antigravity-chat-browser/issues).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2026 Khallaf Sayed.
