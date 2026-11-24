#!/bin/bash
set -euo pipefail

ROOT_DIR="/app/applet"
SDK_BUILD_TOOLS="/opt/android-sdk/build-tools/android-14"
ANDROID_JAR="/opt/android-sdk/platforms/android-34/android.jar"
WORK_DIR="/tmp/voz-a-libro-apk-build"
ANDROID_SRC="${ROOT_DIR}/android-src"
OUT_DIR="${ROOT_DIR}/android-dist"
KEYSTORE="${ANDROID_SRC}/release.keystore"

echo "=== 1. Preparando recursos e iconos ==="
mkdir -p "${ANDROID_SRC}/res/drawable"
mkdir -p "${ANDROID_SRC}/assets/www"
mkdir -p "${OUT_DIR}"

cp "${ROOT_DIR}/public/pwa-192x192.png" "${ANDROID_SRC}/res/drawable/ic_launcher.png"

echo "=== 2. Compilando web app (npm run build) ==="
cd "${ROOT_DIR}"
printf '// Auto-populated after Android APK compilation; empty inside APK bundle itself.\nexport const APK_BASE64 = "";\n' > "${ROOT_DIR}/src/apkPayload.ts"
npm run build

rm -rf "${ANDROID_SRC}/assets/www"
mkdir -p "${ANDROID_SRC}/assets/www"
cp -r "${ROOT_DIR}/dist/." "${ANDROID_SRC}/assets/www/"

echo "=== 3. Generando keystore de firma si no existe ==="
if [ ! -f "${KEYSTORE}" ]; then
  keytool -genkeypair -v \
    -keystore "${KEYSTORE}" \
    -alias vozalibro \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass vozalibro2025 \
    -keypass vozalibro2025 \
    -dname "CN=Voz a Libro, OU=Mobile, O=VozALibro, L=CDMX, S=CDMX, C=MX"
fi

echo "=== 4. Compilando recursos y R.java con aapt ==="
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}/gen" "${WORK_DIR}/classes" "${WORK_DIR}/dex" "${WORK_DIR}/apk"

"${SDK_BUILD_TOOLS}/aapt" package -f -m \
  -J "${WORK_DIR}/gen" \
  -S "${ANDROID_SRC}/res" \
  -M "${ANDROID_SRC}/AndroidManifest.xml" \
  -I "${ANDROID_JAR}"

echo "=== 5. Compilando Java con javac (Java 8 bytecode) ==="
javac -source 1.8 -target 1.8 \
  -bootclasspath "${ANDROID_JAR}:${SDK_BUILD_TOOLS}/core-lambda-stubs.jar" \
  -d "${WORK_DIR}/classes" \
  "${WORK_DIR}/gen/com/vozalibro/app/R.java" \
  "${ANDROID_SRC}/src/com/vozalibro/app/MainActivity.java"

echo "=== 6. Convirtiendo a Dalvik bytecode (classes.dex) con d8 ==="
CLASS_FILES=$(find "${WORK_DIR}/classes" -name "*.class")
"${SDK_BUILD_TOOLS}/d8" \
  --release \
  --min-api 24 \
  --lib "${ANDROID_JAR}" \
  --output "${WORK_DIR}/dex" \
  ${CLASS_FILES}

echo "=== 7. Empaquetando recursos + assets/www en APK ==="
"${SDK_BUILD_TOOLS}/aapt" package -f \
  -M "${ANDROID_SRC}/AndroidManifest.xml" \
  -S "${ANDROID_SRC}/res" \
  -A "${ANDROID_SRC}/assets" \
  -I "${ANDROID_JAR}" \
  -F "${WORK_DIR}/apk/unaligned.apk"

cd "${WORK_DIR}/dex"
zip -q -u "${WORK_DIR}/apk/unaligned.apk" classes.dex
cd "${ROOT_DIR}"

echo "=== 8. Alineando APK con zipalign ==="
"${SDK_BUILD_TOOLS}/zipalign" -f -p 4 \
  "${WORK_DIR}/apk/unaligned.apk" \
  "${WORK_DIR}/apk/aligned.apk"

echo "=== 9. Firmando APK con apksigner (v1+v2+v3) ==="
"${SDK_BUILD_TOOLS}/apksigner" sign \
  --ks "${KEYSTORE}" \
  --ks-key-alias vozalibro \
  --ks-pass pass:vozalibro2025 \
  --key-pass pass:vozalibro2025 \
  --out "${OUT_DIR}/VozALibro.apk" \
  "${WORK_DIR}/apk/aligned.apk"

echo "=== 10. Verificando firma y contenido del APK ==="
"${SDK_BUILD_TOOLS}/apksigner" verify --verbose "${OUT_DIR}/VozALibro.apk"
ls -lh "${OUT_DIR}/VozALibro.apk"

echo "=== 11. Generando payload JS perezoso para descarga sin redirección de cookies ==="
node -e 'const fs=require("fs"); const b64=fs.readFileSync(process.argv[1]).toString("base64"); fs.writeFileSync(process.argv[2], "// Auto-generated signed APK payload\nexport const APK_BASE64 = \"" + b64 + "\";\n");' "${OUT_DIR}/VozALibro.apk" "${ROOT_DIR}/src/apkPayload.ts"

echo "APK listo en ${OUT_DIR}/VozALibro.apk"
