const { google } = require('googleapis');
const Store = require('electron-store').default || require('electron-store');
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const SecureConfig = require('./secure-config');

class GoogleDriveService {
  constructor() {
    this.store = new Store();
    this.oauth2Client = null;
    this.drive = null;
    this.secureConfig = new SecureConfig();

    // OAuth2 설정 - 보안 모듈에서 가져오기
    try {
      const oauthConfig = this.secureConfig.getOAuthConfig();
      this.clientId = oauthConfig.clientId;
      this.clientSecret = oauthConfig.clientSecret;
      this.redirectUri = 'http://localhost';

      // 디버깅용 로그 (민감정보 숨김)
      console.log('OAuth2 Config loaded:', {
        clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'NOT SET',
        clientSecret: this.clientSecret ? 'SECURED' : 'NOT SET',
        redirectUri: this.redirectUri
      });
    } catch (error) {
      console.error('OAuth2 설정 로드 실패:', error.message);
      this.clientId = null;
      this.clientSecret = null;
      this.redirectUri = 'http://localhost';
    }

    // 스코프 설정 - 공유드라이브 지원을 위한 전체 Drive 권한
    this.scopes = [
      'https://www.googleapis.com/auth/drive'
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

    // 공유 드라이브 ID (설정 파일에서 읽거나 하드코딩)
    this.sharedDriveId = null; // 공유 드라이브 사용 시 ID 설정

    // 폴더 ID 캐시
    this.folderIds = {};
  }

  // 공유 드라이브용 파일 검색 옵션 생성
  getSharedDriveOptions() {
    if (this.sharedDriveId) {
      return {
        driveId: this.sharedDriveId,
        corpora: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      };
    }
    return {
      spaces: 'drive'
    };
  }

  // 공유 드라이브용 파일 작업 옵션 생성 (create/update용)
  getSharedDriveWriteOptions() {
    if (this.sharedDriveId) {
      return {
        supportsAllDrives: true
      };
    }
    return {};
  }

  // 공유 드라이브 검색 및 설정
  async findSharedDrive() {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    // 직접 설정된 공유드라이브 ID가 있으면 우선 사용
    const directSharedDriveId = process.env.SHARED_DRIVE_ID || null;
    if (directSharedDriveId) {
      this.sharedDriveId = directSharedDriveId;
      console.log(`환경변수로 설정된 공유 드라이브 사용: ${directSharedDriveId}`);
      return directSharedDriveId;
    }

    try {
      // 공유 드라이브 목록 가져오기
      const response = await this.drive.drives.list({
        fields: 'drives(id, name)'
      });

      const drives = response.data.drives || [];

      // 모든 공유드라이브 출력 (디버깅용)
      if (drives.length > 0) {
        console.log('📋 발견된 공유드라이브 목록:');
        drives.forEach(drive => {
          console.log(`  - ${drive.name} (${drive.id})`);
        });
      }

      // RND-Form 공유 드라이브 찾기
      const rndDrive = drives.find(drive =>
        drive.name.includes('RND') || drive.name.includes('Form') || drive.name.includes('양식')
      );

      if (rndDrive) {
        this.sharedDriveId = rndDrive.id;
        console.log(`✅ 키워드 매칭 공유 드라이브 발견: ${rndDrive.name} (${rndDrive.id})`);
        return rndDrive.id;
      }

      // 키워드 매칭이 없으면 첫 번째 공유드라이브 사용
      if (drives.length > 0) {
        const firstDrive = drives[0];
        this.sharedDriveId = firstDrive.id;
        console.log(`⚠️ 키워드 매칭 없음. 첫 번째 공유드라이브 사용: ${firstDrive.name} (${firstDrive.id})`);
        console.log('💡 팁: 공유드라이브 이름에 "RND", "Form", "양식" 중 하나를 포함하면 자동 선택됩니다.');
        return firstDrive.id;
      }

      console.log('❌ 공유 드라이브가 없습니다. 개인 드라이브를 사용합니다.');
      console.log('💡 해결방법:');
      console.log('  1. Google Drive 웹에서 공유드라이브 생성');
      console.log('  2. 또는 기존 공유드라이브에 초대 요청');
      console.log('  3. 또는 .env 파일에 SHARED_DRIVE_ID=드라이브ID 설정');
      return null;
    } catch (error) {
      console.error('❌ 공유 드라이브 검색 오류:', error.message);
      if (error.code === 403) {
        console.log('💡 권한 오류가 발생했지만 OAuth2 스코프는 올바르게 설정되었습니다.');
      }
      return null;
    }
  }

  // OAuth2 클라이언트 초기화
  initOAuth2Client() {
    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    // 저장된 토큰이 있으면 복원
    const tokens = this.store.get('googleTokens');
    if (tokens) {
      this.oauth2Client.setCredentials(tokens);
      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      return true;
    }
    return false;
  }

  // 인증 URL 생성
  getAuthUrl() {
    if (!this.oauth2Client) {
      this.initOAuth2Client();
    }

    // client_id 확인
    if (!this.clientId) {
      console.error('ERROR: client_id is missing!');
      throw new Error('client_id가 설정되지 않았습니다. .env 파일을 확인해주세요.');
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      prompt: 'consent'
    });
  }

