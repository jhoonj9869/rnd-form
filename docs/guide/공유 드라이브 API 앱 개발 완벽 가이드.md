# Google Workspace 공유 드라이브 API 앱 개발 완벽 가이드

Google Workspace를 사용하여 공유 드라이브로 회사 내부 직원과 데이터를 공유하고, 구글 계정 로그인으로 드라이브 조회, 수정, 편집, 다운로드, 업로드를 허용하는 API 앱 개발에 필요한 모든 정보를 상세히 제공합니다.

## 📋 개요

이 가이드는 Google Workspace API를 활용하여 공유 드라이브 기반의 협업 애플리케이션을 구축하는 데 필요한 전반적인 정보를 포함하고 있습니다. OAuth 2.0 인증부터 파일 관리, 권한 설정, 에러 처리까지 실제 구현에 필요한 모든 내용을 다룹니다.

## 🔧 1. 개발 환경 설정

### 1.1 Google Cloud Console 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. Google Drive API 활성화: `API 및 서비스` → `라이브러리` → `Google Drive API` → `사용 설정` [Google Cloud Console](https://console.cloud.google.com/apis/library/drive.googleapis.com)

### 1.2 OAuth 2.0 인증 설정

#### 동의 화면 구성
1. `API 및 서비스` → `OAuth 동의 화면` 이동
2. 앱 유형 선택: `내부` (조직용) 또는 `외부`
3. 앱 정보 입력:
   - 앱 이름
   - 사용자 지원 이메일
   - 개발자 연락처 정보

#### OAuth 2.0 클라이언트 ID 생성
1. `API 및 서비스` → `사용자 인증 정보` → `사용자 인증 정보 만들기` → `OAuth 2.0 클라이언트 ID`
2. 애플리케이션 유형 선택:
   - 웹 애플리케이션: 리디렉션 URI 설정
   - 데스크톱 앱: `http://localhost` 권장
3. 다운로드된 JSON 파일(`credentials.json`) 안전하게 저장

### 1.3 필수 API 스코프 설정

공유 드라이브 관리를 위한 필수 권한:

```python
# Python 예제
SCOPES = [
    'https://www.googleapis.com/auth/drive',  # 전체 드라이브 접근
    'https://www.googleapis.com/auth/drive.file',  # 파일 접근
    'https://www.googleapis.com/auth/drive.metadata'  # 메타데이터 접근
]
```

## 🔐 2. OAuth 2.0 인증 구현

### 2.1 인증 흐름

Google OAuth 2.0은 다음 6단계로 구성됩니다:

1. **클라이언트 객체 생성 및 구성**
2. **Google OAuth 2.0 서버로 리디렉션**
3. **사용자에게 동의 요청**
4. **웹 서버로 리디렉션**
5. **승인 코드를 액세스 토큰으로 교환**
6. **권한 범위 확인**

### 2.2 Python 인증 구현

```python
import os
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive']

def authenticate_google_drive():
    """Google Drive API 인증"""
    creds = None
    
    # 기존 토큰 파일 확인
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # 유효한 토큰이 없으면 인증 진행
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # 토큰 저장
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    
    return build('drive', 'v3', credentials=creds)

# 서비스 객체 생성
service = authenticate_google_drive()
```

### 2.3 JavaScript 인증 구현

```javascript
// index.html
const CLIENT_ID = 'YOUR_CLIENT_ID';
const API_KEY = 'YOUR_API_KEY';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive';

function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(function () {
        // 인증 상태 변경 감지
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        // 인증 성공 - API 호출
        listFiles();
    } else {
        // 인증 필요
        gapi.auth2.getAuthInstance().signIn();
    }
}
```

## 📁 3. 공유 드라이브 관리

### 3.1 공유 드라이브 생성

```python
def create_shared_drive(service, name, request_id):
    """공유 드라이브 생성"""
    drive_metadata = {
        'name': name,
        'restrictions': {
            'driveMembersOnly': True,  # 멤버만 접근 가능
            'copyRequiresWriterPermission': True,  # 쓰기 권한 필요
            'downloadRestriction': {
                'restrictedForReaders': False,  # 읽기 권한자 다운로드 허용
                'restrictedForWriters': False   # 쓰기 권한자 다운로드 허용
            }
        }
    }
    
    try:
        drive = service.drives().create(
            requestId=request_id,
            body=drive_metadata,
            supportsAllDrives=True
        ).execute()
        
        return drive
    except Exception as e:
        print(f'공유 드라이브 생성 오류: {e}')
        return None
```

