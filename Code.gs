// 이끌림수학학원 출결/숙제 체크 - Apps Script 백엔드 (성능 개선판)
// 명단 탭과 기록 탭을 읽고 쓰는 웹앱 API

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'roster') {
    return jsonResponse(getRoster());
  }
  if (action === 'records') {
    const weekStart = e.parameter.weekStart; // YYYY-MM-DD (월요일)
    return jsonResponse(getRecordsForWeek(weekStart));
  }
  if (action === 'homework') {
    const weekStart = e.parameter.weekStart; // YYYY-MM-DD (월요일)
    return jsonResponse(getHomeworkForWeek(weekStart));
  }
  if (action === 'holidays') {
    const years = (e.parameter.years || '').split(',').filter(y => y);
    return jsonResponse(getHolidays(years));
  }
  if (action === 'examSchedule') {
    return jsonResponse(getExamSchedule());
  }
  if (action === 'studentReport') {
    const reportId = e.parameter.id;
    return jsonResponse(getStudentReport(reportId));
  }
  if (action === 'notice') {
    return jsonResponse(getNotice());
  }
  if (action === 'elemTests') {
    return jsonResponse(getElemTestsForStudent(e.parameter.name));
  }
  if (action === 'studentInfoList') {
    return jsonResponse(getStudentInfoList());
  }
  if (action === 'tuition') {
    return jsonResponse(getTuitionForMonth(e.parameter.yearMonth));
  }
  return jsonResponse({ error: 'unknown action' });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  if (action === 'saveRoster') {
    saveRoster(body.roster);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'saveRecord') {
    saveRecord(body.record);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'saveHomework') {
    const r = body.record;
    saveHomeworkRecord(r.date, r.day, r.block, r.name, r.completed, r.memo);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'saveNotice') {
    saveNotice(body.notice);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'uploadNoticeAttachment') {
    // POST는 no-cors로 전송되어 브라우저가 응답을 읽지 못하므로, 결과를 클라이언트에 돌려주는 대신
    // 서버가 "공지사항" 시트의 첨부파일 칸에 직접 기록한다 (uploadNoticeAttachment 안에서 처리).
    uploadNoticeAttachment(body.uploadToken, body.fileName, body.base64Data, body.mimeType);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'uploadTextbookImage') {
    // 같은 이유로 서버가 "학생정보" 시트에 직접 기록한다 (uploadTextbookImage 안에서 처리).
    uploadTextbookImage(body.name, body.fileName, body.base64Data, body.mimeType);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'setTextbookMemo') {
    setTextbookMemo(body.name, body.memo);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'deleteTextbookImage') {
    deleteTextbookImage(body.name);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'saveElemTest') {
    saveElemTest(body.test);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'deleteElemTest') {
    deleteElemTest(body.rowNum);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'setStudentStatus') {
    setStudentStatus(body.name, body.status);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'saveTuition') {
    saveTuition(body.record);
    return jsonResponse({ status: 'ok' });
  }
  return jsonResponse({ error: 'unknown action' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getExamSchedule() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('시험일정');
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const school = data[i][0];
    const examStart = data[i][1];
    const examEnd = data[i][2];
    const mathExamDate = data[i][3];
    const memo = data[i][4];
    if (!school || !examStart) continue;
    rows.push({
      school: school,
      examStart: formatDate(examStart),
      examEnd: examEnd ? formatDate(examEnd) : formatDate(examStart),
      mathExamDate: mathExamDate ? formatDate(mathExamDate) : null,
      memo: memo || ''
    });
  }
  return rows;
}

function formatDate(dateValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// 시트가 "15:30" 같은 값을 시간(Date)으로 자동 변환해 저장하는 경우가 있어,
// 비교/반환 전에 항상 'HH:mm' 문자열로 정규화한다.
// SpreadsheetApp이 돌려주는 Date는 realm이 달라 instanceof Date가 false로 나올 수 있어
// realm에 안전한 Object.prototype.toString으로 판별한다.
function normalizeBlock(val) {
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(val).trim();
}

// 날짜 값을 'yyyy-MM-dd' 문자열로 정규화 (Date 객체든 문자열이든 동일한 키로 맞춤)
function normalizeDate_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : s;
}

// 숙제 상태 값을 "완료"/"미흡"/"안함"/"미확인" 중 하나로 정규화한다.
// 예전 3단계 체계("완료"/"미완료"/"미확인")와 legacy boolean 저장분도 함께 호환한다.
function normalizeHwStatus_(raw) {
  const s = String(raw || '').trim();
  if (s === '완료' || s === '미흡' || s === '안함' || s === '미확인') return s;
  if (s === '미완료') return '미흡'; // 이전 3단계 체계 호환
  if (s === 'TRUE' || s === 'true') return '완료';
  if (s === 'FALSE' || s === 'false') return '미확인';
  return '미확인';
}

// 숙제 상태 4단계의 "관대함" 순위 — 같은 날 여러 슬롯 기록이 있을 때 더 나은 쪽을 채택하기 위함
// 완료(3) > 미흡(2) > 안함(1) > 미확인(0)
function hwStatusRank_(status) {
  if (status === '완료') return 3;
  if (status === '미흡') return 2;
  if (status === '안함') return 1;
  return 0; // 미확인
}

// 보강 상태 값을 "none"(지정 안 함)/"wait"(대기)/"done"(완료)/"waived"(보강 없음) 중 하나로 정규화한다.
// 시트에 아직 이 컬럼이 없거나 빈 값이면, 예전 makeupDone(TRUE/FALSE)을 기준으로 추론해
// 기존 데이터와의 하위 호환을 유지한다. 결석이라고 자동으로 "대기"가 되지 않도록
// 빈 값의 기본값은 "none"으로 둔다.
function normalizeMakeupStatus_(rawStatus, legacyMakeupDone) {
  const s = String(rawStatus || '').trim().toLowerCase();
  if (s === 'wait' || s === 'done' || s === 'waived') return s;
  if (legacyMakeupDone) return 'done';
  return 'none';
}

