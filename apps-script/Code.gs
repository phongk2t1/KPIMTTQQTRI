/* ============================================================
 * KPI MTTQ – MÁY CHỦ GOOGLE APPS SCRIPT (dự án KPIMTTQQTRI)
 * Dữ liệu lưu trong bảng tính Google "KPIMTTQQTRI".
 * Dự án gồm 3 tệp: Code.gs (tệp này), Core.gs (bản sao của assets/core.js), Seed.gs (tài khoản khởi đầu).
 *
 * Cách dùng:
 *   1. Chạy hàm setup() một lần để tạo các trang tính và tài khoản quản trị khởi đầu.
 *   2. Triển khai > Ứng dụng web > Thực thi: Tôi; Quyền truy cập: Bất kỳ ai.
 *   3. Dán đường dẫn /exec vào assets/config.js của trang GitHub.
 * ============================================================ */

var KPI_DB_NAME = 'KPIMTTQQTRI';         // tên bảng tính chứa dữ liệu
var KPI_UPLOAD_FOLDER = 'KPI_MinhChung'; // thư mục Drive chứa tệp minh chứng

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('KPI_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet(); // khi dự án gắn liền với bảng tính
  if (!ss) {
    var files = DriveApp.getFilesByName(KPI_DB_NAME);
    while (files.hasNext() && !ss) {
      var f = files.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS && !f.isTrashed()) ss = SpreadsheetApp.openById(f.getId());
    }
  }
  if (!ss) ss = SpreadsheetApp.create(KPI_DB_NAME);
  props.setProperty('KPI_SHEET_ID', ss.getId());
  return ss;
}

/** Kho dữ liệu trên Google Sheet: mỗi bảng là một trang tính, dòng 1 là tiêu đề cột tiếng Việt (KPI_LABELS). */
function makeSheetStore_(ss) {
  var cache = {};
  function load(t) {
    if (cache[t]) return cache[t];
    var sh = ss.getSheetByName(KPI_SHEETS[t]);
    if (!sh) throw new Error('Thiếu trang tính "' + KPI_SHEETS[t] + '". Hãy chạy hàm setup().');
    var byLabel = {};
    KPI_TABLES[t].forEach(function (f) { byLabel[KPI_LABELS[t][f]] = f; });
    var v = sh.getDataRange().getValues();
    var head = v[0].map(function (h) { h = String(h).trim(); return byLabel[h] || h; });
    var rows = v.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, j) { if (h) o[h] = r[j]; });
      return o;
    });
    return (cache[t] = { sh: sh, head: head, rows: rows });
  }
  function cell(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' && /^[=+\-@']/.test(v)) return "'" + v; // chặn công thức chèn vào ô
    return v;
  }
  function toRow(T, o) { return T.head.map(function (h) { return cell(o[h]); }); }
  function indexOf(T, id) {
    for (var i = 0; i < T.rows.length; i++) if (String(T.rows[i].id) === String(id)) return i;
    return -1;
  }
  return {
    all: function (t) { return load(t).rows.filter(function (r) { return String(r.id) !== ''; }); },
    insert: function (t, row) {
      var T = load(t);
      T.sh.getRange(T.rows.length + 2, 1, 1, T.head.length).setNumberFormat('@').setValues([toRow(T, row)]);
      var o = {};
      T.head.forEach(function (h) { if (h) o[h] = row[h] === undefined ? '' : row[h]; });
      T.rows.push(o);
    },
    update: function (t, id, patch) {
      var T = load(t), i = indexOf(T, id);
      if (i < 0) throw new Error('Không tìm thấy bản ghi ' + id + ' trong ' + t);
      Object.keys(patch).forEach(function (k) { T.rows[i][k] = patch[k]; });
      T.sh.getRange(i + 2, 1, 1, T.head.length).setNumberFormat('@').setValues([toRow(T, T.rows[i])]);
    },
    remove: function (t, id) {
      var T = load(t), i = indexOf(T, id);
      if (i < 0) return;
      T.sh.deleteRow(i + 2);
      T.rows.splice(i, 1);
    }
  };
}

