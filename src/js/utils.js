// 유틸리티 함수들

// 문서번호 생성 (YYYY-MM-DD-XXX 형식)
export async function generateDocNumber(formStorage, formType = 'expense-report') {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    try {
        // FormStorageService에서 오늘 날짜의 모든 문서 조회
        const workspaceDocs = await formStorage.getWorkspaceDocuments(formType);
        const cacheDocs = await formStorage.getCacheDocuments(formType);

        // 모든 문서 병합
        const allDocs = [...workspaceDocs, ...cacheDocs];
        const todayDocs = allDocs.filter(doc =>
            doc.docNumber && doc.docNumber.startsWith(dateStr)
        );

        // 가장 큰 번호 찾기
        let maxNum = 0;
        todayDocs.forEach(doc => {
            const match = doc.docNumber.match(/(\d{4})-(\d{2})-(\d{2})-(\d{3})/);
            if (match) {
                const num = parseInt(match[4], 10);
                if (num > maxNum) {
                    maxNum = num;
                }
            }
        });

        // 다음 번호 생성
        const nextNum = String(maxNum + 1).padStart(3, '0');
        return `${dateStr}-${nextNum}`;
    } catch (error) {
        console.error('문서번호 생성 오류:', error);
        // 오류 시 기본 번호 생성
        return `${dateStr}-001`;
    }
}

// 숫자를 한글 금액으로 변환
export function toKoreanAmount(num) {
    if (!num || num === 0) return '영원';

    const units = ['', '십', '백', '천'];
    const bigUnits = ['', '만', '억', '조'];
    const numbers = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

    let result = '';
    let bigUnitIndex = 0;
    let number = Math.abs(num);

    while (number > 0) {
        const part = number % 10000;
        if (part > 0) {
            let partStr = '';
            let tempPart = part;
            let unitIndex = 0;

            while (tempPart > 0) {
                const digit = tempPart % 10;
                if (digit > 0) {
                    // 일십, 일백, 일천의 '일'은 표기 (공문서 스타일)
                    if (digit === 1 && unitIndex > 0) {
                        partStr = '일' + units[unitIndex] + partStr;
                    } else {
                        partStr = numbers[digit] + units[unitIndex] + partStr;
                    }
                }
                tempPart = Math.floor(tempPart / 10);
                unitIndex++;
            }

            if (bigUnitIndex > 0) {
                partStr += bigUnits[bigUnitIndex];
            }
            result = partStr + result;
        }
        number = Math.floor(number / 10000);
        bigUnitIndex++;
    }

    return `일금 ${result}원 정`;
}

// 통화 포맷
export function formatCurrency(amount) {
    if (!amount && amount !== 0) return '₩0';
    return '₩' + Number(amount).toLocaleString('ko-KR');
}

// 날짜 포맷 (YYYY-MM-DD)
export function formatDate(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// 날짜시간 포맷 (YYYY-MM-DD HH:mm)
export function formatDateTime(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 디바운스 함수
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// UUID 생성 (폴리필)
export function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // 폴백: 간단한 UUID v4 생성
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 파일 크기 포맷
export function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 객체 깊은 복사
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

// 검증 함수들
export const validators = {
    // 필수 필드 검증
    required: (value) => {
        return value !== null && value !== undefined && value !== '';
    },

    // 이메일 검증
    email: (value) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(value);
    },

    // 전화번호 검증
    phone: (value) => {
        const re = /^[\d-]+$/;
        return re.test(value);
    },

    // 금액 검증 (양수)
    positiveAmount: (value) => {
        return !isNaN(value) && Number(value) > 0;
    },

    // 날짜 검증 (미래 날짜 불가)
    notFutureDate: (value) => {
        const date = new Date(value);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return date <= today;
    }
};

// JSON 내보내기
export function exportToJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `export_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// JSON 가져오기
export function importFromJSON() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                reject(new Error('파일이 선택되지 않았습니다'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    resolve(data);
                } catch (error) {
                    reject(new Error('JSON 파싱 실패: ' + error.message));
                }
            };
            reader.onerror = () => {
                reject(new Error('파일 읽기 실패'));
            };
            reader.readAsText(file);
        };

        input.click();
    });
}