// new Date("yyyy-MM-dd")는 UTC 자정으로 파싱되어 스프레드시트 타임존 기준 값과 어긋나므로,
// 'T00:00:00'을 붙여 로컬(스크립트 타임존)로 파싱한 뒤 주간 종료일 문자열을 구한다.
function weekEndDateStr(weekStart, tz) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

// ---------- 명단 ----------
// 열 구성 (1-based): 1 요일 / 2 시간블록 / 3 슬롯 / 4 이름 / 5 적용시작일(effectiveFrom)
// 같은 (요일,시간블록,슬롯) 조합이라도 적용시작일이 다르면 별개의 배정 이력 행으로 존재할 수 있다.
// 5번째 컬럼이 비어있는(예전 방식으로 저장된) 행은 항상 적용되는 것으로 간주해 하위 호환한다.
function getRoster() {
  const sheet = getSheet('명단');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1); // skip header
  return rows.map(r => ({
    day: r[0], block: normalizeBlock(r[1]), slot: r[2], name: r[3] || "",
    effectiveFrom: r[4] ? normalizeDate_(r[4]) : ""
  }));
}

// 명단 편집 화면에서 이름이 바뀐 항목만, 지정된 적용시작일(없으면 오늘 날짜)로 이력 행을 추가/갱신한다.
// (기존 행은 과거 기록 보존을 위해 절대 덮어쓰지 않는다. 단, 같은 시작일로 이미 추가해둔 행이
//  있다면 — 예: 같은 날 여러 번 수정한 경우 — 그 행만 갱신해 중복을 막는다.)
// rosterRows의 각 항목은 { day, block, slot, name, effectiveFrom? } 형태로,
// effectiveFrom을 지정하면 그 날짜부터, 생략하면 오늘 날짜부터 적용된다(관리자가 실제 변경일을
// 정확히 아는 경우 — 예: 과거 특정 날짜부터 이미 요일이 바뀐 상황 — 직접 지정할 수 있다).
//
// 안전장치: 클라이언트가 "바뀌지 않은 슬롯"까지 실수로 함께 보내더라도(예: 화면 캐시 문제로 인한
// 중복 전송), 서버 쪽에서 한 번 더 "이 항목의 새 이름이 그 슬롯의 적용시작일 시점 기준 유효 이름과
// 이미 같은가"를 확인해, 같으면 아무 행도 추가/수정하지 않고 건너뛴다. 이렇게 하면 클라이언트 쪽
// 비교 로직에 결함이 있어도 시트에 무의미한 중복 이력이 쌓이는 것을 막을 수 있다.
function saveRoster(rosterRows) {
  const sheet = getSheet('명단');
  const tz = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const data = sheet.getDataRange().getValues();

  // block(시간블록) 셀은 시트가 "16:00" 같은 값을 시간(Date)으로 자동 변환해 저장하는 경우가 있으므로
  // 항상 normalizeBlock으로 통일해서 비교해야 한다.
  const lookupByEffRow = {};
  // 슬롯별 전체 이력(적용시작일별 이름) — "지금 실제로 유효한 이름이 무엇인가"를 계산하는 데 쓴다.
  const slotHistory = {}; // key: day|block|slot → [{name, effectiveFrom}, ...]
  for (let i = 1; i < data.length; i++) {
    const day = data[i][0];
    const block = normalizeBlock(data[i][1]);
    const slot = data[i][2];
    const name = String(data[i][3] || '').trim();
    const rowEff = data[i][4] ? normalizeDate_(data[i][4]) : '';

    const slotKey = day + '|' + block + '|' + slot;
    if (!slotHistory[slotKey]) slotHistory[slotKey] = [];
    slotHistory[slotKey].push({ name: name, effectiveFrom: rowEff });

    if (!rowEff) continue;
    const key = slotKey + '|' + rowEff;
    lookupByEffRow[key] = i + 1;
  }

  function currentNameAt(day, block, slot, dateStr) {
    const slotKey = day + '|' + block + '|' + slot;
    const hist = slotHistory[slotKey];
    if (!hist || !hist.length) return '';
    let best = null;
    hist.forEach(function (it) {
      if (!it.effectiveFrom) {
        // 시작일 없는 레거시 행이 여러 개 남아있을 수 있으므로, 이름이 있는 쪽을 우선한다.
        if (!best || (!best.effectiveFrom && !best.name && it.name)) best = it;
        return;
      }
      if (it.effectiveFrom <= dateStr) {
        if (!best || !best.effectiveFrom || it.effectiveFrom > best.effectiveFrom) best = it;
      }
    });
    return best ? best.name : '';
  }

  rosterRows.forEach(item => {
    const eff = item.effectiveFrom ? normalizeDate_(item.effectiveFrom) : todayStr;
    const newName = String(item.name || '').trim();

    // 이 슬롯이 eff 시점에 이미 이 이름이었다면, 실질적으로 아무것도 바뀌지 않는 요청이므로 건너뛴다.
    const already = currentNameAt(item.day, normalizeBlock(item.block), item.slot, eff);
    if (already === newName) return;

    const key = item.day + '|' + normalizeBlock(item.block) + '|' + item.slot + '|' + eff;
    const existingRow = lookupByEffRow[key];
    if (existingRow) {
      // 같은 시작일로 이미 추가해둔 행이 있다면 그 값만 갱신 (중복 행 방지)
      sheet.getRange(existingRow, 4).setValue(newName);
    } else {
      // 새 이력 행 추가 — 기존 행들은 그대로 두어 과거 조회 시 그 시점 이름이 보존된다.
      sheet.appendRow([item.day, item.block, item.slot, newName, eff]);
    }
  });
}

// ---------- 기록 ----------
// 열 구성 (1-based): 1 날짜 / 2 요일 / 3 시간블록 / 4 슬롯 / 5 상태 / 6 숙제(레거시) /
// 7 숙제메모(레거시) / 8 태도(레거시) / 9 사유메모 / 10 태도메모 / 11 등원시각 / 12 하원시각 /
// 13 보강완료(레거시 TRUE/FALSE) / 14 보강일시 / 15 보강상태(wait/done/waived, 신규)
function findRowsInDateRange_(sheet, startStr, endStr) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const tz = Session.getScriptTimeZone();
  const dateCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const rowNums = [];
  for (let i = 0; i < dateCol.length; i++) {
    const cellVal = dateCol[i][0];
    if (!cellVal) continue;
    const dateStr = Utilities.formatDate(new Date(cellVal), tz, 'yyyy-MM-dd');
    if (dateStr >= startStr && dateStr <= endStr) {
      rowNums.push(i + 2);
    }
  }
  return rowNums;
}

