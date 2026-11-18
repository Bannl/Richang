// Construit l'APK avec le JDK d'Android Studio et un cache Gradle dans le projet (C: manque de place).
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd();
const jbr = path.win32.normalize(process.env.JAVA_HOME || 'C:/Program Files/Android/Android Studio/jbr');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  || path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');
const env = {
  ...process.env,
  JAVA_HOME: jbr,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle'),
};
if (!existsSync(jbr)) { console.error('JDK introuvable : ' + jbr + ' (definir JAVA_HOME)'); process.exit(1); }
if (!existsSync(sdk)) { console.error('SDK Android introuvable : ' + sdk + ' (definir ANDROID_HOME)'); process.exit(1); }
const task = process.argv[2] || 'assembleDebug';
// Gradle met a jour l'APK de debug sur place : des ressources qui retrecissent y laissent leurs anciens octets (89 Mo
// pour 84 Mo de contenu, 2026-11-18). Sans l'ancien APK, il est reconstruit en entier.
if (task === 'assembleDebug') rmSync(path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'), { force: true });
const gradlew = path.join(root, 'android', 'gradlew.bat');
const r = spawnSync(`"${gradlew}"`, [task, '--no-daemon'], {
  cwd: path.join(root, 'android'), stdio: 'inherit', env, shell: true,
});
process.exit(r.status ?? 1);
