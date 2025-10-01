// 이중 저장 체계 관리자
// 로컬(자동) + 클라우드(수동) 분리 운영

export class StorageManager {
  constructor() {
    this.formStorage = null; // FormStorageService 인스턴스
    this.localDB = null; // 호환성을 위한 alias
    this.isOnline = navigator.onLine;
    this.autoSaveInterval = null;
    this.currentFormType = 'none'; // 현재 선택된 양식 (기본값: 대기 상태)
    this.syncStatus = {
      local: 'idle', // idle, saving, saved, error
      cloud: 'idle', // idle, syncing, synced, error
      lastLocalSave: null,
      lastCloudSync: null
    };

    // 온라인/오프라인 이벤트
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  // 초기화
  async init(formStorage) {
    this.formStorage = formStorage;
    this.localDB = formStorage; // 호환성을 위한 alias
    await this.loadFormType();
    await this.startAutoSave();

    // 초기 동기화 제거 - 양식 선택 시점에 동기화
    // 캐시에 이미 데이터가 있으므로 사용자는 지연을 느끼지 않음
    // if (window.electronAPI) {
    //   await this.pullFromCloud();
    // }

    console.log('StorageManager 초기화 완료');
  }

  // ============= 로컬 저장 (자동) =============

  // 로컬 자동저장 시작
  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    // 자동저장 제거 - 수동 저장만 사용
    // this.autoSaveInterval = setInterval(() => {
    //   this.saveToLocal();
    // }, 3000);
  }

  // 로컬 저장 (자동)
  async saveToLocal(doc = null) {
    try {
      this.syncStatus.local = 'saving';

      if (doc) {
        // 특정 문서 저장 (Workspace에)
        await this.formStorage.saveToWorkspace(this.currentFormType, doc);
      } else {
        // 현재 작업 중인 문서 자동저장
        const activeDoc = this.getActiveDocument();
        if (activeDoc && activeDoc.isDirty) {
          await this.formStorage.saveToWorkspace(this.currentFormType, activeDoc);
          activeDoc.isDirty = false;
        }
      }

      this.syncStatus.local = 'saved';
      this.syncStatus.lastLocalSave = new Date().toISOString();

      // UI 업데이트
      this.updateSyncStatus();

      return { success: true };
    } catch (error) {
      console.error('로컬 저장 실패:', error);
      this.syncStatus.local = 'error';
      return { success: false, error };
    }
  }

  // 로컬에서 문서 로드
  async loadFromLocal(docId) {
    try {
      // Workspace에서 먼저 찾고, 없으면 Cache에서 찾기
      let doc = await this.formStorage.getFromWorkspace(this.currentFormType, docId);
      if (!doc) {
        doc = await this.formStorage.getFromCache(this.currentFormType, docId);
      }
      return doc;
    } catch (error) {
      console.error('로컬 로드 실패:', error);
      return null;
    }
  }

  // 양식별 로컬 문서 목록
  async getLocalDocuments() {
    try {
      // Workspace와 Cache의 모든 문서 가져오기
      const workspaceDocs = await this.formStorage.getWorkspaceDocuments(this.currentFormType);
      const cacheDocs = await this.formStorage.getCacheDocuments(this.currentFormType);

      // 병합 (Workspace 우선)
      const docMap = new Map();
      cacheDocs.forEach(doc => docMap.set(doc.id, doc));
      workspaceDocs.forEach(doc => docMap.set(doc.id, doc));

      return Array.from(docMap.values());
    } catch (error) {
      console.error('로컬 문서 목록 조회 실패:', error);
      return [];
    }
  }

  // 로컬 문서 삭제
  async deleteFromLocal(docId) {
    try {
      // Workspace에서 삭제
      await this.formStorage.deleteFromWorkspace(this.currentFormType, docId);
      console.log('로컬 문서 삭제:', docId);
      return { success: true };
    } catch (error) {
      console.error('로컬 삭제 실패:', error);
      return { success: false, error };
    }
  }

  // ============= 클라우드 저장 (수동) =============