### 3.2 공유 드라이브 목록 조회

```python
def list_shared_drives(service, page_size=10):
    """공유 드라이브 목록 조회"""
    try:
        results = service.drives().list(
            pageSize=page_size,
            useDomainAdminAccess=True,
            fields="nextPageToken, drives(id, name, createdTime)"
        ).execute()
        
        drives = results.get('drives', [])
        
        for drive in drives:
            print(f"ID: {drive['id']}, 이름: {drive['name']}, 생성일: {drive['createdTime']}")
        
        return drives
    except Exception as e:
        print(f'공유 드라이브 조회 오류: {e}')
        return []
```

### 3.3 공유 드라이브 권한 관리

```python
def add_drive_member(service, drive_id, email, role='reader'):
    """공유 드라이브 멤버 추가"""
    permission_metadata = {
        'type': 'user',
        'role': role,  # 'reader', 'commenter', 'writer', 'fileOrganizer', 'organizer'
        'emailAddress': email
    }
    
    try:
        permission = service.permissions().create(
            fileId=drive_id,
            body=permission_metadata,
            supportsAllDrives=True,
            useDomainAdminAccess=True,
            sendNotificationEmail=True,
            emailMessage="회사 공유 드라이브에 초대되었습니다."
        ).execute()
        
        return permission
    except Exception as e:
        print(f'멤버 추가 오류: {e}')
        return None
```

## 📤 4. 파일 업로드 및 다운로드

### 4.1 파일 업로드 구현

Google Drive API는 세 가지 업로드 방식을 제공합니다:

#### 단순 업로드 (5MB 이하)

```python
def upload_small_file(service, file_path, file_name, mime_type, parent_id=None):
    """소용량 파일 업로드"""
    file_metadata = {
        'name': file_name,
        'parents': [parent_id] if parent_id else []
    }
    
    media = MediaFileUpload(file_path, mimetype=mime_type)
    
    try:
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            supportsAllDrives=True,
            fields='id, name, mimeType, size'
        ).execute()
        
        return file
    except Exception as e:
        print(f'파일 업로드 오류: {e}')
        return None
```

#### 재개 가능한 대용량 파일 업로드

```python
def upload_large_file(service, file_path, file_name, mime_type, parent_id=None):
    """대용량 파일 재개 가능 업로드"""
    file_metadata = {
        'name': file_name,
        'parents': [parent_id] if parent_id else []
    }
    
    # 초기 요청 - 재개 가능한 세션 URI 얻기
    media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
    
    try:
        request = service.files().create(
            body=file_metadata,
            media_body=media,
            supportsAllDrives=True
        )
        
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                print(f'업로드 진행률: {int(status.progress() * 100)}%')
        
        return response
    except Exception as e:
        print(f'대용량 파일 업로드 오류: {e}')
        return None
```

### 4.2 파일 다운로드 구현

#### 블롭 파일 다운로드

```python
def download_file(service, file_id, destination_path):
    """파일 다운로드"""
    try:
        # 파일 정보 가져오기
        file_info = service.files().get(
            fileId=file_id,
            supportsAllDrives=True,
            fields='name, mimeType, size'
        ).execute()
        
        # 파일 내용 다운로드
        request = service.files().get_media(fileId=file_id)
        
        with open(destination_path, 'wb') as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
                if status:
                    print(f'다운로드 진행률: {int(status.progress() * 100)}%')
        
        return file_info
    except Exception as e:
        print(f'파일 다운로드 오류: {e}')
        return None
```

#### Google Workspace 파일보내기

```python
def export_google_workspace_file(service, file_id, destination_path, export_mime_type='application/pdf'):
    """Google Workspace 파일보내기"""
    try:
        #보내기 가능 형식 확인
        file_info = service.files().get(
            fileId=file_id,
            supportsAllDrives=True,
            fields='name, mimeType, exportLinks'
        ).execute()
        
        #보내기 수행
        request = service.files().export_media(
            fileId=file_id,
            mimeType=export_mime_type
        )
        
        with open(destination_path, 'wb') as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
                if status:
                    print(f'보내기 진행률: {int(status.progress() * 100)}%')
        
        return file_info
    except Exception as e:
        print(f'파일보내기 오류: {e}')
        return None
```

## 🔍 5. 파일 및 폴더 관리

### 5.1 파일 목록 조회

