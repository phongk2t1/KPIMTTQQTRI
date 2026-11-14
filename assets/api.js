/* Lớp gọi máy chủ Apps Script.
 * Riêng khi mở trên máy (localhost) mà chưa khai API_URL, lõi nghiệp vụ chạy ngay trong trình duyệt
 * với dữ liệu mẫu để lập trình viên chạy thử; trên trang thật luôn gọi máy chủ. */
window.KPI_API = (function () {
  var CFG = window.KPI_CONFIG || {};
  var LOCAL = (!CFG.API_URL || /[?&]thu=1/.test(location.search)) && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var DB_KEY = 'kpi_local_db_v7';
  var TEST = { id: '000000000000', password: 'thu12345' }; // tài khoản thử, chỉ tồn tại trong trình duyệt khi chạy trên máy
  var core = null;

  function localCore() {
    if (core) return core;
    var db;
    try { db = JSON.parse(localStorage.getItem(DB_KEY) || 'null'); } catch (e) { db = null; }
    var fresh = !db;
    if (fresh) db = {};
    Object.keys(KPI_TABLES).forEach(function (t) { if (!db[t]) db[t] = []; });
    function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* bỏ qua */ } }
    var store = {
      all: function (t) { return db[t]; },
      insert: function (t, row) { db[t].push(Object.assign({}, row)); save(); },
      update: function (t, id, patch) {
        var r = db[t].filter(function (x) { return String(x.id) === String(id); })[0];
        if (r) { Object.assign(r, patch); save(); }
      },
      remove: function (t, id) { db[t] = db[t].filter(function (x) { return String(x.id) !== String(id); }); save(); },
      insertMany: function (t, rows) { rows.forEach(function (r) { db[t].push(Object.assign({}, r)); }); save(); },
      updateMany: function (t, list) {
        list.forEach(function (x) { var r = db[t].filter(function (y) { return String(y.id) === String(x.id); })[0]; if (r) Object.assign(r, x.patch); });
        save();
      },
      group: function (t, field, value) { return db[t].filter(function (x) { return String(x[field]) === String(value); }); },
      replaceGroup: function (t, field, value, rows) {
        db[t] = db[t].filter(function (x) { return String(x[field]) !== String(value); }).concat(rows.map(function (r) { return Object.assign({}, r); }));
        save();
      }
    };
    var env = {
      hash: function (s) { // băm đơn giản, chỉ dùng khi chạy thử trên máy
        var h1 = 0x811c9dc5, h2 = 0x1b873593;
        for (var i = 0; i < s.length; i++) {
          var c = s.charCodeAt(i);
          h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
        }
        return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
      },
      uuid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); },
      secret: function () { return 'local'; }
    };
    core = KPI_createCore(store, env);
    if (fresh) core.seed({ admin: TEST, sample: true });
    return core;
  }

  async function call(action, data) {
    var req = { action: action, data: data || {}, token: localStorage.getItem('kpi_token') || '' };
    var res;
    if (LOCAL) {
      res = JSON.parse(JSON.stringify(localCore().handle(req)));
    } else {
      if (!CFG.API_URL) throw new Error('Trang chưa được nối với máy chủ. Quản trị viên cần khai API_URL trong assets/config.js.');
      try {
        var r = await fetch(CFG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // tránh bước kiểm tra CORS của trình duyệt
          body: JSON.stringify(req)
        });
        res = await r.json();
      } catch (e) {
        throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
      }
    }
    if (!res.ok) { var e = new Error(res.error || 'Có lỗi xảy ra.'); e.code = res.code; throw e; }
    return res.data;
  }

  return {
    local: LOCAL,
    testAccount: LOCAL ? TEST : null,
    call: call,
    resetLocal: function () { localStorage.removeItem(DB_KEY); localStorage.removeItem('kpi_token'); core = null; }
  };
})();