function getRecordsForWeek(weekStart) {
  const sheet = getSheet('기록');
  const tz = Session.getScriptTimeZone();
  const endStr = weekEndDateStr(weekStart, tz);
  const rowNums = findRowsInDateRange_(sheet, weekStart, endStr);
  if (!rowNums.length) return [];

  const byKey = {};
  rowNums.forEach(rowNum => {
    const r = sheet.getRange(rowNum, 1, 1, 15).getValues()[0];
    if (!r[0]) return;
    const dateStr = Utilities.formatDate(new Date(r[0]), tz, 'yyyy-MM-dd');
    const key = dateStr + '|' + normalizeBlock(r[2]) + '|' + String(parseInt(r[3], 10));
    byKey[key] = {
      date: dateStr,
      day: r[1], block: normalizeBlock(r[2]), slot: r[3],
      status: r[4], hw: r[5], hwNote: r[6], attitude: r[7],
      statusNote: r[8] || "", attNote: r[9] || "",
      checkIn: normalizeBlock(r[10] || ""),
      checkOut: normalizeBlock(r[11] || ""),
      makeupDone: !!r[12], makeupDate: r[13] || "",
      makeupStatus: normalizeMakeupStatus_(r[14], r[12])
    };
  });
  return Object.values(byKey);
}

function saveRecord(rec) {
  const sheet = getSheet('기록');
  const lastRow = sheet.getLastRow();
  const targetDate = rec.date;
  const tz = Session.getScriptTimeZone();
  const targetSlot = String(parseInt(rec.slot, 10));
  const targetBlock = String(rec.block).trim();
  const makeupStatus = normalizeMakeupStatus_(rec.makeupStatus, rec.makeupDone);

  if (lastRow >= 2) {
    const keyCols = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let i = keyCols.length - 1; i >= 0; i--) {
      const cellVal = keyCols[i][0];
      if (!cellVal) continue;
      const rowDate = Utilities.formatDate(new Date(cellVal), tz, 'yyyy-MM-dd');
      if (rowDate !== targetDate) continue;
      const rowBlock = String(keyCols[i][2]).trim();
      if (rowBlock !== targetBlock) continue;
      const rowSlot = String(parseInt(keyCols[i][3], 10));
      if (rowSlot !== targetSlot) continue;

      const rowNum = i + 2;
      sheet.getRange(rowNum, 1, 1, 10).setValues([[
        rec.date, rec.day, rec.block, rec.slot, rec.status, rec.hw, rec.hwNote, rec.attitude,
        rec.statusNote || "", rec.attNote || ""
      ]]);
      sheet.getRange(rowNum, 11, 1, 5).setValues([[
        rec.checkIn || "", rec.checkOut || "", makeupStatus === 'done', rec.makeupDate || "", makeupStatus
      ]]);
      return;
    }
  }
  sheet.appendRow([
    rec.date, rec.day, rec.block, rec.slot, rec.status, rec.hw, rec.hwNote, rec.attitude,
    rec.statusNote || "", rec.attNote || "",
    rec.checkIn || "", rec.checkOut || "", makeupStatus === 'done', rec.makeupDate || "", makeupStatus
  ]);
}

// ---------- 숙제기록 ----------
function getHomeworkSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('숙제기록');
  if (!sheet) {
    sheet = ss.insertSheet('숙제기록');
    sheet.appendRow(['날짜', '요일', '시간블록', '학생이름', '숙제완료여부', '숙제메모']);
  }
  return sheet;
}

function getHomeworkForWeek(weekStart) {
  const sheet = getHomeworkSheet();
  const tz = Session.getScriptTimeZone();
  const endStr = weekEndDateStr(weekStart, tz);
  const rowNums = findRowsInDateRange_(sheet, weekStart, endStr);
  if (!rowNums.length) return [];

  const byKey = {};
  rowNums.forEach(rowNum => {
    const r = sheet.getRange(rowNum, 1, 1, 6).getValues()[0];
    if (!r[0]) return;
    const dateStr = Utilities.formatDate(new Date(r[0]), tz, 'yyyy-MM-dd');
    const block = normalizeBlock(r[2]);
    const key = dateStr + '|' + block + '|' + String(r[3]).trim();
    byKey[key] = {
      date: dateStr,
      day: r[1], block: block, name: r[3],
      completed: r[4], memo: r[5] || ""
    };
  });
  return Object.values(byKey);
}

function saveHomeworkRecord(date, dayOfWeek, slot, studentName, completed, memo) {
  const sheet = getHomeworkSheet();
  const lastRow = sheet.getLastRow();
  const targetDate = date;
  const targetBlock = normalizeBlock(slot);
  const targetName = String(studentName).trim();
  const tz = Session.getScriptTimeZone();

  if (lastRow >= 2) {
    const keyCols = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let i = keyCols.length - 1; i >= 0; i--) {
      const cellVal = keyCols[i][0];
      if (!cellVal) continue;
      const rowDate = Utilities.formatDate(new Date(cellVal), tz, 'yyyy-MM-dd');
      if (rowDate !== targetDate) continue;
      const rowBlock = normalizeBlock(keyCols[i][2]);
      if (rowBlock !== targetBlock) continue;
      const rowName = String(keyCols[i][3]).trim();
      if (rowName !== targetName) continue;

      const rowNum = i + 2;
      sheet.getRange(rowNum, 1, 1, 6).setValues([[
        date, dayOfWeek, slot, studentName, completed, memo || ""
      ]]);
      return;
    }
  }
  sheet.appendRow([date, dayOfWeek, slot, studentName, completed, memo || ""]);
}

// ---------- 공지사항 ----------
// "공지사항" 시트가 없으면 자동 생성 (제목 / 내용 / 시작일 / 종료일 / 수정시각 / 첨부파일ID / 첨부파일명 / 첨부파일종류)
function getNoticeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('공지사항');
  if (!sheet) {
    sheet = ss.insertSheet('공지사항');
    sheet.appendRow(['제목', '내용', '시작일', '종료일', '수정시각', '첨부파일ID', '첨부파일명', '첨부파일종류']);
  }
  return sheet;
}

