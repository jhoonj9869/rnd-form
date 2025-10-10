/**
 * 로딩 오버레이 유틸리티
 * 클라우드 작업 중 UI를 완전히 차단하고 진행 상태를 표시
 *
 * 사용법:
 *   const overlay = showLoadingOverlay("저장 중...");
 *   try {
 *     await someAsyncOperation();
 *   } finally {
 *     hideLoadingOverlay(overlay);
 *   }
 */

// 스피너 애니메이션 CSS를 한 번만 추가
function ensureStylesExist() {
    if (!document.getElementById('rnd-loading-overlay-styles')) {
        const style = document.createElement('style');
        style.id = 'rnd-loading-overlay-styles';
        style.textContent = `
            @keyframes rnd-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            #rnd-loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: all;
                user-select: none;
            }

            #rnd-loading-overlay .overlay-content {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 400px;
            }

            #rnd-loading-overlay .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: rnd-spin 1s linear infinite;
                margin: 0 auto 1rem;
            }

            #rnd-loading-overlay .message {
                margin: 0.5rem 0;
                font-weight: bold;
                font-size: 16px;
                color: #333;
            }

            #rnd-loading-overlay .detail {
                color: #666;
                font-size: 14px;
                margin-top: 0.5rem;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * 로딩 오버레이 표시
 * @param {string} message - 메인 메시지 (예: "클라우드에 저장 중...")
 * @param {string} detail - 상세 설명 (선택사항)
 * @returns {HTMLElement} 생성된 오버레이 엘리먼트
 */
export function showLoadingOverlay(message, detail = '잠시만 기다려주세요...') {
    // 중복 방지: 이미 표시 중이면 기존 것 반환
    let overlay = document.getElementById('rnd-loading-overlay');
    if (overlay) {
        console.warn('[LoadingOverlay] 이미 오버레이가 표시 중입니다.');
        return overlay;
    }

    // 스타일 추가
    ensureStylesExist();

    // 오버레이 생성
    overlay = document.createElement('div');
    overlay.id = 'rnd-loading-overlay';

    overlay.innerHTML = `
        <div class="overlay-content">
            <div class="spinner"></div>
            <p class="message">${message}</p>
            <small class="detail">${detail}</small>
        </div>
    `;

    // DOM에 추가
    document.body.appendChild(overlay);

    console.log('[LoadingOverlay] 오버레이 표시:', message);
    return overlay;
}

/**
 * 로딩 오버레이 제거
 * @param {HTMLElement} overlay - showLoadingOverlay()가 반환한 엘리먼트 (선택사항)
 */
export function hideLoadingOverlay(overlay = null) {
    // 전달받은 overlay 제거 시도
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
        console.log('[LoadingOverlay] 오버레이 제거 (인자로 전달받음)');
        return;
    }

    // ID로 찾아서 제거
    const existing = document.getElementById('rnd-loading-overlay');
    if (existing) {
        existing.remove();
        console.log('[LoadingOverlay] 오버레이 제거 (ID로 검색)');
    } else {
        console.warn('[LoadingOverlay] 제거할 오버레이가 없습니다.');
    }
}

// 전역 객체로도 노출 (Alpine.js에서 사용하기 위해)
if (typeof window !== 'undefined') {
    window.loadingOverlay = {
        show: showLoadingOverlay,
        hide: hideLoadingOverlay
    };
}
