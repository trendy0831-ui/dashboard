// 이끌림수학학원 출결/숙제 체크 - Apps Script 백엔드
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
  return jsonResponse({ error: 'unknown action' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// ---------- 명단 ----------
function getRoster() {
  const sheet = getSheet('명단');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1); // skip header
  return rows.map(r => ({
    day: r[0], block: r[1], slot: r[2], name: r[3] || ""
  }));
}

function saveRoster(rosterRows) {
  const sheet = getSheet('명단');
  const data = sheet.getDataRange().getValues();
  // build lookup of row index by day|block|slot
  const lookup = {};
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0] + '|' + data[i][1] + '|' + data[i][2];
    lookup[key] = i + 1; // 1-indexed sheet row
  }
  rosterRows.forEach(item => {
    const key = item.day + '|' + item.block + '|' + item.slot;
    const rowNum = lookup[key];
    if (rowNum) {
      sheet.getRange(rowNum, 4).setValue(item.name); // D열
    }
  });
}

// ---------- 기록 ----------
function getRecordsForWeek(weekStart) {
  const sheet = getSheet('기록');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const tz = Session.getScriptTimeZone();

  const byKey = {}; // 같은 날짜|블록|슬롯 중복 시 마지막(가장 아래) 행이 최종 반영됨
  rows.forEach(r => {
    if (!r[0]) return;
    const d = new Date(r[0]);
    if (d >= start && d <= end) {
      const dateStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
      const key = dateStr + '|' + String(r[2]).trim() + '|' + String(parseInt(r[3], 10));
      byKey[key] = {
        date: dateStr,
        day: r[1], block: r[2], slot: r[3],
        status: r[4], hw: r[5], hwNote: r[6], attitude: r[7],
        statusNote: r[8] || "", attNote: r[9] || ""
      };
    }
  });
  return Object.values(byKey);
}

// 기록 저장: 같은 날짜+시간블록+슬롯이 이미 있으면 업데이트, 없으면 새로 추가
function saveRecord(rec) {
  const sheet = getSheet('기록');
  const data = sheet.getDataRange().getValues();
  const targetDate = rec.date;
  const tz = Session.getScriptTimeZone();

  for (let i = 1; i < data.length; i++) {
    const cellVal = data[i][0];
    if (!cellVal) continue;
    const rowDate = Utilities.formatDate(new Date(cellVal), tz, 'yyyy-MM-dd');
    const rowBlock = String(data[i][2]).trim();
    const rowSlot = String(parseInt(data[i][3], 10));
    const targetSlot = String(parseInt(rec.slot, 10));
    if (rowDate === targetDate && rowBlock === String(rec.block).trim() && rowSlot === targetSlot) {
      // update existing row
      sheet.getRange(i + 1, 1, 1, 10).setValues([[
        rec.date, rec.day, rec.block, rec.slot, rec.status, rec.hw, rec.hwNote, rec.attitude,
        rec.statusNote || "", rec.attNote || ""
      ]]);
      return;
    }
  }
  // not found, append new row
  sheet.appendRow([rec.date, rec.day, rec.block, rec.slot, rec.status, rec.hw, rec.hwNote, rec.attitude,
    rec.statusNote || "", rec.attNote || ""]);
}

// ---------- 숙제기록 ----------
// 컬럼: 날짜, 요일, 시간블록, 학생이름, 숙제완료여부, 숙제메모
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
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const tz = Session.getScriptTimeZone();

  const byKey = {}; // 같은 날짜|블록|학생이름 중복 시 마지막(가장 아래) 행이 최종 반영됨
  rows.forEach(r => {
    if (!r[0]) return;
    const d = new Date(r[0]);
    if (d >= start && d <= end) {
      const dateStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
      const key = dateStr + '|' + String(r[2]).trim() + '|' + String(r[3]).trim();
      byKey[key] = {
        date: dateStr,
        day: r[1], block: r[2], name: r[3],
        completed: r[4], memo: r[5] || ""
      };
    }
  });
  return Object.values(byKey);
}

// 숙제기록 저장: 같은 날짜+시간블록+학생이름이 이미 있으면 업데이트, 없으면 새로 추가
function saveHomeworkRecord(date, dayOfWeek, slot, studentName, completed, memo) {
  const sheet = getHomeworkSheet();
  const data = sheet.getDataRange().getValues();
  const targetDate = date;
  const targetBlock = String(slot).trim();
  const targetName = String(studentName).trim();
  const tz = Session.getScriptTimeZone();

  for (let i = 1; i < data.length; i++) {
    const cellVal = data[i][0];
    if (!cellVal) continue;
    const rowDate = Utilities.formatDate(new Date(cellVal), tz, 'yyyy-MM-dd');
    const rowBlock = String(data[i][2]).trim();
    const rowName = String(data[i][3]).trim();
    if (rowDate === targetDate && rowBlock === targetBlock && rowName === targetName) {
      // update existing row
      sheet.getRange(i + 1, 1, 1, 6).setValues([[
        date, dayOfWeek, slot, studentName, completed, memo || ""
      ]]);
      return;
    }
  }
  // not found, append new row
  sheet.appendRow([date, dayOfWeek, slot, studentName, completed, memo || ""]);
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
      const locdate = String(item.locdate); // YYYYMMDD
      const dateStr = locdate.slice(0,4) + '-' + locdate.slice(4,6) + '-' + locdate.slice(6,8);
      result[dateStr] = item.dateName;
    });
  } catch (e) {
    // API 실패 시 빈 객체 반환 (앱은 정상 동작, 공휴일 표시만 안 됨)
  }
  return result;
}

// 캐시 초기화용 (수동 실행) - 공휴일 캐시가 잘못 저장됐을 때 사용
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