  // 인증 플로우 시작
  async authenticate(parentWindow) {
    return new Promise((resolve, reject) => {
      console.log('authenticate 메소드 호출됨');
      console.log('Client ID:', this.clientId);
      console.log('Client Secret:', this.clientSecret ? '있음' : '없음');

      const authUrl = this.getAuthUrl();
      console.log('인증 URL:', authUrl);

      // 인증 창 열기
      const authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        parent: parentWindow,
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      authWindow.loadURL(authUrl);

      // 리다이렉트 감지
      authWindow.webContents.on('will-redirect', async (event, url) => {
        if (url.startsWith(this.redirectUri)) {
          event.preventDefault();

          // 인증 코드 추출
          const urlParams = new URL(url).searchParams;
          const code = urlParams.get('code');

          if (code) {
            try {
              // 토큰 교환
              const { tokens } = await this.oauth2Client.getToken(code);
              this.oauth2Client.setCredentials(tokens);

              // 토큰 저장
              this.store.set('googleTokens', tokens);

              // Drive API 초기화
              this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

              authWindow.close();
              resolve(true);
            } catch (error) {
              authWindow.close();
              reject(error);
            }
          } else {
            authWindow.close();
            reject(new Error('인증 코드를 받지 못했습니다'));
          }
        }
      });

      authWindow.on('closed', () => {
        reject(new Error('인증 창이 닫혔습니다'));
      });
    });
  }

  // 로그아웃
  logout() {
    this.store.delete('googleTokens');
    this.oauth2Client = null;
    this.drive = null;
  }

  // 인증 상태 확인
  isAuthenticated() {
    return this.store.has('googleTokens');
  }

  // RND-Form 폴더 생성 또는 찾기
  async getOrCreateAppFolder() {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      // 공유 드라이브 ID가 없으면 먼저 찾기
      if (!this.sharedDriveId) {
        await this.findSharedDrive();
      }

      // 공유 드라이브가 설정된 경우 공유 드라이브에서만 검색
      if (this.sharedDriveId) {
        const response = await this.drive.files.list({
          q: "name='RND-Form' and mimeType='application/vnd.google-apps.folder' and trashed=false",
          fields: 'files(id, name)',
          driveId: this.sharedDriveId,
          corpora: 'drive',
          includeItemsFromAllDrives: true,
          supportsAllDrives: true
        });

        if (response.data.files.length > 0) {
          return response.data.files[0].id;
        }

        // 공유 드라이브에 폴더가 없으면 생성
        const createResponse = await this.drive.files.create({
          resource: {
            name: 'RND-Form',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [this.sharedDriveId]
          },
          fields: 'id',
          supportsAllDrives: true
        });

        return createResponse.data.id;
      }

      // 공유 드라이브를 찾을 수 없으면 개인 드라이브 사용
      console.log('공유 드라이브를 찾을 수 없어 개인 드라이브를 사용합니다');
      const response = await this.drive.files.list({
        q: "name='RND-Form' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      const createResponse = await this.drive.files.create({
        resource: {
          name: 'RND-Form',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });

      return createResponse.data.id;
    } catch (error) {
      console.error('폴더 생성/검색 오류:', error);
      throw error;
    }
  }