```python
def list_drive_files(service, drive_id=None, page_size=100):
    """드라이브 파일 목록 조회"""
    query_params = {
        'pageSize': page_size,
        'supportsAllDrives': True,
        'includeItemsFromAllDrives': True,
        'fields': 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)'
    }
    
    if drive_id:
        query_params['driveId'] = drive_id
        query_params['corpora'] = 'drive'
    
    try:
        results = service.files().list(**query_params).execute()
        files = results.get('files', [])
        
        return files
    except Exception as e:
        print(f'파일 목록 조회 오류: {e}')
        return []
```

### 5.2 파일 검색

```python
def search_files(service, query, drive_id=None):
    """파일 검색"""
    query_params = {
        'q': query,
        'supportsAllDrives': True,
        'includeItemsFromAllDrives': True,
        'fields': 'files(id, name, mimeType, modifiedTime)'
    }
    
    if drive_id:
        query_params['driveId'] = drive_id
        query_params['corpora'] = 'drive'
    
    try:
        results = service.files().list(**query_params).execute()
        return results.get('files', [])
    except Exception as e:
        print(f'파일 검색 오류: {e}')
        return []
```

### 5.3 파일 메타데이터 업데이트

```python
def update_file_metadata(service, file_id, new_name=None, new_description=None):
    """파일 메타데이터 업데이트"""
    file_metadata = {}
    if new_name:
        file_metadata['name'] = new_name
    if new_description:
        file_metadata['description'] = new_description
    
    try:
        file = service.files().update(
            fileId=file_id,
            body=file_metadata,
            supportsAllDrives=True,
            fields='id, name, description'
        ).execute()
        
        return file
    except Exception as e:
        print(f'파일 메타데이터 업데이트 오류: {e}')
        return None
```

## 🛡️ 6. 권한 및 보안 설정

### 6.1 파일 권한 관리

```python
def create_file_permission(service, file_id, email, role='reader', send_notification=True):
    """파일 권한 생성"""
    permission_metadata = {
        'type': 'user',
        'role': role,
        'emailAddress': email
    }
    
    try:
        permission = service.permissions().create(
            fileId=file_id,
            body=permission_metadata,
            supportsAllDrives=True,
            sendNotificationEmail=send_notification,
            emailMessage="파일에 대한 접근 권한이 부여되었습니다."
        ).execute()
        
        return permission
    except Exception as e:
        print(f'파일 권한 생성 오류: {e}')
        return None

def list_file_permissions(service, file_id):
    """파일 권한 목록 조회"""
    try:
        permissions = service.permissions().list(
            fileId=file_id,
            supportsAllDrives=True,
            fields='permissions(id, type, role, emailAddress, displayName)'
        ).execute()
        
        return permissions.get('permissions', [])
    except Exception as e:
        print(f'파일 권한 조회 오류: {e}')
        return []
```

### 6.2 다운로드 제한 설정

```python
def set_download_restrictions(service, file_id, restrict_readers=False, restrict_writers=False):
    """파일 다운로드 제한 설정"""
    restrictions = {
        'downloadRestriction': {
            'restrictedForReaders': restrict_readers,
            'restrictedForWriters': restrict_writers
        }
    }
    
    try:
        file = service.files().update(
            fileId=file_id,
            body=restrictions,
            supportsAllDrives=True
        ).execute()
        
        return file
    except Exception as e:
        print(f'다운로드 제한 설정 오류: {e}')
        return None
```

## ⚠️ 7. 에러 처리 및 트러블슈팅

### 7.1 일반적인 에러 코드

| HTTP 상태 코드 | 설명 | 해결 방법 |
|---|---|---|
| 400 | 잘못된 요청 | 요청 매개변수 확인 |
| 401 | 인증 실패 | 토큰 갱신 또는 재인증 |
| 403 | 권한 없음 | API 활성화 및 권한 확인 |
| 404 | 파일을 찾을 수 없음 | 파일 ID 확인 |
| 409 | 충돌 | 중복 요청 또는 리소스 충돌 |
| 429 | 요청 제한 | 속도 제한 준수 및 재시도 |

### 7.2 에러 처리 구현

```python
import time
from googleapiclient.errors import HttpError

def handle_api_error(func, *args, **kwargs):
    """API 에러 처리 및 재시도"""
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except HttpError as e:
            error_details = json.loads(e.content.decode('utf-8'))
            error_code = error_details.get('error', {}).get('code', 0)
            error_message = error_details.get('error', {}).get('message', '')
            
            if error_code == 429:  # Rate limit
                if attempt < max_retries - 1:
                    time.sleep(retry_delay * (2 ** attempt))
                    continue
            elif error_code == 401:  # Authentication error
                if attempt < max_retries - 1:
                    # 토큰 갱신 시도
                    service = authenticate_google_drive()
                    kwargs['service'] = service
                    continue
            else:
                print(f'API 에러 ({error_code}): {error_message}')
                raise
            
            if attempt == max_retries - 1:
                print(f'최대 재시도 횟수 초과: {error_message}')
                raise
```

