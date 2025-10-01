// Electron과 웹 버전 모두 지원하는 브리지
export const ElectronBridge = {
  // Electron인지 확인
  isElectron: () => {
    return window.electronAPI !== undefined;
  },

  // JSON 저장
  async saveJSON(data) {
    if (this.isElectron()) {
      // Electron: 네이티브 파일 시스템 사용
      return await window.electronAPI.saveJSON(data);
    } else {
      // 웹: 브라우저 다운로드
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `지출결의서_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    }
  },

  // JSON 불러오기
  async loadJSON() {
    if (this.isElectron()) {
      // Electron: 네이티브 파일 시스템 사용
      return await window.electronAPI.loadJSON();
    } else {
      // 웹: 파일 선택 input 사용
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            const text = await file.text();
            resolve({ success: true, data: JSON.parse(text) });
          } else {
            resolve({ success: false, canceled: true });
          }
        };
        input.click();
      });
    }
  },

  // 구글드라이브 동기화 (Electron 전용)
  async googleDriveSync(action, data) {
    if (this.isElectron()) {
      return await window.electronAPI.googleDriveSync(action, data);
    } else {
      console.warn('구글드라이브 동기화는 Electron 앱에서만 사용 가능합니다.');
      return { success: false, message: 'Electron 앱에서만 사용 가능' };
    }
  }
};