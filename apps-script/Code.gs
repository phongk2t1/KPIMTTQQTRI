/* ============================================================
 * KPI MTTQ – MÁY CHỦ GOOGLE APPS SCRIPT (dự án KPIMTTQQTRI)
 * Dữ liệu lưu trong bảng tính Google "KPIMTTQQTRI" (xem KPI_SHEET_ID).
 * Dự án gồm 3 tệp: Code.gs (tệp này), Core.gs (bản sao của assets/core.js), Seed.gs (tài khoản khởi đầu).
 *
 * Cách dùng:
 *   1. Chạy hàm setup() một lần để tạo các trang tính và tài khoản quản trị khởi đầu.
 *   2. Triển khai > Ứng dụng web > Thực thi: Tôi; Quyền truy cập: Bất kỳ ai.
 *   3. Dán đường dẫn /exec vào assets/config.js của trang GitHub.
 * ============================================================ */

// Mã của bảng tính "KPIMTTQQTRI" chứa dữ liệu (phần giữa /d/ và /edit trong địa chỉ bảng tính).
// Máy chủ chỉ xin quyền với Google Trang tính, không đụng tới các tệp khác trên Drive.
var KPI_SHEET_ID = '1lfjNlIKGNmCvWaSO1KR3_d64DR0rwzmdknFbSJ3Z1pI';

function getSpreadsheet_() {
  return SpreadsheetApp.openById(KPI_SHEET_ID);
}

/** Kho dữ liệu trên Google Sheet: mỗi bảng là một trang tính, dòng 1 là tiêu đề cột tiếng Việt (KPI_LABELS). */
function makeSheetStore_(ss) {
  var cache = {}, metas = {}, found = {};
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
    },
    insertMany: function (t, rows) { // thêm nhiều dòng trong một lần ghi
      if (!rows.length) return;
      var T = load(t);
      T.sh.getRange(T.rows.length + 2, 1, rows.length, T.head.length).setNumberFormat('@').setValues(rows.map(function (r) { return toRow(T, r); }));
      rows.forEach(function (row) {
        var o = {};
        T.head.forEach(function (h) { if (h) o[h] = row[h] === undefined ? '' : row[h]; });
        T.rows.push(o);
      });
    },
    updateMany: function (t, list) { // sửa nhiều dòng, gom các dòng liền nhau thành một lần ghi
      var T = load(t), nums = [];
      list.forEach(function (x) {
        var i = indexOf(T, x.id);
        if (i < 0) return;
        Object.keys(x.patch).forEach(function (k) { T.rows[i][k] = x.patch[k]; });
        if (nums.indexOf(i + 2) < 0) nums.push(i + 2);
      });
      nums.sort(function (a, b) { return a - b; });
      runs(nums).forEach(function (r) {
        var block = [];
        for (var k = 0; k < r[1]; k++) block.push(toRow(T, T.rows[r[0] - 2 + k]));
        T.sh.getRange(r[0], 1, r[1], T.head.length).setNumberFormat('@').setValues(block);
      });
    },
    /* Hai hàm dưới dùng cho bảng lớn (công việc, đánh giá): chỉ tìm và đọc/ghi đúng các dòng của một phiếu,
     * không nạp cả trang tính. */
    group: function (t, field, value) {
      var G = meta(t), nums = locate(G, t, field, value), out = [];
      runs(nums).forEach(function (r) {
        G.sh.getRange(r[0], 1, r[1], G.head.length).getValues().forEach(function (v) {
          var o = {};
          G.head.forEach(function (h, j) { if (h) o[h] = v[j]; });
          out.push(o);
        });
      });
      return out;
    },
    replaceGroup: function (t, field, value, rows) {
      var G = meta(t), old = locate(G, t, field, value), targets = [];
      for (var i = 0; i < rows.length; i++) targets.push(i < old.length ? old[i] : ++G.last); // ghi đè dòng cũ, thừa thì nối cuối
      var k = 0;
      runs(targets).forEach(function (r) {
        var block = rows.slice(k, k + r[1]).map(function (o) { return G.head.map(function (h) { return cell(o[h]); }); });
        G.sh.getRange(r[0], 1, r[1], G.head.length).setNumberFormat('@').setValues(block);
        k += r[1];
      });
      var extra = old.slice(rows.length); // phiếu ít việc hơn trước: xoá trắng các dòng thừa
      if (extra.length) G.sh.getRangeList(runs(extra).map(function (r) { return 'A' + r[0] + ':' + colName(G.head.length) + (r[0] + r[1] - 1); })).clearContent();
      found[t + '|' + field + '|' + value] = targets.slice().sort(function (a, b) { return a - b; });
    }
  };

  function meta(t) { // tiêu đề cột và dòng cuối của một trang tính, không đọc dữ liệu
    if (metas[t]) return metas[t];
    var sh = ss.getSheetByName(KPI_SHEETS[t]);
    if (!sh) throw new Error('Thiếu trang tính "' + KPI_SHEETS[t] + '". Hãy chạy hàm setup() hoặc migrateV2().');
    var byLabel = {};
    KPI_TABLES[t].forEach(function (f) { byLabel[KPI_LABELS[t][f]] = f; });
    var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { h = String(h).trim(); return byLabel[h] || h; });
    return (metas[t] = { sh: sh, head: head, last: Math.max(sh.getLastRow(), 1) });
  }
  function locate(G, t, field, value) { // số dòng (tăng dần) của các dòng có field = value
    var key = t + '|' + field + '|' + value;
    if (found[key]) return found[key];
    var col = G.head.indexOf(field) + 1, nums = [];
    if (col > 0 && G.last >= 2 && String(value) !== '') {
      G.sh.getRange(2, col, G.last - 1, 1).createTextFinder(String(value)).matchEntireCell(true).matchCase(true).findAll()
        .forEach(function (r) { nums.push(r.getRow()); });
      nums.sort(function (a, b) { return a - b; });
    }
    return (found[key] = nums);
  }
  function runs(nums) { // gom các số dòng liền nhau: [[dòng đầu, số dòng], ...]
    var out = [];
    nums.forEach(function (n) {
      var last = out[out.length - 1];
      if (last && last[0] + last[1] === n) last[1]++; else out.push([n, 1]);
    });
    return out;
  }
  function colName(n) { var s = ''; while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; }
}