function makeEnv_() {
  var props = PropertiesService.getScriptProperties();
  return {
    hash: function (s) {
      return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
        .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
    },
    uuid: function () { return Utilities.getUuid(); },
    secret: function () {
      var s = props.getProperty('KPI_SECRET');
      if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('KPI_SECRET', s); }
      return s;
    },
    uploadFile: function (name, mime, base64) {
      var it = DriveApp.getFoldersByName(KPI_UPLOAD_FOLDER);
      var folder = it.hasNext() ? it.next() : DriveApp.createFolder(KPI_UPLOAD_FOLDER);
      var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime || 'application/octet-stream', name));
      // Người duyệt cần mở được tệp: chia sẻ dạng "ai có đường liên kết đều xem được".
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return { url: file.getUrl(), label: name };
    }
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, data: 'Máy chủ KPI MTTQ đang hoạt động.' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (x) {
    return json_({ ok: false, error: 'Máy chủ đang bận, vui lòng thử lại sau ít giây.' });
  }
  try {
    var req = JSON.parse(e.postData.contents);
    var core = KPI_createCore(makeSheetStore_(getSpreadsheet_()), makeEnv_());
    return json_(core.handle(req));
  } catch (x) {
    return json_({ ok: false, error: 'Lỗi máy chủ: ' + x.message });
  } finally {
    lock.releaseLock();
  }
}

/** Chạy MỘT LẦN: tạo các trang tính và tài khoản quản trị khởi đầu (lấy từ Seed.gs nếu có). */
function setup() {
  var ss = getSpreadsheet_();
  Object.keys(KPI_TABLES).forEach(function (t) {
    var sh = ss.getSheetByName(KPI_SHEETS[t]) || ss.insertSheet(KPI_SHEETS[t]);
    var head = KPI_TABLES[t].map(function (f) { return KPI_LABELS[t][f]; });
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#fde8e8');
      sh.setFrozenRows(1);
    }
  });
  ['Sheet1', 'Trang tính1', 'Trang tính 1'].forEach(function (name) {
    var first = ss.getSheetByName(name);
    if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  });

  var core = KPI_createCore(makeSheetStore_(ss), makeEnv_());
  var out = core.seed({ admin: typeof KPI_SEED_ADMIN !== 'undefined' ? KPI_SEED_ADMIN : null });
  Logger.log('Bảng dữ liệu: ' + ss.getUrl());
  if (!out.adminId) Logger.log('Hệ thống đã có dữ liệu, không khởi tạo lại.');
  else if (out.adminPassword) Logger.log('Tài khoản quản trị: ' + out.adminId + ' – mật khẩu tạm (đổi ngay lần đầu): ' + out.adminPassword);
  else Logger.log('ĐÃ KHỞI TẠO. Tài khoản quản trị khởi đầu: ' + out.adminId + ' (mật khẩu như đã thống nhất, nên đổi sau khi đăng nhập).');
}

/** Dùng khi quên mật khẩu quản trị: chạy hàm này rồi xem mật khẩu tạm trong Nhật ký thực thi. */
function resetAdminPassword() {
  var store = makeSheetStore_(getSpreadsheet_());
  var env = makeEnv_();
  var admin = store.all('Users').filter(function (u) { return String(u.isAdmin) === '1'; })[0];
  if (!admin) throw new Error('Không tìm thấy tài khoản quản trị. Hãy chạy setup().');
  var pass = 'Kpi' + Utilities.getUuid().replace(/-/g, '').slice(0, 7) + '9';
  var salt = Utilities.getUuid();
  store.update('Users', admin.id, { salt: salt, passHash: env.hash(salt + '|' + pass), mustChange: 1, active: 1 });
  Logger.log('Tài khoản: ' + admin.id + ' – mật khẩu tạm: ' + pass);
}
