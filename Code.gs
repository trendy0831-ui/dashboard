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
    // 2026-09 이전 버전 호환용으로 남겨둠 — report.html은 이제 아래의 가벼운 studentReportSummary +
    // 탭별 지연 로딩 API를 사용한다.
    const reportId = e.parameter.id;
    return jsonResponse(getStudentReport(reportId));
  }
  if (action === 'studentReportSummary') {
    // 2026-09: report.html 첫 화면 전용 — 이번 달 출석·숙제 집계, 최근 10건, 확인할 내용, 보강·교재까지
    // 한 번에 내려주고(별도 지연 로딩 불필요), 짧은 서버 캐시를 적용해 반복 요청 시 시트 재조회를 줄인다.
    return jsonResponse(getStudentReportSummary(e.parameter.id));
  }
  if (action === 'studentReportExam') {
    // 시험 탭을 처음 열 때만 호출 (학교 D-day + 개인 테스트 기록)
    return jsonResponse(getStudentReportExam(e.parameter.id));
  }
  if (action === 'studentReportTuition') {
    // 수강료 탭을 처음 열 때만 호출 (최근 6개월 이력)
    return jsonResponse(getStudentReportTuition(e.parameter.id));
  }
  if (action === 'studentReportNotice') {
    // 공지사항 탭을 처음 열 때만 호출. 공지는 전교생 공통이라 전역으로 짧게 캐시한다.
    return jsonResponse(getNoticeCached_());
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
  if (action === 'settings') {
    // 2026-09: 색상 테마 등 "기기 상관없이 공통으로 적용돼야 하는" 설정값.
    // 그동안 admin.html이 이 action을 호출하고 있었지만 서버에 대응 핸들러가 없어서
    // (unknown action 응답 → 매번 기본색으로 되돌아감) PC에서 바꾼 테마색이 실제로는
    // 저장되지 않고, 모바일/다른 브라우저에도 반영되지 않았던 버그를 여기서 고친다.
    return jsonResponse(getSettings_());
  }
  if (action === 'tuition') {
    return jsonResponse(getTuitionForMonth(e.parameter.yearMonth));
  }
  if (action === 'tuitionStatusToday') {
    // 2026-09: 학생별 결제기준일(월정액)/회차(회차제)를 반영한 "오늘 기준" 수강료 상태.
    // 수강료 탭(이번 달) 및 대시보드 미납 카드가 이 값으로 완납/결제예정/미납 3단계를 표시한다.
    return jsonResponse(getTuitionStatusToday());
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
  if (action === 'setTuitionSettings') {
    // 학생별 결제 방식(월정액/회차)·결제기준일·결제회차수·회차기준일/기준회차를 "학생정보" 시트에 직접 기록한다.
    setTuitionSettings(body.name, body.billingType, body.dueDay, body.sessionCount, body.sessionBaselineDate, body.sessionBaselineCount);
    return jsonResponse({ status: 'ok' });
  }
  if (action === 'saveSettings') {
    // 2026-09: 색상 테마 저장 — PropertiesService(스크립트 속성)에 저장해 모든 기기/브라우저가
    // 같은 값을 읽도록 한다. POST는 no-cors라 클라이언트가 응답을 못 읽으므로 여기서 직접 반영한다.
    saveSettings_(body.settings);
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
  // 2026-09: 관리자 화면 탭을 왔다갔다할 때마다 매번 시트를 다시 읽던 것을, 짧은 서버 캐시로 줄인다
  // (명단은 관리자가 직접 수정할 때 말고는 안 바뀌는 데이터라 30초 정도는 캐시해도 안전하다).
  const cacheKey = 'admin_roster';
  const cached = reportCacheGet_(cacheKey);
  if (cached) return cached;
  const sheet = getSheet('명단');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1); // skip header
  const result = rows.map(r => ({
    day: r[0], block: normalizeBlock(r[1]), slot: r[2], name: r[3] || "",
    effectiveFrom: r[4] ? normalizeDate_(r[4]) : ""
  }));
  reportCacheSet_(cacheKey, result, 30);
  return result;
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
  adminCacheClear_(['admin_roster']); // 명단이 바뀌었으니 캐시된 값을 즉시 무효화
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
  // 2026-09: 수강료 탭을 열 때마다 시트 전체를 다시 훑던 것을 짧게(20초) 캐시 — 결제 처리 직후에는
  // saveTuition이 즉시 캐시를 지우므로 실제로 저장한 내용이 늦게 반영되는 일은 없다.
  const cacheKey = 'admin_tuition_' + yearMonth;
  const cached = reportCacheGet_(cacheKey);
  if (cached) return cached;
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
  reportCacheSet_(cacheKey, rows, 20);
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
      adminCacheClear_(['admin_tuition_' + rec.yearMonth, 'admin_tuitionStatusToday']);
      return;
    }
  }
  sheet.appendRow([rec.name, '', rec.amount || '', status, rec.paidDate || '', rec.memo || '']);
  const newRowNum = sheet.getLastRow();
  const ymCell = sheet.getRange(newRowNum, 2);
  ymCell.setNumberFormat('@');
  ymCell.setValue(rec.yearMonth);
  adminCacheClear_(['admin_tuition_' + rec.yearMonth, 'admin_tuitionStatusToday']);
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