  // 클라우드 저장 (수동 - 확인 필요)
  async saveToCloud(doc, formType = null) {
    if (!window.electronAPI) {
      return { success: false, error: '클라우드 저장은 데스크톱 앱에서만 가능합니다.' };
    }

    try {
      this.syncStatus.cloud = 'syncing';

      // 문서 객체를 순수 객체로 변환
      const plainDoc = JSON.parse(JSON.stringify(doc));
      console.log('클라우드 저장할 문서:', plainDoc);

      // 구글드라이브 인증 확인
      const authCheck = await window.electronAPI.googleDriveSync('check-auth');
      if (!authCheck.success || !authCheck.authenticated) {
        this.syncStatus.cloud = 'error';
        return { success: false, error: '구글드라이브 로그인이 필요합니다.' };
      }

      // 양식별 폴더에 저장 (객체를 JSON으로 직렬화)
      const saveData = {
        formType: formType || this.currentFormType,  // 전달된 formType 우선 사용
        document: plainDoc  // 이미 변환된 순수 객체 사용
      };

      console.log('IPC로 전달할 데이터:', saveData);

      const result = await window.electronAPI.googleDriveSync('save-document', saveData);

      if (result.success) {
        this.syncStatus.cloud = 'synced';
        this.syncStatus.lastCloudSync = new Date().toISOString();

        // 클라우드 저장 후 Cache로 이동
        doc.cloudSynced = true;
        doc.cloudSyncedAt = this.syncStatus.lastCloudSync;

        // FormStorageService의 moveToCache 사용 (전달받은 formType 사용)
        const actualFormType = formType || this.currentFormType;
        if (this.formStorage && this.formStorage.moveToCache) {
          await this.formStorage.moveToCache(actualFormType, doc.id);
          console.log('문서가 Cache로 이동됨:', doc.id);
        } else {
          console.error('FormStorageService.moveToCache 메서드를 찾을 수 없음');
          // fallback 제거 - Workspace에 다시 저장하지 않음
        }

        console.log('클라우드 저장 완료:', doc.id);
      } else {
        this.syncStatus.cloud = 'error';
      }

      this.updateSyncStatus();
      return result;
    } catch (error) {
      console.error('클라우드 저장 실패:', error);
      this.syncStatus.cloud = 'error';
      return { success: false, error };
    }
  }

  // 클라우드에서 가져오기 (Pull)
  async pullFromCloud() {
    if (!window.electronAPI) {
      return { success: false, error: '클라우드 기능은 데스크톱 앱에서만 사용 가능' };
    }

    // 이미 동기화 중인지 확인
    if (this.syncStatus.cloud === 'syncing') {
      return { success: false, error: '이미 동기화가 진행 중입니다' };
    }

    try {
      this.syncStatus.cloud = 'syncing';
      console.log('클라우드에서 데이터 가져오기...');

      // 구글드라이브 인증 확인
      const authCheck = await window.electronAPI.googleDriveSync('check-auth');
      if (!authCheck.success || !authCheck.authenticated) {
        console.log('구글드라이브 미연결');
        this.syncStatus.cloud = 'error';
        return { success: false, error: 'Not authenticated' };
      }

      // 양식별 문서 목록 가져오기
      const result = await window.electronAPI.googleDriveSync('list-documents', {
        formType: this.currentFormType
      });

      if (result.success && result.documents) {
        // 로컬과 병합 (충돌 해결 포함)
        await this.mergeWithLocal(result.documents);
        console.log('클라우드 동기화 완료');
        this.syncStatus.cloud = 'synced';
        this.syncStatus.lastCloudSync = new Date().toISOString();
        return { success: true, count: result.documents.length };
      }

      this.syncStatus.cloud = 'error';
      return result;
    } catch (error) {
      console.error('클라우드 Pull 실패:', error);
      this.syncStatus.cloud = 'error';
      return { success: false, error };
    }
  }

  // 클라우드에서 문서 삭제
  async deleteFromCloud(docId) {
    if (!window.electronAPI) {
      return { success: false, error: '클라우드 기능은 데스크톱 앱에서만 사용 가능' };
    }

    try {
      const result = await window.electronAPI.googleDriveSync('delete-document', {
        formType: this.currentFormType,
        documentId: docId
      });

      if (result.success) {
        console.log('클라우드 문서 삭제:', docId);

        // 로컬 문서도 클라우드 동기화 상태 업데이트
        const localDoc = await this.loadFromLocal(docId);
        if (localDoc) {
          localDoc.cloudSynced = false;
          localDoc.cloudDeleted = true;
          await this.saveToLocal(localDoc);
        }
      }

      return result;
    } catch (error) {
      console.error('클라우드 삭제 실패:', error);
      return { success: false, error };
    }
  }

  // ============= 양식 관리 =============

  // 양식 타입 변경
  async switchFormType(formType) {
    // 현재 작업 저장
    await this.saveToLocal();

    // 진행 중인 동기화가 있으면 취소 (양식 전환이 우선)
    if (this.syncStatus.cloud === 'syncing') {
      console.log('양식 전환으로 인한 동기화 재시작');
      this.syncStatus.cloud = 'idle';
    }

    // 양식 타입 변경
    this.currentFormType = formType;
    localStorage.setItem('currentFormType', formType);

    // 새 양식의 문서 목록 로드
    await this.pullFromCloud();

    console.log('양식 전환:', formType);

    // UI 업데이트를 위한 이벤트 발생
    window.dispatchEvent(new CustomEvent('formTypeChanged', {
      detail: { formType }
    }));
  }