  // 데이터베이스 동기화
  async syncDatabase(localData) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const folderId = await this.getOrCreateAppFolder();
      const fileName = 'database.json';

      // 기존 파일 검색 (공유 드라이브 우선)
      const sharedDriveOptions = this.getSharedDriveOptions();
      const searchResponse = await this.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, modifiedTime)',
        ...sharedDriveOptions
      });

      const fileContent = JSON.stringify(localData, null, 2);
      const media = {
        mimeType: 'application/json',
        body: fileContent
      };

      if (searchResponse.data.files.length > 0) {
        // 기존 파일 업데이트
        const fileId = searchResponse.data.files[0].id;
        const writeOptions = this.getSharedDriveWriteOptions();
        await this.drive.files.update({
          fileId: fileId,
          media: media,
          ...writeOptions
        });
        console.log('데이터베이스 업데이트 완료');
      } else {
        // 새 파일 생성
        const writeOptions = this.getSharedDriveWriteOptions();
        await this.drive.files.create({
          resource: {
            name: fileName,
            parents: [folderId]
          },
          media: media,
          fields: 'id',
          ...writeOptions
        });
        console.log('데이터베이스 생성 완료');
      }

      return true;
    } catch (error) {
      console.error('동기화 오류:', error);
      throw error;
    }
  }

  // 데이터베이스 다운로드
  async downloadDatabase() {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const folderId = await this.getOrCreateAppFolder();
      const fileName = 'database.json';

      // 파일 검색 (공유 드라이브 우선)
      const sharedDriveOptions = this.getSharedDriveOptions();
      const searchResponse = await this.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)',
        ...sharedDriveOptions
      });

      if (searchResponse.data.files.length === 0) {
        return null; // 클라우드에 파일이 없음
      }

      const fileId = searchResponse.data.files[0].id;

      // 파일 다운로드
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });

      return response.data;
    } catch (error) {
      console.error('다운로드 오류:', error);
      throw error;
    }
  }

  // 충돌 해결 (최신 버전 기준)
  async resolveConflict(localData, cloudData) {
    // 간단한 충돌 해결: 타임스탬프 기준
    // 실제로는 더 복잡한 병합 로직이 필요할 수 있음
    const localTimestamp = localData.lastModified || 0;
    const cloudTimestamp = cloudData.lastModified || 0;

    if (localTimestamp > cloudTimestamp) {
      console.log('로컬 데이터가 더 최신입니다');
      return localData;
    } else {
      console.log('클라우드 데이터가 더 최신입니다');
      return cloudData;
    }
  }

  // 자동 동기화 시작 (일시적으로 비활성화)
  startAutoSync(interval = 60000) { // 1분마다
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // 임시로 자동 동기화 비활성화 - 무한 루프 문제 해결 중
    console.log('자동 동기화는 현재 비활성화되어 있습니다 (무한 루프 방지)');
    return;

    this.syncInterval = setInterval(async () => {
      if (this.isAuthenticated()) {
        try {
          // 여기서 실제 동기화 로직 호출
          console.log('자동 동기화 실행...');
          // await this.syncDatabase(localData);
        } catch (error) {
          console.error('자동 동기화 실패:', error);
        }
      }
    }, interval);
  }

  // 자동 동기화 중지
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ========== 양식별 폴더 관리 메서드 추가 ==========

  // RND-Form 루트 폴더 아래의 모든 폴더 목록 가져오기
  async listFormFolders() {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const rootFolderId = await this.getOrCreateAppFolder();

      // 루트 폴더 아래의 모든 폴더 검색
      const response = await this.drive.files.list({
        q: `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, createdTime, modifiedTime)',
        orderBy: 'name',
        spaces: 'drive'
      });

      return response.data.files;
    } catch (error) {
      console.error('폴더 목록 가져오기 실패:', error);
      throw error;
    }
  }

  // 특정 폴더 내의 파일 검색
  async findFileInFolder(folderId, fileName) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const response = await this.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        spaces: 'drive'
      });

      return response.data.files.length > 0 ? response.data.files[0] : null;
    } catch (error) {
      console.error(`파일 검색 실패 (${fileName}):`, error);
      throw error;
    }
  }

  // 파일 다운로드 (내용 가져오기)
  async downloadFileContent(fileId) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });

      return response.data;
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      throw error;
    }
  }

  // 양식별 폴더 확인 및 생성
  async getOrCreateFormFolder(formType) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    // 캐시된 폴더 ID가 있으면 반환
    if (this.folderIds[formType]) {
      return this.folderIds[formType];
    }

    try {
      // 루트 폴더 확인
      const rootFolderId = await this.getOrCreateAppFolder();

      // 양식 폴더명
      const folderName = this.folderStructure.forms[formType] || formType;

      // 양식 폴더 검색
      const searchOptions = {
        q: `name='${folderName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      };

      // 공유드라이브 옵션 추가
      if (this.sharedDriveId) {
        searchOptions.driveId = this.sharedDriveId;
        searchOptions.corpora = 'drive';
        searchOptions.includeItemsFromAllDrives = true;
        searchOptions.supportsAllDrives = true;
      } else {
        searchOptions.spaces = 'drive';
      }

      const response = await this.drive.files.list(searchOptions);

      if (response.data.files.length > 0) {
        this.folderIds[formType] = response.data.files[0].id;
        return response.data.files[0].id;
      }

      // 폴더가 없으면 생성
      const createOptions = {
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId]
        },
        fields: 'id'
      };

      // 공유드라이브 옵션 추가
      if (this.sharedDriveId) {
        createOptions.supportsAllDrives = true;
      }

      const createResponse = await this.drive.files.create(createOptions);

      this.folderIds[formType] = createResponse.data.id;
      return createResponse.data.id;
    } catch (error) {
      console.error(`양식 폴더 생성/검색 오류 (${formType}):`, error);
      throw error;
    }
  }

  // 양식별 문서 저장
  async saveFormDocument(formType, document) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const folderId = await this.getOrCreateFormFolder(formType);
      const fileName = `${document.id}.json`;

      // 기존 파일 검색
      const searchOptions = {
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)'
      };

      // 공유드라이브 옵션 추가
      if (this.sharedDriveId) {
        searchOptions.driveId = this.sharedDriveId;
        searchOptions.corpora = 'drive';
        searchOptions.includeItemsFromAllDrives = true;
        searchOptions.supportsAllDrives = true;
      } else {
        searchOptions.spaces = 'drive';
      }

      const searchResponse = await this.drive.files.list(searchOptions);

      const fileContent = JSON.stringify(document, null, 2);
      const media = {
        mimeType: 'application/json',
        body: fileContent
      };

      if (searchResponse.data.files.length > 0) {
        // 기존 파일 업데이트
        const fileId = searchResponse.data.files[0].id;
        const updateOptions = {
          fileId: fileId,
          media: media
        };

        // 공유드라이브 옵션 추가
        if (this.sharedDriveId) {
          updateOptions.supportsAllDrives = true;
        }

        await this.drive.files.update(updateOptions);
        console.log(`문서 업데이트: ${formType}/${fileName}`);
      } else {
        // 새 파일 생성
        const createFileOptions = {
          resource: {
            name: fileName,
            parents: [folderId]
          },
          media: media,
          fields: 'id'
        };

        // 공유드라이브 옵션 추가
        if (this.sharedDriveId) {
          createFileOptions.supportsAllDrives = true;
        }

        await this.drive.files.create(createFileOptions);
        console.log(`문서 생성: ${formType}/${fileName}`);
      }

      return { success: true, documentId: document.id };
    } catch (error) {
      console.error('문서 저장 오류:', error);
      throw error;
    }
  }

  // 양식별 문서 목록 조회
  async listFormDocuments(formType) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const folderId = await this.getOrCreateFormFolder(formType);

      // 해당 폴더의 모든 JSON 파일 조회
      const listOptions = {
        q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc'
      };

      // 공유드라이브 옵션 추가
      if (this.sharedDriveId) {
        listOptions.driveId = this.sharedDriveId;
        listOptions.corpora = 'drive';
        listOptions.includeItemsFromAllDrives = true;
        listOptions.supportsAllDrives = true;
      } else {
        listOptions.spaces = 'drive';
      }

      const response = await this.drive.files.list(listOptions);

      const documents = [];

      // 각 파일의 내용 읽기
      for (const file of response.data.files) {
        try {
          const getOptions = {
            fileId: file.id,
            alt: 'media'
          };

          // 공유드라이브 옵션 추가
          if (this.sharedDriveId) {
            getOptions.supportsAllDrives = true;
          }

          const content = await this.drive.files.get(getOptions);

          const document = content.data;
          document.cloudFileId = file.id;
          document.cloudModifiedTime = file.modifiedTime;
          documents.push(document);
        } catch (error) {
          console.error(`문서 읽기 실패 (${file.name}):`, error);
        }
      }

      return documents;
    } catch (error) {
      console.error('문서 목록 조회 오류:', error);
      throw error;
    }
  }

  // 양식별 문서 삭제
  async deleteFormDocument(formType, documentId) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const folderId = await this.getOrCreateFormFolder(formType);
      const fileName = `${documentId}.json`;

      console.log(`[삭제 시도] formType: ${formType}, documentId: ${documentId}, fileName: ${fileName}`);
      console.log(`[삭제 시도] folderId: ${folderId}, sharedDriveId: ${this.sharedDriveId}`);

      // 파일 검색
      const searchOptions = {
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)'
      };

      // 공유드라이브 옵션 추가
      if (this.sharedDriveId) {
        searchOptions.driveId = this.sharedDriveId;
        searchOptions.corpora = 'drive';
        searchOptions.includeItemsFromAllDrives = true;
        searchOptions.supportsAllDrives = true;
        console.log('[삭제 시도] 공유드라이브 모드 활성화');
      } else {
        searchOptions.spaces = 'drive';
        console.log('[삭제 시도] 개인 드라이브 모드');
      }

      console.log('[삭제 시도] 검색 옵션:', JSON.stringify(searchOptions, null, 2));
      const searchResponse = await this.drive.files.list(searchOptions);
      console.log(`[삭제 시도] 검색 결과: ${searchResponse.data.files.length}개 파일 발견`);

      if (searchResponse.data.files.length > 0) {
        const fileId = searchResponse.data.files[0].id;

        // 파일 삭제 옵션
        const deleteOptions = {
          fileId: fileId
        };

        // 공유드라이브 옵션 추가
        if (this.sharedDriveId) {
          deleteOptions.supportsAllDrives = true;
        }

        // 파일 삭제 (휴지통으로)
        await this.drive.files.delete(deleteOptions);

        console.log(`문서 삭제: ${formType}/${fileName}`);
        return { success: true, documentId };
      } else {
        const debugInfo = {
          fileName,
          folderId,
          sharedDriveId: this.sharedDriveId,
          searchQuery: searchOptions.q,
          mode: this.sharedDriveId ? '공유드라이브' : '개인드라이브'
        };
        console.log('[삭제 실패] 디버그 정보:', debugInfo);
        return {
          success: false,
          error: '문서를 찾을 수 없습니다',
          debug: debugInfo
        };
      }
    } catch (error) {
      console.error('문서 삭제 오류:', error);
      throw error;
    }
  }

  // 특정 문서 가져오기
  async getFormDocument(formType, documentId) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const folderId = await this.getOrCreateFormFolder(formType);
      const fileName = `${documentId}.json`;

      // 파일 검색
      const searchOptions = {
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, modifiedTime)'
      };

      // 공유드라이브 옵션 추가
      if (this.sharedDriveId) {
        searchOptions.driveId = this.sharedDriveId;
        searchOptions.corpora = 'drive';
        searchOptions.includeItemsFromAllDrives = true;
        searchOptions.supportsAllDrives = true;
      } else {
        searchOptions.spaces = 'drive';
      }

      const searchResponse = await this.drive.files.list(searchOptions);

      if (searchResponse.data.files.length === 0) {
        return null;
      }

      const fileId = searchResponse.data.files[0].id;

      // 파일 내용 가져오기 옵션
      const getOptions = {
        fileId: fileId,
        alt: 'media'
      };

      // 공유드라이브 옵션 추가
      if (this.sharedDriveId) {
        getOptions.supportsAllDrives = true;
      }

      const response = await this.drive.files.get(getOptions);

      const document = response.data;
      document.cloudFileId = fileId;
      document.cloudModifiedTime = searchResponse.data.files[0].modifiedTime;

      return document;
    } catch (error) {
      console.error('문서 가져오기 오류:', error);
      throw error;
    }
  }

  // ========== 첨부파일 관리 메서드 추가 ==========

  // 문서별 첨부파일 폴더 생성/확인
  async getOrCreateDocumentFolder(documentId) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const rootFolderId = await this.getOrCreateAppFolder();
      const attachmentsFolderName = 'attachments';

      // attachments 폴더 확인/생성
      let attachmentsFolderId = this.folderIds['attachments'];
      if (!attachmentsFolderId) {
        const response = await this.drive.files.list({
          q: `name='${attachmentsFolderName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
          spaces: 'drive'
        });

        if (response.data.files.length > 0) {
          attachmentsFolderId = response.data.files[0].id;
        } else {
          const createResponse = await this.drive.files.create({
            resource: {
              name: attachmentsFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [rootFolderId]
            },
            fields: 'id'
          });
          attachmentsFolderId = createResponse.data.id;
        }
        this.folderIds['attachments'] = attachmentsFolderId;
      }

      // 문서별 폴더 확인/생성
      const docFolderName = documentId;
      const response = await this.drive.files.list({
        q: `name='${docFolderName}' and '${attachmentsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      });

      if (response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      const createResponse = await this.drive.files.create({
        resource: {
          name: docFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [attachmentsFolderId]
        },
        fields: 'id'
      });

      return createResponse.data.id;
    } catch (error) {
      console.error('문서 폴더 생성/검색 오류:', error);
      throw error;
    }
  }

  // 첨부파일 업로드
  async uploadAttachment(documentId, fileBuffer, fileName, mimeType) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const folderId = await this.getOrCreateDocumentFolder(documentId);

      const media = {
        mimeType: mimeType,
        body: fileBuffer
      };

      const response = await this.drive.files.create({
        resource: {
          name: fileName,
          parents: [folderId]
        },
        media: media,
        fields: 'id, name, size, mimeType, webViewLink, webContentLink'
      });

      return {
        success: true,
        driveFileId: response.data.id,
        name: response.data.name,
        size: response.data.size,
        mimeType: response.data.mimeType,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink
      };
    } catch (error) {
      console.error('첨부파일 업로드 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 첨부파일 다운로드
  async downloadAttachment(fileId) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });

      return {
        success: true,
        data: Buffer.from(response.data)
      };
    } catch (error) {
      console.error('첨부파일 다운로드 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 첨부파일 삭제
  async deleteAttachment(fileId) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      await this.drive.files.delete({
        fileId: fileId
      });

      return { success: true };
    } catch (error) {
      console.error('첨부파일 삭제 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 문서의 모든 첨부파일 삭제
  async deleteDocumentAttachments(documentId) {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      const folderId = await this.getOrCreateDocumentFolder(documentId);

      // 폴더 자체를 삭제 (하위 파일 모두 삭제됨)
      await this.drive.files.delete({
        fileId: folderId
      });

      return { success: true };
    } catch (error) {
      console.error('문서 첨부파일 삭제 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 일반 파일 업로드 메서드
  async uploadFile(folderId, fileName, content, mimeType = 'application/json') {
    if (!this.drive) {
      throw new Error('구글드라이브에 연결되지 않았습니다');
    }

    try {
      // 기존 파일 검색
      const searchResponse = await this.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      });

      let fileId;

      if (searchResponse.data.files.length > 0) {
        // 기존 파일 업데이트
        fileId = searchResponse.data.files[0].id;
        await this.drive.files.update({
          fileId: fileId,
          media: {
            mimeType: mimeType,
            body: content
          },
          fields: 'id'
        });
      } else {
        // 새 파일 생성
        const response = await this.drive.files.create({
          resource: {
            name: fileName,
            parents: [folderId]
          },
          media: {
            mimeType: mimeType,
            body: content
          },
          fields: 'id'
        });
        fileId = response.data.id;
      }

      return fileId;
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      throw error;
    }
  }
}

module.exports = GoogleDriveService;