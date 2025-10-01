const { contextBridge, ipcRenderer } = require('electron');

// 안전한 API를 웹 페이지에 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 파일 시스템
  saveJSON: (data) => ipcRenderer.invoke('save-json', data),
  loadJSON: () => ipcRenderer.invoke('load-json'),

  // 구글드라이브
  googleDriveSync: (action, data) => ipcRenderer.invoke('google-drive-sync', action, data),

  // 미니 알림 다이얼로그 (입력 필드 활성화용)
  showMiniNotification: (options) => ipcRenderer.invoke('show-mini-notification', options),

  // Blocking 다이얼로그 (입력 필드 활성화를 위한 이벤트 루프 중단)
  showBlockingDialog: (options) => ipcRenderer.invoke('show-blocking-dialog', options),

  // 구글드라이브 양식 관리 API
  drive: {
    listFolders: () => ipcRenderer.invoke('google-drive-sync', 'list-folders'),
    findFile: (folderId, fileName) => ipcRenderer.invoke('google-drive-sync', 'find-file', { folderId, fileName }),
    downloadFile: (fileId) => ipcRenderer.invoke('google-drive-sync', 'download-file', { fileId }),
    uploadFile: (folderId, fileName, content, mimeType) =>
      ipcRenderer.invoke('google-drive-sync', 'upload-file', { folderId, fileName, content, mimeType })
  },

  // 앱 정보
  getVersion: () => ipcRenderer.invoke('get-app-version'),

  // 자동 업데이트 (추후 구현)
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // 인쇄
  print: (options) => ipcRenderer.invoke('print', options),

  // 플랫폼 정보
  platform: process.platform,
  isElectron: true
});

console.log('Preload script loaded - Electron APIs exposed to renderer');