// 공지사항 PDF/이미지 첨부파일을 저장할 전용 Drive 폴더. 없으면 자동 생성해 재사용한다.
function getNoticeAttachmentFolder_() {
  const FOLDER_NAME = '학원공지_첨부파일';
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

// admin.html에서 base64로 인코딩해 보낸 파일(PDF 또는 이미지)을 Drive에 저장하고, 학부모가
// 열람할 수 있도록 링크 공유("링크가 있는 모든 사용자 - 뷰어")로 권한을 설정한 뒤 파일 ID를 반환한다.
// fileName: 원본 파일명, base64Data: data URL의 콤마 이후 부분(순수 base64 문자열), mimeType: 파일의 MIME 타입
// admin.html에서 base64로 인코딩해 보낸 파일(PDF 또는 이미지)을 Drive에 저장하고, 학부모가
// 열람할 수 있도록 링크 공유("링크가 있는 모든 사용자 - 뷰어")로 권한을 설정한 뒤,
// "공지사항" 시트의 첨부파일 칸(F,G,H열)을 즉시 함께 갱신한다.
// POST 요청은 no-cors로 전송되어 브라우저가 응답을 읽을 수 없으므로 — GET 폴링으로 결과를
// 되돌려주는 방식은 Apps Script exec URL의 리다이렉트 특성과 맞물려 불안정했다 — 서버가
// 시트에 직접 기록해두고, 클라이언트는 이후 저장(saveNotice) 시 이 값을 건드리지 않는 방식을 쓴다.
// fileName: 원본 파일명, base64Data: data URL의 콤마 이후 부분(순수 base64 문자열), mimeType: 파일의 MIME 타입
function uploadNoticeAttachment(uploadToken, fileName, base64Data, mimeType) {
  const folder = getNoticeAttachmentFolder_();
  const bytes = Utilities.base64Decode(base64Data);
  const type = mimeType || 'application/pdf';
  const blob = Utilities.newBlob(bytes, type, fileName || 'notice');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileType = type.indexOf('image/') === 0 ? 'image' : 'pdf';
  const result = { fileId: file.getId(), fileName: file.getName(), fileType: fileType };

  const sheet = getNoticeSheet();
  if (sheet.getLastRow() < 2) {
    sheet.appendRow(['', '', '', '', new Date(), result.fileId, result.fileName, result.fileType]);
  } else {
    sheet.getRange(2, 6, 1, 3).setValues([[result.fileId, result.fileName, result.fileType]]);
  }
  return result;
}

// 오늘 날짜가 시작일~종료일 사이인 공지 1건을 반환 (여러 건이면 가장 최근 수정된 것)
// noticeId는 report.html이 NEW 뱃지/읽음 처리를 위해 쓰는 값으로, 수정시각(ms)을 그대로 사용한다.
// 첨부파일이 있으면 embedUrl(iframe 미리보기용)과 fileName을 함께 내려준다.
function getNotice() {
  const sheet = getNoticeSheet();
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  let best = null;
  for (let i = 1; i < data.length; i++) {
    const title = data[i][0];
    const content = data[i][1];
    const startRaw = data[i][2];
    const endRaw = data[i][3];
    const updatedRaw = data[i][4];
    const attachmentId = data[i][5] || '';
    const attachmentName = data[i][6] || '';
    const attachmentType = data[i][7] || 'pdf';
    if (!title || !startRaw || !endRaw) continue;

    const startStr = normalizeDate_(startRaw);
    const endStr = normalizeDate_(endRaw);
    if (todayStr < startStr || todayStr > endStr) continue;

    const updatedMs = updatedRaw ? new Date(updatedRaw).getTime() : 0;
    if (!best || updatedMs > best.updatedMs) {
      best = {
        id: String(updatedMs),
        title: title,
        content: content || '',
        startDate: startStr,
        endDate: endStr,
        updatedMs: updatedMs,
        attachmentId: attachmentId,
        attachmentName: attachmentName,
        attachmentType: attachmentType
      };
    }
  }

  if (!best) return { notice: null };
  const notice = {
    id: best.id,
    title: best.title,
    content: best.content,
    startDate: best.startDate,
    endDate: best.endDate
  };
  if (best.attachmentId) {
    notice.attachmentName = best.attachmentName;
    notice.attachmentType = best.attachmentType;
    notice.attachmentViewUrl = 'https://drive.google.com/file/d/' + best.attachmentId + '/view';
    // 이미지·PDF 모두 작은 썸네일 카드로 보여주고, 클릭했을 때만 확대해서 크게 본다.
    // 이미지는 <img>로 바로, PDF는 Drive의 페이지 미리보기(iframe) embed URL로 확대한다.
    notice.attachmentThumbUrl = 'https://drive.google.com/thumbnail?id=' + best.attachmentId + '&sz=w200';
    if (best.attachmentType !== 'image') {
      notice.attachmentEmbedUrl = 'https://drive.google.com/file/d/' + best.attachmentId + '/preview';
    }
  }
  return { notice: notice };
}

// 공지사항 저장 — 항상 2행(첫 데이터 행)에 덮어써서 "전체 공지 1건"만 유지한다.
// 공지사항 저장 — 항상 2행(첫 데이터 행)에 덮어써서 "전체 공지 1건"만 유지한다.
// 저장할 때마다 수정시각을 새로 찍어서 report.html의 NEW 뱃지가 뜨게 한다.
// 첨부파일(F,G,H열)은 uploadNoticeAttachment가 별도로 직접 기록하므로, 여기서는 절대 건드리지
// 않는다 — 그래야 "파일 첨부 후 저장" 순서에서 방금 올린 첨부가 빈 값으로 덮어써지지 않는다.
// notice.removeAttachment === true로 명시적으로 온 경우에만 첨부 정보를 지운다.
function saveNotice(notice) {
  const sheet = getNoticeSheet();
  const now = new Date();
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([notice.title, notice.content, notice.startDate, notice.endDate, now, '', '', '']);
  } else {
    sheet.getRange(2, 1, 1, 5).setValues([[notice.title, notice.content, notice.startDate, notice.endDate, now]]);
    if (notice.removeAttachment === true) {
      sheet.getRange(2, 6, 1, 3).setValues([['', '', '']]);
    }
  }
}

