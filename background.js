// 학교 도메인인지 판단하는 함수
function isFromSchool(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.hostname.endsWith("handong.edu");
  } catch (e) {
    return false;
  }
}

function decodeHtmlNumericEntities(str) {
  const decoded = str.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCharCode(parseInt(dec, 10))
  );
  // 한글 자모 문자열이라면 NFC로 조합 → "빅데이터캠프" 같은 완성형으로
  return decoded.normalize("NFC");
}

// 깨진 파일명을 한글로 복구하려는 시도용 함수
function fixBrokenKoreanFilename(rawName) {
  // (A) HTML 숫자 엔티티 패턴이면, 우선 그걸 처리
  if (rawName.includes("&#")) {
    const htmlFixed = decodeHtmlNumericEntities(rawName);
    return htmlFixed;
  }

  // (B) EUC-KR 모지바케 패턴 처리 (¾ÆÄ«... 같은 것)
  const bytes = new Uint8Array(rawName.length);
  for (let i = 0; i < rawName.length; i++) {
    bytes[i] = rawName.charCodeAt(i) & 0xff;
  }

  // 특수 케이스: 서버에서 '서'(BC AD)가 'BC 5F'로 깨져 오는 것 같으므로,
  // 0xBC 0x5F → 0xBC 0xAD 로 강제로 교체
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xbc && bytes[i + 1] === 0x5f) {
      bytes[i + 1] = 0xad; // '서'의 두 번째 바이트로 강제 변경
    }
  }

  try {
    const decoder = new TextDecoder("euc-kr");
    const decoded = decoder.decode(bytes);
    return decoded;
  } catch (e) {
    console.error("[FilenameFix] euc-kr decode failed:", e);
    return rawName; // 실패하면 원래 이름 그대로 반환
  }
}


// 경로의 마지막 세그먼트(파일명)만 교체
function replaceLastPathSegment(path, newName) {
  const parts = path.split("/");
  parts[parts.length - 1] = newName;
  return parts.join("/");
}


// 다운로드 파일명 결정 시점에 호출됨
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  // 학교 사이트에서 다운받는 파일만 처리
  if (!isFromSchool(item.url)) {
    suggest(); // 기본 파일명 사용
    return;
  }

  console.log("[FilenameFix] Original filename:", item.filename);
  console.log("[FilenameFix] URL:", item.url);

  const pathParts = item.filename.split("/");
  const originalBase = pathParts[pathParts.length - 1];

  const fixedBase = fixBrokenKoreanFilename(originalBase);
  console.log("[FilenameFix] Fixed base:", fixedBase);

  if (fixedBase === originalBase) {
    suggest();
    return;
  }

  const newPath = replaceLastPathSegment(item.filename, fixedBase);
  console.log("[FilenameFix] New path:", newPath);

  suggest({
    filename: newPath,
    conflictAction: "uniquify"
  });
});