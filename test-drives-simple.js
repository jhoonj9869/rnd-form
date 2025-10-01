const { google } = require('googleapis');
const ElectronStore = require('electron-store');

async function testSharedDrives() {
  console.log('🔍 간단한 공유드라이브 테스트...\n');

  try {
    // 토큰 가져오기
    const store = new ElectronStore({ projectName: 'rnd-form' });
    const tokens = store.get('googleTokens');

    if (!tokens) {
      console.log('❌ 저장된 토큰이 없습니다.');
      console.log('💡 Electron 앱에서 먼저 Google 로그인을 하세요.');
      return;
    }

    console.log('✅ 저장된 토큰 확인됨');

    // OAuth2 클라이언트 설정
    const auth = new google.auth.OAuth2();
    auth.setCredentials(tokens);

    // Drive API 클라이언트 생성
    const drive = google.drive({ version: 'v3', auth });

    console.log('📋 공유드라이브 조회 중...');

    // 공유드라이브 목록 조회
    const response = await drive.drives.list({
      fields: 'drives(id, name, createdTime)'
    });

    const drives = response.data.drives || [];

    if (drives.length === 0) {
      console.log('\n❌ 공유드라이브가 없습니다.');
      console.log('\n💡 해결방법:');
      console.log('1. Google Drive 웹 → "공유 드라이브" 생성');
      console.log('2. 이름에 "RND", "Form", "양식" 중 하나 포함');
      console.log('3. 또는 기존 공유드라이브에 초대 요청');
      return;
    }

    console.log(`\n✅ 총 ${drives.length}개의 공유드라이브 발견:\n`);

    drives.forEach((drive, index) => {
      console.log(`${index + 1}. 📁 ${drive.name}`);
      console.log(`   ID: ${drive.id}`);
      console.log(`   생성일: ${new Date(drive.createdTime).toLocaleDateString('ko-KR')}`);
      console.log('');
    });

    // 키워드 검색
    const keywords = ['RND', 'Form', '양식', 'rnd', 'form'];
    const matchedDrives = drives.filter(drive =>
      keywords.some(keyword => drive.name.includes(keyword))
    );

    console.log('🎯 키워드 매칭 결과:');
    if (matchedDrives.length > 0) {
      matchedDrives.forEach(drive => {
        console.log(`   ✅ ${drive.name} (${drive.id})`);
      });
    } else {
      console.log('   ❌ "RND/Form/양식" 키워드 매칭 없음');
    }

    console.log('\n🔧 코드에 추가할 설정:');
    if (drives.length > 0) {
      const recommendedDrive = matchedDrives.length > 0 ? matchedDrives[0] : drives[0];
      console.log(`// electron/google-drive.js의 constructor에 추가:`);
      console.log(`this.sharedDriveId = '${recommendedDrive.id}'; // ${recommendedDrive.name}`);
    }

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);

    if (error.code === 403) {
      console.log('\n💡 권한 오류 - 이미 해결됨! OAuth2 스코프가 올바르게 설정되었습니다.');
    } else if (error.code === 401) {
      console.log('\n💡 인증 오류 - 앱에서 다시 로그인하세요.');
    }
  }
}

testSharedDrives();