### 7.3 공유 드라이브 특정 에러

```python
def handle_shared_drive_errors(service, operation_func, *args, **kwargs):
    """공유 드라이브 특정 에러 처리"""
    try:
        return operation_func(service, *args, **kwargs)
    except HttpError as e:
        error_details = json.loads(e.content.decode('utf-8'))
        error_reason = error_details.get('error', {}).get('errors', [{}])[0].get('reason', '')
        
        if error_reason == 'teamDriveHierarchyTooDeep':
            print('폴더 깊이 제한 초과 (최대 100 레벨)')
        elif error_reason == 'teamDriveMembershipLimit':
            print('멤버 수 제한 초과')
        elif error_reason == 'organizerOnNonTeamDrive':
            print('공유 드라이브가 아닌 항목에 organizer 권한 적용 시도')
        else:
            print(f'공유 드라이브 에러: {error_reason}')
        
        raise
```

## 🔒 8. 보안 모범 사례

### 8.1 인증 보안

```python
# 안전한 토큰 저장
import os
from cryptography.fernet import Fernet

def secure_token_storage(token_data, encryption_key=None):
    """토큰 데이터 암호화 저장"""
    if encryption_key is None:
        encryption_key = Fernet.generate_key()
    
    cipher_suite = Fernet(encryption_key)
    encrypted_token = cipher_suite.encrypt(token_data.encode())
    
    # 환경 변수에 암호화 키 저장
    os.environ['GDRIVE_ENCRYPTION_KEY'] = encryption_key.decode()
    
    # 암호화된 토큰 파일 저장
    with open('encrypted_token.bin', 'wb') as f:
        f.write(encrypted_token)
    
    return encryption_key

def retrieve_secure_token():
    """암호화된 토큰 복원"""
    encryption_key = os.environ.get('GDRIVE_ENCRYPTION_KEY').encode()
    cipher_suite = Fernet(encryption_key)
    
    with open('encrypted_token.bin', 'rb') as f:
        encrypted_token = f.read()
    
    decrypted_token = cipher_suite.decrypt(encrypted_token)
    return decrypted_token.decode()
```

### 8.2 CSRF 방지

```python
import secrets
from flask import session, request

def generate_csrf_token():
    """CSRF 토큰 생성"""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_urlsafe(32)
    return session['csrf_token']

def validate_csrf_token(token):
    """CSRF 토큰 검증"""
    return token == session.get('csrf_token')
```

### 8.3 입력 검증

```python
import re
from urllib.parse import urlparse

def validate_file_path(file_path):
    """파일 경로 유효성 검증"""
    # 경로 조작 방지
    if '..' in file_path or file_path.startswith('/'):
        return False
    
    # 허용된 확장자 확인
    allowed_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.png']
    file_ext = os.path.splitext(file_path)[1].lower()
    
    return file_ext in allowed_extensions

def validate_drive_id(drive_id):
    """드라이브 ID 유효성 검증"""
    # 드라이브 ID 형식 확인 (영숫자 및 특수문자)
    pattern = r'^[a-zA-Z0-9_-]+$'
    return re.match(pattern, drive_id) is not None
```

## 📊 9. 성능 최적화

### 9.1 페이지네이션 구현

```python
def list_all_files_paginated(service, drive_id=None, page_size=100):
    """모든 파일 페이지네이션으로 조회"""
    page_token = None
    all_files = []
    
    while True:
        try:
            query_params = {
                'pageSize': page_size,
                'pageToken': page_token,
                'supportsAllDrives': True,
                'includeItemsFromAllDrives': True
            }
            
            if drive_id:
                query_params['driveId'] = drive_id
                query_params['corpora'] = 'drive'
            
            results = service.files().list(**query_params).execute()
            files = results.get('files', [])
            all_files.extend(files)
            
            page_token = results.get('nextPageToken')
            if not page_token:
                break
                
        except Exception as e:
            print(f'페이지네이션 오류: {e}')
            break
    
    return all_files
```

### 9.2 배치 처리