// ---------- 초등부 테스트 기록 (주간테스트/단원평가) ----------
// "초등테스트기록" 시트가 없으면 자동 생성 (학생이름 / 테스트명 / 날짜 / 점수 / 메모)
function getElemTestSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('초등테스트기록');
  if (!sheet) {
    sheet = ss.insertSheet('초등테스트기록');
    sheet.appendRow(['학생이름', '테스트명', '날짜', '점수', '메모']);
  }
  return sheet;
}

// 특정 학생의 테스트 기록을 최신순으로 반환 (성적 관리 화면 + report.html 시험 탭에서 사용)
// rowNum은 삭제 시 어느 시트 행을 지울지 특정하기 위해 함께 내려준다.
function getElemTestsForStudent(studentName) {
  if (!studentName) return [];
  const sheet = getElemTestSheet();
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0] || '').trim();
    if (name !== String(studentName).trim()) continue;
    if (!data[i][1]) continue;
    rows.push({
      rowNum: i + 1,
      name: name,
      title: data[i][1],
      date: normalizeDate_(data[i][2]),
      score: normalizeScoreCell_(data[i][3]),
      memo: data[i][4] || ''
    });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}

// 점수 셀이 과거에 실수로 날짜(Date)로 저장된 경우를 대비한 방어 코드.
// 정상적으로 텍스트로 저장된 값은 그대로 반환한다.
function normalizeScoreCell_(val) {
  if (Object.prototype.toString.call(val) === '[object Date]') {
    // "9/10"이 날짜로 잘못 저장됐다면 월/일 값으로 원래 분수 형태를 복원 시도
    const m = val.getMonth() + 1;
    const d = val.getDate();
    return m + '/' + d;
  }
  return val;
}

// 초등 테스트 결과 저장. test.id가 있으면(기존 행 수정) 그 행을 덮어쓰고, 없으면 새 행 추가.
// id는 시트의 실제 행 번호를 그대로 사용한다 (성적 관리 화면에서 목록을 다시 그릴 때 넘겨받음).
// "9/10" 같은 값을 구글시트가 날짜로 자동 변환해버리는 것을 막기 위해
// 저장 시 점수 셀 서식을 텍스트로 강제 지정한다.
function saveElemTest(test) {
  const sheet = getElemTestSheet();
  const rowNum = test.rowNum || (sheet.getLastRow() + 1);
  if (!test.rowNum) {
    sheet.appendRow([test.name, test.title, test.date, '', test.memo || '']);
  } else {
    sheet.getRange(rowNum, 1).setValue(test.name);
    sheet.getRange(rowNum, 2).setValue(test.title);
    sheet.getRange(rowNum, 3).setValue(test.date);
    sheet.getRange(rowNum, 5).setValue(test.memo || '');
  }
  const scoreCell = sheet.getRange(rowNum, 4);
  scoreCell.setNumberFormat('@'); // 텍스트 서식으로 고정 — "9/10"이 날짜로 바뀌는 것 방지
  scoreCell.setValue(String(test.score));
}

// 잘못 입력된 테스트 기록 한 건을 시트에서 삭제 (성적 관리 화면의 삭제 버튼에서 호출)
function deleteElemTest(rowNum) {
  if (!rowNum) return;
  const sheet = getElemTestSheet();
  sheet.deleteRow(rowNum);
}

// ---------- 수강료 ----------
// "수강료" 시트가 없으면 자동 생성 (이름 / 연월(YYYY-MM) / 금액 / 납부상태(미납·완납) / 납부일 / 메모)
// 한 학생당 한 연월에 한 행만 존재한다 (saveTuition이 이름+연월 조합으로 upsert).
function getTuitionSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('수강료');
  if (!sheet) {
    sheet = ss.insertSheet('수강료');
    sheet.appendRow(['이름', '연월', '금액', '납부상태', '납부일', '메모']);
  }
  return sheet;
}

// 연월(YYYY-MM) 셀 값을 정규화한다. 시트가 "2026-08" 같은 값을 날짜(Date)로 자동 변환해
// 저장하는 경우가 있어, 비교/반환 전에 항상 'yyyy-MM' 문자열로 되돌린다.
function normalizeYearMonth_(val) {
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  const s = String(val || '').trim();
  const m = s.match(/^\d{4}-\d{2}/);
  return m ? m[0] : s;
}

// 특정 연월(YYYY-MM)의 수강료 기록 전체를 반환 (학생 관리 화면의 수강료 탭에서 사용).
// 아직 해당 연월 행이 없는 재원생은 여기 포함되지 않으며, 클라이언트가 studentInfoList와
// 합쳐서 "기록 없음 = 미납"으로 보여준다.
function getTuitionForMonth(yearMonth) {
  if (!yearMonth) return [];
  const sheet = getTuitionSheet_();
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0] || '').trim();
    const ym = normalizeYearMonth_(data[i][1]);
    if (!name || ym !== yearMonth) continue;
    rows.push({
      rowNum: i + 1,
      name: name,
      yearMonth: ym,
      amount: data[i][2] || '',
      status: (data[i][3] || '').trim() === '완납' ? '완납' : '미납',
      paidDate: data[i][4] ? normalizeDate_(data[i][4]) : '',
      memo: data[i][5] || ''
    });
  }
  return rows;
}