function makeEnv_() {
  var props = PropertiesService.getScriptProperties();
  return {
    hash: function (s) {
      return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
        .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
    },
    uuid: function () { return Utilities.getUuid(); },
    defaultPass: function () { return typeof KPI_DEFAULT_PASS !== 'undefined' ? KPI_DEFAULT_PASS : null; },
    evidence: evidenceEnv_(),
    secret: function () {
      var s = props.getProperty('KPI_SECRET');
      if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('KPI_SECRET', s); }
      return s;
    }
  };
}

/* ---------- Minh chứng trên Google Drive ----------
 * Tệp nằm trong Drive của tài khoản triển khai: KPIQTRI / <CCCD> / <tên kỳ> / <mã minh chứng>_<tên tệp>.
 * Máy chủ chỉ có quyền với những tệp, thư mục do chính nó tạo (quyền drive.file), không đọc được tệp khác trên Drive.
 * Tệp không chia sẻ công khai; người được xem phiếu tải nội dung qua máy chủ. */
var KPI_DRIVE_ROOT = 'KPIQTRI';

function driveFolder_(name, parentId, fresh) {
  var props = PropertiesService.getScriptProperties(), key = 'DIR|' + (parentId || '') + '|' + name;
  var id = fresh ? null : props.getProperty(key);
  if (id) return id;
  var q = "name = '" + String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '" + (parentId || 'root') + "' in parents";
  var found = Drive.Files.list({ q: q, fields: 'files(id)', pageSize: 1 }).files || [];
  if (found.length) id = found[0].id;
  else {
    var res = { name: name, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) res.parents = [parentId];
    id = Drive.Files.create(res, null, { fields: 'id' }).id;
  }
  props.setProperty(key, id);
  return id;
}