// ---------- 회차제 수강료: 출결 기록 기반 자동 계산 (2026-09, 홍라임 학생 등 선불 회차제용) ----------

// studentName이 실제로 배정되어 있던 (요일,시간블록,슬롯)의 출석 기록만 골라 날짜 오름차순으로 반환한다.
// buildStudentRecords_와 같은 "적용시작일 기준 슬롯 이력 매칭" 원리를 그대로 사용 — 요일/시간이 바뀌어도
// 각 날짜 시점에 실제로 그 학생 것이었던 슬롯만 정확히 집계된다.
function getAttendedDatesForStudent_(studentName) {
  const rosterSheet = getSheet('명단');
  const rosterData = rosterSheet.getDataRange().getValues();
  const slotHistoryMap = {};
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
  function nameAt(day, block, slot, dateStr) {
    const key = day + '|' + block + '|' + String(slot);
    const candidates = slotHistoryMap[key];
    if (!candidates || !candidates.length) return '';
    let best = null;
    candidates.forEach(function (it) {
      if (!it.effectiveFrom) {
        if (!best || (!best.effectiveFrom && !best.name && it.name)) best = it;
        return;
      }
      if (it.effectiveFrom <= dateStr) {
        if (!best || !best.effectiveFrom || it.effectiveFrom > best.effectiveFrom) best = it;
      }
    });
    return best ? best.name : '';
  }
  const candidateSlots = [];
  Object.keys(slotHistoryMap).forEach(function (key) {
    const hasMe = slotHistoryMap[key].some(function (it) { return it.name.indexOf(studentName) !== -1; });
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
    return nameAt(day, block, slot, dateStr).indexOf(studentName) !== -1;
  }

  const recordSheet = getSheet('기록');
  const recordData = recordSheet.getDataRange().getValues();
  const dates = [];
  for (let i = 1; i < recordData.length; i++) {
    const row = recordData[i];
    const rDay = row[1];
    const rBlock = normalizeBlock(row[2]);
    const rSlot = row[3];
    const rDateStr = normalizeDate_(row[0]);
    if (isMyPeriod(rDay, rBlock, rSlot, rDateStr)) {
      dates.push({ date: rDateStr, status: row[4] });
    }
  }
  dates.sort(function (a, b) { return a.date.localeCompare(b.date); });
  return dates;
}

// studentName의 afterDateStr 이후 가장 가까운 "다음 수업일"을 명단(요일 배정)에서 찾는다 (최대 21일 탐색).
// 회차제 선불 기준 — "N회 수업이 끝난 뒤 ~ 다음(N+1번째) 수업 시작 전"이 결제 기한이므로, 그 다음 수업의
// 실제 날짜가 필요하다. 단순화를 위해 "그 날짜에 이름이 배정되어 있고 적용시작일 조건을 만족하는 슬롯이
// 있는가"만 확인한다(같은 슬롯이 그 사이 다른 학생으로 재배정된 극히 드문 경우까지는 다루지 않음).
function findNextClassDate_(studentName, afterDateStr) {
  const rosterSheet = getSheet('명단');
  const rosterData = rosterSheet.getDataRange().getValues();
  const dowNames = ['일', '월', '화', '수', '목', '금', '토'];
  const tz = Session.getScriptTimeZone();
  const start = new Date(afterDateStr + 'T00:00:00');
  for (let offset = 1; offset <= 21; offset++) {
    const d = new Date(start.getTime());
    d.setDate(d.getDate() + offset);
    const dateStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    const dow = dowNames[d.getDay()];
    for (let i = 1; i < rosterData.length; i++) {
      if (rosterData[i][0] !== dow) continue;
      const name = String(rosterData[i][3] || '');
      if (name.indexOf(studentName) === -1) continue;
      const effectiveFrom = rosterData[i][4] ? normalizeDate_(rosterData[i][4]) : '';
      if (effectiveFrom && effectiveFrom > dateStr) continue; // 이 날짜엔 아직 시작 전
      return dateStr;
    }
  }
  return null;
}

// 재원 중인 모든 학생의 "오늘" 기준 수강료 상태를 3단계(완납/결제예정/미납)로 계산한다.
// - 월정액 학생: 학생정보의 결제기준일(없으면 1일)을 넘겼는데 이번 달 완납 기록이 없으면 "미납",
//   아직 기준일 전이면 "결제예정(D-n)".
// - 회차제 학생(예: 홍라임, 8회): 마지막 완납 이후 출석(present/late) 횟수를 자동으로 세어, 아직
//   설정된 회차(N)에 못 미치면 "완납"(이번 주기 안에서 이미 커버됨)으로 본다. N회를 채우면 그 순간부터
//   "결제예정" — 선불제이므로 다음(N+1번째) 수업이 시작되기 전까지는 미납이 아니다. 그 다음 수업일이
//   지나도록 결제 기록이 없으면 그때 비로소 "미납"으로 바뀐다.
function getTuitionStatusToday() {
  // 2026-09: 학생마다 출결/명단까지 스캔하는 무거운 계산이라, 대시보드+수강료 탭이 동시에 부르더라도
  // 짧은 캐시(20초)로 중복 계산을 피한다. 결제 저장/설정 변경 시 saveTuition·setTuitionSettings·
  // setStudentStatus가 즉시 이 캐시를 지우므로 최신 상태가 늦게 반영되는 일은 없다.
  const cacheKey = 'admin_tuitionStatusToday';
  const cached = reportCacheGet_(cacheKey);
  if (cached) return cached;
  const students = getStudentInfoList().filter(function (s) { return s.status === '재원'; });
  const tz = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const currentYm = todayStr.substring(0, 7);

  const tuitionSheet = getTuitionSheet_();
  const tuitionData = tuitionSheet.getDataRange().getValues();
  const historyByName = {};
  for (let i = 1; i < tuitionData.length; i++) {
    const name = String(tuitionData[i][0] || '').trim();
    if (!name) continue;
    const ym = normalizeYearMonth_(tuitionData[i][1]);
    const status = (tuitionData[i][3] || '').trim() === '완납' ? '완납' : '미납';
    const paidDate = tuitionData[i][4] ? normalizeDate_(tuitionData[i][4]) : '';
    if (!historyByName[name]) historyByName[name] = [];
    historyByName[name].push({ yearMonth: ym, status: status, paidDate: paidDate });
  }

  const result = students.map(function (s) {
    const history = historyByName[s.name] || [];
    const currentRow = history.find(function (h) { return h.yearMonth === currentYm; });
    if (currentRow && currentRow.status === '완납') {
      return { name: s.name, status: 'paid', label: '완납' };
    }

    if (s.billingType === '회차') {
      const n = parseInt(s.sessionCount, 10) || 0;
      if (!n) {
        return { name: s.name, status: 'overdue', label: '미납 (회차 미설정)' };
      }
      const paidHistory = history.filter(function (h) { return h.status === '완납'; })
        .sort(function (a, b) { return b.yearMonth.localeCompare(a.yearMonth); });
      const lastPaidDateStr = paidHistory.length ? (paidHistory[0].paidDate || (paidHistory[0].yearMonth + '-01')) : '';
      const baselineDateStr = s.sessionBaselineDate || '';
      const baselineCount = parseInt(s.sessionBaselineCount, 10) || 0;

      // 기준점 결정: 회차기준일(수동 보정)보다 "나중" 시점에 실제 완납 기록이 있으면 그 결제로 회차가
      // 리셋된 것이므로 결제일을 기준으로 0회부터 다시 센다. 그렇지 않으면(완납 기록이 없거나, 완납 기록이
      // 더 예전이면) 관리자가 입력해둔 회차기준일 + 그 시점 진행 회차를 출발점으로 삼는다.
      // 이렇게 해야 "이 기능을 처음 켤 때 이미 회차 중간(예: 3회차)"인 경우에도 처음부터 다시 세는 오류가 없다.
      let sinceDateStr, baseCount;
      if (lastPaidDateStr && (!baselineDateStr || lastPaidDateStr > baselineDateStr)) {
        sinceDateStr = lastPaidDateStr;
        baseCount = 0;
      } else if (baselineDateStr) {
        sinceDateStr = baselineDateStr;
        baseCount = baselineCount;
      } else {
        // 완납 기록도, 회차기준일 설정도 없는 경우 — 정확한 계산이 불가능하므로 안전하게 0회부터 센다
        // (관리자가 회차 카드에서 회차기준일/기준 회차를 설정하는 것을 권장).
        sinceDateStr = todayStr;
        baseCount = 0;
      }
      const attended = getAttendedDatesForStudent_(s.name).filter(function (d) {
        return d.date > sinceDateStr && (d.status === 'present' || d.status === 'late');
      });
      const count = baseCount + attended.length;
      if (count < n) {
        return { name: s.name, status: 'paid', label: '완납' };
      }
      // attended 배열은 baseCount 이후부터 새로 센 출석만 담고 있으므로, "전체 n회째"에 해당하는
      // 인덱스는 baseCount를 뺀 자리다.
      const nthDate = attended[n - baseCount - 1].date;
      const nextClassDate = findNextClassDate_(s.name, nthDate);
      if (nextClassDate && todayStr < nextClassDate) {
        return { name: s.name, status: 'upcoming', label: '결제 예정 (' + count + '/' + n + '회, 다음 수업 전)', sessionCount: count, sessionTarget: n, nextClassDate: nextClassDate };
      }
      return { name: s.name, status: 'overdue', label: '미납 (' + count + '/' + n + '회 출석)', sessionCount: count, sessionTarget: n };
    }

    // 월정액
    const dueDay = parseInt(s.dueDay, 10) || 1;
    const todayDay = parseInt(todayStr.split('-')[2], 10);
    if (todayDay < dueDay) {
      return { name: s.name, status: 'upcoming', label: '결제 예정 (D-' + (dueDay - todayDay) + ')', dueDay: dueDay };
    }
    return { name: s.name, status: 'overdue', label: '미납', dueDay: dueDay };
  });
  reportCacheSet_(cacheKey, result, 20);
  return result;
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

// 2026-09: 리포트 링크 폐기(회수) 기능. 학부모에게 나간 링크가 유출되었거나 새로 발급해야 할 때,
// Apps Script 편집기에서 이 함수를 실행하면(파라미터를 학생 이름으로 바꿔서) 기존 report_id를
// 새 값으로 교체한다 — 이전 링크는 그 즉시(다음 요청부터) "student not found"로 동작해 못 쓰게 된다.
// 필요하면 이 함수를 admin.html에 버튼으로 연결해 원장님이 직접 누를 수 있게 확장할 수 있다.
function regenerateReportId(name) {
  if (!name) { Logger.log('학생 이름을 인자로 넣어서 실행해주세요. 예: regenerateReportId("홍길동")'); return; }
  const sheet = getSheet('학생정보');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      const newId = Utilities.getUuid().replace(/-/g, '').substring(0, 10);
      sheet.getRange(i + 1, 4).setValue(newId);
      // 이전 링크로 온 요청이 짧은 캐시에 남아있지 않도록, 관련 캐시는 새 요청 시 자연 만료(TTL)로 정리된다.
      Logger.log(name + '의 새 리포트 링크 ID: ' + newId);
      return newId;
    }
  }
  Logger.log('해당 이름의 학생을 찾지 못했습니다: ' + name);
  return null;
}