// 수강료 한 건 저장. 같은 이름+연월 행이 있으면 덮어쓰고, 없으면 새 행을 추가한다.
// "2026-08" 같은 연월 값을 구글시트가 날짜로 자동 변환해버리는 것을 막기 위해(초등 테스트
// 점수의 "9/10"과 동일한 문제), 연월 셀은 항상 텍스트 서식으로 고정한 뒤 값을 넣는다.
function saveTuition(rec) {
  if (!rec || !rec.name || !rec.yearMonth) return;
  const sheet = getTuitionSheet_();
  const status = rec.status === '완납' ? '완납' : '미납';
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0] || '').trim();
    const ym = normalizeYearMonth_(data[i][1]);
    if (name === rec.name && ym === rec.yearMonth) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 1).setValue(rec.name);
      const ymCell = sheet.getRange(rowNum, 2);
      ymCell.setNumberFormat('@');
      ymCell.setValue(rec.yearMonth);
      sheet.getRange(rowNum, 3, 1, 4).setValues([[rec.amount || '', status, rec.paidDate || '', rec.memo || '']]);
      return;
    }
  }
  sheet.appendRow([rec.name, '', rec.amount || '', status, rec.paidDate || '', rec.memo || '']);
  const newRowNum = sheet.getLastRow();
  const ymCell = sheet.getRange(newRowNum, 2);
  ymCell.setNumberFormat('@');
  ymCell.setValue(rec.yearMonth);
}

// 특정 학생의 수강료 이력을 최신 연월순으로 최대 limit건 반환 (report.html 학부모 리포트에서 사용)
function getTuitionHistoryForStudent_(studentName, limit) {
  if (!studentName) return [];
  const sheet = getTuitionSheet_();
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0] || '').trim();
    if (name !== String(studentName).trim()) continue;
    const ym = normalizeYearMonth_(data[i][1]);
    if (!ym) continue;
    rows.push({
      yearMonth: ym,
      amount: data[i][2] || '',
      status: (data[i][3] || '').trim() === '완납' ? '완납' : '미납',
      paidDate: data[i][4] ? normalizeDate_(data[i][4]) : '',
      memo: data[i][5] || ''
    });
  }
  rows.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  return limit ? rows.slice(0, limit) : rows;
}

// ---------- 공휴일 (한국천문연구원 특일정보 API) ----------
const HOLIDAY_API_KEY = "3xGFaw8GKPkrpf8c%2F8dNckyt98Uyv47u5%2BkDmYA8tPE3LbBHez764DKmgoJHiyNNMGO7iHXTzyUdsvjNwEg0CA%3D%3D";

function getHolidays(years) {
  const result = {};
  years.forEach(year => {
    const cached = getCachedHolidays(year);
    if (cached && Object.keys(cached).length > 0) {
      Object.assign(result, cached);
    } else {
      const fetched = fetchHolidaysFromApi(year);
      if (Object.keys(fetched).length > 0) {
        cacheHolidays(year, fetched);
      }
      Object.assign(result, fetched);
    }
  });
  return result;
}

function getCachedHolidays(year) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('holidays_' + year);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function cacheHolidays(year, data) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('holidays_' + year, JSON.stringify(data));
}

function fetchHolidaysFromApi(year) {
  const url = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
    + "?ServiceKey=" + HOLIDAY_API_KEY
    + "&solYear=" + year
    + "&numOfRows=100"
    + "&_type=json";
  const result = {};
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(res.getContentText());
    const items = json.response && json.response.body && json.response.body.items ? json.response.body.items.item : null;
    if (!items) return result;
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach(item => {
      const locdate = String(item.locdate);
      const dateStr = locdate.slice(0,4) + '-' + locdate.slice(4,6) + '-' + locdate.slice(6,8);
      result[dateStr] = item.dateName;
    });
  } catch (e) {
    // API 실패 시 빈 객체 반환
  }
  return result;
}

function clearHolidayCache() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(key => {
    if (key.indexOf('holidays_') === 0) {
      props.deleteProperty(key);
    }
  });
  Logger.log('공휴일 캐시 초기화 완료');
}

// "명단" 시트에 완전히 동일한(요일,시간블록,슬롯,이름,적용시작일) 중복 행이 쌓였을 때 정리하는 함수.
// Apps Script 편집기에서 이 함수를 선택한 뒤 "실행" 버튼을 눌러 수동으로 1회 실행한다.
// 과거 이력(다른 적용시작일을 가진 행)은 전혀 건드리지 않고, 완전히 동일한 행만 처음 것 하나만 남기고 지운다.
function dedupeRosterHistory() {
  const sheet = getSheet('명단');
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) { Logger.log('정리할 행이 없습니다.'); return; }
  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  const seen = {};
  const rowsToDelete = []; // 1-based 시트 행 번호

  for (let i = 0; i < data.length; i++) {
    const day = data[i][0];
    const block = normalizeBlock(data[i][1]);
    const slot = data[i][2];
    const name = String(data[i][3] || '').trim();
    const eff = data[i][4] ? normalizeDate_(data[i][4]) : '';
    const key = day + '|' + block + '|' + slot + '|' + name + '|' + eff;
    const sheetRowNum = i + 2;

    if (seen[key]) {
      rowsToDelete.push(sheetRowNum);
    } else {
      seen[key] = true;
    }
  }

  // 뒤에서부터 지워야 앞 행 번호가 밀리지 않는다.
  rowsToDelete.sort(function (a, b) { return b - a; });
  rowsToDelete.forEach(function (rowNum) { sheet.deleteRow(rowNum); });

  Logger.log('중복 행 ' + rowsToDelete.length + '개를 삭제했습니다. (원래 ' + data.length + '행 → ' + (data.length - rowsToDelete.length) + '행)');
}

// "학생정보" 시트의 report_id(D열)가 비어있는 행에 고유 ID를 자동 생성해서 채움
function generateReportIds() {
  const sheet = getSheet('학생정보');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const name = data[i][0];
    const existingId = data[i][3];

    if (name && !existingId) {
      const newId = Utilities.getUuid().replace(/-/g, '').substring(0, 10);
      sheet.getRange(i + 1, 4).setValue(newId);
    }
  }
}

// "학생정보" 시트 열 구성 (1-based): 1 이름 / 2 학교 / 3 학년 / 4 report_id / 5 재원상태("퇴원"이면 퇴원, 그 외/빈칸은 재원중) /
// 6 교재이미지ID / 7 교재이미지명 / 8 교재메모(교재명·준비 기한 등 간단한 문구)
// 학생 관리 화면(admin.html)에서 퇴원 처리 토글에 사용. 시트에 아직 5번째 열이 없어도 안전하게 빈 값으로 처리된다.
function getStudentInfoList() {
  const sheet = getSheet('학생정보');
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const name = data[i][0];
    if (!name) continue;
    rows.push({
      rowNum: i + 1,
      name: name,
      school: data[i][1] || '',
      grade: data[i][2] || '',
      reportId: data[i][3] || '',
      status: (data[i][4] || '').trim() === '퇴원' ? '퇴원' : '재원',
      textbookImageId: data[i][5] || '',
      textbookImageName: data[i][6] || '',
      textbookMemo: data[i][7] || ''
    });
  }
  return rows;
}