function evidenceEnv_() {
  function dirOf(cccd, periodName, fresh) {
    var root = driveFolder_(KPI_DRIVE_ROOT, null, fresh), person = driveFolder_(String(cccd), root, fresh);
    return driveFolder_(String(periodName).replace(/[\\\/]/g, '-'), person, fresh);
  }
  return {
    save: function (cccd, periodName, fileName, mime, base64) {
      var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, fileName), f;
      try { f = Drive.Files.create({ name: fileName, parents: [dirOf(cccd, periodName, false)] }, blob, { fields: 'id,size' }); }
      catch (e) { f = Drive.Files.create({ name: fileName, parents: [dirOf(cccd, periodName, true)] }, blob, { fields: 'id,size' }); } // thư mục đã bị xoá tay: tạo lại
      return { fileId: f.id, size: Number(f.size) || blob.getBytes().length };
    },
    read: function (fileId) {
      var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media',
        { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) throw new Error('Không đọc được tệp minh chứng trên Drive (mã ' + r.getResponseCode() + ').');
      return { mime: r.getHeaders()['Content-Type'] || 'application/octet-stream', data: Utilities.base64Encode(r.getContent()) };
    },
    remove: function (fileId) { Drive.Files.update({ trashed: true }, fileId); }
  };
}

/** Chạy MỘT LẦN sau khi nâng cấp: cấp quyền Drive khi Google hỏi và tạo thư mục gốc KPIQTRI. */
function setupDrive() {
  var id = driveFolder_(KPI_DRIVE_ROOT, null, true);
  Logger.log('ĐÃ SẴN SÀNG. Thư mục minh chứng: https://drive.google.com/drive/folders/' + id);
}

/** Nạp kho công việc mẫu từ tệp KhoMau.gs (biến KPI_LIBRARY). Thay toàn bộ kho của từng người có trong tệp. */
function importLibrary() {
  var ss = getSpreadsheet_();
  ensureSheets_(ss);
  var core = KPI_createCore(makeSheetStore_(ss), makeEnv_());
  Logger.log(core.importLibrary(KPI_LIBRARY, true).join('\n'));
}

/** Nạp Danh mục sản phẩm thí điểm từ tệp DanhMuc.gs (biến KPI_CATALOG). Thay toàn bộ danh mục đang có. */
function importCatalog() {
  var ss = getSpreadsheet_();
  ensureSheets_(ss);
  var core = KPI_createCore(makeSheetStore_(ss), makeEnv_());
  Logger.log('ĐÃ NẠP ' + core.importCatalog(KPI_CATALOG) + ' mã sản phẩm vào trang DanhMucSanPham.');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, data: 'Máy chủ KPI MTTQ đang hoạt động.' });
}

/* Các thao tác chỉ đọc không cần xếp hàng chờ khoá: nhiều người đăng nhập, xem phiếu cùng lúc vẫn chạy song song.
 * Chỉ thao tác ghi mới lấy khoá để hai lượt ghi không chen nhau. */
var KPI_READ_ACTIONS = { login: 1, bootstrap: 1, overview: 1, stats: 1, getEvaluation: 1, tasksFrom: 1, adminList: 1,
  evidenceGet: 1, evidenceSources: 1, libraryFind: 1, adminLibraryList: 1, rating: 1, catalog: 1 };

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); }
  catch (x) { return json_({ ok: false, error: 'Yêu cầu không hợp lệ.' }); }
  var lock = null;
  if (!KPI_READ_ACTIONS[req.action]) {
    lock = LockService.getScriptLock();
    try { lock.waitLock(28000); }
    catch (x) { return json_({ ok: false, error: 'Máy chủ đang bận ghi dữ liệu, vui lòng bấm lại sau ít giây.' }); }
  }
  try {
    var ss = getSpreadsheet_(), env = makeEnv_();
    env.usage = usageEnv_(ss); // nhật ký sử dụng
    env.locked = !!lock;       // chỉ gộp nhật ký cũ khi đang giữ khoá ghi
    var core = KPI_createCore(makeSheetStore_(ss), env);
    return json_(core.handle(req));
  } catch (x) {
    return json_({ ok: false, error: 'Lỗi máy chủ: ' + x.message });
  } finally {
    if (lock) lock.releaseLock();
  }
}

/* ---------- Nhật ký sử dụng ----------
 * NhatKy: mỗi lượt đăng nhập, xem, thêm, sửa, xoá một dòng, chỉ ghi nối đuôi (appendRow) nên không làm chậm thao tác chính.
 * NhatKyTongHop: số lượt theo tháng – người – chức năng của những dòng đã quá hạn lưu chi tiết.
 * Hai trang tự tạo khi cần; không thuộc KPI_TABLES. */
