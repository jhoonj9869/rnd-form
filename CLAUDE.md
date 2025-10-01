# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
**RND Form** - 동적 양식 관리 시스템 with Google Drive integration (v2.3.0)
- Hybrid Web/Desktop app (Alpine.js + Electron)
- Cloud-first storage with offline capability
- Dynamic form loading from Google Drive
- Korean folder name support

## Document Management Rules

### 📁 Document Structure
```
rnd-form/
├── README.md           # External facing (rarely updated)
├── CLAUDE.md          # AI work instructions (this file)
└── docs/
    ├── ARCHITECTURE.md    # System architecture & technical design
    ├── CURRENT_STATUS.md  # Session state & active issues
    ├── PRD.md            # Product requirements & features
    └── roadmap.md        # Development plan & milestones
```

### 📋 Document Roles & Update Frequency

| Document | Purpose | When to Update | Critical Info |
|----------|---------|----------------|---------------|
| `docs/ARCHITECTURE.md` | Technical structure, storage patterns, system design | When architecture changes | Storage dual-pattern, API flows |
| `docs/CURRENT_STATUS.md` | **Session continuity**, active work, blockers | Every `/exit`, `/clear`, `/compact` | Current tasks, unresolved issues |
| `docs/PRD.md` | Business requirements, feature specs | When requirements change | Feature list, user flows |
| `docs/roadmap.md` | Development phases, future plans | Sprint/milestone updates | Version plans, priorities |

### 🔄 Session Continuity Protocol

**IMPORTANT**: When starting any session, ALWAYS:
1. Read `docs/CURRENT_STATUS.md` first to understand context
2. Continue from where previous session ended
3. Update status before session ends (`/exit`, `/clear`, `/compact`)

### ✅ Management Principles

1. **Single Source of Truth**: Each document owns specific information
2. **No Duplication**: Reference via links, don't copy content
3. **Living Documents**: Only `CURRENT_STATUS.md` updates frequently
4. **Context Preservation**: All project details in `docs/` for session recovery

## Essential Commands

```bash
npm run dev              # Web development server
npm run electron:dev     # Desktop app development
npm run build           # Build single HTML file
npm run build:win      # Build Windows .exe
```

## Key Architecture Points

1. **Dual Storage Structure**:
   - **Workspace/Cache Pattern** via `form-storage-service.js` (v2.2.5+)
   - Workspace: Editable local documents
   - Cache: Read-only cloud-synced documents
   - IndexedDB + Google Drive integration via `storage-manager.js`
2. **Dynamic Form System** (v2.3.0):
   - Forms loaded from Google Drive folders
   - Korean folder names mapped to English IDs
   - Common template structure with custom content areas
   - Form registry service for dynamic management
3. **Security**: Stamps only applied at print time, never stored
4. **Alpine.js App**: Main state in `Alpine.data('expenseApp')` in `app.js`
5. **Background Uploads**: Resilient file upload queue in `background-uploader.js`
6. **No Test Framework**: Currently no automated tests configured

## Critical Files to Know

- `src/js/app.js` - Main application logic and state
- `src/js/form-storage-service.js` - Workspace/Cache dual storage
- `src/js/form-registry-service.js` - Dynamic form management (NEW)
- `src/js/storage-manager.js` - Handles storage sync with cloud
- `electron/google-drive.js` - OAuth2 and Drive API
- `src/forms/common/` - Base templates for new forms
- `src/forms/templates/` - Form configurations and mappings

## Quick References

- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Current Status**: [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md)
- **Requirements**: [docs/PRD.md](docs/PRD.md)
- **Roadmap**: [docs/roadmap.md](docs/roadmap.md)

## Common Issues

1. **Google Drive Auth**: Check OAuth2 token in Electron Store
2. **Build Issues**: Ensure `vite-plugin-singlefile` is installed
3. **Sync Problems**: Monitor `background-uploader.js` queue status