// 학생 재원상태를 변경한다. status는 "재원" 또는 "퇴원"만 허용.
function setStudentStatus(name, status) {
  if (!name) return;
  const normalizedStatus = (status === '퇴원') ? '퇴원' : '재원';
  const sheet = getSheet('학생정보');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 5).setValue(normalizedStatus);
      return;
    }
  }
}

// 학생별 준비 교재 이미지를 Drive에 저장하고, "학생정보" 시트의 F,G열(교재이미지ID/명)에
// 직접 기록한다. 공지사항 첨부와 동일하게, POST(no-cors)는 응답을 읽을 수 없으므로 서버가
// 시트에 바로 써서 클라이언트가 별도로 결과를 조회할 필요가 없게 한다.
// 새로 등록하면 이전 이미지를 덮어쓴다(학생당 한 장만 유지).
function uploadTextbookImage(name, fileName, base64Data, mimeType) {
  if (!name) return;
  const folder = getNoticeAttachmentFolder_(); // 공지 첨부와 같은 폴더를 재사용
  const bytes = Utilities.base64Decode(base64Data);
  const type = mimeType || 'image/png';
  const blob = Utilities.newBlob(bytes, type, fileName || 'textbook.png');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const sheet = getSheet('학생정보');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 6, 1, 2).setValues([[file.getId(), file.getName()]]);
      return;
    }
  }
}

// 학생별 준비 교재 메모(교재명, 준비 기한 등 간단한 문구)를 저장한다. H열에 기록하며,
// 이미지와 별개로 언제든 단독으로 수정할 수 있다.
function setTextbookMemo(name, memo) {
  if (!name) return;
  const sheet = getSheet('학생정보');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 8).setValue(memo || '');
      return;
    }
  }
}

// 학생별 준비 교재 이미지를 삭제한다. Drive의 실제 파일도 휴지통으로 보내고,
// "학생정보" 시트의 F,G열(교재이미지ID/명)을 비운다. 메모(H열)는 건드리지 않는다.
function deleteTextbookImage(name) {
  if (!name) return;
  const sheet = getSheet('학생정보');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      const fileId = data[i][5];
      if (fileId) {
        try {
          DriveApp.getFileById(fileId).setTrashed(true);
        } catch (e) {
          // 파일이 이미 삭제되었거나 접근 불가한 경우에도 시트 값은 정리한다.
        }
      }
      sheet.getRange(i + 1, 6, 1, 2).setValues([['', '']]);
      return;
    }
  }
}

