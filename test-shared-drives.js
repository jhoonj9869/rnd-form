const { google } = require('googleapis');
const GoogleDriveService = require('./electron/google-drive.js');

async function listAllSharedDrives() {
  console.log('🔍 현재 계정의 모든 공유드라이브 조회 중...\n');

  try {
    // GoogleDriveService 인스턴스 생성
    const driveService = new GoogleDriveService();

    // 설정 로드
    await driveService.loadConfig();
    console.log('✅ OAuth2 설정 로드 완료');

    // 기존 토큰 확인
    const Store = require('electron-store');
    const store = new Store({ projectName: 'rnd-form' });
    const tokens = store.get('googleTokens');

    if (!tokens) {
      console.log('❌ 저장된 토큰이 없습니다. 앱에서 먼저 로그인하세요.');
      return;
    }

    console.log('✅ 저장된 토큰 확인됨');

    // OAuth2 클라이언트 설정
    driveService.oauth2Client.setCredentials(tokens);
    driveService.drive = google.drive({ version: 'v3', auth: driveService.oauth2Client });

    // 모든 공유드라이브 조회
    console.log('\n📋 공유드라이브 목록 조회 중...');
    const response = await driveService.drive.drives.list({
      fields: 'drives(id, name, createdTime, capabilities)'
    });

    const drives = response.data.drives || [];

    if (drives.length === 0) {
      console.log('❌ 현재 계정에는 공유드라이브가 없습니다.');
      console.log('\n💡 해결방법:');
      console.log('1. Google Drive 웹에서 공유드라이브 생성');
      console.log('2. 또는 조직 관리자에게 공유드라이브 접근 권한 요청');
      return;
    }

    console.log(`✅ 총 ${drives.length}개의 공유드라이브 발견:\n`);

    drives.forEach((drive, index) => {
      console.log(`${index + 1}. 📁 ${drive.name}`);
      console.log(`   ID: ${drive.id}`);
      console.log(`   생성일: ${drive.createdTime}`);
      console.log(`   권한: ${drive.capabilities ? Object.keys(drive.capabilities).join(', ') : '확인불가'}`);
      console.log('');
    });

    // RND/Form/양식 키워드 검색
    console.log('🎯 RND/Form/양식 키워드 검색 결과:');
    const keywords = ['RND', 'Form', '양식', 'rnd', 'form'];
    const matchedDrives = drives.filter(drive =>
      keywords.some(keyword => drive.name.includes(keyword))
    );

    if (matchedDrives.length > 0) {
      console.log(`✅ ${matchedDrives.length}개의 매칭 드라이브 발견:`);
      matchedDrives.forEach(drive => {
        console.log(`   📌 ${drive.name} (ID: ${drive.id})`);
      });
    } else {
      console.log('❌ RND/Form/양식 키워드와 매칭되는 드라이브 없음');
    }

    // 추천 설정
    console.log('\n🔧 추천 설정:');
    if (drives.length > 0) {
      const firstDrive = drives[0];
      console.log(`가장 첫 번째 공유드라이브를 사용하거나:`);
      console.log(`this.sharedDriveId = '${firstDrive.id}'; // ${firstDrive.name}`);

      if (matchedDrives.length > 0) {
        const bestMatch = matchedDrives[0];
        console.log(`\n또는 키워드 매칭 드라이브를 사용:`);
        console.log(`this.sharedDriveId = '${bestMatch.id}'; // ${bestMatch.name}`);
      }
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    if (error.code === 403) {
      console.log('\n💡 권한 오류 해결방법:');
      console.log('1. Google Cloud Console에서 Drive API 활성화 확인');
      console.log('2. OAuth2 동의 화면에서 적절한 스코프 설정 확인');
    }
  }
}

// 실행
listAllSharedDrives();