// "학생정보" 시트 열 구성 (1-based): 1 이름 / 2 학교 / 3 학년 / 4 report_id / 5 재원상태("퇴원"이면 퇴원, 그 외/빈칸은 재원중) /
// 6 교재이미지ID / 7 교재이미지명 / 8 교재메모(교재명·준비 기한 등 간단한 문구) /
// 9 링크만료일(선택, YYYY-MM-DD — 비어있으면 만료 없음. 지나면 해당 report_id 링크는 "만료됨"으로 처리) /
// 10 결제방식(선택, "회차"면 회차제 — 그 외/빈칸은 기존과 동일한 월정액) /
// 11 결제기준일(월정액 학생용 선택, 매월 며칠 — 숫자. 빈칸이면 기존처럼 1일 기준 하위 호환) /
// 12 결제회차수(회차제 학생용, 숫자 — 예: 8. 선불제 기준으로, 이 회차만큼 출석하면 다음 수업 전 결제가 필요하다고 판단) /
// 13 회차기준일(회차제 학생용, YYYY-MM-DD — 회차제를 처음 설정할 때 "이 날짜 시점에 몇 회차까지 다녔는지"를
//    수동으로 한 번 맞춰두기 위한 값. 완납 기록이 아직 하나도 없을 때/이미 회차 중간에 시작할 때를 위한 보정용) /
// 14 회차기준시점진행회차(회차제 학생용, 숫자 — 13번 날짜 시점까지 이미 다닌 횟수. 예: 오늘 기준 3회차 진행 중이면 3)
// 학생 관리 화면(admin.html)에서 퇴원 처리 토글/수강료 결제 방식 설정에 사용. 시트에 아직 해당 열이 없어도 안전하게 빈 값으로 처리된다.
function getStudentInfoList() {
  // 2026-09: 학생 관리/리포트/수강료 탭과 대시보드가 탭을 열 때마다 매번 새로 이 시트를 스캔하던 것을
  // 짧은 캐시(30초)로 줄인다. 학생정보는 관리자가 직접 수정할 때만 바뀌므로, 아래 각 수정 함수들이
  // 저장 직후 즉시 이 캐시를 지워서 "저장했는데 화면엔 예전 값이 보이는" 일이 없게 한다.
  const cacheKey = 'admin_studentInfoList';
  const cached = reportCacheGet_(cacheKey);
  if (cached) return cached;
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
      textbookMemo: data[i][7] || '',
      billingType: (data[i][9] || '').trim() === '회차' ? '회차' : '월정액',
      dueDay: data[i][10] || '',
      sessionCount: data[i][11] || '',
      sessionBaselineDate: data[i][12] ? normalizeDate_(data[i][12]) : '',
      sessionBaselineCount: data[i][13] || ''
    });
  }
  reportCacheSet_(cacheKey, rows, 30);
  return rows;
}

