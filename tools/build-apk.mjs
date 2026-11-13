// 一键打 APK：探测工具链 → cap sync → gradlew assembleDebug → 产物复制到 dist/
// 用法：npm run apk
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';

function findJava() {
  if (process.env.JAVA_HOME && existsSync(path.join(process.env.JAVA_HOME, 'bin', 'javac.exe'))) return process.env.JAVA_HOME;
  const base = 'E:\\Tools\\jdk-17';
  if (existsSync(base)) {
    for (const n of readdirSync(base)) {
      const p = path.join(base, n);
      if (existsSync(path.join(p, 'bin', 'javac.exe'))) return p;
    }
  }
  return null;
}
function findSdk() {
  for (const k of ['ANDROID_HOME', 'ANDROID_SDK_ROOT']) {
    if (process.env[k] && existsSync(process.env[k])) return process.env[k];
  }
  return existsSync('E:\\Tools\\android-sdk') ? 'E:\\Tools\\android-sdk' : null;
}

const java = findJava();
const sdk = findSdk();
if (!java || !sdk) {
  console.error('缺少构建工具链。需要：JDK 17（JAVA_HOME 或 E:\\Tools\\jdk-17\\jdk-17*）与 Android SDK（ANDROID_HOME 或 E:\\Tools\\android-sdk，含 platforms;android-34、build-tools;34.0.0）。');
  process.exit(1);
}
console.log(`JAVA_HOME=${java}\nANDROID_HOME=${sdk}`);
const env = { ...process.env, JAVA_HOME: java, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: win });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('npx', ['cap', 'sync', 'android'], root);
run(path.join(root, 'android', 'gradlew.bat'), ['assembleDebug', '--console=plain'], path.join(root, 'android'));

const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(apk)) { console.error('未找到 APK 产物：' + apk); process.exit(1); }
const ver = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const outDir = path.join(root, 'dist');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `BreakTheBrick-v${ver}-debug.apk`);
copyFileSync(apk, out);
const adb = existsSync('E:\\Tools\\platform-tools\\adb.exe') ? 'E:\\Tools\\platform-tools\\adb.exe' : 'adb';
console.log(`\nAPK 已产出：${out}\n安装到已连接的手机：${adb} install -r "${out}"`);