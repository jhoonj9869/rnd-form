/**
 * 릴리스 준비 스크립트
 * 용도: 공개 저장소용 / 내부 배포용 구분 빌드
 */

const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'internal'; // 'public' or 'internal'

console.log(`🔧 릴리스 준비 중... (모드: ${mode})`);

if (mode === 'public') {
  // 공개 저장소용 - 민감정보 제거
  console.log('📦 공개 저장소용 빌드 준비...');

  // google-drive.js를 public 버전으로 교체
  const publicPath = path.join(__dirname, '../electron/google-drive.public.js');
  const targetPath = path.join(__dirname, '../electron/google-drive.js');

  if (fs.existsSync(publicPath)) {
    // 원본 백업
    const backupPath = path.join(__dirname, '../electron/google-drive.backup.js');
    if (fs.existsSync(targetPath)) {
      fs.copyFileSync(targetPath, backupPath);
    }

    // public 버전으로 교체
    fs.copyFileSync(publicPath, targetPath);
    console.log('✅ google-drive.js를 공개 버전으로 교체');
  }

  // client_secret 파일 제거
  const secretFiles = [
    'client_secret_712893977707-odsg2vajc67icfkiutv4v6m3mvsn6orj.apps.googleusercontent.com.json',
    '.env'
  ];

  secretFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ ${file} 제거됨`);
    }
  });

  // secure-config.js 제거
  const secureConfigPath = path.join(__dirname, '../electron/secure-config.js');
  if (fs.existsSync(secureConfigPath)) {
    fs.unlinkSync(secureConfigPath);
    console.log('✅ secure-config.js 제거됨');
  }

} else if (mode === 'internal') {
  // 내부 배포용 - 보안 설정 포함
  console.log('🏢 내부 배포용 빌드 준비...');

  // 백업에서 원본 복원 (있는 경우)
  const backupPath = path.join(__dirname, '../electron/google-drive.backup.js');
  const targetPath = path.join(__dirname, '../electron/google-drive.js');

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, targetPath);
    console.log('✅ google-drive.js 원본 복원');
  }

  // .env.example에서 .env 생성 (없는 경우)
  const envExamplePath = path.join(__dirname, '../.env.example');
  const envPath = path.join(__dirname, '../.env');

  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('⚠️ .env 파일 생성됨 - 실제 값으로 업데이트 필요');
  }
}

console.log('✨ 릴리스 준비 완료!');
console.log(`다음 명령어 실행: npm run build:win`);