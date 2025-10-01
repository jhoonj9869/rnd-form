// 인쇄용 도장 관리 시스템 (저장 없음)
class PrintStampManager {
    constructor() {
        this.tempStamp = null;
    }

    // 인쇄를 위한 임시 도장 로드
    async loadStampForPrint(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('이미지 파일을 선택해주세요'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.tempStamp = {
                    dataUrl: e.target.result,
                    name: file.name
                };
                resolve(this.tempStamp);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 결재란에 도장 미리보기 적용
    applyToPrintPreview(targetElement) {
        if (!this.tempStamp || !targetElement) return false;

        // 기존 도장 제거
        const existingStamp = targetElement.querySelector('.print-stamp');
        if (existingStamp) {
            existingStamp.remove();
        }

        // 임시 도장 추가
        const stampImg = document.createElement('img');
        stampImg.className = 'print-stamp';
        stampImg.src = this.tempStamp.dataUrl;
        stampImg.style.cssText = `
            position: absolute;
            width: 60px;
            height: 60px;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.9;
            pointer-events: none;
            z-index: 10;
        `;

        targetElement.style.position = 'relative';
        targetElement.appendChild(stampImg);

        return true;
    }

    // 인쇄 미리보기에서 도장 제거
    removeFromPrintPreview(targetElement) {
        const stamp = targetElement.querySelector('.print-stamp');
        if (stamp) {
            stamp.remove();
            return true;
        }
        return false;
    }

    // 인쇄 완료 후 임시 데이터 클리어
    clearTempStamp() {
        this.tempStamp = null;

        // DOM에서도 모든 임시 도장 제거
        const allStamps = document.querySelectorAll('.print-stamp');
        allStamps.forEach(stamp => stamp.remove());
    }

    // 인쇄 다이얼로그 생성
    createPrintDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'print-stamp-dialog';
        dialog.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                min-width: 300px;
            ">
                <h3 style="margin-top: 0;">인쇄 옵션</h3>

                <div style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 10px;">
                        <input type="checkbox" id="addStampOption">
                        결재란에 도장 추가
                    </label>

                    <div id="stampUploadArea" style="display: none; margin-top: 10px;">
                        <input type="file"
                               id="stampFileInput"
                               accept="image/*"
                               style="margin-bottom: 10px;">
                        <div id="stampPreview" style="
                            width: 100px;
                            height: 100px;
                            border: 2px dashed #ccc;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 10px 0;
                        ">
                            <span style="color: #999; font-size: 12px;">미리보기</span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.closest('.print-stamp-dialog').remove()"
                            style="padding: 8px 16px; border: 1px solid #ccc;
                                   background: white; border-radius: 4px; cursor: pointer;">
                        취소
                    </button>
                    <button id="proceedPrintBtn"
                            style="padding: 8px 16px; background: #007bff;
                                   color: white; border: none; border-radius: 4px; cursor: pointer;">
                        인쇄 진행
                    </button>
                </div>
            </div>
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
            " onclick="this.parentElement.remove()"></div>
        `;

        // 이벤트 핸들러 설정
        setTimeout(() => {
            const checkbox = dialog.querySelector('#addStampOption');
            const uploadArea = dialog.querySelector('#stampUploadArea');
            const fileInput = dialog.querySelector('#stampFileInput');
            const preview = dialog.querySelector('#stampPreview');

            checkbox.addEventListener('change', (e) => {
                uploadArea.style.display = e.target.checked ? 'block' : 'none';
            });

            fileInput.addEventListener('change', async (e) => {
                if (e.target.files[0]) {
                    try {
                        const stamp = await this.loadStampForPrint(e.target.files[0]);
                        preview.innerHTML = `<img src="${stamp.dataUrl}" style="max-width: 100%; max-height: 100%;">`;
                    } catch (error) {
                        alert(error.message);
                    }
                }
            });
        }, 0);

        return dialog;
    }
}

// 전역 인스턴스 생성
window.printStampManager = new PrintStampManager();

export default PrintStampManager;