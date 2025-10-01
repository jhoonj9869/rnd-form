// IndexedDB 래퍼 클래스
export class DB {
    constructor() {
        this.dbName = 'ExpenseFormDB';
        this.version = 1;
        this.db = null;
    }

    // DB 초기화
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error('데이터베이스를 열 수 없습니다'));
            };

            request.onblocked = () => {
                console.warn('데이터베이스 업그레이드가 차단됨. 다른 탭을 닫아주세요.');
                reject(new Error('데이터베이스가 다른 탭에서 사용 중입니다'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;

                // 버전 변경 시 DB 닫기
                this.db.onversionchange = () => {
                    this.db.close();
                    console.log('데이터베이스 버전 변경 감지 - 연결 종료');
                };

                console.log('데이터베이스 연결 성공');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // documents 스토어 생성
                if (!db.objectStoreNames.contains('documents')) {
                    const documentStore = db.createObjectStore('documents', {
                        keyPath: 'id'
                    });

                    // 인덱스 생성
                    documentStore.createIndex('docNumber', 'docNumber', { unique: true });
                    documentStore.createIndex('date', 'date', { unique: false });
                    documentStore.createIndex('title', 'title', { unique: false });
                    documentStore.createIndex('status', 'status', { unique: false });
                    documentStore.createIndex('updatedAt', 'updatedAt', { unique: false });

                    console.log('documents 스토어 생성됨');
                }

                // settings 스토어 생성
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', {
                        keyPath: 'key'
                    });
                    console.log('settings 스토어 생성됨');
                }

                // counters 스토어 생성 (문서번호 시퀀스용)
                if (!db.objectStoreNames.contains('counters')) {
                    db.createObjectStore('counters', {
                        keyPath: 'date'
                    });
                    console.log('counters 스토어 생성됨');
                }
            };
        });
    }

    // 유틸리티: 날짜 키 생성
    formatDateKey() {
        return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    }

    // 유틸리티: Alpine 프록시를 일반 객체로 변환
    toPlain(value) {
        // structuredClone이 있으면 사용, 없으면 JSON 변환
        return typeof structuredClone === 'function'
            ? structuredClone(value)
            : JSON.parse(JSON.stringify(value));
    }

    // 원자적 문서 생성 (새 문서번호 할당)
    async createDocumentAtomic(doc) {
        const plain = this.toPlain(doc);
        const date = this.formatDateKey();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['counters', 'documents'], 'readwrite');
            const counters = tx.objectStore('counters');
            const documents = tx.objectStore('documents');

            // 트랜잭션 완료 시에만 resolve
            tx.oncomplete = () => resolve(plain);
            tx.onabort = () => reject(tx.error || new Error('문서 생성 트랜잭션 취소'));
            tx.onerror = () => reject(tx.error || new Error('문서 생성 트랜잭션 오류'));

            // 오늘 날짜의 카운터 가져오기
            const getReq = counters.get(date);
            getReq.onerror = () => tx.abort();

            getReq.onsuccess = () => {
                const current = getReq.result?.seq || 0;
                const nextSeq = current + 1;
                const docNumber = `${date}-${String(nextSeq).padStart(3, '0')}`;

                // 카운터 업데이트
                counters.put({ date, seq: nextSeq });

                // 문서 준비
                if (!plain.id) {
                    plain.id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
                }
                plain.docNumber = docNumber;
                const now = new Date().toISOString();
                plain.createdAt = plain.createdAt || now;
                plain.updatedAt = now;

                // 문서 저장 (docNumber 유니크 인덱스로 중복 방지)
                const putReq = documents.put(plain);
                putReq.onerror = () => {
                    // 유니크 제약 위반 시 트랜잭션 중단
                    tx.abort();
                };
            };
        });
    }

    // 문서 저장 (새 문서 또는 기존 문서 업데이트)
    async saveDocument(doc) {
        const plain = this.toPlain(doc);
        const isNew = !plain.docNumber;

        // 새 문서면 원자적 생성
        if (isNew) {
            return this.createDocumentAtomic(plain);
        }

        // 기존 문서 업데이트
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['documents'], 'readwrite');
            const store = tx.objectStore('documents');

            // 트랜잭션 완료 시에만 resolve
            tx.oncomplete = () => {
                console.log('문서 업데이트 성공:', plain.docNumber);
                resolve(plain);
            };
            tx.onabort = () => reject(tx.error || new Error('문서 저장 트랜잭션 취소'));
            tx.onerror = () => reject(tx.error || new Error('문서 저장 트랜잭션 오류'));

            plain.updatedAt = new Date().toISOString();
            store.put(plain);
        });
    }

    // 문서 업데이트 (deprecated - saveDocument 사용)
    async updateDocument(document) {
        return this.saveDocument(document);
    }

    // 문서 조회
    async getDocument(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents'], 'readonly');
            const store = transaction.objectStore('documents');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('문서 조회 실패'));
            };
        });
    }

    // 모든 문서 조회
    async getAllDocuments() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                console.warn('데이터베이스가 초기화되지 않았습니다');
                resolve([]);
                return;
            }

            const transaction = this.db.transaction(['documents'], 'readonly');
            const store = transaction.objectStore('documents');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(new Error('문서 목록 조회 실패'));
            };
        });
    }

    // 문서 삭제
    async deleteDocument(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents'], 'readwrite');
            const store = transaction.objectStore('documents');
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('문서 삭제 성공:', id);
                resolve();
            };

            request.onerror = () => {
                reject(new Error('문서 삭제 실패'));
            };
        });
    }

    // 문서번호로 검색
    async getDocumentByNumber(docNumber) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents'], 'readonly');
            const store = transaction.objectStore('documents');
            const index = store.index('docNumber');
            const request = index.get(docNumber);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('문서번호 검색 실패'));
            };
        });
    }

    // 날짜별 문서 조회
    async getDocumentsByDate(date) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents'], 'readonly');
            const store = transaction.objectStore('documents');
            const index = store.index('date');
            const request = index.getAll(date);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(new Error('날짜별 문서 조회 실패'));
            };
        });
    }

    // 문서번호 시퀀스 조회/업데이트
    async getNextSequence(date) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                console.warn('데이터베이스가 초기화되지 않았습니다');
                resolve(1);
                return;
            }

            const transaction = this.db.transaction(['counters'], 'readwrite');
            const store = transaction.objectStore('counters');

            // 현재 날짜의 카운터 조회
            const getRequest = store.get(date);

            getRequest.onsuccess = () => {
                let counter = getRequest.result;
                let nextSeq = 1;

                if (counter) {
                    // 기존 카운터가 있으면 증가
                    nextSeq = counter.sequence + 1;
                    counter.sequence = nextSeq;
                } else {
                    // 새로운 날짜면 카운터 생성
                    counter = {
                        date: date,
                        sequence: nextSeq
                    };
                }

                // 카운터 저장
                const putRequest = store.put(counter);

                putRequest.onsuccess = () => {
                    resolve(nextSeq);
                };

                putRequest.onerror = () => {
                    reject(new Error('시퀀스 업데이트 실패'));
                };
            };

            getRequest.onerror = () => {
                reject(new Error('시퀀스 조회 실패'));
            };
        });
    }

    // 설정 저장
    async saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('설정 저장 실패'));
            };
        });
    }

    // 설정 조회
    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result?.value);
            };

            request.onerror = () => {
                reject(new Error('설정 조회 실패'));
            };
        });
    }

    // 전체 데이터 내보내기
    async exportAllData() {
        try {
            const documents = await this.getAllDocuments();
            const settings = [];

            // 모든 설정 조회
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.getAll();

            const settingsData = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error('설정 조회 실패'));
            });

            return {
                version: this.version,
                exportDate: new Date().toISOString(),
                documents: documents,
                settings: settingsData
            };
        } catch (error) {
            console.error('데이터 내보내기 실패:', error);
            throw error;
        }
    }

    // 데이터 가져오기
    async importData(data) {
        try {
            // 문서 가져오기
            if (data.documents && data.documents.length > 0) {
                const transaction = this.db.transaction(['documents'], 'readwrite');
                const store = transaction.objectStore('documents');

                for (const doc of data.documents) {
                    await new Promise((resolve, reject) => {
                        const request = store.put(doc);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(new Error('문서 가져오기 실패'));
                    });
                }
            }

            // 설정 가져오기
            if (data.settings && data.settings.length > 0) {
                const transaction = this.db.transaction(['settings'], 'readwrite');
                const store = transaction.objectStore('settings');

                for (const setting of data.settings) {
                    await new Promise((resolve, reject) => {
                        const request = store.put(setting);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(new Error('설정 가져오기 실패'));
                    });
                }
            }

            console.log('데이터 가져오기 완료');
            return true;
        } catch (error) {
            console.error('데이터 가져오기 실패:', error);
            throw error;
        }
    }

    // 데이터베이스 초기화
    async clearAll() {
        const stores = ['documents', 'settings', 'counters'];

        for (const storeName of stores) {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(`${storeName} 초기화 실패`));
            });
        }

        console.log('데이터베이스 초기화 완료');
    }
}