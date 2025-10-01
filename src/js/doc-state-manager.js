/**
 * DocStateManager - 양식별 문서 상태 관리자
 *
 * 각 양식과 저장소 조합별로 독립적인 currentDoc을 유지하여
 * 양식 전환 시 문서 유실 문제를 해결합니다.
 */
export class DocStateManager {
    constructor() {
        // 양식별 문서 상태 저장소
        // 구조: { 'form-type': { workspace: {...}, cache: {} } }
        this.states = {};

        // 현재 컨텍스트 정보
        this.currentContext = {
            formType: null,
            storageType: null,
            docId: null
        };

        // 기본 문서 템플릿 생성 함수
        this.createDefaultDoc = null;
    }

    /**
     * 기본 문서 템플릿 생성 함수 설정
     */
    setDefaultDocCreator(creator) {
        this.createDefaultDoc = creator;
    }

    /**
     * 양식 타입 등록 및 초기화
     */
    registerFormType(formType) {
        if (!this.states[formType]) {
            this.states[formType] = {
                workspace: null,  // 작업 중인 문서 (단일)
                cache: {}        // 캐시된 문서들 (복수)
            };
            console.log(`DocStateManager: 양식 '${formType}' 등록됨`);
        }
    }

    /**
     * 모든 양식 타입 등록
     */
    registerAllFormTypes(formTypes) {
        formTypes.forEach(type => this.registerFormType(type));
    }

    /**
     * 현재 컨텍스트 전환 (양식 변경 시)
     */
    switchContext(formType, storageType = 'workspace', docId = null) {
        // 이전 컨텍스트의 문서 저장은 app.js에서 처리

        // 양식이 등록되어 있지 않으면 등록
        this.registerFormType(formType);

        // 컨텍스트 변경
        const prevContext = { ...this.currentContext };
        this.currentContext = {
            formType,
            storageType,
            docId
        };

        console.log('DocStateManager: 컨텍스트 전환', {
            from: prevContext,
            to: this.currentContext
        });

        return this.getCurrentDoc();
    }

    /**
     * 현재 문서 상태 저장
     */
    saveCurrentState(doc) {
        const { formType, storageType, docId } = this.currentContext;

        if (!formType) {
            console.warn('DocStateManager: formType이 설정되지 않음');
            return false;
        }

        this.registerFormType(formType);

        if (storageType === 'workspace') {
            // Workspace는 단일 문서
            this.states[formType].workspace = doc ? { ...doc } : null;
        } else if (storageType === 'cache' && docId) {
            // Cache는 복수 문서
            if (doc) {
                this.states[formType].cache[docId] = { ...doc };
            } else {
                delete this.states[formType].cache[docId];
            }
        }

        console.log(`DocStateManager: 상태 저장 - ${formType}/${storageType}`, doc?.id);
        return true;
    }

    /**
     * 현재 컨텍스트의 문서 반환
     */
    getCurrentDoc() {
        const { formType, storageType, docId } = this.currentContext;

        if (!formType) {
            return null;
        }

        this.registerFormType(formType);

        let doc = null;

        if (storageType === 'workspace') {
            doc = this.states[formType].workspace;
        } else if (storageType === 'cache' && docId) {
            doc = this.states[formType].cache[docId];
        }

        // 문서가 없으면 기본 템플릿 생성
        if (!doc && this.createDefaultDoc && storageType === 'workspace') {
            doc = this.createDefaultDoc();
            this.states[formType].workspace = doc;
        }

        return doc;
    }

    /**
     * 특정 양식의 workspace 문서 가져오기
     */
    getWorkspaceDoc(formType) {
        this.registerFormType(formType);
        return this.states[formType].workspace;
    }

    /**
     * 특정 양식의 workspace 문서 설정
     */
    setWorkspaceDoc(formType, doc) {
        this.registerFormType(formType);
        this.states[formType].workspace = doc ? { ...doc } : null;
        console.log(`DocStateManager: Workspace 문서 설정 - ${formType}`, doc?.id);
    }

    /**
     * 특정 양식의 workspace 문서 삭제
     */
    clearWorkspaceDoc(formType) {
        this.registerFormType(formType);
        this.states[formType].workspace = null;
        console.log(`DocStateManager: Workspace 문서 삭제 - ${formType}`);
    }

    /**
     * 양식 전환 시 현재 문서 저장 후 새 양식 문서 로드
     */
    async switchFormWithSave(newFormType, getCurrentDocFn, saveDocFn) {
        const { formType: oldFormType } = this.currentContext;

        // 현재 문서가 있으면 저장
        if (oldFormType && getCurrentDocFn) {
            const currentDoc = getCurrentDocFn();
            if (currentDoc) {
                this.saveCurrentState(currentDoc);

                // 실제 저장이 필요한 경우 saveDocFn 호출
                if (saveDocFn && currentDoc.id && !currentDoc.isSaved) {
                    await saveDocFn();
                }
            }
        }

        // 새 양식으로 전환
        return this.switchContext(newFormType, 'workspace');
    }

    /**
     * 모든 양식의 workspace 문서 ID 목록 반환
     */
    getAllWorkspaceDocIds() {
        const ids = {};
        Object.keys(this.states).forEach(formType => {
            const doc = this.states[formType].workspace;
            if (doc && doc.id) {
                ids[formType] = doc.id;
            }
        });
        return ids;
    }

    /**
     * 디버깅용: 현재 상태 출력
     */
    debugState() {
        console.group('DocStateManager 상태');
        console.log('현재 컨텍스트:', this.currentContext);
        console.log('양식별 상태:', this.states);
        console.log('Workspace 문서 IDs:', this.getAllWorkspaceDocIds());
        console.groupEnd();
    }

    /**
     * 모든 상태 초기화
     */
    reset() {
        this.states = {};
        this.currentContext = {
            formType: null,
            storageType: null,
            docId: null
        };
        console.log('DocStateManager: 모든 상태 초기화됨');
    }
}