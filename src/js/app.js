// Alpine.js 앱 메인 로직
import Alpine from 'alpinejs';
import { FormStorageService } from './form-storage-service.js';
import { DocStateManager } from './doc-state-manager.js';
import { storageManager } from './storage-manager.js';
import formRegistry from './form-registry-service.js';
import AttachmentManager from './attachment-manager.js';
import { showLoadingOverlay, hideLoadingOverlay } from './loading-overlay.js';
import {
    generateDocNumber,
    toKoreanAmount,
    formatCurrency,
    formatDate,
    formatDateTime
} from './utils.js';

// Alpine.js 초기화
window.Alpine = Alpine;
Alpine.data('expenseApp', () => ({
        // 데이터베이스 인스턴스
        formStorage: null, // FormStorageService 인스턴스
        docStateManager: null, // DocStateManager 인스턴스
        db: null, // 호환성을 위해 임시 유지

        // 현재 편집 중인 문서
        currentDoc: {
            id: null,
            docNumber: '',
            title: '',
            date: new Date().toISOString().split('T')[0],
            department: '',
            requester: '',
            category: '',
            paymentMethod: '',
            vendor: '',
            purchaseDate: new Date().toISOString().split('T')[0],
            amount: 0,
            vatIncluded: true,
            items: [],
            notes: '',
            submitDate: new Date().toISOString().split('T')[0],
            submitterTitle: '',
            submitterName: '',
            status: 'draft',
            createdAt: null,
            updatedAt: null
        },

        // 문서 목록 (분리 관리)
        workspaceDocument: null,  // 작업 중인 단일 문서
        cacheDocuments: [],   // 클라우드 동기화된 문서들
        filteredCacheDocuments: [],

        // UI 상태
        searchQuery: '',
        statusMessage: '준비됨',
        isLoading: false,
        isDocumentSaved: true,  // 문서 저장 상태 추적
        originalDocHash: null,   // 원본 문서 해시 (변경 감지용)
        selectedDocId: null,

        // 메인화면 초기화 상태 (v2.5.0)
        isEditable: false,       // 편집 가능 여부
        showBlankPaper: true,    // A4 백지 표시 여부
        showUsageGuide: true,    // 사용 가이드 표시 여부
        guideContent: '새 문서를 작성하거나 기존 문서를 선택하세요.', // 가이드 내용

        // 양식 전환 상태 플래그
        isSwitchingForm: false,  // 양식 전환 중인지 여부

        // 구글드라이브 상태
        googleDriveAuth: false,
        googleDriveSyncing: false,

        // 이중 저장 체계 상태
        syncStatus: {
            local: 'idle',
            cloud: 'idle',
            lastLocalSave: null,
            lastCloudSync: null
        },
        currentFormType: 'none',

        // 양식 관리
        availableForms: [],
        formRegistry: null,
        currentFormConfig: null,

        // 초기화 중복 방지 플래그
        isInitializing: false,
        isInitialized: false,

        // 초기화
        async init() {
            // 중복 실행 방지
            if (this.isInitializing || this.isInitialized) {
                console.log('[init] 이미 초기화됨 - 중복 실행 방지');
                return;
            }

            this.isInitializing = true;
            console.log('[init] 앱 초기화 시작');

            try {
                // 초기 템플릿 저장 (지출결의서)
                const previewContainer = document.querySelector('.preview-container');
                if (previewContainer) {
                    this.originalExpenseTemplate = previewContainer.innerHTML;
                }

                // FormStorageService 초기화 (이중 저장소)
                this.formStorage = new FormStorageService();
                await this.formStorage.init();

                // DocStateManager 초기화
                this.docStateManager = new DocStateManager();
                // 기본 문서 생성 함수 설정
                this.docStateManager.setDefaultDocCreator(() => this.createEmptyDocument());

                // 호환성을 위한 임시 매핑
                this.db = this.formStorage;

                // StorageManager 초기화 (FormStorageService와 연동)
                await storageManager.init(this.formStorage);

                // FormRegistry 초기화
                this.formRegistry = formRegistry;
                await this.loadFormList();

                // DocStateManager에 동적 양식 등록
                const formTypes = Array.from(this.formRegistry.forms.keys());
                this.docStateManager.registerAllFormTypes(formTypes);
                console.log('[init] 동적 양식 등록 완료:', formTypes);

                // 동기화 상태 이벤트 리스너
                window.addEventListener('syncStatusChanged', (e) => {
                    this.syncStatus = e.detail;
                });

                // 양식 변경 이벤트 리스너
                window.addEventListener('formTypeChanged', (e) => {
                    this.currentFormType = e.detail.formType;
                    this.loadDocuments();
                });

                // 양식 전환 이벤트 리스너
                window.addEventListener('formSwitched', (e) => {
                    this.currentFormType = e.detail.formId;
                    this.currentFormConfig = e.detail.config;
                    this.loadDocuments();
                });

                // 문서 목록 로드 (내부에서 초기화 지점 호출됨)
                await this.loadDocuments();

                // 저장 상태 추적 설정
                this.setupSaveTracking();

                // 단축키 설정
                this.setupKeyboardShortcuts();

                // 구글드라이브 인증 상태 확인
                await this.checkGoogleDriveAuth();

                // 첨부파일 관리자 초기화
                await this.initAttachmentManager();

                this.statusMessage = '준비 완료';
                this.isInitialized = true;
                this.isInitializing = false;
                console.log('[init] 앱 초기화 완료');

            } catch (error) {
                console.error('앱 초기화 실패:', error);
                this.statusMessage = '초기화 실패: ' + error.message;
                this.isInitializing = false;
            }
        },

        // ID 생성 함수
        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        },

        // 비동기 작업 래퍼 (중복 에러 처리 패턴 제거)
        async executeWithLoading(statusMessage, asyncFunc, errorMessage = null) {
            this.isLoading = true;
            this.statusMessage = statusMessage;

            try {
                const result = await asyncFunc();
                return result;
            } catch (error) {
                console.error(errorMessage || statusMessage + ' 실패:', error);
                this.statusMessage = (errorMessage || statusMessage + ' 실패') + ': ' + error.message;
                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        // 초기 템플릿 저장 (지출결의서용)
        originalExpenseTemplate: null,

        // 빈 문서 템플릿 생성 (양식별 구조)
        createEmptyDocument() {
            const newId = this.generateId();
            const baseDocument = {
                id: newId,
                docNumber: '',
                title: '',
                date: new Date().toISOString().split('T')[0],
                department: '',
                requester: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isReadOnly: false,
                isFromCloud: false,
                isSyncedToCloud: false
            };

            // 양식별 추가 필드
            switch (this.currentFormType) {
                case 'expense-report':
                    return {
                        ...baseDocument,
                        vendor: '',
                        amount: 0,
                        memo: '',
                        items: [{
                            description: '',
                            quantity: 1,
                            unitPrice: 0
                        }]
                    };

                case 'purchase-order':
                    return {
                        ...baseDocument,
                        // 공통 필드만 유지, 나머지는 빈 상태
                    };

                case 'travel-report':
                    return {
                        ...baseDocument,
                        // 공통 필드만 유지, 나머지는 빈 상태
                    };

                default:
                    return baseDocument;
            }
        },

        // === 중앙 초기화 지점 (Central Initialization Point) ===
        // 모든 currentDoc 변경의 단일 진입점
        async setCurrentDocument(newDoc, context = {}) {
            try {
                // 1. 이전 상태 정리
                if (this.currentDoc && this.currentDoc.id && this.currentFormType) {
                    // DocStateManager에 현재 상태 저장 (현재 양식 정보와 함께)
                    this.docStateManager.switchContext(this.currentFormType, 'workspace', this.currentDoc.id);
                    this.docStateManager.saveCurrentState(this.currentDoc);
                }

                // 2. 새 문서 설정
                if (newDoc) {
                    this.currentDoc = { ...newDoc };

                    // UI 상태 업데이트
                    this.isEditable = !newDoc.isReadOnly;
                    this.showBlankPaper = false;
                    this.showUsageGuide = false;

                    // 문서 해시 계산 (변경 감지용)
                    this.originalDocHash = this.getDocumentHash(newDoc);
                    this.isDocumentSaved = true;
                } else {
                    // 메인화면 초기화 상태 - currentDoc을 빈 객체로 유지 (x-model 안전성)
                    this.currentDoc = this.createEmptyDocument();
                    this.currentDoc.id = null; // 초기화 상태임을 명시
                    this.isEditable = false;
                    this.showBlankPaper = true;
                    this.showUsageGuide = true;
                    this.guideContent = this.getUsageGuide(context);
                    this.originalDocHash = null;
                    this.isDocumentSaved = true;
                }

                // 3. 첨부파일 로드
                if (newDoc && newDoc.id) {
                    await this.loadAttachments();
                } else {
                    this.attachments = [];
                }

                // 4. 이벤트 발송
                this.$dispatch('docInitialized', {
                    doc: newDoc,
                    context: context,
                    formType: this.currentFormType
                });


            } catch (error) {
                console.error('문서 초기화 중 오류:', error);
                this.statusMessage = '문서 초기화 실패';
            }
        },

        // 사용 가이드 콘텐츠 생성
        getUsageGuide(context) {
            const guides = {
                'initial': '새 문서를 작성하거나 기존 문서를 선택하세요.',
                'main-screen': '문서를 선택하거나 새로 만들어 시작하세요.',
                'form-switch': `${this.getFormTypeName(this.currentFormType)} 양식이 선택되었습니다.`,
                'full-refresh': '모든 양식이 새로고침되었습니다.',
                'new-document-ready': '새 문서가 준비되었습니다. 작업중 문서를 클릭하여 시작하세요.',
                'document-switch': '문서가 로드되었습니다.',
                'document-saved': '문서가 저장되었습니다.',
                'form-list-refresh': '양식 목록을 새로고침하고 있습니다...',
                'form-list-refreshed': context?.message || '양식 목록이 새로고침되었습니다. 양식을 선택해주세요.',
                'error': context?.message || '오류가 발생했습니다.'
            };

            return guides[context?.type] || guides['initial'];
        },

        // 계층별 초기화 함수들

        // 1️⃣ 문서 단위 초기화
        async initializeDocument(docId, source = 'cache') {
            try {
                let doc = null;

                if (source === 'workspace') {
                    doc = await this.formStorage.getFromWorkspace(this.currentFormType, docId);
                } else {
                    doc = await this.formStorage.getFromCache(this.currentFormType, docId);
                }

                await this.setCurrentDocument(doc, {
                    type: 'document-switch',
                    source: source,
                    previousDoc: this.currentDoc?.id
                });

                return doc;
            } catch (error) {
                console.error('문서 초기화 실패:', error);
                await this.setCurrentDocument(null, {
                    type: 'document-switch-error',
                    error: error.message
                });
                throw error;
            }
        },

        // 2️⃣ 양식 단위 초기화
        async initializeFormType(formType) {
            try {

                // 현재 문서 상태 저장
                if (this.currentDoc) {
                    this.docStateManager.saveCurrentState(this.currentDoc);
                }

                // 양식 전환
                const previousFormType = this.currentFormType;
                this.currentFormType = formType;


                // 중앙 초기화 지점 원칙: 양식 전환 시 안전한 대기 상태로 초기화
                await this.setCurrentDocument(null, {
                    type: 'form-switch',
                    formType: formType,
                    previousFormType: previousFormType,
                    message: '양식이 전환되었습니다. 문서를 선택하거나 새로 만들어 시작하세요.'
                });

                // 문서 목록 새로고침
                await this.loadDocuments();

                // Alpine.js 강제 반응성 업데이트
                await this.$nextTick();

                return null;
            } catch (error) {
                console.error('양식 초기화 실패:', error);
                throw error;
            }
        },

        // 3️⃣ 전체 시스템 초기화
        async initializeSystem() {
            try {
                // 모든 양식 상태 저장
                this.docStateManager.saveAllStates();

                // 기본 양식으로 초기화
                this.currentFormType = 'none';

                await this.setCurrentDocument(null, {
                    type: 'full-refresh',
                    timestamp: new Date().toISOString()
                });

                // 양식 레지스트리 새로고침
                if (this.formRegistry) {
                    await this.formRegistry.refreshCache();
                }

                // 문서 목록 새로고침
                await this.loadDocuments();

                } catch (error) {
                console.error('시스템 초기화 실패:', error);
                throw error;
            }
        },

        // 새 문서 생성 (현재 양식의 workspace만 처리)
        async newDocument() {
            // 작업중 문서가 있으면 경고
            const workspaceDocs = await this.formStorage.getWorkspaceDocuments(this.currentFormType);
            if (workspaceDocs && workspaceDocs.length > 0) {
                if (!confirm('작업중인 문서가 삭제됩니다.\n클라우드에 저장하지 않은 데이터는 사라집니다.\n\n계속하시겠습니까?')) {
                    return;
                }
            }

            // 현재 양식의 workspace 문서만 삭제 (다른 양식은 영향 없음)
            try {
                if (workspaceDocs && workspaceDocs.length > 0) {
                    for (const doc of workspaceDocs) {
                        await this.formStorage.deleteFromWorkspace(this.currentFormType, doc.id);
                    }
                    this.workspaceDocument = null;
                }

                // DocStateManager의 현재 양식 workspace도 클리어
                this.docStateManager.clearWorkspaceDoc(this.currentFormType);
            } catch (error) {
                console.error('기존 문서 삭제 중 오류:', error);
            }

            // 새 문서 생성하여 Workspace에 저장
            const newDoc = this.createEmptyDocument();
            await this.formStorage.saveToWorkspace(this.currentFormType, newDoc);

            // 문서 목록 새로고침 (새 문서 UI 반영)
            await this.loadDocuments();

            // 자동으로 새 문서 로드
            await this.loadDocument(newDoc.id);

            // 새 문서는 저장되지 않은 상태로 시작 (저장 필요 표시)
            this.isDocumentSaved = false;
            this.originalDocHash = null; // 원본 해시 없음 (새 문서이므로)

            // 편집 모드 활성화 다이얼로그 (입력 필드 포커스 활성화용)
            if (window.electronAPI) {
                setTimeout(async () => {
                    await window.electronAPI.showBlockingDialog({
                        type: 'info',
                        title: '편집 모드 활성화',
                        message: '새 문서를 편집할 수 있습니다.',
                        detail: '확인을 누르면 모든 입력 필드가 활성화됩니다.',
                        buttons: ['확인']
                    });
                }, 300);
            }
        },

        // 문서 저장 (DocStateManager 활용)
        async saveDocument(skipValidation = true) {
            // 작업중 문서가 선택되지 않은 경우 알림
            if (!this.currentDoc || !this.currentDoc.id) {
                alert('작업중 문서를 선택해주세요.');
                return;
            }

            // Cache(클라우드) 문서는 읽기 전용이므로 저장 불가
            if (this.currentDoc.isReadOnly) {
                alert('작업중 문서를 선택해주세요.');
                return;
            }

            await this.executeWithLoading('저장 중...', async () => {
                // 프록시 객체를 일반 객체로 변환
                const docToSave = JSON.parse(JSON.stringify(this.currentDoc));

                // isReadOnly 플래그 제거 (workspace 문서는 절대 읽기 전용이 아님)
                delete docToSave.isReadOnly;

                // 업데이트 시간 갱신
                docToSave.updatedAt = new Date().toISOString();
                docToSave.lastSaved = new Date().toISOString();

                if (!docToSave.id) {
                    // 새 문서인 경우 ID 생성
                    docToSave.id = crypto.randomUUID();
                    docToSave.createdAt = new Date().toISOString();
                }

                // Workspace에 저장 (작업 중인 문서)
                const result = await this.formStorage.saveToWorkspace(this.currentFormType, docToSave);

                if (result.success) {
                    this.currentDoc.id = docToSave.id;
                    this.currentDoc.createdAt = docToSave.createdAt;
                    this.currentDoc.updatedAt = docToSave.updatedAt;
                    this.currentDoc.lastSaved = docToSave.lastSaved;
                    this.currentDoc.isSyncedToCloud = false;  // 로컬에만 저장됨

                    // DocStateManager에도 저장
                    this.docStateManager.setWorkspaceDoc(this.currentFormType, this.currentDoc);
                    this.docStateManager.switchContext(this.currentFormType, 'workspace', docToSave.id);

                    // workspaceDocument 업데이트
                    this.workspaceDocument = { ...this.currentDoc };

                    this.statusMessage = '문서가 Workspace에 저장되었습니다';

                    // 저장 상태 업데이트
                    this.isDocumentSaved = true;
                    // currentDoc 기준으로 해시 저장 (docToSave가 아닌 currentDoc)
                    this.originalDocHash = this.getDocumentHash(this.currentDoc);
                } else {
                    throw new Error('저장 실패');
                }

                this.currentDoc.updatedAt = docToSave.updatedAt;

                // workspaceDocument만 업데이트 (목록 구조는 변화 없으므로 loadDocuments 불필요)
                this.workspaceDocument = { ...this.currentDoc };
            }, '저장 실패');
        },

        // 문서 불러오기 (DocStateManager 활용)
        async loadDocument(id) {
            this.selectedDocId = id;  // 선택 상태 업데이트

            await this.executeWithLoading('불러오는 중...', async () => {
                // Workspace에서 먼저 찾고, 없으면 Cache에서 찾기
                let doc = await this.formStorage.getFromWorkspace(this.currentFormType, id);
                let storageType = 'workspace';
                let isFromCache = false;

                if (!doc) {
                    doc = await this.formStorage.getFromCache(this.currentFormType, id);
                    storageType = 'cache';
                    isFromCache = true;
                }

                if (doc) {
                    // 상태 표시를 위한 추가 정보
                    doc.isReadOnly = isFromCache;  // Cache 문서는 읽기 전용

                    // 중앙 초기화 지점을 통한 문서 로드
                    await this.setCurrentDocument(doc, {
                        type: 'document-switch',
                        source: storageType,
                        previousDoc: this.currentDoc?.id
                    });

                    // items가 없으면 빈 배열로 초기화
                    if (!this.currentDoc.items || this.currentDoc.items.length === 0) {
                        this.currentDoc.items = [{
                            description: '',
                            quantity: 1,
                            unitPrice: 0
                        }];
                    }

                    this.selectedDocId = doc.id;
                    this.statusMessage = '문서를 불러왔습니다';
                } else {
                    await this.setCurrentDocument(null, {
                        type: 'document-not-found',
                        attemptedId: id
                    });
                    this.statusMessage = '문서를 찾을 수 없습니다';
                }
            }, '불러오기 실패');
        },

        // 컨텍스트 메뉴 표시
        showContextMenu(docId, event) {
            // 선택 상태 업데이트
            this.selectedDocId = docId;

            // this를 저장하여 이벤트 핸들러에서 사용
            const self = this;

            // 기본 컨텍스트 메뉴 대신 커스텀 메뉴 생성
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.position = 'fixed';
            menu.style.left = event.clientX + 'px';
            menu.style.top = event.clientY + 'px';
            menu.innerHTML = `
                <div class="menu-item" data-action="edit">
                    <span>✏️</span> 편집
                </div>
                <div class="menu-item" data-action="copy">
                    <span>📋</span> 복사
                </div>
                <hr class="menu-divider">
                <div class="menu-item" data-action="delete">
                    <span>🗑️</span> 삭제
                </div>
            `;

            // 메뉴 아이템 클릭 이벤트 처리
            menu.addEventListener('click', (e) => {
                const menuItem = e.target.closest('.menu-item');
                if (menuItem) {
                    const action = menuItem.dataset.action;

                    // 메뉴 닫기
                    menu.remove();

                    // 액션 실행
                    switch(action) {
                        case 'edit':
                            self.editCloudDocument(docId);
                            break;
                        case 'copy':
                            self.copyCloudDocument(docId);
                            break;
                        case 'delete':
                            self.deleteCloudDocument(docId);
                            break;
                    }
                }
            });

            document.body.appendChild(menu);

            // 메뉴 밖 클릭 시 메뉴 닫기
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closeMenu);
            }, 0);
        },


        // Cache 문서 클릭 처리
        async handleCacheDocClick(doc) {
            // 작업중인 문서면 Workspace에서 열기
            if (doc.isBeingEdited && this.workspaceDocument) {
                await this.loadDocument(this.workspaceDocument.id);
            } else {
                // 일반 Cache 문서는 읽기 전용으로 열기
                await this.viewCloudDocument(doc.id);

                // 읽기 전용 문서는 더블클릭 또는 우클릭 메뉴로 수정 가능
            }
        },

        // 클라우드 문서 미리보기 (읽기 전용)
        async viewCloudDocument(id) {
            this.selectedDocId = id;
            try {
                // 먼저 모든 양식 타입에서 문서 검색
                let doc = null;
                let docFormType = null;

                // 현재 양식에서 먼저 찾기
                doc = await this.formStorage.getFromCache(this.currentFormType, id);
                if (doc) {
                    docFormType = this.currentFormType;
                } else {
                    // 다른 양식들에서 찾기
                    const formTypes = ['expense-report', 'purchase-order', 'travel-report'];
                    for (const formType of formTypes) {
                        if (formType !== this.currentFormType) {
                            doc = await this.formStorage.getFromCache(formType, id);
                            if (doc) {
                                docFormType = formType;
                                break;
                            }
                        }
                    }
                }

                if (doc && docFormType) {
                    // 문서의 양식이 현재 양식과 다르면 양식 전환
                    if (docFormType !== this.currentFormType) {
                        await this.switchFormType(docFormType);
                    }

                    // 중앙 초기화 지점을 통해 문서 설정
                    const readOnlyDoc = { ...doc, isReadOnly: true };
                    await this.setCurrentDocument(readOnlyDoc, {
                        type: 'view-cloud-document',
                        formType: docFormType,
                        readonly: true
                    });
                    this.statusMessage = '클라우드 문서 미리보기 (읽기 전용)';
                } else {
                    alert('문서를 찾을 수 없습니다.');
                }
            } catch (error) {
                console.error('문서 미리보기 실패:', error);
                this.statusMessage = '문서 미리보기 실패: ' + error.message;
            }
        },


        // 클라우드 문서 수정 (Cache → Workspace로 이동)
        async editCloudDocument(id) {
            // 작업중 문서가 있으면 경고
            const workspaceDocs = await this.formStorage.getWorkspaceDocuments(this.currentFormType);
            if (workspaceDocs && workspaceDocs.length > 0) {
                if (!confirm('작업중인 문서가 삭제됩니다.\n클라우드에 저장하지 않은 데이터는 사라집니다.\n\n계속하시겠습니까?')) {
                    return;
                }
            }

            try {
                // 먼저 모든 양식 타입에서 문서 검색
                let doc = null;
                let docFormType = null;

                // 현재 양식에서 먼저 찾기
                doc = await this.formStorage.getFromCache(this.currentFormType, id);
                if (doc) {
                    docFormType = this.currentFormType;
                } else {
                    // 다른 양식들에서 찾기
                    const formTypes = ['expense-report', 'purchase-order', 'travel-report'];
                    for (const formType of formTypes) {
                        if (formType !== this.currentFormType) {
                            doc = await this.formStorage.getFromCache(formType, id);
                            if (doc) {
                                docFormType = formType;
                                break;
                            }
                        }
                    }
                }

                if (doc && docFormType) {
                    // 문서의 양식이 현재 양식과 다르면 양식 전환
                    if (docFormType !== this.currentFormType) {
                        await this.switchFormType(docFormType);
                    }

                    // 현재 문서를 임시로 비워서 DOM 클리어 (최소 구조 유지)
                    this.currentDoc = {
                        id: null,
                        items: []
                    };
                    await this.$nextTick();

                    // 이동 전에 메타 정보 추가
                    doc.isFromCloud = true;  // 클라우드에서 가져옴
                    doc.isSyncedToCloud = false;  // 수정 시작하면 동기화 필요
                    doc.lastSaved = new Date().toISOString();

                    // Cache 문서를 업데이트 후 Workspace로 이동
                    await this.formStorage.saveToCache(docFormType, doc);
                    const movedDoc = await this.formStorage.moveToWorkspace(docFormType, id);

                    // 문서 목록 새로고침 (작업중 문서 표시)
                    await this.loadDocuments();

                    // 약간의 지연 후 문서 로드 (DOM이 완전히 업데이트되도록)
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // loadDocument를 사용하여 정상적인 로드 프로세스 실행
                    // 이제 개선된 로드 로직이 적용됨
                    await this.loadDocument(id);

                    this.statusMessage = '문서를 수정 모드로 전환했습니다';

                    // Blocking 다이얼로그로 입력 필드 활성화 (Alpine.js 재활성화)
                    if (window.electronAPI?.showBlockingDialog) {
                        setTimeout(async () => {
                            await window.electronAPI.showBlockingDialog({
                                type: 'info',
                                title: '편집 모드 활성화',
                                message: `${doc.docNumber || '문서'}를 편집할 수 있습니다.`,
                                detail: '확인을 누르면 모든 입력 필드가 활성화됩니다.',
                                buttons: ['확인']
                            });
                        }, 300);
                    }
                } else {
                    alert('문서를 찾을 수 없습니다.');
                }
            } catch (error) {
                console.error('문서 수정 전환 실패:', error);
                this.statusMessage = '문서 수정 전환 실패: ' + error.message;
            }
        },

        // 클라우드 문서 삭제 (Cache & Drive 모두 삭제)
        async deleteCloudDocument(id) {
            if (!confirm('이 문서를 완전히 삭제하시겠습니까?\n클라우드와 캐시에서 모두 삭제됩니다.')) {
                return;
            }

            try {
                this.statusMessage = '문서 삭제 중...';

                // 1. Google Drive에서 삭제
                if (window.electronAPI) {
                    const driveResult = await window.electronAPI.googleDriveSync('delete-document', {
                        formType: this.currentFormType,
                        documentId: id
                    });

                    if (!driveResult.success) {
                        console.warn('Drive 삭제 실패 (로컬에만 있던 문서일 수 있음):', driveResult.error);
                        if (driveResult.debug) {
                            console.warn('디버그 정보:', driveResult.debug);
                        }
                        // Drive 삭제 실패해도 계속 진행 (로컬은 삭제)
                    }
                }

                // 2. Cache에서 삭제
                await this.formStorage.deleteFromCache(this.currentFormType, id);

                // 3. 만약 Workspace에도 있다면 삭제
                const workspaceDoc = await this.formStorage.getFromWorkspace(this.currentFormType, id);
                if (workspaceDoc) {
                    await this.formStorage.deleteFromWorkspace(this.currentFormType, id);
                    this.workspaceDocument = null;

                    // 현재 편집중이던 문서라면 새 문서로
                    if (this.currentDoc.id === id) {
                        await this.newDocument();
                    }
                }

                // 문서 목록 새로고침
                await this.loadDocuments();

                this.showNotification('문서가 삭제되었습니다.');
                this.statusMessage = '삭제 완료';
            } catch (error) {
                console.error('문서 삭제 실패:', error);
                alert('문서 삭제 중 오류가 발생했습니다: ' + error.message);
                this.statusMessage = '삭제 실패';
            }
        },

        // 클라우드 문서 복사 (새 ID로 Workspace에 생성)
        async copyCloudDocument(id) {
            // 작업중 문서가 있으면 경고
            const workspaceDocs = await this.formStorage.getWorkspaceDocuments(this.currentFormType);
            if (workspaceDocs && workspaceDocs.length > 0) {
                if (!confirm('작업중인 문서가 삭제됩니다.\n클라우드에 저장하지 않은 데이터는 사라집니다.\n\n계속하시겠습니까?')) {
                    return;
                }
            }

            try {
                // Cache에서 문서 가져오기
                const doc = await this.formStorage.getFromCache(this.currentFormType, id);
                if (doc) {
                    // 순수 객체로 복사본 생성
                    const newDoc = JSON.parse(JSON.stringify({
                        ...doc,
                        id: this.generateId(),
                        docNumber: '(복사본) ' + (doc.docNumber || '번호없음'),  // 복사본 표시 + 원본 번호
                        title: doc.title || '',  // 제목은 그대로 유지
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        lastSaved: new Date().toISOString(),
                        isReadOnly: false,
                        isFromCache: false,
                        isFromCloud: false,  // 복사본은 새 문서 (클라우드와 연결 끊어짐)
                        isSyncedToCloud: false  // 새 ID이므로 동기화 필요
                    }));

                    // items가 없으면 빈 배열로 초기화
                    if (!newDoc.items || newDoc.items.length === 0) {
                        newDoc.items = [{
                            description: '',
                            quantity: 1,
                            unitPrice: 0
                        }];
                    }

                    // Workspace에 저장 (순수 객체 사용)
                    await this.formStorage.saveToWorkspace(this.currentFormType, newDoc);

                    // 문서 목록 새로고침 (새 문서 UI 반영)
                    await this.loadDocuments();

                    // 자동으로 복사된 문서 로드
                    await this.loadDocument(newDoc.id);

                    // 복사된 문서는 저장되지 않은 상태로 시작 (저장 필요 표시)
                    this.isDocumentSaved = false;
                    this.originalDocHash = null;

                    this.statusMessage = '문서를 복사했습니다';

                    // 편집 모드 활성화 다이얼로그 (입력 필드 포커스 활성화용)
                    if (window.electronAPI) {
                        setTimeout(async () => {
                            await window.electronAPI.showBlockingDialog({
                                type: 'info',
                                title: '편집 모드 활성화',
                                message: '복사된 문서를 편집할 수 있습니다.',
                                detail: '확인을 누르면 모든 입력 필드가 활성화됩니다.',
                                buttons: ['확인']
                            });
                        }, 300);
                    }
                }
            } catch (error) {
                console.error('문서 복사 실패:', error);
                this.statusMessage = '문서 복사 실패: ' + error.message;
            }
        },

        // (중복 함수 제거 - 482번 라인의 deleteCloudDocument 사용)

        // 문서 삭제 (기존 메서드 - Workspace 문서용)
        async deleteDocument(id) {
            if (!confirm('정말로 이 문서를 삭제하시겠습니까?')) {
                return;
            }

            await this.executeWithLoading('삭제 중...', async () => {
                // Workspace에서 삭제
                await this.formStorage.deleteFromWorkspace(this.currentFormType, id);
                this.statusMessage = '문서가 삭제되었습니다';

                // 현재 문서가 삭제된 경우 새 문서로
                if (this.currentDoc.id === id) {
                    await this.newDocument();
                }

                // 목록 새로고침
                await this.loadDocuments();
            }, '삭제 실패');
        },

        // 문서 목록 로드 (Cache만 표시)
        async loadDocuments() {
            try {
                // 'none' 상태에서는 모든 목록을 비우고 초기화 지점으로 이동
                if (this.currentFormType === 'none') {
                    this.workspaceDocument = null;
                    this.cacheDocuments = [];
                    this.filteredCacheDocuments = [];  // 필터링된 목록도 비우기

                    // 중앙 초기화 지점으로 이동
                    await this.setCurrentDocument(null, {
                        type: 'main-screen',
                        message: '양식을 선택해주세요.'
                    });
                    return;
                }

                // Workspace 문서 로드 (현재 편집 중인 문서 - 1개만)
                const workspaceDocuments = await this.formStorage.getWorkspaceDocuments(this.currentFormType);
                this.workspaceDocument = workspaceDocuments.length > 0 ? workspaceDocuments[0] : null;


                // Cache 문서 로드 (클라우드 동기화된 문서)
                const cacheDocuments = await this.formStorage.getCacheDocuments(this.currentFormType);

                // Cache 문서에 작업중 표시 추가 (현재 양식에서만 정확히 확인)
                this.cacheDocuments = cacheDocuments.map(doc => {
                    // 편집중 판단: workspace에 동일 ID 문서가 있으면 편집중 (currentDoc 상태 무관)
                    const isBeingEdited = this.workspaceDocument &&
                                         this.workspaceDocument.id === doc.id;


                    return {
                        ...doc,
                        isCache: true,
                        isBeingEdited: isBeingEdited,
                        displayType: '저장됨'
                    };
                });

                this.searchDocuments();

                // 중앙 초기화 지점 검증: 현재 문서가 목록에 없으면 초기화
                if (this.currentDoc && this.currentDoc.id) {
                    const currentDocExists = (this.workspaceDocument && this.workspaceDocument.id === this.currentDoc.id) ||
                                           this.cacheDocuments.some(doc => doc.id === this.currentDoc.id);

                    if (!currentDocExists) {
                        await this.setCurrentDocument(null, {
                            type: 'document-invalidated',
                            message: '문서 목록이 변경되어 초기화되었습니다. 문서를 다시 선택해 주세요.'
                        });
                    }
                }

                // Alpine.js 반응성 강제 업데이트
                this.$nextTick(() => {
                    // UI 업데이트 완료
                });

                // 양식 전환 중이 아닐 때만 초기화 (양식 전환 시에는 switchForm에서 처리)
                if (!this.isSwitchingForm) {
                    // 동기화 후 초기화 지점으로 이동 (문서 목록 변경 시 재선택 필요)
                    await this.setCurrentDocument(null, {
                        type: 'app-ready',
                        message: '문서를 선택하거나 새로 만들어 시작하세요.'
                    });
                }

            } catch (error) {
                console.error('목록 로드 실패:', error);
                this.workspaceDocument = null;
                this.cacheDocuments = [];
                this.filteredCacheDocuments = [];

                // 에러 시에도 안전한 초기화 상태로
                await this.setCurrentDocument(null, {
                    type: 'load-error',
                    message: '문서 목록 로드에 실패했습니다.'
                });
            }
        },

        // 문서 검색 (Workspace + Cache 문서)
        searchDocuments() {
            const query = this.searchQuery.toLowerCase();

            if (!query) {
                this.filteredCacheDocuments = [...this.cacheDocuments];
            } else {
                this.filteredCacheDocuments = this.cacheDocuments.filter(doc =>
                    doc.title?.toLowerCase().includes(query) ||
                    doc.docNumber?.toLowerCase().includes(query) ||
                    doc.department?.toLowerCase().includes(query) ||
                    doc.requester?.toLowerCase().includes(query)
                );
            }

            // Workspace 문서를 상단에, 그 다음 최신순 정렬
            this.filteredCacheDocuments.sort((a, b) => {
                // Workspace 문서가 항상 위로
                if (a.isWorkspace && !b.isWorkspace) return -1;
                if (!a.isWorkspace && b.isWorkspace) return 1;
                // 같은 타입끼리는 최신순
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            });
        },

        // 품목 추가
        addItem() {
            this.currentDoc.items.push({
                description: '',
                quantity: 1,
                unitPrice: 0
            });
        },

        // 품목 삭제
        removeItem(index) {
            this.currentDoc.items.splice(index, 1);
            this.updateItemsTotal();
        },

        // 자유입력 항목 추가
        addFreeEntry(preset = '') {
            if (!this.currentDoc.free) {
                this.currentDoc.free = { entries: [] };
            }
            this.currentDoc.free.entries.push({
                label: preset || '',
                description: '',
                amount: 0
            });
        },

        // 자유입력 항목 삭제
        removeFreeEntry(index) {
            if (this.currentDoc.free && this.currentDoc.free.entries) {
                this.currentDoc.free.entries.splice(index, 1);
                this.updateTotals();
            }
        },

        // 품목 합계 업데이트
        updateItemsTotal() {
            // 각 품목의 금액 계산
            this.currentDoc.items.forEach(item => {
                item.amount = (item.quantity || 0) * (item.unitPrice || 0);
            });

            // 전체 합계 업데이트
            this.updateTotals();
        },

        // 전체 합계 계산 (품목 + 자유입력)
        updateTotals() {
            // 품목 소계
            const itemsSubtotal = this.currentDoc.items.reduce((sum, item) => {
                return sum + ((item.quantity || 0) * (item.unitPrice || 0));
            }, 0);

            // 자유입력 소계
            let freeSubtotal = 0;
            if (this.currentDoc.free && this.currentDoc.free.entries) {
                freeSubtotal = this.currentDoc.free.entries.reduce((sum, entry) => {
                    return sum + (entry.amount || 0);
                }, 0);
            }

            // 합계 저장
            this.currentDoc.totals = {
                itemsSubtotal,
                freeSubtotal,
                grandTotal: itemsSubtotal + freeSubtotal
            };

            // 기존 amount 필드와 호환성 (임시)
            this.currentDoc.amount = this.currentDoc.totals.grandTotal;
        },

        // 품목 변경 시 자동 계산
        updateItem(index) {
            const item = this.currentDoc.items[index];
            if (item) {
                item.amount = (item.quantity || 0) * (item.unitPrice || 0);
                this.updateItemsTotal();
            }
        },


        // 금액 업데이트
        updateAmount() {
            // 금액이 직접 입력되면 품목 합계와 동기화 해제
            // 필요시 로직 추가
        },

        // 품목 합계 계산 (getter)
        get itemsTotal() {
            if (!this.currentDoc || !this.currentDoc.items || !Array.isArray(this.currentDoc.items)) {
                return 0;
            }
            return this.currentDoc.items.reduce((sum, item) => {
                return sum + ((item.quantity || 0) * (item.unitPrice || 0));
            }, 0);
        },

        // 문서 검증
        validateDocument() {
            const fieldNames = {
                title: '제목',
                department: '부서',
                requester: '신청자',
                vendor: '거래처'
            };

            // 최소 필수 항목만 체크 (제목과 거래처만)
            const minRequired = ['title', 'vendor'];
            const missing = [];

            for (const field of minRequired) {
                if (!this.currentDoc[field] || this.currentDoc[field].trim() === '') {
                    missing.push(fieldNames[field] || field);
                }
            }

            if (missing.length > 0) {
                this.statusMessage = `필수 항목을 입력하세요: ${missing.join(', ')}`;
                return false;
            }

            // 품목 또는 자유입력 중 하나는 있어야 함
            const hasFreeEntries = this.currentDoc.free && this.currentDoc.free.entries && this.currentDoc.free.entries.length > 0;
            const hasItems = this.currentDoc.items && this.currentDoc.items.length > 0;

            // 둘 다 없으면 에러
            if (!hasItems && !hasFreeEntries) {
                this.statusMessage = '품목 또는 자유입력 항목을 최소 1개 이상 입력하세요';
                return false;
            }

            // 품목이 있는 경우에만 품목 검증
            if (hasItems) {
                // 빈 품목 필터링 (품명이 없는 항목은 제거)
                this.currentDoc.items = this.currentDoc.items.filter(item =>
                    item.description && item.description.trim() !== ''
                );

                // 필터링 후 다시 확인
                if (this.currentDoc.items.length > 0) {
                    let hasValidItem = false;
                    for (let i = 0; i < this.currentDoc.items.length; i++) {
                        const item = this.currentDoc.items[i];

                        // 수량 또는 단가 중 하나라도 있으면 OK
                        if ((item.quantity && item.quantity > 0) ||
                            (item.unitPrice && item.unitPrice > 0)) {
                            hasValidItem = true;
                        }
                    }

                    // 품목이 있는데 모두 금액이 0이고 자유입력도 없으면 에러
                    if (!hasValidItem && !hasFreeEntries) {
                        this.statusMessage = '최소 하나의 항목에 금액 정보를 입력하세요';
                        return false;
                    }
                }
            }

            // 총 금액은 경고만 (강제하지 않음)
            if (this.currentDoc.amount <= 0) {
                console.warn('총 금액이 0입니다');
                // return false를 제거하여 0원도 허용
            }

            return true;
        },

        // 인쇄
        async printDocument() {
            // 인쇄 전 자동저장
            await this.saveDocument();
            this.statusMessage = '인쇄 준비 중...';

            // 순수 인쇄 (WYSIWYG - 미리보기 화면 그대로 출력)
            if (window.electronAPI?.print) {
                try {
                    await window.electronAPI.print({ silent: false });
                } catch (error) {
                    console.error('인쇄 오류:', error);
                    window.print();
                }
            } else {
                window.print();
            }

            this.statusMessage = '준비됨';
        },

        // 인쇄 미리보기
        printPreview() {
            // 저장 후 미리보기
            this.saveDocument().then(() => {
                // 미리보기 창 열기
                const printContent = document.querySelector('.preview-paper').innerHTML;
                const printWindow = window.open('', 'PRINT', 'width=800,height=900');

                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html lang="ko">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>인쇄 미리보기 - ${this.currentDoc.title || '지출결의서'}</title>
                        <style>
                            * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                            }
                            body {
                                font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
                                background: #e5e7eb;
                                padding: 20px;
                            }
                            .preview-paper {
                                background: white;
                                width: 210mm;
                                margin: 0 auto;
                                padding: 15mm 20mm;
                                box-shadow: 0 0 20px rgba(0,0,0,0.1);
                                min-height: 297mm;
                            }
                            .title-approval-container {
                                display: flex;
                                justify-content: space-between;
                                align-items: flex-start;
                                margin-bottom: 30px;
                            }
                            .doc-title {
                                font-size: 28px;
                                font-weight: bold;
                                padding: 20px;
                            }
                            .approval-box table {
                                width: 250px;
                                border-collapse: collapse;
                                border: 2px solid #000;
                            }
                            .approval-box th, .approval-box td {
                                border: 1px solid #000;
                                padding: 8px;
                                text-align: center;
                                font-size: 12px;
                            }
                            .approval-box .sign-area {
                                height: 60px;
                            }
                            .info-table {
                                width: 100%;
                                border-collapse: collapse;
                                border: 2px solid #000;
                                margin-bottom: 20px;
                            }
                            .info-table th, .info-table td {
                                border: 1px solid #000;
                                padding: 10px;
                                font-size: 13px;
                            }
                            .info-table th {
                                background: #f5f5f5;
                                width: 15%;
                                text-align: center;
                            }
                            .items-table {
                                width: 100%;
                                border-collapse: collapse;
                                border: 2px solid #000;
                            }
                            .items-table th, .items-table td {
                                border: 1px solid #000;
                                padding: 8px;
                                font-size: 13px;
                                text-align: center;
                            }
                            .items-table th {
                                background: #f5f5f5;
                            }
                            .items-table tbody td:nth-child(2) {
                                text-align: left;
                            }
                            .separator-row td {
                                padding: 0 !important;
                                height: 2px !important;
                                background: #999 !important;
                            }
                            .print-controls {
                                text-align: center;
                                padding: 20px;
                                background: white;
                                border-top: 1px solid #ddd;
                                position: sticky;
                                bottom: 0;
                            }
                            .btn-print {
                                padding: 10px 30px;
                                background: #2563eb;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                font-size: 16px;
                                cursor: pointer;
                                margin: 0 10px;
                            }
                            .btn-close {
                                padding: 10px 30px;
                                background: #6b7280;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                font-size: 16px;
                                cursor: pointer;
                                margin: 0 10px;
                            }
                            @media print {
                                body {
                                    background: white;
                                    padding: 0;
                                }
                                .preview-paper {
                                    box-shadow: none;
                                    width: 100%;
                                    padding: 0;
                                }
                                .print-controls {
                                    display: none;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="preview-paper">
                            ${printContent}
                        </div>
                        <div class="print-controls">
                            <button class="btn-print" onclick="window.print()">🖨️ 인쇄하기</button>
                            <button class="btn-close" onclick="window.close()">❌ 닫기</button>
                        </div>
                    </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.focus();
            });

            this.statusMessage = '인쇄 미리보기';
        },

        // 저장 상태 추적 설정
        setupSaveTracking() {
            // 문서 변경 감지
            this.$watch('currentDoc', () => {
                // 원본 해시와 현재 해시 비교
                const currentHash = this.getDocumentHash(this.currentDoc);
                if (this.originalDocHash && currentHash !== this.originalDocHash) {
                    this.isDocumentSaved = false;
                }
            }, { deep: true });

            // 상대 시간 표시 주기적 업데이트 (30초마다)
            this.relativeTimeInterval = setInterval(() => {
                // Alpine.js가 자동으로 DOM 업데이트
                // getRelativeTime 함수가 호출되면서 시간이 갱신됨
                if (this.workspaceDocument) {
                    // 강제로 리렌더링 트리거 (Alpine.js가 변경 감지하도록)
                    this.workspaceDocument = { ...this.workspaceDocument };
                }
            }, 30000); // 30초
        },

        // 문서 해시 생성 (변경 감지용)
        getDocumentHash(doc) {
            // 간단한 해시 생성 (JSON 문자열화)
            return JSON.stringify(doc);
        },

        // 유틸리티: 상대 시간 표시
        getRelativeTime(timestamp) {
            if (!timestamp) return '방금 전';

            const now = new Date();
            const past = new Date(timestamp);
            const diffInSeconds = Math.floor((now - past) / 1000);

            if (diffInSeconds < 60) return '방금 전';
            if (diffInSeconds < 3600) {
                const minutes = Math.floor(diffInSeconds / 60);
                return `${minutes}분 전`;
            }
            if (diffInSeconds < 86400) {
                const hours = Math.floor(diffInSeconds / 3600);
                return `${hours}시간 전`;
            }
            const days = Math.floor(diffInSeconds / 86400);
            if (days === 1) return '어제';
            if (days < 7) return `${days}일 전`;
            if (days < 30) {
                const weeks = Math.floor(days / 7);
                return `${weeks}주 전`;
            }
            const months = Math.floor(days / 30);
            if (months < 12) return `${months}개월 전`;
            return '1년 이상';
        },

        // 키보드 단축키 설정
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+S: 저장
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.saveDocument();
                }
                // Ctrl+N: 새 문서
                if (e.ctrlKey && e.key === 'n') {
                    e.preventDefault();
                    this.newDocument();
                }
                // Ctrl+P: 인쇄
                if (e.ctrlKey && e.key === 'p') {
                    e.preventDefault();
                    this.printDocument();
                }
                // Ctrl+R: 새로고침 (기본 동작)
                // 입력 필드 재활성화 기능 제거 - Alpine.js가 자동으로 처리해야 함
            });
        },

        // 구글드라이브 인증 상태 확인
        async checkGoogleDriveAuth() {
            if (window.electronAPI) {
                try {
                    const result = await window.electronAPI.googleDriveSync('check-auth');
                    if (result.success) {
                        this.googleDriveAuth = result.authenticated;
                    }
                } catch (error) {
                    console.error('인증 상태 확인 실패:', error);
                }
            }
        },

        // 구글드라이브 로그인
        async googleDriveLogin() {
            if (window.electronAPI) {
                try {
                    this.statusMessage = '구글 로그인 중...';
                    const result = await window.electronAPI.googleDriveSync('login');
                    if (result.success) {
                        this.googleDriveAuth = true;
                        this.statusMessage = '구글드라이브 연결됨 - 새로고침 중...';
                        // 자동 동기화 시작 (객체를 JSON 직렬화 가능하게)
                        const autoSyncConfig = JSON.parse(JSON.stringify({ interval: 60000 }));
                        await window.electronAPI.googleDriveSync('start-auto-sync', autoSyncConfig);

                        // 새로고침으로 완전한 초기 상태로 리셋
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    } else {
                        this.statusMessage = '로그인 실패: ' + result.message;
                    }
                } catch (error) {
                    console.error('로그인 실패:', error);
                    this.statusMessage = '로그인 실패';
                }
            } else {
                alert('구글드라이브 연동은 Electron 앱에서만 사용 가능합니다.');
            }
        },

        // 구글드라이브 로그아웃
        async googleDriveLogout() {
            if (window.electronAPI) {
                try {
                    await window.electronAPI.googleDriveSync('stop-auto-sync');
                    await window.electronAPI.googleDriveSync('logout');
                    this.googleDriveAuth = false;
                    this.statusMessage = '구글드라이브 연결 해제됨 - 새로고침 중...';

                    // 새로고침으로 완전한 초기 상태로 리셋
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                } catch (error) {
                    console.error('로그아웃 실패:', error);
                }
            }
        },

        // 구글드라이브 동기화
        // 클라우드에 수동 저장 (이중 저장 체계)
        async saveToCloud() {
            if (!this.currentDoc.id) {
                alert('저장할 문서가 없습니다.');
                return;
            }

            // 현재 양식의 workspace에 문서가 있는지 확인
            const workspaceDoc = await this.formStorage.getFromWorkspace(this.currentFormType, this.currentDoc.id);
            if (!workspaceDoc) {
                alert('현재 양식에 해당하는 문서가 없습니다.');
                return;
            }

            if (!confirm('클라우드에 저장하시겠습니까?\n팀 전체와 공유됩니다.')) {
                return;
            }

            // 로딩 오버레이 표시
            const overlay = showLoadingOverlay(
                '클라우드에 저장 중입니다...',
                '다른 작업을 하지 말고 잠시만 기다려주세요.'
            );

            try {
                this.googleDriveSyncing = true;
                this.statusMessage = '클라우드 저장 중...';

                // currentDoc을 순수 객체로 변환 (Alpine.js Proxy 제거)
                const plainDoc = JSON.parse(JSON.stringify(this.currentDoc));

                // StorageManager를 통해 클라우드 저장 (현재 양식 타입 명시)
                const result = await storageManager.saveToCloud(plainDoc, this.currentFormType);

                if (result.success) {
                    // 클라우드 저장 성공 후 상태 업데이트
                    this.currentDoc.isSyncedToCloud = true;
                    this.currentDoc.lastSaved = new Date().toISOString();

                    // Workspace에서 삭제
                    await this.formStorage.deleteFromWorkspace(this.currentFormType, this.currentDoc.id);
                    this.workspaceDocument = null;

                    // DocStateManager Workspace 클리어
                    this.docStateManager.clearWorkspaceDoc(this.currentFormType);

                    // 초기화 상태로 전환 (새 문서 생성 대신 메인화면 초기화)
                    await this.setCurrentDocument(null, {
                        type: 'cloud-save-complete',
                        message: '클라우드 저장이 완료되었습니다. 새로운 작업을 시작하세요.'
                    });

                    // 문서 목록 새로고침
                    await this.loadDocuments();

                    this.statusMessage = '클라우드 저장 완료';
                    this.showNotification('클라우드에 저장되었습니다. 작업 공간이 비워졌습니다.');
                } else {
                    this.statusMessage = '클라우드 저장 실패';
                    alert('클라우드 저장 실패: ' + (result.error || '알 수 없는 오류'));
                }
            } catch (error) {
                console.error('클라우드 저장 실패:', error);
                this.statusMessage = '클라우드 저장 실패';
                alert('클라우드 저장 중 오류 발생: ' + error.message);
            } finally {
                this.googleDriveSyncing = false;
                // 오버레이 제거 (반드시 실행)
                hideLoadingOverlay(overlay);
            }
        },

        // 동기화 설명과 함께 실행
        async syncWithExplanation() {
            // 양식 선택 여부 확인
            if (this.currentFormType === 'none') {
                alert('양식을 먼저 선택해주세요.');
                return;
            }

            // 이미 동기화 중인지 확인
            if (this.googleDriveSyncing) {
                alert('이미 동기화가 진행 중입니다.');
                return;
            }

            const message = `📋 동기화 기능 안내\n\n` +
                `이 기능은 Google Drive에 저장된 문서를 로컬로 가져옵니다.\n\n` +
                `• Google Drive의 최신 문서 목록을 가져옵니다\n` +
                `• 로컬 캐시를 업데이트합니다\n` +
                `• 클라우드 문서 목록이 새로고침됩니다\n\n` +
                `계속하시겠습니까?`;

            if (confirm(message)) {
                await this.pullFromCloud();
            }
        },

        // 클라우드에서 최신 데이터 가져오기
        async pullFromCloud() {
            // 양식 선택 여부 확인
            if (this.currentFormType === 'none') {
                alert('양식을 먼저 선택해주세요.');
                return;
            }

            // 이미 동기화 중인지 확인
            if (this.googleDriveSyncing) {
                alert('이미 동기화가 진행 중입니다.');
                return;
            }

            // 로딩 오버레이 표시
            const overlay = showLoadingOverlay(
                '클라우드에서 데이터 가져오는 중...',
                '문서 목록을 동기화하고 있습니다. 잠시만 기다려주세요.'
            );

            try {
                this.googleDriveSyncing = true;
                this.statusMessage = '클라우드에서 데이터 가져오는 중...';

                const result = await storageManager.pullFromCloud();

                if (result.success) {
                    await this.loadDocuments();

                    // 동기화 완료 후 빈 화면 유지 (saveToCloud와 동일한 동작)
                    // 사용자가 수동으로 새 문서를 생성하거나 클라우드 문서를 선택할 수 있음

                    this.statusMessage = `클라우드 동기화 완료 (${result.count || 0}개 문서)`;
                } else {
                    // 이미 동기화 중인 경우 알림 표시
                    if (result.error === '이미 동기화가 진행 중입니다') {
                        alert(result.error);
                    }
                    this.statusMessage = '클라우드 동기화 실패';
                }
            } catch (error) {
                console.error('클라우드 동기화 실패:', error);
                this.statusMessage = '동기화 실패';
            } finally {
                this.googleDriveSyncing = false;
                // 오버레이 제거 (반드시 실행)
                hideLoadingOverlay(overlay);
            }
        },

        // 기존 googleDriveSync 메서드 (호환성 유지)
        async googleDriveSync() {
            await this.pullFromCloud();
        },

        // 클라우드 데이터 병합
        async mergeCloudData(cloudData) {
            if (cloudData && cloudData.documents) {
                // 간단한 병합: 클라우드 데이터로 덮어쓰기
                // 실제로는 더 복잡한 병합 로직이 필요할 수 있음
                for (const doc of cloudData.documents) {
                    await this.db.saveDocument(doc);
                }
                await this.loadDocuments();
            }
        },

        // 알림 표시
        showNotification(message, duration = 3000) {
            this.statusMessage = message;
            setTimeout(() => {
                if (this.statusMessage === message) {
                    this.statusMessage = '준비됨';
                }
            }, duration);
        },

        // 양식 타입 변경 (DocStateManager 활용)
        async switchFormType(formType) {
            if (this.currentFormType === formType) return;

            // 중앙 초기화 지점을 통한 양식 전환
            await this.initializeFormType(formType);

            // 기존 스토리지 매니저 동기화
            await storageManager.switchFormType(formType);

            this.showNotification(`양식 전환: ${this.getFormTypeName(formType)}`);
        },

        // 양식 타입 이름 가져오기
        getFormTypeName(formType) {
            const names = {
                'expense-report': '지출결의서',
                'purchase-order': '구매요청서',
                'travel-report': '출장보고서',
                'none': '양식을 선택하세요'
            };
            return names[formType] || formType;
        },

        // 사용 가능한 양식 목록
        getAvailableFormTypes() {
            return storageManager.getAvailableFormTypes();
        },

        // === 첨부파일 시스템 ===
        attachmentManager: null,
        attachments: [],
        showAttachmentModal: false,

        // 첨부파일 관리자 초기화
        async initAttachmentManager() {
            this.attachmentManager = new AttachmentManager();
            if (this.currentDoc.id) {
                await this.loadAttachments();
            }
        },

        // 첨부파일 로드
        async loadAttachments() {
            if (!this.currentDoc.id) return;

            // AttachmentManager는 메타데이터만 메모리에 저장하므로
            // 문서의 attachments 필드에서 직접 가져옴
            this.attachments = this.currentDoc.attachments || [];
        },

        // 파일 업로드
        async uploadFiles(event) {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            const results = [];
            for (const file of files) {
                try {
                    const attachment = await this.attachmentManager.addAttachment(this.currentDoc.id, file);
                    results.push({ success: true, attachment });
                } catch (error) {
                    results.push({ success: false, error: error.message, fileName: file.name });
                }
            }

            // 성공한 파일들 목록 갱신
            await this.loadAttachments();

            // 결과 메시지 표시
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            let message = '';
            if (successCount > 0) {
                message += `${successCount}개 파일 업로드 성공`;
            }
            if (failCount > 0) {
                message += (message ? ', ' : '') + `${failCount}개 파일 실패`;
                const failures = results.filter(r => !r.success);
                failures.forEach(f => {
                    console.error(`${f.fileName}: ${f.error}`);
                });
            }

            this.showNotification(message);
        },

        // 첨부파일 삭제
        async deleteAttachment(attachmentId) {
            if (confirm('이 첨부파일을 삭제하시겠습니까?')) {
                const success = await this.attachmentManager.deleteAttachment(this.currentDoc.id, attachmentId);
                if (success) {
                    await this.loadAttachments();
                    this.showNotification('첨부파일이 삭제되었습니다');
                }
            }
        },

        // 첨부파일 다운로드
        downloadAttachment(attachment) {
            this.attachmentManager.downloadAttachment(attachment);
        },

        // 첨부파일 미리보기
        previewAttachment(attachment) {
            const previewUrl = this.attachmentManager.getPreviewUrl(attachment);
            if (previewUrl) {
                window.open(previewUrl, '_blank');
            } else {
                alert('이 파일은 미리보기를 지원하지 않습니다');
            }
        },

        // 파일 크기 포맷
        formatFileSize(bytes) {
            return this.attachmentManager.formatFileSize(bytes);
        },

        // 파일 아이콘 가져오기
        getFileIcon(mimeType) {
            return this.attachmentManager.getFileIcon(mimeType);
        },

        // ========== 양식 관리 메서드 ==========

        // 양식 목록 로드
        async loadFormList() {
            try {
                this.isLoading = true;
                this.statusMessage = '양식 목록 로딩 중...';

                // FormRegistry를 통해 양식 목록 가져오기
                const forms = await this.formRegistry.fetchAvailableForms();
                this.availableForms = forms;

                // 기본 양식이 없으면 expense-report 추가
                if (this.availableForms.length === 0) {
                    this.availableForms = [{
                        id: 'expense-report',
                        name: '지출결의서',
                        isDefault: true
                    }];
                }

                this.statusMessage = `${this.availableForms.length}개 양식 로드됨`;
            } catch (error) {
                console.error('양식 목록 로드 실패:', error);
                this.statusMessage = '양식 목록 로드 실패';

                // 오프라인 폴백
                this.availableForms = [{
                    id: 'expense-report',
                    name: '지출결의서',
                    isDefault: true
                }];
            } finally {
                this.isLoading = false;
            }
        },

        // 양식 목록 새로고침
        async refreshFormList() {
            try {
                // 1. 먼저 'none' 상태로 전환하고 문서 목록 비우기
                this.currentFormType = 'none';

                // 2. 양식 목록 새로고침
                if (this.formRegistry) {
                    // refreshCache() 자체가 fetchAvailableForms()를 호출하므로
                    // loadFormList()는 중복 호출을 피하기 위해 생략
                    const forms = await this.formRegistry.refreshCache();
                    this.availableForms = forms;

                    // 기본 양식이 없으면 expense-report 추가
                    if (this.availableForms.length === 0) {
                        this.availableForms = [{
                            id: 'expense-report',
                            name: '지출결의서',
                            isDefault: true
                        }];
                    }

                    // 3. loadDocuments()를 호출하여 'none' 상태 처리
                    await this.loadDocuments();

                } else {
                    await this.loadFormList();
                }
            } catch (error) {
                console.error('[refreshFormList] 오류:', error);
                await this.setCurrentDocument(null, {
                    type: 'error',
                    message: '양식 목록 새로고침 중 오류가 발생했습니다.'
                });
            }
        },

        // 양식 전환 (DocStateManager 활용)
        async switchForm(formId) {
            try {
                if (this.currentFormType === formId) return;

                // "준비중" 양식 선택 시 안내 메시지
                if (formId.startsWith('coming-soon')) {
                    alert('이 양식은 아직 준비 중입니다.\n곧 업데이트를 통해 제공될 예정입니다.');
                    return;
                }

                // 현재 작업 저장 확인 (변경사항이 있을 때만)
                if (this.currentDoc.id && !this.isDocumentSaved) {
                    if (!confirm('현재 작업을 저장하지 않고 양식을 변경하시겠습니까?')) {
                        return;
                    }
                }

                // 양식 전환 플래그 설정 (loadDocuments 강제 초기화 방지용)
                this.isSwitchingForm = true;
                this.isLoading = true;
                this.statusMessage = `'${formId}' 양식으로 전환 중...`;

                // 현재 문서를 DocStateManager에 저장
                if (this.currentDoc && this.currentDoc.id) {
                    this.docStateManager.saveCurrentState(this.currentDoc);
                }

                // FormRegistry를 통해 양식 템플릿 로드
                const template = await this.formRegistry.switchForm(formId);

                // FormStorage의 양식 타입도 변경
                this.formStorage.setFormType(formId);
                const prevFormType = this.currentFormType;
                this.currentFormType = formId;

                // DocStateManager 컨텍스트 전환
                this.docStateManager.switchContext(formId, 'workspace');

                // 템플릿 적용
                await this.applyFormTemplate(template);

                // StorageManager 양식 전환 및 클라우드 동기화
                await storageManager.switchFormType(formId);

                // 문서 목록 다시 로드 (해당 양식의 문서만)
                await this.loadDocuments();

                // 새 양식의 기존 workspace 문서 확인 및 검증
                const savedDoc = this.docStateManager.getWorkspaceDoc(formId);

                if (savedDoc && savedDoc.id && this.workspaceDocument && this.workspaceDocument.id === savedDoc.id) {
                    // DocStateManager와 실제 workspace가 일치하면 복원
                    this.currentDoc = { ...savedDoc };

                    // DocStateManager 컨텍스트 설정
                    this.docStateManager.switchContext(formId, 'workspace', savedDoc.id);
                } else if (this.workspaceDocument && this.workspaceDocument.id) {
                    // workspace에 문서가 있으면 그것을 사용
                    this.currentDoc = { ...this.workspaceDocument };

                    // DocStateManager에도 저장
                    this.docStateManager.switchContext(formId, 'workspace', this.workspaceDocument.id);
                    this.docStateManager.saveCurrentState(this.workspaceDocument);
                } else {
                    // 새 문서로 초기화
                    await this.newDocument();
                }

                this.statusMessage = `'${formId}' 양식으로 전환됨`;
            } catch (error) {
                console.error('양식 전환 실패:', error);
                alert(`양식 전환 실패: ${error.message}`);
            } finally {
                this.isSwitchingForm = false;  // 양식 전환 플래그 해제
                this.isLoading = false;
            }
        },

        // 양식 템플릿 적용
        async applyFormTemplate(template) {
            try {

                // 지출결의서는 기본 템플릿이 이미 HTML에 있으므로 원복
                if (this.currentFormType === 'expense-report') {
                    // 기본 템플릿 복원
                    const previewContainer = document.querySelector('.preview-container');
                    if (previewContainer && this.originalExpenseTemplate) {
                        previewContainer.innerHTML = this.originalExpenseTemplate;
                    }
                    this.updateFormFields(null);
                    return;
                }

                // 다른 양식들은 동적으로 템플릿 적용
                const previewContainer = document.querySelector('.preview-container');
                if (previewContainer && template && template.content) {
                    // 템플릿 내용이 올바른지 확인
                    if (typeof template.content === 'string') {
                        // 기존 내용 제거
                        previewContainer.innerHTML = '';

                        // 새 템플릿 적용
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = template.content;

                        // doc-content 영역 찾기
                        const docContent = tempDiv.querySelector('.doc-content');
                        if (docContent) {
                            previewContainer.innerHTML = docContent.outerHTML;
                        } else {
                            // 전체 템플릿 적용
                            previewContainer.innerHTML = template.content;
                        }
                    } else {
                        console.error('템플릿 내용이 문자열이 아닙니다:', template.content);
                    }
                }

                // 양식별 필드 구조 업데이트
                this.updateFormFields(template.config);
            } catch (error) {
                console.error('템플릿 적용 실패:', error);
            }
        },

        // 양식별 필드 구조 업데이트
        updateFormFields(formConfig) {
            if (!formConfig) return;

            // 양식별 필드 매핑
            const fieldMappings = {
                'none': {
                    title: '제목',
                    message: '양식을 선택하세요'
                },
                'expense-report': {
                    title: '지출결의 제목',
                    department: '사용처',
                    requester: '사용자',
                    category: '지출과목',
                    vendor: '구입처',
                    amount: '지출금액'
                },
                'purchase-order': {
                    title: '구매요청 제목',
                    department: '요청부서',
                    requestor: '요청자',
                    vendor: '공급업체',
                    items: '구매항목',
                    total: '총액'
                },
                'travel-report': {
                    title: '출장보고서 제목',
                    department: '부서',
                    traveler: '출장자',
                    destination: '출장지',
                    period: '출장기간',
                    purpose: '출장목적'
                }
            };

            // 현재 양식의 필드 매핑 적용
            this.currentFieldLabels = fieldMappings[this.currentFormType] || fieldMappings['none'];
        },

        // 구매요청서 합계 계산
        calculatePurchaseTotal() {
            if (!this.currentDoc.items) return 0;
            return this.currentDoc.items.reduce((sum, item) => {
                const quantity = item.quantity || 0;
                const unitPrice = item.unitPrice || 0;
                return sum + (quantity * unitPrice);
            }, 0);
        },

        // 양식 아이콘 가져오기
        getFormIcon(formId) {
            const icons = {
                'expense-report': '💰',
                'purchase-order': '🛒',
                'travel-report': '✈️',
                'base-template': '📄'
            };
            return icons[formId] || '📋';
        },

        // 양식별 필드 값 가져오기 (동적 템플릿용)
        getFieldValue(key) {
            return this.currentDoc[key] || '';
        },

        // 품목별 값 가져오기 (동적 템플릿용)
        getItemValue(item, key) {
            if (key === 'total') {
                return this.formatCurrency((item.quantity || 0) * (item.unitPrice || 0));
            }
            return item[key] || '';
        },

        // 합계 계산 (동적 템플릿용)
        calculateTotal() {
            if (!this.currentDoc.items) return 0;
            return this.currentDoc.items.reduce((sum, item) => {
                return sum + ((item.quantity || 0) * (item.unitPrice || 0));
            }, 0);
        },

        // 유틸리티 함수들 (템플릿에서 사용)
        toKoreanAmount,
        formatCurrency,
        formatDate,
        formatDateTime
}));

// Alpine 시작
Alpine.start();