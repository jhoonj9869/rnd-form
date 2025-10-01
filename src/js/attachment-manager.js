// 첨부파일 관리 시스템 (Google Drive 연동)
import { backgroundUploader } from './background-uploader.js';

class AttachmentManager {
    constructor() {
        this.attachments = {}; // 메타데이터만 저장
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
        ];
    }

    // 파일 검증
    validateFile(file) {
        if (file.size > this.maxFileSize) {
            throw new Error(`파일 크기는 ${this.maxFileSize / 1024 / 1024}MB를 초과할 수 없습니다.`);
        }

        if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(file.type)) {
            throw new Error('지원하지 않는 파일 형식입니다.');
        }

        return true;
    }

    // 파일 추가 (Google Drive 업로드)
    async addAttachment(documentId, file) {
        try {
            this.validateFile(file);

            // 백그라운드 업로더에 추가
            const metadata = await backgroundUploader.addToQueue(
                documentId,
                file,
                // 진행률 콜백
                (progress) => {
                    console.log(`업로드 진행: ${progress.loaded}/${progress.total}`);
                },
                // 완료 콜백
                (result) => {
                    // 메타데이터 업데이트
                    const attachment = this.attachments[documentId]?.find(a => a.id === result.taskId);
                    if (attachment) {
                        attachment.driveFileId = result.driveFileId;
                        attachment.uploadStatus = 'completed';
                        attachment.webViewLink = result.webViewLink;
                        attachment.webContentLink = result.webContentLink;
                    }
                },
                // 에러 콜백
                (error) => {
                    console.error('업로드 실패:', error);
                    const attachment = this.attachments[documentId]?.find(a => a.id === error.taskId);
                    if (attachment) {
                        attachment.uploadStatus = 'failed';
                        attachment.error = error.error;
                    }
                }
            );

            // 메타데이터 저장
            if (!this.attachments[documentId]) {
                this.attachments[documentId] = [];
            }

            this.attachments[documentId].push(metadata);
            return metadata;
        } catch (error) {
            console.error('첨부파일 추가 실패:', error);
            throw error;
        }
    }

    // 첨부파일 삭제 (Google Drive에서)
    async deleteAttachment(documentId, attachmentId) {
        const attachment = this.attachments[documentId]?.find(a => a.id === attachmentId);
        if (!attachment) return false;

        try {
            // Google Drive에서 삭제
            if (attachment.driveFileId && window.electronAPI) {
                const result = await window.electronAPI.googleDriveSync('delete-attachment', {
                    fileId: attachment.driveFileId
                });

                if (!result.success) {
                    throw new Error(result.error || '삭제 실패');
                }
            }

            // 메타데이터 제거
            const index = this.attachments[documentId].findIndex(a => a.id === attachmentId);
            if (index > -1) {
                this.attachments[documentId].splice(index, 1);
            }

            return true;
        } catch (error) {
            console.error('첨부파일 삭제 실패:', error);
            return false;
        }
    }

    // 문서의 모든 첨부파일 가져오기 (메타데이터만)
    getDocumentAttachments(documentId) {
        return this.attachments[documentId] || [];
    }

    // 첨부파일 다운로드 (Google Drive에서)
    async downloadAttachment(attachment) {
        if (!attachment.driveFileId || !window.electronAPI) {
            throw new Error('다운로드할 수 없는 파일입니다');
        }

        try {
            const result = await window.electronAPI.googleDriveSync('download-attachment', {
                fileId: attachment.driveFileId
            });

            if (!result.success) {
                throw new Error(result.error || '다운로드 실패');
            }

            // Blob 생성 및 다운로드
            const blob = new Blob([result.data], { type: attachment.mimeType });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = attachment.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('다운로드 실패:', error);
            throw error;
        }
    }

    // 첨부파일 미리보기 URL 생성
    getPreviewUrl(attachment) {
        // Google Drive 웹 뷰 링크 반환
        if (attachment.webViewLink) {
            return attachment.webViewLink;
        }

        // 이미지나 PDF인 경우 컨텐츠 링크
        if (attachment.webContentLink &&
            (attachment.mimeType?.startsWith('image/') || attachment.mimeType === 'application/pdf')) {
            return attachment.webContentLink;
        }

        return null;
    }

    // 업로드 재시도
    async retryUpload(taskId) {
        return await backgroundUploader.retryFailedUpload(taskId);
    }

    // 실패한 업로드 목록
    getFailedUploads(documentId) {
        return backgroundUploader.getDocumentUploads(documentId).failed;
    }

    // 업로드 상태 확인
    getUploadStatus() {
        return backgroundUploader.getQueueStatus();
    }

    // 파일 크기 포맷팅
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // 파일 아이콘 가져오기
    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType === 'application/pdf') return '📄';
        if (mimeType.includes('word')) return '📝';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
        if (mimeType === 'text/plain') return '📃';
        return '📎';
    }

    // 드래그앤드롭 초기화
    initDropZone(element, documentId, callback) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.classList.add('drag-over');
        });

        element.addEventListener('dragleave', () => {
            element.classList.remove('drag-over');
        });

        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files);
            const results = [];

            for (const file of files) {
                try {
                    const attachment = await this.addAttachment(documentId, file);
                    results.push({ success: true, attachment });
                } catch (error) {
                    results.push({ success: false, error: error.message, file: file.name });
                }
            }

            if (callback) {
                callback(results);
            }
        });
    }

    // 문서 삭제 시 첨부파일도 삭제
    async deleteDocumentAttachments(documentId) {
        const attachments = this.attachments[documentId] || [];

        // Google Drive에서 문서 폴더 전체 삭제
        if (window.electronAPI && attachments.length > 0) {
            try {
                await window.electronAPI.googleDriveSync('delete-document-attachments', {
                    documentId: documentId
                });
            } catch (error) {
                console.error('문서 첨부파일 삭제 실패:', error);
            }
        }

        // 메타데이터 제거
        delete this.attachments[documentId];
    }

    // 메타데이터를 문서에 저장할 형태로 변환
    exportMetadata(documentId) {
        const attachments = this.attachments[documentId] || [];
        return attachments.map(att => ({
            id: att.id,
            name: att.name,
            size: att.size,
            mimeType: att.mimeType,
            driveFileId: att.driveFileId,
            uploadStatus: att.uploadStatus,
            uploadedAt: att.uploadedAt
        }));
    }

    // 문서에서 메타데이터 복원
    importMetadata(documentId, metadata) {
        if (!metadata || !Array.isArray(metadata)) return;

        this.attachments[documentId] = metadata;
    }
}

// 전역 인스턴스 생성
window.attachmentManager = new AttachmentManager();

export default AttachmentManager;