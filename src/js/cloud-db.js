// 클라우드 우선 데이터베이스 관리
export class CloudDB {
  constructor() {
    this.cache = new Map(); // 메모리 캐시
    this.isOnline = navigator.onLine;
    this.pendingChanges = []; // 오프라인 시 대기 중인 변경사항

    // 온라인/오프라인 감지
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async init() {
    console.log('CloudDB 초기화 중...');

    // 구글드라이브 연결 확인
    if (window.electronAPI) {
      const authCheck = await window.electronAPI.googleDriveSync('check-auth');
      if (authCheck.success && authCheck.authenticated) {
        // 클라우드에서 데이터 로드
        await this.loadFromCloud();
      } else {
        console.log('구글드라이브 미연결 - 로컬 모드로 작동');
        // 로컬 모드: 메모리에서만 작동
        this.loadFromLocalStorage();
      }
    } else {
      // 웹 버전: localStorage 사용
      this.loadFromLocalStorage();
    }
  }

  // 클라우드에서 데이터 로드
  async loadFromCloud() {
    try {
      const result = await window.electronAPI.googleDriveSync('sync-download');
      if (result.success && result.data) {
        // 캐시에 저장
        if (result.data.documents) {
          result.data.documents.forEach(doc => {
            this.cache.set(doc.id, doc);
          });
        }
        console.log('클라우드에서 데이터 로드 완료');
        return true;
      }
    } catch (error) {
      console.error('클라우드 로드 실패:', error);
    }
    return false;
  }

  // localStorage에서 임시 데이터 로드 (오프라인 백업)
  loadFromLocalStorage() {
    const tempData = localStorage.getItem('rnd-form-temp');
    if (tempData) {
      try {
        const documents = JSON.parse(tempData);
        documents.forEach(doc => {
          this.cache.set(doc.id, doc);
        });
        console.log('임시 데이터 로드');
      } catch (error) {
        console.error('임시 데이터 로드 실패:', error);
      }
    }
  }

  // 클라우드에 저장
  async saveToCloud() {
    if (!window.electronAPI) return false;

    try {
      const documents = Array.from(this.cache.values());
      const result = await window.electronAPI.googleDriveSync('sync-upload', {
        documents,
        lastModified: Date.now()
      });

      if (result.success) {
        console.log('클라우드 저장 완료');
        // 저장 성공 시 임시 데이터 삭제
        localStorage.removeItem('rnd-form-temp');
        return true;
      }
    } catch (error) {
      console.error('클라우드 저장 실패:', error);
      // 실패 시 로컬에 임시 저장
      this.saveToLocalStorage();
    }
    return false;
  }

  // localStorage에 임시 저장 (오프라인 백업)
  saveToLocalStorage() {
    const documents = Array.from(this.cache.values());
    localStorage.setItem('rnd-form-temp', JSON.stringify(documents));
    console.log('임시 데이터 저장 (오프라인)');
  }

  // 문서 저장
  async saveDocument(doc) {
    // 캐시에 저장
    this.cache.set(doc.id, doc);

    if (this.isOnline && window.electronAPI) {
      // 온라인이면 즉시 클라우드 저장
      await this.saveToCloud();
    } else {
      // 오프라인이면 대기 목록에 추가
      this.pendingChanges.push({ type: 'save', doc });
      this.saveToLocalStorage();
    }
  }

  // 문서 업데이트
  async updateDocument(doc) {
    return this.saveDocument(doc);
  }

  // 문서 조회
  async getDocument(id) {
    return this.cache.get(id);
  }

  // 모든 문서 조회
  async getAllDocuments() {
    return Array.from(this.cache.values());
  }

  // 문서 삭제
  async deleteDocument(id) {
    this.cache.delete(id);

    if (this.isOnline && window.electronAPI) {
      await this.saveToCloud();
    } else {
      this.pendingChanges.push({ type: 'delete', id });
      this.saveToLocalStorage();
    }
  }

  // 온라인 복귀 시
  async handleOnline() {
    console.log('온라인 복귀 - 동기화 시작');
    this.isOnline = true;

    // 대기 중인 변경사항 처리
    if (this.pendingChanges.length > 0 && window.electronAPI) {
      await this.saveToCloud();
      this.pendingChanges = [];
    }

    // 클라우드에서 최신 데이터 가져오기
    await this.loadFromCloud();
  }

  // 오프라인 전환 시
  handleOffline() {
    console.log('오프라인 모드 전환');
    this.isOnline = false;
    this.saveToLocalStorage();
  }

  // 실시간 동기화 시작
  startRealtimeSync(interval = 30000) { // 30초마다
    if (!window.electronAPI) return;

    setInterval(async () => {
      if (this.isOnline) {
        console.log('자동 동기화 실행');
        await this.saveToCloud();
        await this.loadFromCloud();
      }
    }, interval);
  }

  // 충돌 해결 (서버 우선)
  async resolveConflicts() {
    // 클라우드 데이터를 마스터로 사용
    const cloudLoaded = await this.loadFromCloud();
    if (cloudLoaded) {
      console.log('클라우드 데이터로 덮어쓰기 완료');
      localStorage.removeItem('rnd-form-temp');
    }
  }
}