// report_id로 학생을 찾아 출결/숙제/보강/시험/공지/수강료 데이터를 모아서 반환
// (병합 키는 "날짜" 단위 — 하루에 시간블록이 여러 개라도 출결·숙제가 한 줄로 합쳐짐)
function getStudentReport(reportId) {
  if (!reportId) return { error: 'missing id' };

  // 1. 학생정보 시트에서 이름/학교/학년/재원상태 찾기
  const infoSheet = getSheet('학생정보');
  const infoData = infoSheet.getDataRange().getValues();
  let student = null;
  for (let i = 1; i < infoData.length; i++) {
    if (infoData[i][3] === reportId) {
      const status = (infoData[i][4] || '').trim() === '퇴원' ? '퇴원' : '재원';
      student = { name: infoData[i][0], school: infoData[i][1], grade: infoData[i][2], status: status,
        textbookImageId: infoData[i][5] || '', textbookImageName: infoData[i][6] || '', textbookMemo: infoData[i][7] || '' };
      break;
    }
  }
  if (!student) return { error: 'student not found' };
  if (student.status === '퇴원') return { error: 'student inactive' };

  // 2. 명단 시트 전체 이력을 (요일,시간블록,슬롯)별로 모아둔다 — 다른 학생의 배정 이력도 함께 있어야
  // "이 슬롯이 특정 날짜에 실제로 누구 것이었는지"를 정확히 판단할 수 있다.
  const rosterSheet = getSheet('명단');
  const rosterData = rosterSheet.getDataRange().getValues();
  const slotHistoryMap = {}; // key: day|block|slot → [{name, effectiveFrom}, ...]
  for (let i = 1; i < rosterData.length; i++) {
    const day = rosterData[i][0];
    const block = normalizeBlock(rosterData[i][1]);
    const slot = String(rosterData[i][2]);
    const name = String(rosterData[i][3] || '');
    const effectiveFrom = rosterData[i][4] ? normalizeDate_(rosterData[i][4]) : '';
    const key = day + '|' + block + '|' + slot;
    if (!slotHistoryMap[key]) slotHistoryMap[key] = [];
    slotHistoryMap[key].push({ name: name, effectiveFrom: effectiveFrom });
  }

  // 특정 (day,block,slot,dateStr)에 대해 그 시점 실제 유효했던 이름을 계산 (admin.html의 rosterNameAt과 동일 원리)
  function nameAt(day, block, slot, dateStr) {
    const key = day + '|' + block + '|' + String(slot);
    const candidates = slotHistoryMap[key];
    if (!candidates || !candidates.length) return '';
    let best = null;
    candidates.forEach(function (it) {
      if (!it.effectiveFrom) {
        // 시작일 없는 레거시 행이 여러 개 남아있을 수 있으므로, 이름이 있는 쪽을 우선한다.
        if (!best || (!best.effectiveFrom && !best.name && it.name)) best = it;
        return;
      }
      if (it.effectiveFrom <= dateStr) {
        if (!best || !best.effectiveFrom || it.effectiveFrom > best.effectiveFrom) best = it;
      }
    });
    return best ? best.name : '';
  }

  // 이 학생 이름이 한 번이라도 들어간 (day,block,slot) 조합만 후보로 추려서, 기록 매칭 시 순회 범위를 줄인다.
  const candidateSlots = [];
  Object.keys(slotHistoryMap).forEach(function (key) {
    const hasMe = slotHistoryMap[key].some(function (it) { return it.name.indexOf(student.name) !== -1; });
    if (hasMe) {
      const parts = key.split('|');
      candidateSlots.push({ day: parts[0], block: parts[1], slot: parts[2] });
    }
  });

  function isMyPeriod(day, block, slot, dateStr) {
    const isCandidate = candidateSlots.some(function (s) {
      return s.day === day && s.block === block && s.slot === String(slot);
    });
    if (!isCandidate) return false;
    // 그 날짜에 실제로 유효했던 이름이 이 학생인지를 직접 확인 — 다른 학생에게 재배정된 이후 날짜는 자동으로 걸러진다.
    return nameAt(day, block, slot, dateStr).indexOf(student.name) !== -1;
  }

  // 3. 기록 시트에서 이 학생의 배정 구간에 해당하는 출결 데이터만 모으기 (날짜 단위로 합침)
  const recordSheet = getSheet('기록');
  const recordData = recordSheet.getDataRange().getValues();
  const attendanceMap = {}; // key: date → 출결 정보 (같은 날 여러 슬롯이면 마지막 것이 최종 반영)

  for (let i = 1; i < recordData.length; i++) {
    const row = recordData[i];
    const rDay = row[1];
    const rBlock = normalizeBlock(row[2]);
    const rSlot = row[3];
    const rDateStr = normalizeDate_(row[0]);

    const match = isMyPeriod(rDay, rBlock, rSlot, rDateStr);
    if (match) {
      const dateKey = rDateStr;
      attendanceMap[dateKey] = {
        date: row[0], day: row[1], block: row[2],
        status: row[4],
        statusMemo: row[8], attitudeMemo: row[9],
        makeupDone: row[12], makeupDate: row[13],
        makeupStatus: normalizeMakeupStatus_(row[14], row[12])
      };
    }
  }

  // 4. 숙제기록 시트에서 이 학생 이름으로 직접 매칭 (날짜 단위로 합침)
  // 같은 날 여러 슬롯 기록이 있으면 4단계 중 더 관대한(=순위가 높은) 상태를 채택한다.
  const hwSheet = getSheet('숙제기록');
  const hwData = hwSheet.getDataRange().getValues();
  const homeworkMap = {}; // key: date → 숙제 정보

  for (let i = 1; i < hwData.length; i++) {
    const row = hwData[i];
    const hwName = String(row[3] || '');
    if (hwName.indexOf(student.name) !== -1) {
      const dateKey = normalizeDate_(row[0]);
      const status = normalizeHwStatus_(row[4]);
      const prev = homeworkMap[dateKey];
      if (!prev || hwStatusRank_(status) > hwStatusRank_(prev.homeworkStatus)) {
        homeworkMap[dateKey] = {
          homeworkStatus: status,
          homeworkContent: row[5] || ''
        };
      }
    }
  }

  // 5. 두 맵을 날짜 기준으로 합치기
  const allKeys = new Set([...Object.keys(attendanceMap), ...Object.keys(homeworkMap)]);
  const records = [];
  allKeys.forEach(key => {
    const att = attendanceMap[key] || {};
    const hw = homeworkMap[key] || {};
    const hwStatus = hw.homeworkStatus || '미확인';
    records.push({
      date: att.date || key,
      day: att.day || '',
      block: normalizeBlock(att.block) || '',
      status: att.status || null,
      statusMemo: att.statusMemo || '',
      attitudeMemo: att.attitudeMemo || '',
      makeupDone: att.makeupDone || false,
      makeupDate: att.makeupDate || '',
      makeupStatus: att.makeupStatus || 'none',
      // homeworkStatus: 4단계 문자열("완료"/"미흡"/"안함"/"미확인") — report.html이 이 값을 우선 사용
      homeworkStatus: hwStatus,
      // homeworkDone: 구버전 클라이언트 호환용 — "완료"일 때만 true
      homeworkDone: hwStatus === '완료',
      homeworkContent: hw.homeworkContent || ''
    });
  });

  records.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 6. 시험일정 시트에서 이 학생 학교의 시험 정보 찾기 (중등 이상만 해당 — 초등은 학교 시험 자체가 없음)
  // 학교명이 "~초"(초등학교)로 끝나면 초등부로 판단 — 학년란은 "6학년"처럼 학교급 표기가 없어 학교명으로 구분
  const isElementary = /초$/.test(String(student.school || '').trim());
  let exam = null;
  if (!isElementary) {
    const examSheet = getSheet('시험일정');
    const examData = examSheet.getDataRange().getValues();
    for (let i = 1; i < examData.length; i++) {
      if (examData[i][0] === student.school) {
        exam = {
          school: examData[i][0], examStart: examData[i][1],
          examEnd: examData[i][2], mathExamDate: examData[i][3], memo: examData[i][4]
        };
        break;
      }
    }
  }

  // 6-1. 개인별 테스트 기록 — 초등부는 시험 탭의 주가 되고, 중등 이상은 학교 D-day 아래 보조로 표시된다.
  const elemTests = getElemTestsForStudent(student.name);

  // 7. 공지사항
  const notice = getNotice().notice;

  // 8. 준비 교재 이미지 — 등록되어 있으면 썸네일/확대 보기용 URL을 함께 내려준다.
  let textbook = null;
  if (student.textbookImageId || student.textbookMemo) {
    textbook = {
      name: student.textbookImageName,
      memo: student.textbookMemo || ''
    };
    if (student.textbookImageId) {
      textbook.thumbUrl = 'https://drive.google.com/thumbnail?id=' + student.textbookImageId + '&sz=w200';
      textbook.viewUrl = 'https://drive.google.com/file/d/' + student.textbookImageId + '/view';
    }
  }

  // 9. 수강료 납부 이력 (최근 6개월)
  const tuition = getTuitionHistoryForStudent_(student.name, 6);

  return { student: student, records: records, exam: exam, notice: notice, isElementary: isElementary, elemTests: elemTests, textbook: textbook, tuition: tuition };
}