// 학생별 수강료 결제 방식(월정액/회차) · 결제기준일(월정액) · 결제회차수/회차기준일·기준회차(회차제)를 저장한다.
// billingType은 "회차"일 때만 회차제로 인정하고, 그 외 값은 전부 월정액(빈칸)으로 저장한다.
function setTuitionSettings(name, billingType, dueDay, sessionCount, sessionBaselineDate, sessionBaselineCount) {
  if (!name) return;
  const normalizedType = (billingType === '회차') ? '회차' : '';
  const sheet = getSheet('학생정보');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 10, 1, 5).setValues([[normalizedType, dueDay || '', sessionCount || '', sessionBaselineDate || '', sessionBaselineCount || '']]);
      adminCacheClear_(['admin_studentInfoList', 'admin_tuitionStatusToday']);
      return;
    }
  }
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
      adminCacheClear_(['admin_studentInfoList', 'admin_tuitionStatusToday']);
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
      adminCacheClear_(['admin_studentInfoList']);
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
      adminCacheClear_(['admin_studentInfoList']);
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
      adminCacheClear_(['admin_studentInfoList']);
      return;
    }
  }
}

// ---------- 학부모 리포트: 짧은 서버 캐시 헬퍼 (2026-09) ----------
// 개인정보라 브라우저 장기 캐시는 쓰지 않되, 같은 링크로 짧은 시간 내 반복 요청(탭 전환,
// 새로고침, 여러 기기)이 오면 시트를 다시 읽지 않도록 서버(Apps Script) 쪽에서만 잠깐 캐시한다.
function reportCacheGet_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function reportCacheSet_(key, obj, ttlSeconds) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(obj), ttlSeconds);
  } catch (e) { /* 캐시 저장 실패는 무시 — 매번 새로 읽는 것과 같아질 뿐 기능에는 지장 없음 */ }
}
// 2026-09: 관리자 화면(admin.html)용 짧은 캐시(30초 내외) 무효화 헬퍼. 학생정보/명단/수강료처럼
// 자주 조회되지만 관리자가 직접 수정할 때만 바뀌는 데이터에 캐시를 적용하면서, 수정 직후에는
// 즉시 최신값이 보이도록 관련 캐시 키를 지운다.
function adminCacheClear_(keys) {
  try { CacheService.getScriptCache().removeAll(keys); } catch (e) { /* 무시 — 최악의 경우 캐시 만료까지만 예전 값이 보임 */ }
}

