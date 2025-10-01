// 백그라운드 업로드 큐 시스템
export class BackgroundUploader {
  constructor() {
    this.uploadQueue = [];
    this.isUploading = false;
    this.failedUploads = [];

    // 온라인 상태 모니터링
    window.addEventListener('online', () => this.processQueue());
    window.addEventListener('offline', () => this.pauseQueue());
  }

  // 업로드 큐에 추가
  async addToQueue(documentId, file, onProgress, onComplete, onError) {
    const uploadTask = {
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      file,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      status: 'pending',
      onProgress,
      onComplete,
      onError,
      addedAt: new Date().toISOString()
    };

    this.uploadQueue.push(uploadTask);

    // 즉시 메타데이터 반환 (UI 업데이트용)
    const metadata = {
      id: uploadTask.id,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      uploadStatus: 'pending',
      driveFileId: null // 업로드 완료 후 업데이트
    };

    // 큐 처리 시작
    if (!this.isUploading && navigator.onLine) {
      this.processQueue();
    }

    return metadata;
  }

  // 큐 처리
  async processQueue() {
    if (this.isUploading || this.uploadQueue.length === 0) return;
    if (!navigator.onLine) return;

    this.isUploading = true;

    while (this.uploadQueue.length > 0 && navigator.onLine) {
      const task = this.uploadQueue.shift();
      await this.uploadFile(task);
    }

    this.isUploading = false;
  }

  // 파일 업로드
  async uploadFile(task) {
    try {
      task.status = 'uploading';

      // 진행률 콜백
      if (task.onProgress) {
        task.onProgress({
          loaded: 0,
          total: task.fileSize,
          taskId: task.id
        });
      }

      // FileReader로 파일 읽기
      const fileBuffer = await this.readFileAsBuffer(task.file);

      // Electron IPC를 통해 Google Drive 업로드
      if (!window.electronAPI) {
        throw new Error('Electron API를 사용할 수 없습니다');
      }

      const result = await window.electronAPI.googleDriveSync('upload-attachment', {
        documentId: task.documentId,
        fileBuffer: Array.from(new Uint8Array(fileBuffer)),  // ArrayBuffer를 배열로 변환
        fileName: task.fileName,
        mimeType: task.mimeType
      });

      if (result.success) {
        task.status = 'completed';

        // 성공 콜백
        if (task.onComplete) {
          task.onComplete({
            taskId: task.id,
            driveFileId: result.driveFileId,
            name: result.name,
            size: result.size,
            mimeType: result.mimeType,
            webViewLink: result.webViewLink,
            webContentLink: result.webContentLink
          });
        }
      } else {
        throw new Error(result.error || '업로드 실패');
      }
    } catch (error) {
      console.error('업로드 오류:', error);

      // 즉시 실패 처리 (자동 재시도 없음)
      task.status = 'failed';
      this.failedUploads.push(task);

      // 실패 콜백
      if (task.onError) {
        task.onError({
          taskId: task.id,
          error: error.message,
          canRetry: true
        });
      }

      // 사용자에게 알림 및 재시도 제안
      this.notifyUploadFailure(task);
    }
  }

  // 파일을 Buffer로 읽기
  readFileAsBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        resolve(arrayBuffer);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // 업로드 실패 알림
  notifyUploadFailure(task) {
    // Alpine.js 스토어 업데이트
    if (window.Alpine && window.Alpine.store('app')) {
      const app = window.Alpine.store('app');
      if (!app.uploadErrors) app.uploadErrors = [];

      app.uploadErrors.push({
        id: task.id,
        fileName: task.fileName,
        error: '업로드 실패 - 재시도하시겠습니까?',
        timestamp: new Date().toISOString()
      });
    }

    // 커스텀 이벤트 발생
    window.dispatchEvent(new CustomEvent('uploadFailed', {
      detail: {
        taskId: task.id,
        fileName: task.fileName,
        documentId: task.documentId
      }
    }));
  }

  // 수동 재시도
  async retryFailedUpload(taskId) {
    const taskIndex = this.failedUploads.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return false;

    const task = this.failedUploads.splice(taskIndex, 1)[0];
    task.status = 'pending';

    this.uploadQueue.push(task);

    if (!this.isUploading && navigator.onLine) {
      this.processQueue();
    }

    return true;
  }

  // 모든 실패한 업로드 재시도
  retryAllFailed() {
    const failed = [...this.failedUploads];
    this.failedUploads = [];

    failed.forEach(task => {
      task.status = 'pending';
      this.uploadQueue.push(task);
    });

    if (!this.isUploading && navigator.onLine) {
      this.processQueue();
    }
  }

  // 큐 일시정지
  pauseQueue() {
    this.isUploading = false;
    console.log('오프라인 - 업로드 큐 일시정지');
  }

  // 업로드 취소
  cancelUpload(taskId) {
    const index = this.uploadQueue.findIndex(t => t.id === taskId);
    if (index > -1) {
      this.uploadQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  // 큐 상태 가져오기
  getQueueStatus() {
    return {
      pending: this.uploadQueue.filter(t => t.status === 'pending').length,
      uploading: this.uploadQueue.filter(t => t.status === 'uploading').length,
      failed: this.failedUploads.length,
      isUploading: this.isUploading,
      isOnline: navigator.onLine
    };
  }

  // 특정 문서의 업로드 상태
  getDocumentUploads(documentId) {
    const pending = this.uploadQueue.filter(t => t.documentId === documentId);
    const failed = this.failedUploads.filter(t => t.documentId === documentId);

    return {
      pending,
      failed,
      hasPending: pending.length > 0,
      hasFailed: failed.length > 0
    };
  }
}

// 싱글톤 인스턴스
export const backgroundUploader = new BackgroundUploader();