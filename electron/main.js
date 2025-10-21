require('dotenv').config();
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const GoogleDriveService = require('./google-drive');
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'development ';
console.log('NODE_ENV:', process.env.NODE_ENV, '| isDev:', isDev);

let mainWindow;
let googleDriveService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../src/assets/icon.png'),
    title: 'RND Form - 지출결의서 관리 시스템'
  });

  // 개발 모드면 Vite 서버, 프로덕션이면 빌드된 파일
  if (isDev) {
    // Vite 서버 포트 자동 탐색
    const tryPorts = async () => {
      const ports = [5175, 5174, 5173];
      for (const port of ports) {
        try {
          await mainWindow.loadURL(`http://localhost:${port}`);
          console.log(`개발 서버 연결: http://localhost:${port}`);
          break;
        } catch (err) {
          console.log(`포트 ${port} 시도 실패, 다음 포트 시도...`);
        }
      }
    };
    tryPorts();

    // 페이지 로드 완료 후 개발자 도구 열기
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.openDevTools();
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 메뉴 생성
function createMenu() {
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '새 문서',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-document');
          }
        },
        {
          label: '저장',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save-document');
          }
        },
        { type: 'separator' },
        {
          label: '종료',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '보기',
      submenu: [
        {
          label: '개발자 도구',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.openDevTools();
          }
        },
        {
          label: '새로고침',
          accelerator: 'F5',
          click: () => {
            mainWindow.webContents.reload();
          }
        },
        { type: 'separator' },
        { label: '확대', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: '축소', role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { label: '실제 크기', role: 'resetZoom', accelerator: 'CmdOrCtrl+0' }
      ]
    },
    {
      label: '편집',
      submenu: [
        { label: '실행 취소', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: '다시 실행', role: 'redo', accelerator: 'CmdOrCtrl+Y' },
        { type: 'separator' },
        { label: '잘라내기', role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: '복사', role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: '붙여넣기', role: 'paste', accelerator: 'CmdOrCtrl+V' }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '업데이트 확인',
          click: async () => {
            if (!isDev) {
              const result = await autoUpdater.checkForUpdates();
              if (!result) {
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: '업데이트 확인',
                  message: '현재 최신 버전을 사용하고 있습니다.',
                  buttons: ['확인']
                });
              }
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '개발 모드',
                message: '개발 모드에서는 업데이트를 확인할 수 없습니다.',
                buttons: ['확인']
              });
            }
          }
        },
        { type: 'separator' },
        {
          label: '정보',
          click: () => {
            const packageInfo = require('../package.json');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'RND Form 정보',
              message: 'RND Form',
              detail: `버전: ${packageInfo.version}\n\n지출결의서 관리 시스템\n© 2025 NextE&M`,
              buttons: ['확인']
            });
          }
        },
        { type: 'separator' },
        {
          label: '개발자 도구',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          },
          visible: isDev
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  // 메뉴 설정
  createMenu();

  // 구글드라이브 서비스 초기화
  try {
    googleDriveService = new GoogleDriveService();
    const initialized = googleDriveService.initOAuth2Client();
    console.log('GoogleDriveService 초기화:', initialized ? '성공' : '실패');
  } catch (error) {
    console.error('GoogleDriveService 초기화 오류:', error);
  }

  // 자동 업데이트 설정 (프로덕션 모드에서만)
  if (!isDev) {
    setupAutoUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 통신 핸들러들

// 파일 저장
ipcMain.handle('save-json', async (event, data) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog({
    title: '문서 저장',
    defaultPath: `지출결의서_${new Date().toISOString().split('T')[0]}.json`,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// 파일 불러오기
ipcMain.handle('load-json', async (event) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    title: '문서 불러오기',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled) {
    try {
      const data = fs.readFileSync(result.filePaths[0], 'utf8');
      return { success: true, data: JSON.parse(data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// 인쇄
ipcMain.handle('print', async (event, options) => {
  const printOptions = {
    silent: false,  // false = 미리보기 표시
    printBackground: true,
    deviceName: options?.deviceName || '',
    margins: {
      marginType: 'default'
    }
  };

  mainWindow.webContents.print(printOptions, (success, failureReason) => {
    if (!success) {
      console.error('인쇄 실패:', failureReason);
      return { success: false, error: failureReason };
    }
    return { success: true };
  });
});

// 구글드라이브 연동
ipcMain.handle('google-drive-sync', async (event, action, data) => {
  try {
    // googleDriveService가 없으면 초기화
    if (!googleDriveService) {
      console.log('GoogleDriveService 재초기화 중...');
      googleDriveService = new GoogleDriveService();
      googleDriveService.initOAuth2Client();
    }

    switch (action) {
      case 'login':
        console.log('로그인 시도 중...');
        console.log('Client ID:', process.env.GOOGLE_CLIENT_ID);
        console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '설정됨' : '없음');
        const authResult = await googleDriveService.authenticate(mainWindow);
        return { success: authResult, message: '로그인 성공' };

      case 'logout':
        googleDriveService.logout();
        return { success: true, message: '로그아웃 완료' };

      case 'check-auth':
        const isAuth = googleDriveService.isAuthenticated();
        return { success: true, authenticated: isAuth };

      case 'sync-upload':
        await googleDriveService.syncDatabase(data);
        return { success: true, message: '동기화 완료' };

      case 'sync-download':
        const cloudData = await googleDriveService.downloadDatabase();
        return { success: true, data: cloudData };

      case 'start-auto-sync':
        googleDriveService.startAutoSync(data?.interval);
        return { success: true, message: '자동 동기화 시작' };

      case 'stop-auto-sync':
        googleDriveService.stopAutoSync();
        return { success: true, message: '자동 동기화 중지' };

      // ========== 양식별 문서 관리 ==========
      case 'save-document':
        // 양식별 문서 저장
        const saveResult = await googleDriveService.saveFormDocument(
          data.formType,
          data.document
        );
        return saveResult;

      case 'list-documents':
        // 양식별 문서 목록 조회
        const documents = await googleDriveService.listFormDocuments(data.formType);
        return { success: true, documents };

      case 'get-document':
        // 특정 문서 가져오기
        const document = await googleDriveService.getFormDocument(
          data.formType,
          data.documentId
        );
        return { success: true, document };

      case 'delete-document':
        // 문서 삭제
        const deleteResult = await googleDriveService.deleteFormDocument(
          data.formType,
          data.documentId
        );
        return deleteResult;

      // ========== 첨부파일 관리 ==========
      case 'upload-attachment':
        // 첨부파일 업로드
        const uploadResult = await googleDriveService.uploadAttachment(
          data.documentId,
          Buffer.from(data.fileBuffer),
          data.fileName,
          data.mimeType
        );
        return uploadResult;

      case 'download-attachment':
        // 첨부파일 다운로드
        const downloadResult = await googleDriveService.downloadAttachment(data.fileId);
        return downloadResult;

      case 'delete-attachment':
        // 첨부파일 삭제
        const deleteAttResult = await googleDriveService.deleteAttachment(data.fileId);
        return deleteAttResult;

      case 'delete-document-attachments':
        // 문서의 모든 첨부파일 삭제
        const deleteAllResult = await googleDriveService.deleteDocumentAttachments(data.documentId);
        return deleteAllResult;

      // ========== 양식 관리 ==========
      case 'list-folders':
        // RND-Form 하위 폴더 목록 가져오기
        const folders = await googleDriveService.listFormFolders();
        return { success: true, folders };

      case 'find-file':
        // 특정 폴더 내 파일 검색
        const file = await googleDriveService.findFileInFolder(data.folderId, data.fileName);
        return { success: true, file };

      case 'download-file':
        // 파일 내용 다운로드
        const content = await googleDriveService.downloadFileContent(data.fileId);
        return { success: true, content };

      case 'upload-file':
        // 파일 업로드
        const uploadFileResult = await googleDriveService.uploadFile(
          data.folderId,
          data.fileName,
          data.content,
          data.mimeType || 'application/json'
        );
        return { success: true, fileId: uploadFileResult };

      default:
        return { success: false, message: '알 수 없는 작업' };
    }
  } catch (error) {
    console.error('구글드라이브 오류:', error);
    return { success: false, message: error.message };
  }
});

// 입력 필드 활성화를 위한 미니 다이얼로그
ipcMain.handle('show-mini-notification', async (event, options = {}) => {
  const { dialog } = require('electron');

  // 작고 빠른 알림으로 사용자 경험 개선
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: options.title || '알림',
    message: options.message || '작업이 완료되었습니다.',
    buttons: ['확인'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });

  return result.response;
});

// 입력 필드 활성화를 위한 blocking 다이얼로그 (네이티브 OS 다이얼로그)
ipcMain.handle('show-blocking-dialog', async (event, options = {}) => {
  const { dialog } = require('electron');

  if (!mainWindow) return;

  // 네이티브 OS 다이얼로그로 이벤트 루프를 실제로 중단
  const result = await dialog.showMessageBox(mainWindow, {
    type: options.type || 'info',
    title: options.title || '편집 모드',
    message: options.message || '문서를 편집할 수 있습니다.',
    detail: options.detail || '',
    buttons: options.buttons || ['확인'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });

  // 다이얼로그가 닫힌 후 약간의 지연을 줘서 Alpine.js가 재활성화되도록
  await new Promise(resolve => setTimeout(resolve, 50));

  return result.response;
});

// 자동 업데이트 설정
function setupAutoUpdater() {
  // GitHub Releases URL 설정
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'jhoonj9869',
    repo: 'rnd-form-releases'
  });

  // 업데이트 설정
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false; // 정식 버전만
  autoUpdater.allowDowngrade = false;  // 다운그레이드 방지

  // 이벤트 핸들러
  autoUpdater.on('checking-for-update', () => {
    console.log('업데이트 확인 중...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('업데이트 발견:', info.version);
    const releaseNotes = info.releaseNotes || '업데이트 정보 없음';
    const releaseDate = new Date(info.releaseDate).toLocaleDateString('ko-KR');

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '업데이트 발견',
      message: `새 버전이 발견되었습니다!`,
      detail: `버전: ${info.version}\n날짜: ${releaseDate}\n\n변경사항:\n${releaseNotes}\n\n자동으로 다운로드를 시작합니다.`,
      buttons: ['확인']
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('최신 버전입니다');
  });

  autoUpdater.on('error', (err) => {
    console.error('업데이트 오류:', err);
    if (!isDev) {  // 개발 모드가 아닐 때만 오류 표시
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: '업데이트 오류',
        message: '업데이트 확인 중 오류가 발생했습니다.',
        detail: err.message,
        buttons: ['확인']
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    const transferredMB = (progress.transferred / 1048576).toFixed(1);
    const totalMB = (progress.total / 1048576).toFixed(1);

    console.log(`다운로드: ${percent}% (${transferredMB}/${totalMB} MB)`);

    // 윈도우 타이틀에 진행률 표시
    mainWindow.setTitle(`RND Form - 업데이트 다운로드 중... ${percent}%`);

    // 작업 표시줄에 진행률 표시 (Windows)
    mainWindow.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on('update-downloaded', (info) => {
    // 다운로드 완료 시 진행률 리셋
    mainWindow.setProgressBar(-1);
    mainWindow.setTitle('RND Form - 지출결의서 관리 시스템');

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '업데이트 준비 완료',
      message: `버전 ${info.version} 업데이트가 준비되었습니다.`,
      detail: '지금 재시작하여 업데이트를 적용하시겠습니까?\n나중에 재시작해도 자동으로 업데이트됩니다.',
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  // 앱 시작 3초 후 업데이트 체크 (초기 로딩 방해 방지)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);

  // 주기적 업데이트 체크 (30분마다)
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 30 * 60 * 1000);
}