// ---------- 공통 설정값(색상 테마 등) — PropertiesService 저장 (2026-09) ----------
// PC에서 테마색을 바꿔도 모바일/다른 브라우저에서는 안 바뀌던 문제의 원인은, admin.html이
// 부르는 settings/saveSettings 액션 자체가 서버(Code.gs)에 구현돼 있지 않았던 것 — 즉 값이
// 애초에 시트/저장소 어디에도 저장되지 않고 있었다. 딱 하나(색상 코드)만 저장하면 되므로
// 별도 시트 탭 대신 스크립트 속성(PropertiesService)을 쓴다 — 모든 기기·브라우저가 같은
// Apps Script 프로젝트를 보고 읽으므로, 여기 저장하면 자동으로 모든 기기에 공통 적용된다.
// 2026-09: 고정 프리셋 10개 대신, 그동안 실제로 저장했던 색을 최근 순으로 최대 10개까지
// 함께 보관한다 — 색상 테마 모달의 스와치 목록이 "내가 최근에 쓴 색"이 되도록.
const THEME_RECENT_MAX_ = 10;
function getSettings_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const themeColor = props.getProperty('themeColor');
    const recentRaw = props.getProperty('recentColors');
    let recentColors = [];
    try { recentColors = recentRaw ? JSON.parse(recentRaw) : []; } catch (e2) { recentColors = []; }
    // 아직 한 번도 저장된 적이 없으면(맨 처음 배포 직후) 목록이 완전히 비어 보이지 않도록
    // 현재 적용 중인 색(또는 기본색) 하나는 항상 넣어준다.
    if (!recentColors.length) recentColors = [themeColor || '#0C4642'];
    return { themeColor: themeColor || null, recentColors: recentColors };
  } catch (e) { return {}; }
}
function saveSettings_(settings) {
  if (!settings) return;
  try {
    const props = PropertiesService.getScriptProperties();
    if (settings.themeColor) {
      const hex = String(settings.themeColor).toUpperCase();
      props.setProperty('themeColor', hex);
      const recentRaw = props.getProperty('recentColors');
      let recentColors = [];
      try { recentColors = recentRaw ? JSON.parse(recentRaw) : []; } catch (e2) { recentColors = []; }
      // 이미 목록에 있던 같은 색은 지우고 맨 앞으로 다시 올린다(중복 방지 + 최신순 유지).
      recentColors = recentColors.filter(function (c) { return String(c).toUpperCase() !== hex; });
      recentColors.unshift(hex);
      if (recentColors.length > THEME_RECENT_MAX_) recentColors = recentColors.slice(0, THEME_RECENT_MAX_);
      props.setProperty('recentColors', JSON.stringify(recentColors));
    }
  } catch (e) { /* 저장 실패 시 다음 저장 시도 때까지 이전 값 유지 */ }
}