```python
def batch_update_permissions(service, file_ids, permissions):
    """배치로 권한 업데이트"""
    batch = service.new_batch_http_request()
    
    for file_id in file_ids:
        for permission in permissions:
            request = service.permissions().create(
                fileId=file_id,
                body=permission,
                supportsAllDrives=True
            )
            batch.add(request)
    
    try:
        batch.execute()
        return True
    except Exception as e:
        print(f'배치 처리 오류: {e}')
        return False
```

### 9.3 캐싱 구현

```python
import time
from functools import lru_cache

@lru_cache(maxsize=128)
def get_file_metadata_cached(service, file_id, cache_time=300):
    """파일 메타데이터 캐싱 (5분)"""
    return service.files().get(
        fileId=file_id,
        supportsAllDrives=True,
        fields='id, name, mimeType, size, modifiedTime'
    ).execute()

def clear_file_metadata_cache():
    """캐시 초기화"""
    get_file_metadata_cached.cache_clear()
```

## 🧪 10. 테스트 및 배포

### 10.1 단위 테스트

```python
import unittest
from unittest.mock import Mock, patch

class TestGoogleDriveAPI(unittest.TestCase):
    def setUp(self):
        self.mock_service = Mock()
        
    def test_create_shared_drive(self):
        """공유 드라이브 생성 테스트"""
        with patch('googleapiclient.discovery.build') as mock_build:
            mock_build.return_value = self.mock_service
            
            # 테스트용 가짜 응답
            mock_response = {
                'id': 'test_drive_id',
                'name': 'Test Drive'
            }
            
            self.mock_service.drives().create().execute.return_value = mock_response
            
            # 테스트 실행
            result = create_shared_drive(self.mock_service, 'Test Drive', 'test_request_id')
            
            self.assertIsNotNone(result)
            self.assertEqual(result['id'], 'test_drive_id')
            self.assertEqual(result['name'], 'Test Drive')
```

### 10.2 통합 테스트

```python
def integration_test_full_workflow():
    """전체 워크플로우 통합 테스트"""
    service = authenticate_google_drive()
    
    # 1. 공유 드라이브 생성
    drive = create_shared_drive(service, 'Integration Test Drive', 'test_request_123')
    assert drive is not None, "공유 드라이브 생성 실패"
    
    drive_id = drive['id']
    
    # 2. 멤버 추가
    permission = add_drive_member(service, drive_id, 'test@company.com', 'writer')
    assert permission is not None, "멤버 추가 실패"
    
    # 3. 파일 업로드
    test_file = upload_small_file(service, 'test.txt', 'test.txt', 'text/plain', drive_id)
    assert test_file is not None, "파일 업로드 실패"
    
    # 4. 파일 조회
    files = list_drive_files(service, drive_id)
    assert len(files) > 0, "파일 조회 실패"
    
    # 5. 파일 다운로드
    downloaded = download_file(service, test_file['id'], 'downloaded_test.txt')
    assert downloaded is not None, "파일 다운로드 실패"
    
    # 6. 정리
    service.drives().delete(driveId=drive_id, useDomainAdminAccess=True, allowItemDeletion=True).execute()
    
    print("모든 통합 테스트 통과")
```

### 10.3 배포 체크리스트

- [ ] API 키 및 인증 정보 보안 설정
- [ ] 환경 변수로 민감한 정보 관리
- [ ] 속도 제한 및 쿼터 모니터링 설정
- [ ] 로그 및 모니터링 시스템 구성
- [ ] 백업 및 재해 복구 계획 수립
- [ ] 보안 검토 및 취약점 점검
- [ ] 성능 테스트 및 최적화
- [ ] 문서화 및 사용자 가이드 작성

## 📚 11. 참고 자료 및 링크

### 공식 문서
- [Google Drive API 공식 문서](https://developers.google.com/workspace/drive/api/guides/about-sdk)
- [공유 드라이브 API 참조](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives)
- [OAuth 2.0 가이드](https://developers.google.com/identity/protocols/oauth2)

### 개발자 도구
- [Google API Explorer](https://developers.google.com/workspace/drive/api/reference/rest)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

### 라이브러리 및 SDK
- [Python Client Library](https://github.com/googleapis/google-api-python-client)
- [JavaScript Client Library](https://github.com/google/google-api-javascript-client)
- [Java Client Library](https://github.com/googleapis/google-api-java-client)

이 가이드는 Google Workspace API를 활용한 공유 드라이브 기반 협업 애플리케이션 개발에 필요한 모든 핵심 정보를 제공합니다. 실제 구현 시 프로젝트의 특정 요구사항에 따라 추가적인 커스터마이징이 필요할 수 있습니다.