  // 현재 양식 타입 로드
  async loadFormType() {
    const saved = localStorage.getItem('currentFormType');
    if (saved) {
      this.currentFormType = saved;
    }
    return this.currentFormType;
  }

  // 사용 가능한 양식 목록
  getAvailableFormTypes() {
    return [
      { id: 'expense-report', name: '지출결의서', icon: '💰' },
      { id: 'coming-soon-1', name: '양식 (준비중)', icon: '🚧' },
      { id: 'coming-soon-2', name: '양식 (준비중)', icon: '🚧' }
    ];
  }

  // ============= 동기화 및 충돌 해결 =============

  // 로컬과 클라우드 데이터 병합
  async mergeWithLocal(cloudDocuments) {
    // FormStorageService의 refreshCache 메서드를 사용하여 Cache 전체 새로고침
    if (this.formStorage && this.formStorage.refreshCache) {
      try {
        // 클라우드 문서에 동기화 시간 추가
        const documentsWithSyncTime = cloudDocuments.map(doc => ({
          ...doc,
          cloudSyncedAt: new Date().toISOString(),
          isReadOnly: true,
          isFromCache: true
        }));

        // Cache 스토어 전체 새로고침
        const result = await this.formStorage.refreshCache(this.currentFormType, documentsWithSyncTime);
        console.log(`Cache 동기화 완료: ${documentsWithSyncTime.length}개 문서`);
        return result;
      } catch (error) {
        console.error('Cache 새로고침 실패:', error);

        // Fallback: 개별 저장
        for (const cloudDoc of cloudDocuments) {
          try {
            cloudDoc.cloudSyncedAt = new Date().toISOString();
            cloudDoc.isReadOnly = true;
            cloudDoc.isFromCache = true;

            // Cache에 직접 저장 시도
            await this.formStorage.saveToCache(this.currentFormType, cloudDoc);
          } catch (err) {
            console.error(`문서 ${cloudDoc.id} Cache 저장 실패:`, err);
          }
        }
      }
    }
  }

  // 충돌 감지
  async detectConflicts(docId) {
    const localDoc = await this.loadFromLocal(docId);
    if (!localDoc || !window.electronAPI) return null;

    const cloudResult = await window.electronAPI.googleDriveSync('get-document', {
      formType: this.currentFormType,
      documentId: docId
    });

    if (!cloudResult.success || !cloudResult.document) return null;

    const cloudDoc = cloudResult.document;

    // 수정 시간 비교
    if (localDoc.lastModified !== cloudDoc.lastModified) {
      return {
        hasConflict: true,
        local: localDoc,
        cloud: cloudDoc,
        localNewer: localDoc.lastModified > cloudDoc.lastModified
      };
    }

    return { hasConflict: false };
  }

  // 충돌 해결
  async resolveConflict(docId, useLocal = true) {
    const conflict = await this.detectConflicts(docId);
    if (!conflict || !conflict.hasConflict) return;

    if (useLocal) {
      // 로컬 버전으로 클라우드 덮어쓰기
      await this.saveToCloud(conflict.local);
    } else {
      // 클라우드 버전으로 로컬 덮어쓰기
      await this.saveToLocal(conflict.cloud);
    }
  }

  // ============= 상태 관리 =============

  // 현재 작업 중인 문서 가져오기
  getActiveDocument() {
    // Alpine.js의 현재 편집 중인 문서 참조
    if (window.Alpine && window.Alpine.store('app')) {
      const app = window.Alpine.store('app');
      if (app.currentDocument && app.currentDocument.id) {
        return app.currentDocument;
      }
    }
    return null;
  }

  // 동기화 상태 UI 업데이트
  updateSyncStatus() {
    // Alpine.js 스토어 업데이트
    if (window.Alpine && window.Alpine.store('app')) {
      const app = window.Alpine.store('app');
      app.syncStatus = this.syncStatus;
    }

    // 커스텀 이벤트 발생
    window.dispatchEvent(new CustomEvent('syncStatusChanged', {
      detail: this.syncStatus
    }));
  }

  // 온라인 복귀
  handleOnline() {
    console.log('온라인 상태 복귀');
    this.isOnline = true;
    // 자동으로 클라우드에서 최신 데이터 가져오기
    this.pullFromCloud();
  }

  // 오프라인 전환
  handleOffline() {
    console.log('오프라인 모드');
    this.isOnline = false;
    this.syncStatus.cloud = 'offline';
    this.updateSyncStatus();
  }

  // 정리
  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

// 싱글톤 인스턴스
export const storageManager = new StorageManager();