// ---------- 콜드스타트 완화용 "깨우기" 트리거 (2026-09) ----------
// Apps Script 웹앱은 한동안 아무도 안 쓰면 컨테이너가 잠들고, 다음 요청이 다시 깨우는 데
// 몇십 초~1분 넘게 걸릴 수 있다(실측: 첫 요청이 약 97초). 운영시간대에 10분마다 한 번씩
// 가벼운 함수를 스스로 실행시켜 컨테이너를 계속 "깨어있는" 상태로 유지해 이 지연을 줄인다.
// 트리거 자체는 하루 종일(24시간) 10분 간격으로 걸어두되, 실제로 시트를 건드리는 작업은
// 운영시간(매일 오전 9시~밤 10시) 안에서만 수행해 새벽 시간대엔 불필요한 실행을 피한다.
function keepWarm() {
  var hour = new Date().getHours();
  if (hour < 9 || hour >= 22) return; // 운영시간 외에는 아무 것도 하지 않고 바로 종료
  try {
    // 스프레드시트 연결을 살짝 건드려 컨테이너/권한 컨텍스트를 데워둔다.
    SpreadsheetApp.getActiveSpreadsheet().getName();
  } catch (e) { /* 깨우기 실패는 무시 — 10분 뒤 다음 주기에 다시 시도됨 */ }
}
// Apps Script 편집기 상단 함수 목록에서 installKeepWarmTrigger를 선택해 ▶ 실행 버튼을
// 딱 한 번만 눌러주면 아래 트리거가 등록된다. 이미 등록된 keepWarm 트리거가 있으면
// 먼저 지우고 새로 만들어 중복 등록을 막는다.
function installKeepWarmTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'keepWarm') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('keepWarm')
    .timeBased()
    .everyMinutes(10)
    .create();
}

// I열(링크만료일) 값을 'YYYY-MM-DD' 형식일 때만 날짜로 인정하고, 그 외(빈칸/다른 용도로 쓰인 텍스트 등)는
// 전부 "만료 없음"으로 처리한다. normalizeDate_는 날짜 형식이 아니면 원본 문자열을 그대로 돌려주는데,
// 그 값을 날짜 문자열과 그냥 비교(<)하면 I열에 다른 데이터가 들어있을 때 엉뚱하게 "만료됨"으로 오판될
// 수 있어(2026-09 실제 발생) 반드시 형식을 엄격히 검사한 뒤에만 만료 판단에 사용한다.
function parseExpiryDateStr_(raw) {
  if (!raw) return null;
  if (Object.prototype.toString.call(raw) === '[object Date]') {
    return Utilities.formatDate(raw, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// report_id로 "학생정보" 시트 행만 가볍게 조회 (명단/기록/숙제기록은 건드리지 않음).
// 시험·수강료 탭처럼 출결 이력이 필요 없는 지연 로딩 API에서 사용.
// I열(9번째, 링크만료일)에 'YYYY-MM-DD' 형식 값이 있고 오늘보다 과거면 만료된 링크로 처리한다.
function findStudentBasic_(reportId) {
  if (!reportId) return { error: 'missing id' };
  const infoSheet = getSheet('학생정보');
  const infoData = infoSheet.getDataRange().getValues();
  for (let i = 1; i < infoData.length; i++) {
    if (infoData[i][3] === reportId) {
      const status = (infoData[i][4] || '').trim() === '퇴원' ? '퇴원' : '재원';
      if (status === '퇴원') return { error: 'student inactive' };
      const expiresStr = parseExpiryDateStr_(infoData[i][8]);
      if (expiresStr) {
        const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (expiresStr < todayStr) return { error: 'link expired' };
      }
      const school = infoData[i][1];
      return {
        name: infoData[i][0], school: school, grade: infoData[i][2],
        isElementary: /초$/.test(String(school || '').trim())
      };
    }
  }
  return { error: 'student not found' };
}

// 특정 학교의 시험 일정 조회 (시험 탭에서 재사용)
function getExamForSchool_(school) {
  const examSheet = getSheet('시험일정');
  const examData = examSheet.getDataRange().getValues();
  for (let i = 1; i < examData.length; i++) {
    if (examData[i][0] === school) {
      return { school: examData[i][0], examStart: examData[i][1], examEnd: examData[i][2], mathExamDate: examData[i][3], memo: examData[i][4] };
    }
  }
  return null;
}

function hwScoreOf_(status) {
  if (status === '완료') return 1;
  if (status === '미흡') return 0.5;
  return 0; // 안함, 미확인
}

// 'YYYY-MM-DD' -> "9/9(화)"
function fmtKoDate_(dateStr) {
  const parts = String(dateStr || '').split('-');
  if (parts.length !== 3) return dateStr || '';
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10) + '(' + dow + ')';
}
function tuitionMonthLabel_(ym) {
  const parts = String(ym || '').split('-');
  if (parts.length !== 2) return ym || '';
  return parts[0] + '년 ' + parseInt(parts[1], 10) + '월';
}

function getNoticeCached_() {
  const cacheKey = 'reportNotice_global';
  const cached = reportCacheGet_(cacheKey);
  if (cached) return cached;
  const result = getNotice();
  reportCacheSet_(cacheKey, result, 180); // 공지는 전교생 공통 — 3분간 캐시
  return result;
}

// 시험 탭 전용 지연 로딩 API — 학교 D-day + 개인 테스트 기록만 반환 (출결 이력 스캔 없음)
function getStudentReportExam(reportId) {
  const cacheKey = 'reportExam_' + reportId;
  const cached = reportCacheGet_(cacheKey);
  if (cached) return cached;
  const basic = findStudentBasic_(reportId);
  if (basic.error) return basic;
  const exam = basic.isElementary ? null : getExamForSchool_(basic.school);
  const elemTests = getElemTestsForStudent(basic.name);
  const result = { exam: exam, elemTests: elemTests, isElementary: basic.isElementary };
  reportCacheSet_(cacheKey, result, 300); // 시험 일정은 자주 안 바뀜 — 5분간 캐시
  return result;
}

// 수강료 탭 전용 지연 로딩 API — 최근 6개월 납부 이력만 반환
function getStudentReportTuition(reportId) {
  const cacheKey = 'reportTuition_' + reportId;
  const cached = reportCacheGet_(cacheKey);
  if (cached) return cached;
  const basic = findStudentBasic_(reportId);
  if (basic.error) return basic;
  const result = { tuition: getTuitionHistoryForStudent_(basic.name, 6) };
  reportCacheSet_(cacheKey, result, 120); // 2분간 캐시
  return result;
}

// 학생 조회 + 출결/숙제 기록 병합 — getStudentReport(레거시)와 getStudentReportSummary(신규)가 공용으로 쓴다.
// (병합 키는 "날짜" 단위 — 하루에 시간블록이 여러 개라도 출결·숙제가 한 줄로 합쳐짐)
function buildStudentRecords_(reportId) {
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
      student._expiresRaw = infoData[i][8] || ''; // I열: 링크만료일 (선택, 'YYYY-MM-DD' 형식일 때만 인정)
      break;
    }
  }
  if (!student) return { error: 'student not found' };
  if (student.status === '퇴원') return { error: 'student inactive' };
  const expiresStr = parseExpiryDateStr_(student._expiresRaw);
  if (expiresStr) {
    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (expiresStr < todayStr) return { error: 'link expired' };
  }

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

  // 학교명이 "~초"(초등학교)로 끝나면 초등부로 판단 — 학년란은 "6학년"처럼 학교급 표기가 없어 학교명으로 구분
  const isElementary = /초$/.test(String(student.school || '').trim());

  return { student: student, records: records, isElementary: isElementary };
}