function usageEnv_(ss) {
  var HEAD = { NhatKy: ['Thời gian', 'CCCD', 'Loại', 'Chức năng', 'Đối tượng', 'Kết quả (trống = thành công)'],
    NhatKyTongHop: ['Tháng', 'CCCD', 'Loại', 'Chức năng', 'Số lượt', 'Trong đó lỗi'] };
  var cache = CacheService.getScriptCache(), sheets = {};
  function sheet(name) {
    if (sheets[name]) return sheets[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, sh.getMaxRows(), HEAD[name].length).setNumberFormat('@');
      sh.getRange(1, 1, 1, HEAD[name].length).setValues([HEAD[name]]).setFontWeight('bold').setBackground('#dbeafe');
      sh.setFrozenRows(1);
    }
    return (sheets[name] = sh);
  }
  function txt(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss') : String(v).replace(/^'/, ''); }
  function read(name) {
    var sh = sheet(name), n = sh.getLastRow();
    return n < 2 ? [] : sh.getRange(2, 1, n - 1, HEAD[name].length).getValues().map(function (r) { return r.map(txt); });
  }
  return {
    add: function (row) { sheet('NhatKy').appendRow(row.map(function (v) { return "'" + String(v); }).map(function (v) { return v === "'" ? '' : v; })); },
    head: function () { var sh = sheet('NhatKy'), n = sh.getLastRow(); return { count: Math.max(n - 1, 0), first: n < 2 ? '' : txt(sh.getRange(2, 1).getValue()) }; },
    rows: function () { return read('NhatKy'); },
    drop: function (n) {
      var sh = sheet('NhatKy'), have = sh.getLastRow() - 1;
      if (n <= 0 || have <= 0) return;
      if (n >= have) sh.getRange(2, 1, have, HEAD.NhatKy.length).clearContent(); // không xoá được hết các dòng dưới dòng tiêu đề cố định
      else sh.deleteRows(2, n);
    },
    sums: function () { return read('NhatKyTongHop'); },
    setSums: function (rows) {
      var sh = sheet('NhatKyTongHop'), n = sh.getLastRow(), w = HEAD.NhatKyTongHop.length;
      if (n > 1) sh.getRange(2, 1, n - 1, w).clearContent();
      if (rows.length) sh.getRange(2, 1, rows.length, w).setNumberFormat('@').setValues(rows);
    },
    once: function (key, seconds) { // true nếu trong 'seconds' giây vừa qua chưa gặp khoá này
      var k = 'kpi:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key, Utilities.Charset.UTF_8));
      if (cache.get(k)) return false;
      cache.put(k, '1', Math.min(Math.max(seconds, 1), 21600));
      return true;
    }
  };
}

/** Tạo các trang tính còn thiếu, kèm dòng tiêu đề tiếng Việt. */
function ensureSheets_(ss) {
  Object.keys(KPI_TABLES).forEach(function (t) {
    var sh = ss.getSheetByName(KPI_SHEETS[t]) || ss.insertSheet(KPI_SHEETS[t]);
    var head = KPI_TABLES[t].map(function (f) { return KPI_LABELS[t][f]; });
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#dbeafe').setWrap(true);
      sh.setFrozenRows(1);
    } else { // trang đã có: thêm vào cuối dòng tiêu đề những cột mới của bản nâng cấp
      var lastCol = sh.getLastColumn();
      var have = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
      var missing = head.filter(function (h) { return have.indexOf(h) < 0; });
      if (missing.length) {
        if (lastCol + missing.length > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), lastCol + missing.length - sh.getMaxColumns());
        sh.getRange(1, lastCol + 1, sh.getMaxRows(), missing.length).setNumberFormat('@');
        sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#dbeafe').setWrap(true);
        Logger.log('Trang ' + KPI_SHEETS[t] + ': thêm cột ' + missing.join(', '));
      }
    }
  });
  ['Sheet1', 'Trang tính1', 'Trang tính 1'].forEach(function (name) {
    var first = ss.getSheetByName(name);
    if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  });
}

/** Chạy MỘT LẦN: tạo các trang tính và tài khoản quản trị khởi đầu (lấy từ Seed.gs nếu có). */
function setup() {
  var ss = getSpreadsheet_();
  ensureSheets_(ss);

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

/** Chạy MỘT LẦN (nếu có tệp DuLieuMau.gs): nạp phiếu mẫu vào bảng tính. Chạy lại sẽ ghi đè các phiếu đó. */
function importSample() {
  if (typeof KPI_SAMPLE_EVALS === 'undefined') throw new Error('Chưa có tệp DuLieuMau.gs trong dự án.');
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var core = KPI_createCore(makeSheetStore_(getSpreadsheet_()), makeEnv_());
    core.importEvals(KPI_SAMPLE_EVALS.userId, KPI_SAMPLE_EVALS.months).forEach(function (line) { Logger.log(line); });
    Logger.log('ĐÃ NẠP XONG.');
  } finally { lock.releaseLock(); }
}

