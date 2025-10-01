// 공개 저장소용 버전 - 민감정보 제거됨
const { google } = require('googleapis');
const Store = require('electron-store').default || require('electron-store');
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class GoogleDriveService {
  constructor() {
    this.store = new Store();
    this.oauth2Client = null;
    this.drive = null;

    // OAuth2 설정 - 사용자가 직접 설정해야 함
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = 'http://localhost';

    if (!this.clientId || !this.clientSecret) {
      console.error('⚠️ Google OAuth2 설정이 필요합니다.');
      console.error('📖 설정 방법: https://github.com/jhoonj9869/rnd-form#setup');
    }

    // 스코프 설정
    this.scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.appdata'
    ];

    // 폴더 구조 정의
    this.folderStructure = {
      root: 'RND-Form',
      forms: {
        'expense-report': '지출결의서',
        'purchase-order': '구매요청서',
        'travel-report': '출장보고서'
      },
      backup: 'backup'
    };

    // 폴더 ID 캐시
    this.folderIds = {};
  }

  // 나머지 메서드는 동일...
}

module.exports = GoogleDriveService;