// report_id로 학생을 찾아 출결/숙제/보강/시험/공지/수강료 데이터를 모아서 반환
// 2026-09: report.html은 더 이상 이 함수를 쓰지 않고 getStudentReportSummary + 탭별 지연 로딩 API를
// 사용한다. 다른 곳에서 참조할 가능성을 대비해 기존 응답 형태 그대로 남겨둔다 (레거시, 전체 데이터 반환).
function getStudentReport(reportId) {
  const built = buildStudentRecords_(reportId);
  if (built.error) return built;
  const student = built.student, records = built.records, isElementary = built.isElementary;

  const exam = isElementary ? null : getExamForSchool_(student.school);
  const elemTests = getElemTestsForStudent(student.name);
  const notice = getNotice().notice;

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

  const tuition = getTuitionHistoryForStudent_(student.name, 6);

  return { student: student, records: records, exam: exam, notice: notice, isElementary: isElementary, elemTests: elemTests, textbook: textbook, tuition: tuition };
}

// 2026-09: report.html 첫 화면 전용 API — 이번 달 출석·숙제 집계, 최근 10건, 보강 대기 요약,
// "확인할 내용" 목록, 교재까지 한 번에 반환한다(시험/공지/수강료 상세는 각 탭에서 별도로 지연 로딩).
// buildStudentRecords_가 이미 이 학생의 전체 출결 이력을 한 번에 훑어서 만들어두므로, 보강 목록도
// 별도 API 없이 이 안에서 함께 계산해서 내려준다 (탭을 열 때 추가 요청이 필요 없음).
function getStudentReportSummary(reportId) {
  if (!reportId) return { error: 'missing id' };
  const cacheKey = 'reportSummary_' + reportId;
  const cached = reportCacheGet_(cacheKey);
  if (cached) return cached;

  const built = buildStudentRecords_(reportId);
  if (built.error) return built;

  const student = built.student;
  const records = built.records; // 최신순 정렬된 이 학생의 전체 출결·숙제 이력
  const tz = Session.getScriptTimeZone();
  const now = new Date();

  const thisMonthKey = Utilities.formatDate(now, tz, 'yyyy-MM');
  const monthRecords = records.filter(r => normalizeDate_(r.date).indexOf(thisMonthKey) === 0);
  const presentCnt = monthRecords.filter(r => r.status === 'present').length;
  const lateCnt = monthRecords.filter(r => r.status === 'late').length;
  const absentCnt = monthRecords.filter(r => r.status === 'absent').length;

  // 숙제 완료율 — 결석·미확인은 분모에서 제외, 완료=100%, 미흡=50%, 안함=0%
  const hwEligible = monthRecords.filter(r => r.status !== 'absent' && r.homeworkStatus !== '미확인');
  let homework = { rate: null, eligibleCount: 0, doneCount: 0 };
  if (hwEligible.length > 0) {
    const scoreSum = hwEligible.reduce((sum, r) => sum + hwScoreOf_(r.homeworkStatus), 0);
    homework = {
      rate: Math.round((scoreSum / hwEligible.length) * 100),
      eligibleCount: hwEligible.length,
      doneCount: hwEligible.filter(r => r.homeworkStatus === '완료').length
    };
  }

  const recentRecords = records.slice(0, 10);

  // 보강 대기/완료 (최근 5건) — 결석했다고 무조건 뜨지 않고, 학원에서 "보강 필요"로 표시한 건만
  const makeupItems = records.filter(r => r.makeupStatus === 'wait' || r.makeupStatus === 'done').slice(0, 5);

  // 이번 주(최근 7일) 숙제 미제출 — 결석일은 애초에 숙제 확인 자체가 없으므로 제외
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const weekAgoStr = Utilities.formatDate(new Date(now.getTime() - 6 * 86400000), tz, 'yyyy-MM-dd');
  const missingHwCount = records.filter(r => {
    const d = normalizeDate_(r.date);
    return d >= weekAgoStr && d <= todayStr && r.status !== 'absent' && r.homeworkStatus === '안함';
  }).length;

  // 이번 달 수강료 미납 여부 — 가벼운 조회 1회 (전체 6개월 이력은 수강료 탭에서 지연 로딩)
  const tuitionLatest = getTuitionHistoryForStudent_(student.name, 1)[0] || null;
  const tuitionUnpaid = !!(tuitionLatest && tuitionLatest.yearMonth === thisMonthKey && tuitionLatest.status !== '완납');

  // "이번 주, 확인할 내용" — 학부모의 확인·행동이 필요한 항목만. 없으면 클라이언트에서 긍정 메시지로 대체.
  const actionItems = [];
  makeupItems.filter(r => r.makeupStatus === 'wait').forEach(r => {
    const dateLabel = fmtKoDate_(normalizeDate_(r.date));
    const planLabel = r.makeupDate ? (fmtKoDate_(normalizeDate_(r.makeupDate)) + ' 예정') : '일정 조율 중';
    actionItems.push({ type: 'makeup', text: dateLabel + ' 결석 보강 — ' + planLabel });
  });
  if (missingHwCount > 0) {
    actionItems.push({ type: 'homework', text: '이번 주 숙제 미제출 ' + missingHwCount + '회 있어요' });
  }
  if (tuitionUnpaid) {
    actionItems.push({ type: 'tuition', text: tuitionMonthLabel_(thisMonthKey) + ' 수강료가 아직 미납이에요' });
  }

  // 준비 교재 — 학생정보 행에서 이미 확보한 값이라 별도 시트 조회가 필요 없음
  let textbook = null;
  if (student.textbookImageId || student.textbookMemo) {
    textbook = { name: student.textbookImageName, memo: student.textbookMemo || '' };
    if (student.textbookImageId) {
      textbook.thumbUrl = 'https://drive.google.com/thumbnail?id=' + student.textbookImageId + '&sz=w200';
      textbook.viewUrl = 'https://drive.google.com/file/d/' + student.textbookImageId + '/view';
    }
  }

  const result = {
    updatedAt: Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    student: { name: student.name, school: student.school, grade: student.grade, isElementary: built.isElementary },
    monthAttendance: { count: presentCnt + lateCnt, lateCount: lateCnt, absentCount: absentCnt, unit: '회' },
    homework: homework,
    recentRecords: recentRecords,
    makeupItems: makeupItems,
    textbook: textbook,
    actionItems: actionItems,
    // 탭에 새 항목 점(NEW dot)을 열지 않고도 보여주기 위한 "식별자만" 함께 내려준다 — 공지/시험/수강료
    // 본문·상세는 여전히 각 탭을 열 때만 지연 로딩하지만, 이 식별자들은 이미 캐시로 저렴하게 읽을 수 있는
    // 값들이라 첫 화면 API에 포함해도 부담이 거의 없다 (그래야 탭을 열어보지 않아도 "새 소식" 표시가 뜬다).
    latestIds: {
      notice: (getNoticeCached_().notice || {}).id || null,
      exam: (function(){
        const tests = getElemTestsForStudent(student.name); // 초등·중등 공통으로 쓰이는 개인 테스트 기록
        return tests.length ? String(tests[0].rowNum) : null;
      })(),
      makeup: makeupItems.length ? (makeupItems[0].date + '|' + makeupItems[0].makeupStatus) : null,
      textbook: textbook ? ((textbook.viewUrl || '') + '|' + (textbook.memo || '')) : null,
      tuition: tuitionLatest ? (tuitionLatest.yearMonth + '|' + tuitionLatest.status) : null
    }
  };

  reportCacheSet_(cacheKey, result, 120); // 2분간 캐시 — 반복 방문·탭 전환 시 시트 재조회 방지
  return result;
}