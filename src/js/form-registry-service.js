/**
 * 양식 레지스트리 서비스
 * Google Drive 폴더 기반 동적 양식 관리
 */
class FormRegistryService {
    constructor() {
        this.forms = new Map();
        this.templates = new Map();
        this.currentForm = null;
        this.localCachePath = 'forms/cache/';
        this.driveRootFolder = 'RND-Form';
        this.templatesFolder = 'templates';

        // 중복 실행 방지 플래그
        this.isLoading = false;


        // 한글 폴더명 매핑
        this.folderMapping = {
            '지출결의서': 'expense-report',
            '구매요청서': 'purchase-order',
            '출장보고서': 'travel-report',
            '일반문서': 'general-document',
            '템플릿': 'templates',
            '선택 대기': 'none'
        };

        // 역매핑 (영문 -> 한글)
        this.reverseFolderMapping = {
            'expense-report': '지출결의서',
            'purchase-order': '구매요청서',
            'travel-report': '출장보고서',
            'general-document': '일반문서',
            'templates': '템플릿',
            'none': '양식을 선택하세요'
        };
    }

    /**
     * Google Drive에서 사용 가능한 양식 목록 가져오기
     */
    async fetchAvailableForms() {
        // 중복 실행 방지
        if (this.isLoading) {
            console.log('FormRegistry: 이미 로딩 중 - 중복 실행 방지');
            return Array.from(this.forms.values());
        }

        this.isLoading = true;
        try {
            // 로컬 전용 모드: form-config.json만 사용
            console.log('FormRegistry: 로컬 전용 모드로 양식 로드');

            const localConfig = await this.loadLocalConfig();
            if (localConfig) {
                const forms = Object.entries(localConfig).map(([id, config]) => ({
                    ...config,
                    source: 'local'
                }));

                this.forms = new Map(forms.map(f => [f.id, f]));
                console.log('FormRegistry: 로컬 양식 로드 완료:', forms.map(f => f.id));
                return forms;
            }

            // 로컬 설정이 없으면 기본 양식 사용
            console.warn('FormRegistry: form-config.json을 찾을 수 없음, 기본 양식 사용');
            const forms = await this.loadLocalForms();
            this.forms = new Map(forms.map(f => [f.id, f]));
            return forms;
        } catch (error) {
            console.error('Error fetching forms:', error);
            // 오류 시 기본 양식 사용
            return this.loadLocalForms();
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 로컬 form-config.json 파일 로드
     */
    async loadLocalConfig() {
        try {
            const response = await fetch('/forms/form-config.json');
            if (response.ok) {
                const config = await response.json();
                console.log('FormRegistry: form-config.json 로드 성공');
                return config;
            } else {
                console.warn('FormRegistry: form-config.json 로드 실패 - ', response.status);
                return null;
            }
        } catch (error) {
            console.error('FormRegistry: form-config.json 로드 오류:', error);
            return null;
        }
    }

    /**
     * 기본 로컬 양식 로드 (폴백용)
     */
    async loadLocalForms() {
        console.log('FormRegistry: 기본 양식 사용');
        return [
            {
                id: 'expense-report',
                name: '지출결의서',
                displayName: '지출결의서',
                template: 'forms/expense-report/template.html',
                icon: '💰',
                description: '경비 및 지출 결의를 위한 양식',
                isDefault: true,
                source: 'local'
            }
        ];
    }

    /**
     * 폴더 내 양식 메타데이터 파일 가져오기
     */
    async fetchFormMetadata(folderId, folderName) {
        try {
            // form-meta.json 파일 찾기
            const metaFile = await window.electronAPI.drive.findFile(
                folderId,
                'form-meta.json'
            );

            if (metaFile) {
                const content = await window.electronAPI.drive.downloadFile(metaFile.id);
                // content가 이미 객체인 경우와 문자열인 경우 처리
                const metadata = typeof content === 'string' ? JSON.parse(content) : content;
                metadata.folderId = folderId;
                metadata.folderName = folderName;
                return metadata;
            }
        } catch (error) {
            console.warn(`No metadata found for form ${folderName}:`, error);
        }
        return null;
    }


    /**
     * 양식 템플릿 로드
     */
    async loadFormTemplate(formId) {
        try {
            const form = this.forms.get(formId);
            if (!form) {
                throw new Error(`Form ${formId} not found`);
            }

            // 캐시 확인
            if (this.templates.has(formId)) {
                return this.templates.get(formId);
            }

            let templateContent = '';
            let formConfig = form;

            // Google Drive에서 템플릿 다운로드 시도
            if (form.folderId && window.electronAPI?.drive) {
                try {
                    const templateFile = await window.electronAPI.drive.findFile(
                        form.folderId,
                        'template.html'
                    );

                    if (templateFile) {
                        templateContent = await window.electronAPI.drive.downloadFile(templateFile.id);
                        // 로컬 캐시에 저장
                        this.cacheTemplate(formId, templateContent);
                    }
                } catch (error) {
                    console.warn('Could not fetch template from Drive:', error);
                }
            }

            // 로컬 템플릿 폴백
            if (!templateContent) {
                const templatePath = form.template || `/forms/${formId}/template.html`;
                const response = await fetch(templatePath);
                if (response.ok) {
                    templateContent = await response.text();
                } else if (form.useBaseTemplate !== false) {
                    // 기본 템플릿 사용
                    const baseResponse = await fetch('/forms/base-template.html');
                    if (baseResponse.ok) {
                        templateContent = await baseResponse.text();
                    }
                }
            }

            const template = {
                id: formId,
                content: templateContent,
                config: formConfig
            };

            this.templates.set(formId, template);
            return template;
        } catch (error) {
            console.error(`Error loading template for ${formId}:`, error);
            throw error;
        }
    }

    /**
     * 템플릿 로컬 캐시 저장
     */
    cacheTemplate(formId, content) {
        try {
            const cacheKey = `template_${formId}`;
            localStorage.setItem(cacheKey, content);
            localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
        } catch (error) {
            console.warn('Could not cache template:', error);
        }
    }

    /**
     * 양식 전환
     */
    async switchForm(formId) {
        try {
            const template = await this.loadFormTemplate(formId);
            this.currentForm = formId;

            // 이벤트 발생
            window.dispatchEvent(new CustomEvent('formSwitched', {
                detail: {
                    formId,
                    template,
                    config: this.forms.get(formId)
                }
            }));

            return template;
        } catch (error) {
            console.error('Error switching form:', error);
            throw error;
        }
    }

    /**
     * 양식별 저장소 경로 가져오기
     */
    getFormStoragePath(formId) {
        const form = this.forms.get(formId);
        // Google Drive에서는 한글 폴더명 사용
        if (form?.folderName) {
            return form.folderName;
        }
        // 로컬에서는 영문 ID 사용
        return formId;
    }

    /**
     * 한글 폴더명을 영문 ID로 변환
     */
    convertToFormId(folderName) {
        return this.folderMapping[folderName] || folderName;
    }

    /**
     * 영문 ID를 한글 폴더명으로 변환
     */
    convertToFolderName(formId) {
        return this.reverseFolderMapping[formId] || formId;
    }

    /**
     * 폴더명을 읽기 좋은 형태로 변환
     */
    formatFormName(folderName) {
        const nameMap = {
            'expense-report': '지출결의서',
            'purchase-order': '구매요청서',
            'travel-report': '출장보고서',
            'templates': '템플릿'
        };
        return nameMap[folderName] || folderName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * 양식 메타데이터 업데이트 (Google Drive에 저장)
     */
    async updateFormMetadata(formId, metadata) {
        try {
            const form = this.forms.get(formId);
            if (!form || !form.folderId) {
                throw new Error('Form folder not found in Drive');
            }

            const metaContent = JSON.stringify({
                ...metadata,
                id: formId,
                updatedAt: new Date().toISOString()
            }, null, 2);

            // Google Drive에 메타데이터 파일 업로드
            await window.electronAPI.drive.uploadFile(
                form.folderId,
                'form-meta.json',
                metaContent,
                'application/json'
            );

            // 로컬 캐시 업데이트
            Object.assign(form, metadata);
            this.forms.set(formId, form);
            this.saveLocalCache();

            return true;
        } catch (error) {
            console.error('Error updating form metadata:', error);
            throw error;
        }
    }

    /**
     * 로컬 캐시 저장
     */
    saveLocalCache() {
        try {
            const formsObj = {};
            this.forms.forEach((value, key) => {
                formsObj[key] = value;
            });
            localStorage.setItem('formRegistry', JSON.stringify(formsObj));
            localStorage.setItem('formRegistry_timestamp', Date.now().toString());
        } catch (error) {
            console.warn('Could not save local cache:', error);
        }
    }

    /**
     * 캐시 새로고침
     */
    async refreshCache() {
        this.forms.clear();
        this.templates.clear();
        return await this.fetchAvailableForms();
    }

    /**
     * 양식 설정 가져오기
     */
    getFormConfig(formId) {
        // 'none' 타입은 가상의 빈 양식 설정 반환
        if (formId === 'none') {
            return {
                id: 'none',
                name: '양식을 선택하세요',
                fields: [],
                templates: {},
                description: '사용할 양식을 선택해주세요',
                source: 'virtual'
            };
        }
        return this.forms.get(formId);
    }

    /**
     * 모든 양식 목록 가져오기
     */
    getAllForms() {
        return Array.from(this.forms.values());
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
const formRegistry = new FormRegistryService();

// 전역 객체에 추가 (Alpine.js에서 접근 가능)
if (typeof window !== 'undefined') {
    window.formRegistry = formRegistry;
}

export default formRegistry;