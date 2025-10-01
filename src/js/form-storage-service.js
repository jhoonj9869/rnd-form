// 양식별 이중 저장소 관리 서비스
// Workspace (작업 공간) + Cache (읽기 전용 캐시)

export class FormStorageService {
  constructor() {
    this.db = null;
    this.dbName = 'RNDFormStorage';
    this.dbVersion = 3; // v3: 모든 양식 스토어 생성

    // 지원하는 양식 타입
    this.formTypes = [
      'expense-report',
      'purchase-order',
      'travel-report',
      'base-template'
    ];

    // 현재 선택된 양식 타입 (기본값을 'none'으로 변경)
    this.currentFormType = 'none';

    // 저장소 타입
    this.storageTypes = {
      WORKSPACE: 'workspace',
      CACHE: 'cache'
    };
  }

  // 데이터베이스 초기화
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB 열기 실패:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('FormStorageService 초기화 완료');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        console.log(`DB 업그레이드: v${oldVersion} → v${this.dbVersion}`);

        // 이중 저장소 구조 생성 (모든 버전에서 실행)
        this.migrateToV2(db, event.target.transaction);
      };
    });
  }

  // v2로 마이그레이션 (이중 저장소 구조)
  migrateToV2(db, transaction) {
    console.log('v2 마이그레이션 시작: 이중 저장소 구조');

    // 각 양식별로 workspace와 cache 저장소 생성
    this.formTypes.forEach(formType => {
      // Workspace 저장소 (작업 문서)
      const workspaceName = `${formType}_workspace`;
      if (!db.objectStoreNames.contains(workspaceName)) {
        const workspaceStore = db.createObjectStore(workspaceName, {
          keyPath: 'id',
          autoIncrement: false
        });

        // 인덱스 생성
        workspaceStore.createIndex('docNumber', 'docNumber', { unique: false });
        workspaceStore.createIndex('title', 'title', { unique: false });
        workspaceStore.createIndex('lastModified', 'lastModified', { unique: false });
        workspaceStore.createIndex('isDraft', 'isDraft', { unique: false });

        console.log(`✅ ${workspaceName} 저장소 생성`);
      }

      // Cache 저장소 (클라우드 문서 캐시)
      const cacheName = `${formType}_cache`;
      if (!db.objectStoreNames.contains(cacheName)) {
        const cacheStore = db.createObjectStore(cacheName, {
          keyPath: 'id',
          autoIncrement: false
        });

        // 인덱스 생성
        cacheStore.createIndex('docNumber', 'docNumber', { unique: false });
        cacheStore.createIndex('title', 'title', { unique: false });
        cacheStore.createIndex('cloudSyncedAt', 'cloudSyncedAt', { unique: false });
        cacheStore.createIndex('lastModified', 'lastModified', { unique: false });

        console.log(`✅ ${cacheName} 저장소 생성`);
      }
    });

    // 기존 documents 저장소가 있으면 데이터 마이그레이션
    if (db.objectStoreNames.contains('documents')) {
      const documentsStore = transaction.objectStore('documents');
      const getAllRequest = documentsStore.getAll();

      getAllRequest.onsuccess = () => {
        const oldDocs = getAllRequest.result;
        console.log(`기존 문서 ${oldDocs.length}개 마이그레이션`);

        oldDocs.forEach(doc => {
          const formType = doc.formType || 'expense-report';
          const targetStore = doc.cloudSynced
            ? `${formType}_cache`
            : `${formType}_workspace`;

          if (db.objectStoreNames.contains(targetStore)) {
            try {
              const store = transaction.objectStore(targetStore);
              const addRequest = store.add(doc);
              addRequest.onsuccess = () => {
                console.log(`문서 ${doc.id} → ${targetStore}`);
              };
              addRequest.onerror = () => {
                console.error(`마이그레이션 실패 ${doc.id}:`, addRequest.error);
              };
            } catch (e) {
              console.error(`마이그레이션 오류 ${doc.id}:`, e);
            }
          }
        });
      };

      getAllRequest.onerror = () => {
        console.error('기존 문서 읽기 실패:', getAllRequest.error);
        // 마이그레이션 실패해도 계속 진행 (새 설치일 수 있음)
      };

      // 마이그레이션 후 기존 저장소 삭제 (다음 버전에서)
      // db.deleteObjectStore('documents');
    }

    // 메타데이터 저장소
    if (!db.objectStoreNames.contains('metadata')) {
      const metaStore = db.createObjectStore('metadata', { keyPath: 'key' });
      metaStore.add({
        key: 'version',
        value: this.dbVersion,
        migrationDate: new Date().toISOString()
      });
    }
  }

  // ============= 양식 타입 관리 =============

  // 현재 양식 타입 설정
  setFormType(formType) {
    if (!this.formTypes.includes(formType)) {
      console.warn(`Unknown form type: ${formType}, using default`);
      this.currentFormType = 'none';
    } else {
      this.currentFormType = formType;
    }
    console.log(`Form type set to: ${this.currentFormType}`);
  }

  // 현재 양식 타입 가져오기
  getFormType() {
    return this.currentFormType || 'none';
  }

  // ============= Workspace 작업 =============

  // Workspace에 문서 저장 (단일 문서만 유지)
  async saveToWorkspace(formType, document) {
    // 'none' 타입은 저장하지 않고 성공 반환
    if (formType === 'none') {
      return { success: true, message: 'None type - no save needed' };
    }

    if (!this.db) await this.init();

    const storeName = `${formType}_workspace`;

    // 스토어가 없으면 에러
    if (!this.db.objectStoreNames.contains(storeName)) {
      console.error(`Workspace 스토어가 없음: ${storeName}`);
      throw new Error('Workspace store not found. Please refresh the page.');
    }

    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    // 메타데이터 추가
    document.storageType = this.storageTypes.WORKSPACE;
    document.lastModified = new Date().toISOString();
    document.isDraft = true;

    return new Promise((resolve, reject) => {
      // 먼저 기존 문서를 모두 삭제 (단일 문서 정책)
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        console.log(`${formType} Workspace 기존 문서 삭제됨`);

        // 새 문서 저장
        const request = store.put(document);

        request.onsuccess = () => {
          console.log(`Workspace 단일 문서 저장: ${formType}/${document.id}`);
          resolve({ success: true, id: request.result });
        };

        request.onerror = () => {
          console.error('Workspace 저장 실패:', request.error);
          reject(request.error);
        };
      };

      clearRequest.onerror = () => {
        console.error('Workspace 초기화 실패:', clearRequest.error);
        reject(clearRequest.error);
      };
    });
  }

  // Workspace에서 문서 조회
  async getFromWorkspace(formType, docId) {
    // 'none' 타입은 항상 null 반환 (가상 타입)
    if (formType === 'none') {
      return null;
    }

    if (!this.db) await this.init();

    const storeName = `${formType}_workspace`;
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(docId);

      request.onsuccess = () => {
        const doc = request.result;
        if (doc) {
          doc.isFromWorkspace = true;
        }
        resolve(doc);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Workspace 문서 목록 (단일 문서만 반환)
  async getWorkspaceDocuments(formType) {
    // 'none' 타입은 항상 빈 배열 반환 (가상 타입)
    if (formType === 'none') {
      return [];
    }

    if (!this.db) await this.init();

    const storeName = `${formType}_workspace`;

    // 스토어가 존재하는지 확인
    if (!this.db.objectStoreNames.contains(storeName)) {
      console.log(`Workspace 스토어가 아직 없음: ${storeName}`);
      return [];
    }

    try {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.getAll(); // 모든 문서 가져오기 (실제로는 1개만 있음)

        request.onsuccess = () => {
          const documents = request.result || [];

          // Workspace 문서는 항상 편집 가능
          documents.forEach(doc => {
            doc.isFromWorkspace = true;
            doc.isEditable = true;  // 편집 가능
            doc.isReadOnly = false;
          });

          // 단일 문서 정책이므로 최대 1개만 있어야 함
          if (documents.length > 1) {
            console.warn(`${formType} Workspace에 여러 문서 발견: ${documents.length}개`);
          }

          resolve(documents);
        };

        request.onerror = () => {
          console.error('Workspace 문서 로드 에러:', request.error);
          resolve([]); // 에러 시에도 빈 배열 반환
        };
      });
    } catch (error) {
      console.error('Workspace 트랜잭션 에러:', error);
      return [];
    }
  }

  // Workspace에서 문서 삭제
  async deleteFromWorkspace(formType, docId) {
    // 'none' 타입은 아무것도 하지 않고 성공 반환
    if (formType === 'none') {
      return true;
    }

    if (!this.db) await this.init();

    const storeName = `${formType}_workspace`;
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(docId);

      request.onsuccess = () => {
        console.log(`Workspace 삭제: ${formType}/${docId}`);
        resolve({ success: true });
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============= Cache 작업 =============

  // Cache에서 문서 삭제
  async deleteFromCache(formType, docId) {
    // 'none' 타입은 아무것도 하지 않고 성공 반환
    if (formType === 'none') {
      return true;
    }

    if (!this.db) await this.init();

    const storeName = `${formType}_cache`;
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(docId);

      request.onsuccess = () => {
        console.log(`Cache 삭제: ${formType}/${docId}`);
        resolve({ success: true });
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Cache에 문서 저장 (클라우드에서 가져온 문서)
  async saveToCache(formType, document) {
    // 'none' 타입은 저장하지 않고 성공 반환
    if (formType === 'none') {
      return { success: true, message: 'None type - no save needed' };
    }

    if (!this.db) await this.init();

    const storeName = `${formType}_cache`;
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    // 메타데이터 추가
    document.storageType = this.storageTypes.CACHE;
    document.cloudSyncedAt = new Date().toISOString(); // 인덱스와 일치하게 수정
    document.cachedAt = document.cloudSyncedAt; // 호환성 유지
    document.isReadOnly = true;

    return new Promise((resolve, reject) => {
      const request = store.put(document);

      request.onsuccess = () => {
        console.log(`Cache 저장: ${formType}/${document.id}`);
        resolve({ success: true, id: request.result });
      };

      request.onerror = () => {
        console.error('Cache 저장 실패:', request.error);
        reject(request.error);
      };
    });
  }

  // Cache에서 문서 조회
  async getFromCache(formType, docId) {
    // 'none' 타입은 항상 null 반환 (가상 타입)
    if (formType === 'none') {
      return null;
    }

    if (!this.db) await this.init();

    const storeName = `${formType}_cache`;
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(docId);

      request.onsuccess = () => {
        const doc = request.result;
        if (doc) {
          doc.isFromCache = true;
        }
        resolve(doc);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Cache 문서 목록
  async getCacheDocuments(formType) {
    // 'none' 타입은 항상 빈 배열 반환 (가상 타입)
    if (formType === 'none') {
      return [];
    }

    if (!this.db) await this.init();

    const storeName = `${formType}_cache`;

    // 스토어가 존재하는지 확인
    if (!this.db.objectStoreNames.contains(storeName)) {
      console.log(`Cache 스토어가 아직 없음: ${storeName}`);
      return [];
    }

    try {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      // 인덱스 존재 확인
      if (!store.indexNames.contains('cloudSyncedAt')) {
        console.warn(`cloudSyncedAt 인덱스가 없음: ${storeName}, 일반 커서 사용`);

        return new Promise((resolve, reject) => {
          const request = store.openCursor();
          const documents = [];

          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const doc = cursor.value;
              doc.isFromCache = true;
              doc.isEditable = false;
              doc.isReadOnly = true;
              documents.push(doc);
              cursor.continue();
            } else {
              // cloudSyncedAt 기준으로 정렬
              documents.sort((a, b) => new Date(b.cloudSyncedAt || 0) - new Date(a.cloudSyncedAt || 0));
              resolve(documents);
            }
          };

          request.onerror = () => {
            console.error(`Cache 문서 로드 실패 (일반): ${storeName}`, request.error);
            resolve([]);
          };
        });
      }

      const index = store.index('cloudSyncedAt');

      return new Promise((resolve, reject) => {
        const request = index.openCursor(null, 'prev'); // 최신 동기화순
        const documents = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const doc = cursor.value;
            doc.isFromCache = true;
            doc.isEditable = false;  // Cache 문서는 편집 불가
            doc.isReadOnly = true;   // 읽기 전용
            documents.push(doc);
            cursor.continue();
          } else {
            resolve(documents);
          }
        };

        request.onerror = () => {
          console.error(`Cache 문서 로드 에러 (인덱스): ${storeName}`, request.error);
          resolve([]); // 에러 시에도 빈 배열 반환
        };
      });
    } catch (error) {
      console.error(`Cache 트랜잭션 에러: ${storeName}`, error);
      return [];
    }
  }

  // Cache 전체 새로고침 (클라우드 동기화 시)
  async refreshCache(formType, cloudDocuments) {
    // 'none' 타입은 가상 타입이므로 항상 성공 반환
    if (formType === 'none') {
      return { success: true, count: 0, message: 'None type - virtual form' };
    }

    if (!this.db) await this.init();

    const storeName = `${formType}_cache`;

    // 스토어가 존재하는지 확인
    if (!this.db.objectStoreNames.contains(storeName)) {
      console.error(`Cache 스토어가 없음: ${storeName}. DB 업그레이드가 필요합니다.`);
      // 빈 배열로 성공 처리 (다음 새로고침 시 스토어 생성됨)
      return { success: true, count: 0, message: 'Store not found, refresh page' };
    }

    // 단일 트랜잭션으로 처리
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // 트랜잭션 완료 핸들러
      transaction.oncomplete = () => {
        console.log(`Cache 새로고침 완료: ${formType} (${cloudDocuments.length}개)`);
        resolve({ success: true, count: cloudDocuments.length });
      };

      transaction.onerror = () => {
        console.error('Cache 새로고침 실패:', transaction.error);
        reject(transaction.error);
      };

      // 기존 캐시 클리어
      store.clear();

      // 새 문서들 저장
      cloudDocuments.forEach(doc => {
        doc.storageType = this.storageTypes.CACHE;
        doc.cloudSyncedAt = new Date().toISOString();
        doc.cachedAt = doc.cloudSyncedAt;
        doc.isReadOnly = true;
        store.put(doc);
      });
    });
  }

  // ============= 통합 조회 =============

  // 문서 조회 (Workspace 우선, 없으면 Cache)
  async getDocument(formType, docId) {
    // 1. Workspace에서 먼저 찾기
    let doc = await this.getFromWorkspace(formType, docId);
    if (doc) {
      console.log(`문서 ${docId}: Workspace에서 로드`);
      return doc;
    }

    // 2. Cache에서 찾기
    doc = await this.getFromCache(formType, docId);
    if (doc) {
      console.log(`문서 ${docId}: Cache에서 로드`);
      return doc;
    }

    return null;
  }

  // 전체 문서 목록 (Workspace + Cache)
  async getAllDocuments(formType) {
    const workspaceDocs = await this.getWorkspaceDocuments(formType);
    const cacheDocs = await this.getCacheDocuments(formType);

    // ID 기준으로 중복 제거 (Workspace 우선)
    const docMap = new Map();

    // Workspace 문서 먼저 추가
    workspaceDocs.forEach(doc => {
      docMap.set(doc.id, doc);
    });

    // Cache 문서 추가 (중복 제외)
    cacheDocs.forEach(doc => {
      if (!docMap.has(doc.id)) {
        docMap.set(doc.id, doc);
      }
    });

    return Array.from(docMap.values());
  }

  // ============= 동기화 관련 =============

  // Workspace → Cloud 업로드를 위한 문서 준비
  async prepareForUpload(formType, docId) {
    const doc = await this.getFromWorkspace(formType, docId);
    if (!doc) return null;

    // 업로드용 메타데이터 추가
    doc.uploadedAt = new Date().toISOString();
    doc.isDraft = false;

    return doc;
  }

  // Cloud → Workspace 이동 (편집을 위해)
  async moveToWorkspace(formType, docId) {
    const cacheDoc = await this.getFromCache(formType, docId);
    if (!cacheDoc) return null;

    // Workspace로 복사
    delete cacheDoc.isReadOnly;
    delete cacheDoc.isFromCache;
    cacheDoc.isDraft = true;
    cacheDoc.movedToWorkspaceAt = new Date().toISOString();

    await this.saveToWorkspace(formType, cacheDoc);

    console.log(`문서 ${docId}: Cache → Workspace 이동`);
    return cacheDoc;
  }

  // Workspace → Cache 이동 (동기화 완료 후)
  async moveToCache(formType, docId) {
    if (!this.db) await this.init();

    const workspaceStore = `${formType}_workspace`;
    const cacheStore = `${formType}_cache`;

    // 단일 트랜잭션으로 원자적 처리
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([workspaceStore, cacheStore], 'readwrite');
      const workspace = transaction.objectStore(workspaceStore);
      const cache = transaction.objectStore(cacheStore);

      // 1. Workspace에서 문서 가져오기
      const getRequest = workspace.get(docId);

      getRequest.onsuccess = () => {
        const doc = getRequest.result;
        if (!doc) {
          reject(new Error(`문서 ${docId}를 찾을 수 없습니다`));
          return;
        }

        // 2. Cache에 저장
        doc.cloudSyncedAt = new Date().toISOString();
        doc.storageType = this.storageTypes.CACHE;
        doc.cachedAt = doc.cloudSyncedAt;
        doc.isReadOnly = true;
        delete doc.isFromWorkspace;

        const putRequest = cache.put(doc);

        putRequest.onsuccess = () => {
          // 3. Workspace에서 삭제
          const deleteRequest = workspace.delete(docId);

          deleteRequest.onsuccess = () => {
            console.log(`문서 ${docId}: Workspace → Cache 이동`);
            doc.isFromCache = true;
            resolve(doc);
          };

          deleteRequest.onerror = () => {
            reject(new Error(`Workspace 삭제 실패: ${deleteRequest.error}`));
          };
        };

        putRequest.onerror = () => {
          reject(new Error(`Cache 저장 실패: ${putRequest.error}`));
        };
      };

      getRequest.onerror = () => {
        reject(new Error(`문서 조회 실패: ${getRequest.error}`));
      };

      transaction.onerror = () => {
        reject(new Error(`트랜잭션 실패: ${transaction.error}`));
      };
    });
  }

  // ============= 유틸리티 =============

  // 양식 타입 설정
  setFormType(formType) {
    this.currentFormType = formType;
    console.log('FormStorageService: 양식 타입 변경 ->', formType);
  }

  // 현재 양식 타입 가져오기
  getFormType() {
    return this.currentFormType;
  }

  // 저장소 상태 확인
  async getStorageStats(formType) {
    const workspaceDocs = await this.getWorkspaceDocuments(formType);
    const cacheDocs = await this.getCacheDocuments(formType);

    return {
      formType,
      workspace: {
        count: workspaceDocs.length,
        documents: workspaceDocs.map(d => ({
          id: d.id,
          title: d.title,
          lastModified: d.lastModified
        }))
      },
      cache: {
        count: cacheDocs.length,
        documents: cacheDocs.map(d => ({
          id: d.id,
          title: d.title,
          cloudSyncedAt: d.cloudSyncedAt
        }))
      },
      total: workspaceDocs.length + cacheDocs.length
    };
  }

  // 전체 저장소 초기화 (개발용)
  async clearAll() {
    if (!this.db) await this.init();

    for (const formType of this.formTypes) {
      const workspaceStore = `${formType}_workspace`;
      const cacheStore = `${formType}_cache`;

      // Workspace 클리어
      const tx1 = this.db.transaction([workspaceStore], 'readwrite');
      await new Promise((resolve, reject) => {
        const clearReq = tx1.objectStore(workspaceStore).clear();
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => {
          console.error(`${workspaceStore} 클리어 실패:`, clearReq.error);
          reject(clearReq.error);
        };
      });

      // Cache 클리어
      const tx2 = this.db.transaction([cacheStore], 'readwrite');
      await new Promise((resolve, reject) => {
        const clearReq = tx2.objectStore(cacheStore).clear();
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => {
          console.error(`${cacheStore} 클리어 실패:`, clearReq.error);
          reject(clearReq.error);
        };
      });
    }

    console.log('전체 저장소 초기화 완료');
  }

  // DB 연결 종료
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// 싱글톤 인스턴스 내보내기
export const formStorageService = new FormStorageService();