/** Chạy MỘT LẦN khi nâng cấp từ bản cũ (mỗi phiếu một dòng, công việc dạng JSON trong trang "PhieuDanhGia").
 * Trang cũ được đổi tên thành "PhieuDanhGia_cu" và giữ lại làm bản sao lưu; dữ liệu được tách sang 3 trang mới:
 * TongHopPhieu (mỗi phiếu một dòng), PhieuDanhGia (cán bộ tự chấm, mỗi việc một dòng), DanhGia (người phụ trách chấm). */
function migrateV2() {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var ss = getSpreadsheet_(), old = ss.getSheetByName('PhieuDanhGia_cu');
    if (!old) {
      var cur = ss.getSheetByName('PhieuDanhGia');
      var isOld = cur && String(cur.getRange(1, 1).getValue()).trim() === 'Mã phiếu';
      if (isOld) { cur.setName('PhieuDanhGia_cu'); old = cur; }
    }
    ensureSheets_(ss);
    if (!old) { Logger.log('Không có dữ liệu kiểu cũ để chuyển. Đã bảo đảm đủ các trang tính mới.'); return; }
    var map = { 'Mã phiếu': 'id', 'Mã kỳ': 'periodId', 'CCCD': 'userId', 'Trạng thái': 'status', 'Số công việc': 'taskCount', 'Điểm tự chấm': 'selfTotal',
      'Điểm người phụ trách chấm': 'mgrTotal', 'Điểm được công nhận': 'finalTotal', 'Xếp loại': 'rating', 'Tự nhận xét': 'selfComment',
      'Nhận xét của người phụ trách': 'mgrComment', 'Lúc nộp': 'submittedAt', 'Lúc đánh giá': 'reviewedAt', 'CCCD người đánh giá': 'reviewerId', 'Cập nhật': 'updatedAt' };
    var v = old.getDataRange().getValues(), head = v[0].map(function (h) { return String(h).trim(); });
    var core = KPI_createCore(makeSheetStore_(ss), makeEnv_()), n = 0;
    v.slice(1).forEach(function (r) {
      var header = {}, json = '';
      head.forEach(function (h, j) {
        if (map[h]) header[map[h]] = r[j];
        else if (/^Công việc \(/.test(h)) json += String(r[j]);
      });
      if (String(header.id) === '') return;
      var tasks = [];
      try { tasks = JSON.parse(json || '[]'); } catch (e) { Logger.log('Không đọc được công việc của phiếu ' + header.id); }
      Logger.log(core.migrateEval(header, tasks));
      n++;
    });
    Logger.log('ĐÃ CHUYỂN XONG ' + n + ' phiếu. Trang cũ giữ lại với tên PhieuDanhGia_cu.');
  } finally { lock.releaseLock(); }
}

/** Đặt lại mật khẩu mặc định (KPI_DEFAULT_PASS trong Seed.gs) cho mọi tài khoản KHÔNG có quyền quản trị.
 * Mỗi người phải đổi mật khẩu khi đăng nhập lần đầu. Đồng thời điền các cột hệ thống còn trống cho dòng nhập tay. */
function resetAllPasswords() {
  var lock = LockService.getScriptLock();
  lock.waitLock(28000);
  try {
    var core = KPI_createCore(makeSheetStore_(getSpreadsheet_()), makeEnv_());
    var n = core.resetAllPasswords();
    Logger.log('ĐÃ ĐẶT LẠI mật khẩu mặc định cho ' + n.reset + ' tài khoản; giữ nguyên ' + n.admin + ' tài khoản quản trị; bổ sung cột hệ thống cho ' + n.fixed + ' dòng.');
  } finally { lock.releaseLock(); }
}

/** Chạy sau mỗi lần nâng cấp có thêm cột: bổ sung các cột mới vào dòng tiêu đề của những trang tính đã có. Không đụng tới dữ liệu. */
function upgradeSheets() {
  ensureSheets_(getSpreadsheet_());
  Logger.log('ĐÃ KIỂM TRA XONG các trang tính.');
}
