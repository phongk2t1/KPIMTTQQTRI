/* Giao diện phần mềm KPI CÁN BỘ CÔNG CHỨC */
(function () {
  'use strict';
  var API = window.KPI_API, CFG = window.KPI_CONFIG || {};
  var app = document.getElementById('app'), modal = document.getElementById('modal');
  var S = { user: null, hasReports: false, units: [], periods: [], config: {}, canUpload: false, periodId: '', ov: null, ovKey: '', st: null, cat: null };
  var E = null;   // phiếu đang mở
  var ADMIN = null; // dữ liệu trang quản trị

  var LEVEL = {};
  Object.keys(KPI_LEVELS).forEach(function (k) { LEVEL[k] = KPI_LEVELS[k].name; });
  var STATUS = {
    khong_ke: ['Không tự kê', 'b-gray'], chua_lap: ['Chưa lập', 'b-gray'], nhap: ['Đang soạn', 'b-gray'], cho_duyet: ['Chờ đánh giá', 'b-blue'],
    yeu_cau_sua: ['Yêu cầu sửa', 'b-amber'], da_chot: ['Đã đánh giá', 'b-green']
  };
  var TYPE = { thang: 'Tháng', quy: 'Quý', nam: 'Năm' };
  var APP_TITLE = 'KPI CÁN BỘ CÔNG CHỨC', APP_SUB = 'Phần mềm đánh giá KPI dành cho cán bộ công chức';
  var LOGO = '<svg class="logo" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>' +
    '<rect width="48" height="48" rx="13" fill="url(#lg)"/><g stroke="#fff" stroke-opacity=".55" stroke-width="1.6"><path d="M12 33 21 22 M21 22 30 27 M30 27 37 14"/></g>' +
    '<circle cx="12" cy="33" r="3" fill="#fff"/><circle cx="21" cy="22" r="3" fill="#fff"/><circle cx="30" cy="27" r="3" fill="#fff"/>' +
    '<path fill="#fff" d="M37 7l1.7 4.3L43 13l-4.3 1.7L37 19l-1.7-4.3L31 13l4.3-1.7z"/></svg>';

  /* ---------- Tiện ích ---------- */
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function has(v) { return v !== undefined && v !== null && v !== ''; }
  function fmt(n) { return has(n) ? Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '–'; }
  function fdate(s) { if (!s) return ''; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function ftime(s) { try { return new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return s; } }
  function badge(st) { var b = STATUS[st] || [st, 'b-gray']; return '<span class="badge ' + b[1] + '">' + h(b[0]) + '</span>'; }
  function unitName(id) { var u = S.units.filter(function (x) { return x.id === id; })[0]; return u ? u.name : ''; }
  function period() { return S.periods.filter(function (p) { return p.id === S.periodId; })[0] || null; }
  function toast(msg, bad) {
    var d = document.createElement('div');
    if (bad) d.className = 'bad';
    d.textContent = msg;
    document.getElementById('toast').appendChild(d);
    setTimeout(function () { d.remove(); }, bad ? 6000 : 3000);
  }
  async function api(action, data) {
    try { return await API.call(action, data); }
    catch (e) {
      if (e.code === 'AUTH') { logout(); }
      throw e;
    }
  }
  /** Chạy một thao tác, khoá nút khi đang xử lý, báo lỗi bằng thông báo nổi. */
  async function run(btn, fn) {
    if (btn) btn.disabled = true;
    try { await fn(); }
    catch (e) { toast(e.message || 'Có lỗi xảy ra.', true); }
    finally { if (btn) btn.disabled = false; }
  }
  function setBoot(b) {
    S.user = b.user; S.hasReports = b.hasReports; S.units = b.units; S.periods = b.periods; S.config = b.config; S.canUpload = b.canUpload;
    if (!period()) {
      var open = S.periods.filter(function (p) { return p.phase === 'mo'; })[0] || S.periods.filter(function (p) { return p.phase !== 'khoa'; })[0];
      S.periodId = (open || S.periods[0] || { id: '' }).id;
    }
    S.ov = null; S.st = null;
  }
  function logout() {
    localStorage.removeItem('kpi_token');
    S.user = null; S.ov = null; S.st = null; E = null; ADMIN = null; DASH = { type: '', id: '' };
    location.hash = '';
    render();
  }
  async function overview(force) {
    if (!S.periodId) return { rows: [], trend: [] };
    if (force || !S.ov || S.ovKey !== S.periodId) {
      S.ov = await api('overview', { periodId: S.periodId });
      S.ovKey = S.periodId;
    }
    return S.ov;
  }
  /** Điểm từng kỳ của mọi người trong phạm vi được xem; dùng cho các biểu đồ nhiều kỳ. */
  async function stats() {
    if (!S.st) S.st = await api('stats');
    return S.st;
  }

  /* ---------- Đăng nhập ---------- */
  function renderLogin() {
    var note = API.testAccount ? '<p class="muted small" style="margin-top:14px">Đang chạy thử trên máy với dữ liệu mẫu. Tài khoản thử: ' + h(API.testAccount.id) + ' / ' + h(API.testAccount.password) + '</p>' : '';
    app.innerHTML = '<div class="login"><form class="login-card" id="loginForm">' +
      '<div class="brand">' + LOGO + '<div><b>' + APP_TITLE + '</b><small>' + APP_SUB + '</small></div></div>' +
      '<h1>Đăng nhập</h1>' +
      '<label class="f"><span>Tên đăng nhập (số CCCD)</span><input type="text" name="username" inputmode="numeric" autocomplete="username" required autofocus></label>' +
      '<label class="f"><span>Mật khẩu</span><input type="password" name="password" autocomplete="current-password" required></label>' +
      '<div class="err" id="loginErr"></div>' +
      '<button class="btn primary" style="width:100%;justify-content:center">Đăng nhập</button>' + note + '</form></div>';
    $('#loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = ev.target;
      doLogin(f.username.value, f.password.value, $('button.primary', f));
    });
  }
  async function doLogin(username, password, btn) {
    if (btn) btn.disabled = true;
    try {
      var r = await API.call('login', { username: username, password: password });
      localStorage.setItem('kpi_token', r.token);
      setBoot(r.boot);
      location.hash = '#/tongquan';
      render();
    } catch (e) {
      var el = $('#loginErr');
      if (el) el.textContent = e.message; else toast(e.message, true);
      if (btn) btn.disabled = false;
    }
  }

  /* ---------- Khung trang ---------- */
  function navItems() {
    var u = S.user, items = [['tongquan', 'Tổng quan']];
    if (u.selfEval) items.push(['tudanhgia', 'Tự đánh giá']);
    if (S.hasReports) items.push(['duyet', 'Đánh giá cấp dưới']);
    if (S.hasReports || u.isAdmin) items.push(['baocao', 'KPI tổng hợp']);
    if (S.hasReports || u.isAdmin || u.isStaff || u.isVoter) items.push(['xeploai', 'Xếp loại']);
    items.push(['tieuchi', 'Bảng tiêu chí']);
    if (u.isAdmin) items.push(['quantri', 'Quản trị']);
    items.push(['matkhau', 'Đổi mật khẩu']);
    return items;
  }
  function sideOff() { try { return localStorage.getItem('kpi_side') === 'off'; } catch (e) { return false; } }
  function shell(route, title, showPeriod) {
    var nav = navItems().map(function (n) {
      var on = route === n[0] || (n[0] === (S.hasReports ? 'duyet' : 'baocao') && route === 'phieu');
      return '<a class="nav' + (on ? ' on' : '') + '" href="#/' + n[0] + '">' + n[1] + '</a>';
    }).join('');
    var sel = showPeriod && S.periods.length ? '<label class="period no-print"><span class="muted small">Kỳ đánh giá</span><select id="periodSel">' +
      S.periods.map(function (p) { return '<option value="' + h(p.id) + '"' + (p.id === S.periodId ? ' selected' : '') + '>' + h(p.name) + (p.phase === 'khoa' ? ' (đã khoá)' : p.phase === 'chot' ? ' (đã chốt nhập)' : '') + '</option>'; }).join('') +
      '</select></label>' : '';
    app.innerHTML = '<div class="shell' + (sideOff() ? ' side-off' : '') + '"><aside class="side">' +
      '<div class="brand">' + LOGO + '<div><b>' + APP_TITLE + '</b><small>' + h(S.config.orgName || APP_SUB) + '</small></div></div>' + nav +
      '<div class="who"><span><b>' + h(S.user.fullName) + '</b>' + h(S.user.title || LEVEL[S.user.level]) + '<br>' + h(unitName(S.user.unitId)) + '</span>' +
      '<button class="btn" data-act="logout">Đăng xuất</button></div></aside>' +
      '<main class="main"><div class="top"><div class="ttl"><button class="burger no-print" data-act="toggleSide" aria-label="Ẩn hoặc hiện bảng điều hướng bên trái" title="Ẩn / hiện bảng bên trái"><span></span><span></span><span></span></button><h1>' + h(title) + '</h1></div>' + sel + '</div><div id="view"><div class="loading">Đang tải…</div></div></main></div>';
    var ps = $('#periodSel');
    if (ps) ps.addEventListener('change', function () { S.periodId = ps.value; S.ov = null; render(); });
    return $('#view');
  }

  /** Hiện số phiếu đang chờ người dùng xử lý trên mục "Duyệt đánh giá". */
  function updateBadge() {
    if (!S.user || !S.hasReports || !S.periodId) return;
    overview().then(function (ov) {
      var a = $('.side a.nav[href="#/duyet"]');
      if (!a) return;
      var n = ov.rows.filter(function (x) { return x.canReview; }).length;
      var old = $('.count', a);
      if (old) old.remove();
      if (n) a.insertAdjacentHTML('beforeend', '<span class="count">' + n + '</span>');
    }).catch(function () { /* số đếm không quan trọng bằng nội dung trang */ });
  }

  function selectedRows() { var out = []; E.tasks.forEach(function (t, i) { if (E.sel[t.id]) out.push(i); }); return out; }
  /** Người phụ trách chấm (mode 'score') hoặc chỉ gửi nhận xét và mở cho sửa lại (mode 'note') các công việc ở những dòng đã cho. */
  function doScore(rows, mode, btn) {
    if (!rows.length) return toast('Chưa chọn công việc nào. Tích ô ở đầu dòng công việc.', true);
    for (var k = 0; k < rows.length; k++) {
      var t = E.tasks[rows[k]], no = 'Công việc số ' + (rows[k] + 1);
      if (t.isNew && !String(t.name).trim()) return toast(no + ' (việc thêm mới) chưa ghi tên.', true);
      if (mode === 'score' && !t.code && !KPI_calc(t.m)) return toast(no + ' chưa chọn đủ 5 mức A–E ở khối lãnh đạo chấm.', true);
      if (mode === 'score' && t.code && (t.m || []).some(function (v) { return v; }) && !KPI_calc(t.m)) return toast(no + ': muốn điều chỉnh theo A–E thì chọn đủ 5 mức ở khối lãnh đạo, không thì để trống cả 5.', true);
      if (mode === 'score' && t.code && (Number(t.H) < 1 || Number(t.Q) < 1 || Number(t.T) < 1) && !String(t.note || '').trim()) return toast(no + ' bị giảm điểm (H, Q hoặc T dưới 1): hãy ghi lý do ở ô nhận xét để cán bộ được biết.', true);
      if (mode === 'note' && t.isNew) return toast(no + ' là việc mới thêm, hãy bấm Chấm điểm để lưu.', true);
      if (mode === 'note' && !String(t.note || '').trim()) return toast(no + ' chưa có nhận xét. Ghi nhận xét để cán bộ biết cần điều chỉnh gì.', true);
    }
    if (rows.length > 1 && mode !== 'assign' && !confirm((mode === 'score' ? 'Chấm điểm ' : 'Gửi nhận xét và cho sửa lại ') + rows.length + ' công việc đã chọn?')) return;
    var sent = rows.map(function (i) { return E.tasks[i]; });
    var keep = E.tasks.filter(function (t) { return sent.indexOf(t) < 0; }); // giữ lại những gì đang sửa dở ở các dòng khác
    run(btn, async function () {
      var d = await api('score', {
        periodId: S.periodId, userId: E.d.owner.id, mode: mode,
        tasks: sent.map(function (t) { var x = t.isNew ? { isNew: true, name: t.name, product: t.product, qty: t.qty, month: t.month, m: t.m, note: t.note } : { id: t.id, m: t.m, note: t.note };
          x.progress = t.mProgress; x.doneDate = t.mDone; x.bonus = t.mBonus; x.ot = !!t.ot; x.oq = !!t.oq; // phần người phụ trách xác nhận
          if (t.code) { x.code = t.code; x.h = t.H; x.q = t.Q; x.t = t.T; x.deadline = t.deadline; } // việc trong Danh mục sản phẩm
          return x;
        })
      });
      S.ov = null; S.st = null;
      setEval(d);
      keep.forEach(function (k) {
        if (k.isNew) { E.tasks.push(k); E.sel[k.id] = true; return; }
        var cur = E.tasks.filter(function (x) { return x.id === k.id; })[0];
        if (cur && !cur.locked) { cur.m = k.m; cur.note = k.note; }
      });
      redrawTable();
      toast(mode === 'assign' ? 'Đã giao ' + sent.length + ' công việc cho cán bộ.' : mode === 'score' ? 'Đã chấm điểm ' + sent.length + ' công việc.' : 'Đã gửi nhận xét, cán bộ được sửa lại ' + sent.length + ' công việc.');
    });
  }

  var PREV = [];
  async function loadPrev() {
    var box = $('#prevList'), sel = $('#prevSel');
    if (!box || !sel) return;
    try {
      var r = await api('tasksFrom', { periodId: S.periodId, fromPeriodId: sel.value });
      PREV = r.tasks;
      box.className = 'pick';
      box.innerHTML = '<label style="font-weight:700"><input type="checkbox" id="prevAll" checked>Chọn tất cả (' + PREV.length + ')</label>' + PREV.map(function (t, i) {
        var c = KPI_calc(t.s), m = KPI_calc(t.pm);
        return '<label><input type="checkbox" data-i="' + i + '" checked><span>' + h(t.name) + '<br><span class="muted small">' + h(t.product) + ' · SL ' + fmt(t.qty) + (c ? ' · tự chấm ' + c.n : '') + (m ? ' · đã được chấm ' + m.n + ' (' + fmt(m.point) + 'đ)' : '') + (t.repeat ? ' · lặp lại' : '') + '</span></span></label>';
      }).join('');
    } catch (e) { box.textContent = e.message; }
  }
  function redrawDash() {
    if (!S.ov) return render();
    $('#view').innerHTML = dashboardHtml(S.ov);
    var f = document.getElementById('dashFocus');
    if (f) f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  var TITLES = { tongquan: 'Tổng quan', tudanhgia: 'Phiếu tự đánh giá', phieu: 'Phiếu đánh giá', duyet: 'Đánh giá cấp dưới', baocao: 'KPI tổng hợp', xeploai: 'Xếp loại chất lượng', quantri: 'Quản trị hệ thống', tieuchi: 'Bảng tiêu chí chấm điểm', matkhau: 'Đổi mật khẩu' };
  var renderSeq = 0;
  async function render() {
    modal.innerHTML = '';
    if (!S.user) return renderLogin();
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var route = parts[0] || 'tongquan', arg = parts[1] ? decodeURIComponent(parts[1]) : '';
    var allowed = navItems().map(function (n) { return n[0]; }).concat(S.hasReports || S.user.isAdmin ? ['phieu'] : []);
    if (S.user.mustChange) route = 'matkhau';
    else if (allowed.indexOf(route) < 0) route = 'tongquan';
    var seq = ++renderSeq;
    var view = shell(route, TITLES[route], ['tongquan', 'tudanhgia', 'phieu', 'duyet', 'baocao', 'xeploai'].indexOf(route) >= 0);
    try {
      var needPeriod = ['tongquan', 'tudanhgia', 'phieu', 'duyet', 'baocao', 'xeploai'].indexOf(route) >= 0;
      if (needPeriod && !S.periodId) {
        view.innerHTML = '<div class="card">Chưa có kỳ đánh giá nào. ' + (S.user.isAdmin ? 'Vào <a href="#/quantri/periods">Quản trị › Kỳ đánh giá</a> để tạo.' : 'Vui lòng liên hệ quản trị viên.') + '</div>';
        return;
      }
      var html;
      if (route === 'tongquan') html = dashboardHtml((await Promise.all([overview(), stats()]))[0]);
      else if (route === 'duyet') html = reviewHtml(await overview());
      else if (route === 'baocao') html = reportHtml(await overview());
      else if (route === 'xeploai') { RT = await api('rating', { periodId: S.periodId }); html = ratingHtml(); }
      else if (route === 'tudanhgia' || route === 'phieu') {
        var d = await api('getEvaluation', { periodId: S.periodId, userId: route === 'phieu' ? arg : '' });
        if (seq !== renderSeq) return;
        setEval(d);
        return;
      } else if (route === 'quantri') {
        ADMIN = await api('adminList');
        if (arg === 'catalog') S.cat = (await api('catalog')).items;
        html = adminHtml(arg || 'users');
      } else if (route === 'tieuchi') html = modelHtml();
      else html = passwordHtml();
      if (seq !== renderSeq) return;
      view.innerHTML = html;
      updateBadge();
    } catch (e) {
      if (seq !== renderSeq || !S.user) return;
      view.innerHTML = '<div class="card"><b>Không tải được dữ liệu.</b><div class="muted">' + h(e.message) + '</div></div>';
    }
  }

  /* ---------- Tổng quan ---------- */
  function daysLeft(p) {
    if (!p || !p.deadline) return null;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((new Date(p.deadline + 'T00:00:00') - t) / 86400000);
  }
  function trendHtml(trend) {
    var t = trend.filter(function (x) { return x.avg != null || x.periodId === S.periodId; }).slice(-8);
    if (!t.some(function (x) { return x.avg != null; })) return '<div class="muted">Chưa có kỳ nào có phiếu được đánh giá.</div>';
    var top = Math.max.apply(null, t.map(function (x) { return x.avg || 0; })) || 1;
    return '<div class="trend">' + t.map(function (x) {
      return '<div class="col' + (x.periodId === S.periodId ? ' cur' : '') + '"><div class="b" style="height:' + ((x.avg || 0) / top * 100) + '%"><span>' + fmt(x.avg) + '</span></div><small>' + h(x.name) + '</small></div>';
    }).join('') + '</div>';
  }
  var DASH = { type: '', id: '' }; // đang xem chi tiết đơn vị hay người phụ trách nào
  var GROUPS = [['done', 'Đã được đánh giá', 'var(--c-done)'], ['wait', 'Đã nộp, chờ chấm', 'var(--c-wait)'], ['draft', 'Đang soạn / yêu cầu sửa', 'var(--c-draft)'], ['none', 'Chưa lập phiếu', 'var(--c-none)']];
  function groupOf(rs) {
    var g = { done: 0, wait: 0, draft: 0, none: 0, n: 0, sum: 0, tasks: 0 };
    rs.forEach(function (r) {
      if (!r.user.selfEval) return;
      g.n++; g.tasks += r.taskCount || 0;
      if (r.mgrTotal != null) g.sum += r.mgrTotal; // việc đã chấm được cộng ngay
      if (r.status === 'da_chot') g.done++;
      else if (r.status === 'cho_duyet') g.wait++;
      else if (r.status === 'nhap' || r.status === 'yeu_cau_sua') g.draft++;
      else g.none++;
    });
    g.sum = Math.round(g.sum * 100) / 100;
    return g;
  }
  function stackBar(g) {
    if (!g.n) return '<div class="bar"></div>';
    return '<div class="bar" title="' + g.done + ' đã đánh giá, ' + g.wait + ' chờ chấm, ' + g.draft + ' đang soạn, ' + g.none + ' chưa lập">' +
      '<i class="s-done" style="width:' + (g.done / g.n * 100) + '%"></i><i class="s-wait" style="width:' + (g.wait / g.n * 100) + '%"></i><i class="s-draft" style="width:' + (g.draft / g.n * 100) + '%"></i></div>';
  }
  function donut(g) {
    var C = 2 * Math.PI * 46, off = 0, arcs = '';
    GROUPS.forEach(function (x) {
      var len = g.n ? g[x[0]] / g.n * C : 0;
      if (len > 0) arcs += '<circle cx="60" cy="60" r="46" fill="none" stroke="' + x[2] + '" stroke-width="15" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '"/>';
      off += len;
    });
    return '<div class="donut-wrap"><svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Tiến độ đánh giá"><circle cx="60" cy="60" r="46" fill="none" stroke="var(--c-none)" stroke-width="15"/>' +
      '<g transform="rotate(-90 60 60)">' + arcs + '</g><text class="big" x="60" y="62" text-anchor="middle">' + (g.n ? Math.round(g.done / g.n * 100) : 0) + '%</text><text class="sub" x="60" y="77" text-anchor="middle">đã đánh giá</text></svg>' +
      '<div class="donut-legend">' + GROUPS.map(function (x) { return '<div><i style="background:' + x[2] + '"></i><b>' + g[x[0]] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div></div>';
  }
  /** Mọi dòng nằm dưới một người trong cây phụ trách (không gồm chính người đó). */
  function underOf(rows, id) {
    var kids = {}, out = [], stack = [id];
    rows.forEach(function (r) { (kids[r.user.managerId] || (kids[r.user.managerId] = [])).push(r); });
    while (stack.length) (kids[stack.pop()] || []).forEach(function (r) { if (out.indexOf(r) < 0) { out.push(r); stack.push(r.user.id); } });
    return out;
  }
  function unitIdsUnder(id) {
    var tree = unitTree(), ids = {}, i = tree.map(function (x) { return x.u.id; }).indexOf(id);
    if (i < 0) return ids;
    ids[id] = true;
    for (var k = i + 1; k < tree.length && tree[k].depth > tree[i].depth; k++) ids[tree[k].u.id] = true;
    return ids;
  }
  /** Một dòng người: tên, thanh tiến độ (của cả nhóm nếu là người phụ trách), điểm. Bấm vào: người phụ trách thì xem nhóm, cá nhân thì mở phiếu. */
  function personHtml(rows, r) {
    var lead = r.reports > 0, team = lead ? [r].concat(underOf(rows, r.user.id)) : [r], g = groupOf(team);
    var sub = lead ? g.done + '/' + g.n + ' người đã được đánh giá' + (g.wait ? ' · ' + g.wait + ' chờ chấm' : '') : (r.user.selfEval ? (r.taskCount || 0) + ' công việc' + (r.selfTotal != null ? ' · tự chấm ' + fmt(r.selfTotal) : '') : 'Không tự kê công việc');
    return '<button class="person" data-act="' + (lead ? 'dashUser' : 'open') + '" data-u="' + h(r.user.id) + '"><span class="nm"><b>' + h(r.user.fullName) + '</b><span>' + h(r.user.title || LEVEL[r.user.level]) + ' · ' + h(unitName(r.user.unitId)) + '</span></span>' +
      '<span class="pg">' + stackBar(g) + '<small>' + sub + '</small></span>' +
      '<span class="rt">' + (lead ? '<b>' + fmt(r.kpi) + '</b> <span class="muted small">KPI</span>' : badge(r.status) + (r.mgrTotal != null ? ' <b>' + fmt(r.mgrTotal) + '</b>' : '')) + '</span></button>';
  }
  function sortPeople(a, b) { return KPI_LEVELS[a.user.level].rank - KPI_LEVELS[b.user.level].rank || a.user.fullName.localeCompare(b.user.fullName, 'vi'); }
  function focusHtml(rows) {
    if (!DASH.type) return '';
    var title, list, crumbs = '<button data-act="dashBack">‹ Đóng</button>';
    if (DASH.type === 'hist') return histHtml(rows);
    if (DASH.type === 'unit') {
      var ids = DASH.own ? {} : unitIdsUnder(DASH.id);
      if (DASH.own) ids[DASH.id] = true;
      list = rows.filter(function (r) { return ids[r.user.unitId]; }).sort(sortPeople);
      title = 'Đơn vị: ' + unitName(DASH.id) + (DASH.own ? ' (cán bộ của chính đơn vị)' : '');
    } else {
      var who = rows.filter(function (r) { return r.user.id === DASH.id; })[0];
      if (!who) return '';
      list = rows.filter(function (r) { return r.user.managerId === DASH.id; }).sort(sortPeople);
      title = 'Do ' + who.user.fullName + ' phụ trách';
      var up = rows.filter(function (r) { return r.user.id === who.user.managerId && r.reports > 0; })[0]; // quay lên cấp trên, nếu nằm trong phạm vi được xem
      if (up) crumbs += '<button data-act="dashUser" data-u="' + h(up.user.id) + '">↑ ' + h(up.user.fullName) + '</button>';
      if (who.user.selfEval) crumbs += '<button data-act="open" data-u="' + h(who.user.id) + '">Phiếu của ' + h(who.user.fullName) + '</button>';
    }
    var g = groupOf(DASH.type === 'unit' ? list : [].concat(list, underOf(rows, DASH.id)));
    return '<div class="card focus" id="dashFocus"><div class="crumbs">' + crumbs + '</div><h2>' + h(title) + ' <span class="muted small" style="font-weight:400">· ' + g.done + '/' + g.n + ' người đã được đánh giá · tổng ' + fmt(g.sum) + ' điểm</span></h2>' +
      '<div class="grid cols-2" style="margin-bottom:12px"><div>' + donut(g) + '</div><div class="muted small" style="align-self:center">' +
      (DASH.type === 'unit' ? 'Danh sách cá nhân trong đơn vị' + (DASH.own ? '.' : ' (gồm đơn vị trực thuộc).') + ' Bấm vào một người để mở phiếu; bấm vào người phụ trách để xem nhóm của họ.' : 'Những người do đồng chí này trực tiếp phụ trách. Bấm vào cấp phó, cấp trưởng để xem tiếp các cá nhân họ phụ trách; bấm vào cá nhân để mở phiếu.') + '</div></div>' +
      '<div class="people">' + (list.map(function (r) { return personHtml(rows, r); }).join('') || '<div class="muted">Không có ai.</div>') + '</div></div>';
  }
  /* ---------- Biểu đồ và bảng nhiều kỳ ---------- */
  var RANK_ALL = false;
  function r2(n) { return Math.round(n * 100) / 100; }
  /** CCCD -> mã kỳ -> điểm của người đó trong kỳ đó. */
  function stIndex() {
    var ix = {};
    ((S.st && S.st.rows) || []).forEach(function (x) { (ix[x.userId] || (ix[x.userId] = {}))[x.periodId] = x; });
    return ix;
  }
  function periodsAsc() { return S.periods.slice().sort(function (a, b) { return String(a.startDate).localeCompare(String(b.startDate)); }); }
  /** Kỳ cùng loại liền trước kỳ đang chọn. */
  function prevPeriod() {
    var p = period();
    if (!p) return null;
    var l = periodsAsc().filter(function (x) { return x.type === p.type && String(x.startDate) < String(p.startDate); });
    return l[l.length - 1] || null;
  }
  function yearOf(p) { return String(p.startDate).slice(0, 4); }
  function scoreAt(ix, userId, p) { var x = p && ix[userId] && ix[userId][p.id]; return x && x.mgrTotal != null ? x.mgrTotal : 0; }
  /** Biểu đồ cột bấm được. items: [{label, v, prev, attrs, on, title}]; withPrev: vẽ thêm cột kỳ trước màu xám. */
  function colsHtml(items, withPrev) {
    if (!items.length) return '<div class="muted">Chưa có số liệu.</div>';
    var H = 150, top = Math.max.apply(null, items.map(function (x) { return Math.max(x.v || 0, withPrev ? x.prev || 0 : 0); })) || 1;
    return '<div class="cols">' + items.map(function (x) {
      return '<button class="c' + (x.on ? ' on' : '') + '" ' + x.attrs + ' title="' + h(x.title || x.label) + '"><span class="bars" style="height:' + (H + 22) + 'px">' +
        (withPrev ? '<i class="prev" style="height:' + Math.max(2, (x.prev || 0) / top * H) + 'px"></i>' : '') +
        '<i style="height:' + Math.max(2, (x.v || 0) / top * H) + 'px"><span>' + fmt(x.v || 0) + '</span></i></span><small>' + h(x.label) + '</small></button>';
    }).join('') + '</div>';
  }
  /** Cột điểm từng đơn vị (chỉ tính cán bộ của chính đơn vị nên các cột không cộng trùng nhau), kèm cột kỳ trước. */
  function unitColsHtml(rows, ix, prev) {
    var by = {};
    rows.forEach(function (r) {
      if (!r.user.selfEval) return;
      var o = by[r.user.unitId] || (by[r.user.unitId] = { v: 0, prev: 0, n: 0 });
      o.n++; o.v += r.mgrTotal || 0; o.prev += scoreAt(ix, r.user.id, prev);
    });
    var items = unitTree().filter(function (x) { return by[x.u.id]; }).map(function (x) {
      var o = by[x.u.id];
      return {
        label: x.u.name, v: r2(o.v), prev: r2(o.prev), on: DASH.type === 'unit' && DASH.own && DASH.id === x.u.id,
        attrs: 'data-act="dashUnit" data-own="1" data-id="' + h(x.u.id) + '"',
        title: x.u.name + ': ' + o.n + ' người, ' + fmt(r2(o.v)) + ' điểm' + (prev ? ' (kỳ trước ' + fmt(r2(o.prev)) + ')' : '')
      };
    });
    if (items.length < 2) return '';
    return colsHtml(items, !!prev) + '<div class="legend">' + (prev ? '<span><i style="background:var(--c-none)"></i>' + h(prev.name) + '</span>' : '') +
      '<span><i style="background:#2563eb"></i>' + h(period().name) + '</span></div><p class="muted small" style="margin:8px 0 0">Điểm đã được chấm của cán bộ thuộc chính đơn vị đó. Bấm vào một cột để xem từng người.</p>';
  }
  /** Cột điểm từng người trong phạm vi được xem, cao xuống thấp. */
  function peopleColsHtml(rows) {
    var list = rows.filter(function (r) { return r.user.selfEval; }).sort(function (a, b) { return (b.mgrTotal || 0) - (a.mgrTotal || 0) || a.user.fullName.localeCompare(b.user.fullName, 'vi'); });
    return colsHtml(list.map(function (r) {
      return {
        label: r.user.fullName, v: r.mgrTotal || 0, on: DASH.type === 'hist' && DASH.id === r.user.id, attrs: 'data-act="dashHist" data-u="' + h(r.user.id) + '"',
        title: r.user.fullName + ' · ' + unitName(r.user.unitId) + ': ' + fmt(r.mgrTotal || 0) + ' điểm'
      };
    }), false) + '<p class="muted small" style="margin:8px 0 0">Điểm đã được chấm trên phiếu của từng người trong kỳ. Bấm vào một cột để xem điểm của người đó qua các kỳ.</p>';
  }
  /** Bảng điểm qua các kỳ của một người: số việc, tự chấm, lãnh đạo chấm, chênh lệch. */
  function histTable(ix, userId) {
    var mine = ix[userId] || {}, ps = periodsAsc().filter(function (p) { return mine[p.id] || p.id === S.periodId; });
    if (!ps.some(function (p) { return mine[p.id]; })) return '<div class="muted">Chưa có phiếu ở kỳ nào.</div>';
    var tS = 0, tM = 0, tN = 0;
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kỳ</th><th class="num">Số việc</th><th class="num">Tự chấm</th><th class="num">Lãnh đạo chấm</th><th class="num">Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>' +
      ps.map(function (p) {
        var x = mine[p.id] || { status: 'chua_lap' }, d = x.selfTotal != null && x.mgrTotal != null ? r2(x.mgrTotal - x.selfTotal) : null;
        tS += x.selfTotal || 0; tM += x.mgrTotal || 0; tN += x.taskCount || 0;
        return '<tr' + (p.id === S.periodId ? ' class="cur"' : '') + '><td>' + h(p.name) + '</td><td class="num">' + (x.taskCount || '–') + '</td><td class="num">' + fmt(x.selfTotal) + '</td><td class="num"><b>' + fmt(x.mgrTotal) + '</b></td><td class="num">' + diffHtml(d) + '</td><td>' + badge(x.status) + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td><b>Cộng</b></td><td class="num">' + tN + '</td><td class="num">' + fmt(r2(tS)) + '</td><td class="num"><b>' + fmt(r2(tM)) + '</b></td><td class="num">' + diffHtml(r2(tM - tS)) + '</td><td></td></tr></tfoot></table></div>';
  }
  function diffHtml(d) { return d == null ? '–' : '<span class="' + (d > 0 ? 'up' : d < 0 ? 'down' : 'muted') + '">' + (d > 0 ? '+' : '') + fmt(d) + '</span>'; }
  function histHtml(rows) {
    var who = rows.filter(function (r) { return r.user.id === DASH.id; })[0];
    if (!who) return '';
    return '<div class="card focus" id="dashFocus"><div class="crumbs"><button data-act="dashBack">‹ Đóng</button>' +
      '<button data-act="open" data-u="' + h(who.user.id) + '">Mở phiếu kỳ này</button></div><h2>' + h(who.user.fullName) + ' <span class="muted small" style="font-weight:400">· ' + h(who.user.title || LEVEL[who.user.level]) + ' · ' + h(unitName(who.user.unitId)) + '</span></h2>' +
      histTable(stIndex(), who.user.id) + '</div>';
  }
  /** Xếp hạng cá nhân theo tổng điểm các kỳ cùng loại trong năm của kỳ đang chọn. */
  function rankHtml(rows, ix) {
    var p = period(), y = yearOf(p), ps = S.periods.filter(function (x) { return x.type === p.type && yearOf(x) === y; });
    var list = rows.filter(function (r) { return r.user.selfEval; }).map(function (r) {
      var sum = 0, k = 0;
      ps.forEach(function (q) { var x = ix[r.user.id] && ix[r.user.id][q.id]; if (x && x.mgrTotal != null) { sum += x.mgrTotal; k++; } });
      return { r: r, sum: r2(sum), k: k };
    }).sort(function (a, b) { return b.sum - a.sum || a.r.user.fullName.localeCompare(b.r.user.fullName, 'vi'); });
    var shown = RANK_ALL ? list : list.slice(0, 10);
    return '<div class="card"><h2>Xếp hạng cá nhân năm ' + h(y) + ' <span class="muted small" style="font-weight:400">· cộng ' + ps.length + ' kỳ ' + h((TYPE[p.type] || '').toLowerCase()) + '</span></h2>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="num">Hạng</th><th>Họ tên</th><th class="num">Số kỳ có điểm</th><th class="num">Tổng điểm</th><th class="num">Bình quân một kỳ</th></tr></thead><tbody>' +
      shown.map(function (x, i) {
        return '<tr class="click" data-act="dashHist" data-u="' + h(x.r.user.id) + '"><td class="num">' + (i + 1) + '</td><td><b>' + h(x.r.user.fullName) + '</b><div class="muted small">' + h(unitName(x.r.user.unitId)) + '</div></td>' +
          '<td class="num">' + x.k + '</td><td class="num"><b>' + fmt(x.sum) + '</b></td><td class="num">' + fmt(x.k ? r2(x.sum / x.k) : null) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (list.length > 10 ? '<div class="actions" style="margin-top:10px"><button class="btn sm" data-act="rankAll">' + (RANK_ALL ? 'Chỉ xem 10 người đầu' : 'Xem tất cả ' + list.length + ' người') + '</button></div>' : '') + '</div>';
  }
  /** Những người tăng, giảm điểm nhiều nhất so với kỳ cùng loại liền trước. */
  function moversHtml(rows, ix, prev) {
    var head = '<div class="card"><h2>So với kỳ trước' + (prev ? ' <span class="muted small" style="font-weight:400">· ' + h(prev.name) + '</span>' : '') + '</h2>';
    if (!prev) return head + '<div class="muted">Chưa có kỳ cùng loại nào trước kỳ này để so sánh.</div></div>';
    var list = rows.filter(function (r) { return r.user.selfEval; }).map(function (r) {
      var cur = r.mgrTotal || 0, old = scoreAt(ix, r.user.id, prev);
      return { r: r, cur: cur, old: old, d: r2(cur - old) };
    }).filter(function (x) { return x.d; }).sort(function (a, b) { return b.d - a.d; });
    if (!list.length) return head + '<div class="muted">Điểm kỳ này chưa khác kỳ trước.</div></div>';
    var up = list.filter(function (x) { return x.d > 0; }).slice(0, 5), down = list.filter(function (x) { return x.d < 0; }).reverse().slice(0, 5);
    function part(title, l) {
      if (!l.length) return '';
      return '<tr class="sub"><td colspan="4">' + title + '</td></tr>' + l.map(function (x) {
        return '<tr class="click" data-act="dashHist" data-u="' + h(x.r.user.id) + '"><td><b>' + h(x.r.user.fullName) + '</b><div class="muted small">' + h(unitName(x.r.user.unitId)) + '</div></td><td class="num">' + fmt(x.old) + '</td><td class="num"><b>' + fmt(x.cur) + '</b></td><td class="num">' + diffHtml(x.d) + '</td></tr>';
      }).join('');
    }
    return head + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Họ tên</th><th class="num">Kỳ trước</th><th class="num">Kỳ này</th><th class="num">Chênh lệch</th></tr></thead><tbody>' +
      part('Tăng nhiều nhất', up) + part('Giảm nhiều nhất', down) + '</tbody></table></div>' +
      '<p class="muted small" style="margin:8px 0 0">Kỳ đang chấm dở thì điểm còn thấp hơn kỳ trước là bình thường.</p></div>';
  }
  /** Khối chỉ quản trị thấy: tình hình tài khoản và các kỳ đang mở. */
  function systemHtml() {
    var a = S.st && S.st.accounts;
    if (!a) return '';
    var open = S.periods.filter(function (p) { return p.phase === 'mo'; });
    var soon = open.filter(function (p) { var d = daysLeft(p); return d != null && d >= 0 && d <= 7; });
    return '<div class="card"><h2>Hệ thống</h2><div class="stats" style="margin-bottom:12px">' +
      '<div class="stat"><div class="v">' + a.active + '</div><div class="l">Tài khoản đang hoạt động</div><div class="x">' + a.locked + ' tài khoản đã khoá</div></div>' +
      '<div class="stat' + (a.mustChange ? ' s-none' : ' s-done') + '"><div class="v">' + a.mustChange + '</div><div class="l">Chưa đổi mật khẩu lần đầu</div></div>' +
      '<div class="stat' + (a.noManager ? ' s-none' : ' s-done') + '"><div class="v">' + a.noManager + '</div><div class="l">Chưa khai người phụ trách</div><div class="x">phiếu của họ không ai chấm được</div></div>' +
      '<div class="stat"><div class="v">' + open.length + '</div><div class="l">Kỳ đang mở nhập</div><div class="x">' + (soon.length ? 'chốt trong 7 ngày tới: ' + h(soon.map(function (p) { return p.name; }).join(', ')) : 'không có kỳ nào chốt trong 7 ngày tới') + '</div></div></div>' +
      '<div class="actions"><a class="btn" href="#/quantri/users">Quản lý người dùng</a><a class="btn" href="#/quantri/periods">Quản lý kỳ đánh giá</a></div></div>';
  }

  function remindText(ov) {
    var p = period(), late = ov.rows.filter(function (r) { return r.user.selfEval && ['chua_lap', 'nhap', 'yeu_cau_sua'].indexOf(r.status) >= 0; });
    var names = {}; ov.rows.forEach(function (r) { names[r.user.id] = r.user.fullName; });
    var pend = {}; ov.rows.forEach(function (r) { if (r.status === 'cho_duyet') pend[r.user.managerId] = (pend[r.user.managerId] || 0) + 1; });
    var lines = ['NHẮC VIỆC ĐÁNH GIÁ KPI – ' + p.name.toUpperCase() + (p.deadline ? ' (hạn chốt nhập ' + fdate(p.deadline) + ')' : '')];
    if (late.length) { lines.push('', 'Chưa nộp phiếu tự đánh giá (' + late.length + '):'); late.forEach(function (r, i) { lines.push((i + 1) + '. ' + r.user.fullName + ' – ' + unitName(r.user.unitId) + ' (' + STATUS[r.status][0].toLowerCase() + ')'); }); }
    var ks = Object.keys(pend);
    if (ks.length) { lines.push('', 'Người phụ trách còn phiếu chờ chấm:'); ks.forEach(function (k, i) { lines.push((i + 1) + '. ' + (names[k] || 'Chưa khai người phụ trách') + ': ' + pend[k] + ' phiếu'); }); }
    return { text: lines.join('\n'), late: late, pend: pend, names: names };
  }
  function dashboardHtml(ov) {
    var rows = ov.rows, p = period(), me = S.user;
    var mine = rows.filter(function (r) { return r.user.id === me.id; })[0] || { status: 'chua_lap', kpi: 0, people: 0, done: 0, reports: 0, user: me };
    var all = groupOf(rows), others = rows.filter(function (r) { return r.user.id !== me.id; });
    var left = daysLeft(p), dl = '';
    if (p && p.phase === 'khoa') dl = 'Kỳ đã khoá';
    else if (p && p.phase === 'chot') dl = 'Đã chốt nhập' + (p.deadline ? ' từ sau ngày ' + fdate(p.deadline) : '');
    else if (p && left != null) dl = 'Hạn chốt nhập ' + fdate(p.deadline) + ' (còn ' + left + ' ngày)';
    var html = '', ix = stIndex(), prev = prevPeriod();

    if (me.selfEval) {
      html += '<div class="card"><h2>Phiếu của tôi · ' + h(p.name) + '</h2><div class="stats" style="margin-bottom:12px">' +
        '<div class="stat"><div class="l">Trạng thái</div><div class="v" style="font-size:18px;margin-top:6px">' + badge(mine.status) + '</div></div>' +
        '<div class="stat"><div class="v">' + (mine.taskCount || 0) + '</div><div class="l">Công việc đã kê</div></div>' +
        '<div class="stat"><div class="v">' + fmt(mine.selfTotal) + '</div><div class="l">Điểm tự chấm</div></div>' +
        '<div class="stat s-done"><div class="v">' + fmt(mine.mgrTotal) + '</div><div class="l">Điểm đã được chấm</div></div></div>' +
        '<div class="actions"><a class="btn primary" href="#/tudanhgia">Mở phiếu tự đánh giá</a><span class="muted">' + h(dl) + '</span>' +
        (!me.managerId ? '<span class="badge b-amber">Chưa được khai người phụ trách đánh giá</span>' : '') + '</div></div>';
    }
    if (!others.length && !me.isAdmin) return html + '<div class="card"><h2>Điểm của tôi qua các kỳ</h2>' + trendHtml(ov.trend) + '</div>' +
      '<div class="card"><h2>Bảng điểm từng kỳ</h2>' + histTable(ix, me.id) + '</div>';

    var wide = me.isAdmin && !mine.reports; // quản trị không phụ trách ai: xem toàn cơ quan
    var kpi = wide ? all.sum : mine.kpi, people = wide ? all.n : mine.people;
    var unitsUsed = {}; rows.forEach(function (r) { unitsUsed[r.user.unitId] = true; });
    var todo = rows.filter(function (r) { return r.canReview; }).length;
    html += '<div class="stats">' +
      '<div class="stat"><div class="v">' + Object.keys(unitsUsed).length + '</div><div class="l">Đơn vị</div></div>' +
      '<div class="stat"><div class="v">' + rows.length + '</div><div class="l">Cán bộ, công chức</div><div class="x">' + all.n + ' người tự kê công việc</div></div>' +
      '<div class="stat s-done"><div class="v">' + all.done + '</div><div class="l">Đã được đánh giá</div></div>' +
      '<div class="stat s-none"><div class="v">' + (all.n - all.done) + '</div><div class="l">Chưa được đánh giá</div><div class="x">' + all.wait + ' chờ chấm · ' + (all.draft + all.none) + ' chưa nộp</div></div>' +
      '<div class="stat hl"><div class="v">' + fmt(kpi) + '</div><div class="l">KPI tổng hợp ' + (wide ? 'toàn cơ quan' : 'do tôi phụ trách') + '</div><div class="x">bình quân ' + fmt(people ? kpi / people : null) + ' điểm một người</div></div></div>' +
      (todo ? '<div class="banner amber">Có <b>' + todo + '</b> phiếu đang chờ anh/chị chấm. <a href="#/duyet">Mở danh sách</a></div>' : '');
    if (me.isAdmin) html += systemHtml();

    var tree = unitTree(), byUnit = tree.map(function (x) {
      var ids = unitIdsUnder(x.u.id);
      return { u: x.u, depth: x.depth, g: groupOf(rows.filter(function (r) { return ids[r.user.unitId]; })) };
    }).filter(function (x) { return x.g.n; });
    html += '<div class="grid cols-2"><div class="card"><h2>Tiến độ đánh giá · ' + h(p.name) + '</h2>' + donut(all) + (dl ? '<p class="muted small" style="margin:12px 0 0">' + h(dl) + '</p>' : '') + '</div>' +
      '<div class="card"><h2>Tiến độ chấm điểm từng đơn vị</h2>' + byUnit.map(function (x) {
        return '<button class="bar-row' + (DASH.type === 'unit' && !DASH.own && DASH.id === x.u.id ? ' on' : '') + '" data-act="dashUnit" data-id="' + h(x.u.id) + '" title="Bấm để xem danh sách cá nhân"><span>' + pad(x.depth) + h(x.u.name) + '</span>' + stackBar(x.g) +
          '<span class="right small"><b>' + x.g.done + '/' + x.g.n + '</b> · ' + fmt(x.g.sum) + 'đ</span></button>';
      }).join('') + '<div class="legend">' + GROUPS.map(function (x) { return '<span><i style="background:' + x[2] + '"></i>' + x[1] + '</span>'; }).join('') + '</div><p class="muted small" style="margin:8px 0 0">Bấm vào một đơn vị để xem tiến độ từng cá nhân.</p></div></div>';

    var trendCard = '<div class="card"><h2>KPI tổng hợp ' + (wide ? 'của tôi' : 'do tôi phụ trách') + ' qua các kỳ</h2>' + trendHtml(ov.trend) + '</div>';
    var unitCols = unitColsHtml(rows, ix, prev);
    html += unitCols ? '<div class="grid cols-2"><div class="card"><h2>Điểm theo đơn vị · ' + h(p.name) + '</h2>' + unitCols + '</div>' + trendCard + '</div>' : trendCard;
    html += '<div class="card"><h2>Điểm từng người · ' + h(p.name) + '</h2>' + peopleColsHtml(rows) + '</div>';

    html += focusHtml(rows);

    html += '<div class="grid cols-2">' + rankHtml(rows, ix) + moversHtml(rows, ix, prev) + '</div>';

    var base = mine.reports ? rows.filter(function (r) { return r.user.managerId === me.id; }) : rows.filter(function (r) { return r.reports > 0 && !rows.some(function (x) { return x.user.id === r.user.managerId; }); });
    if (base.length) {
      html += '<div class="card"><h2>' + (mine.reports ? 'Những người tôi trực tiếp phụ trách' : 'Theo người phụ trách') + '</h2><div class="people">' + base.sort(sortPeople).map(function (r) { return personHtml(rows, r); }).join('') + '</div>' +
        '<p class="muted small" style="margin:10px 0 0">Bấm vào cấp trưởng, cấp phó để xem các cá nhân họ phụ trách; bấm vào cá nhân để mở phiếu.</p></div>';
    }

    var rm = remindText(ov), ks = Object.keys(rm.pend);
    html += '<div class="card"><h2>Nhắc nhở</h2>' +
      (rm.late.length || ks.length ? '' : '<div class="muted">Không còn ai phải nhắc trong kỳ này.</div>') +
      (rm.late.length ? '<p style="margin:0 0 6px"><b>' + rm.late.length + '</b> người chưa nộp phiếu' + (dl ? ' · <span class="muted">' + h(dl) + '</span>' : '') + '</p><div class="tbl-wrap" style="max-height:240px;overflow:auto"><table class="tbl"><tbody>' + rm.late.map(function (r) {
        return '<tr class="click" data-act="open" data-u="' + h(r.user.id) + '"><td>' + h(r.user.fullName) + '<div class="muted small">' + h(unitName(r.user.unitId)) + '</div></td><td class="right">' + badge(r.status) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '') +
      (ks.length ? '<p style="margin:12px 0 6px"><b>Người phụ trách còn phiếu chờ chấm</b></p>' + ks.map(function (k) { return '<div class="bar-row" style="grid-template-columns:1fr auto"><span>' + h(rm.names[k] || 'Chưa khai người phụ trách') + '</span><span class="badge b-blue">' + rm.pend[k] + ' phiếu</span></div>'; }).join('') : '') +
      (rm.late.length || ks.length ? '<div class="actions" style="margin-top:12px"><button class="btn" data-act="copyRemind">Chép nội dung nhắc nhở</button><span class="muted small">Dán vào Zalo, email để gửi</span></div>' : '') + '</div>';
    return html;
  }

  /* ---------- Đánh giá cấp dưới ---------- */
  function rowsTable(rows, withAction) {
    if (!rows.length) return '<div class="muted">Không có ai.</div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Họ tên</th><th>Đơn vị</th><th>Cấp</th><th class="num">Số việc</th><th class="num">Tự chấm</th><th class="num">Đã được chấm</th><th class="num">KPI tổng hợp</th><th>Trạng thái</th>' + (withAction ? '<th></th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="click" data-act="open" data-u="' + h(r.user.id) + '"><td><b>' + h(r.user.fullName) + '</b><div class="muted small">' + h(r.user.title) + '</div></td><td>' + h(unitName(r.user.unitId)) + '</td><td>' + h(LEVEL[r.user.level]) + '</td>' +
          '<td class="num">' + (r.taskCount || '–') + '</td><td class="num">' + fmt(r.selfTotal) + '</td><td class="num">' + fmt(r.mgrTotal) + '</td><td class="num"><b>' + fmt(r.kpi) + '</b></td><td>' + badge(r.status) + (r.fb ? ' <span class="badge b-amber" title="Cán bộ phản hồi không tán thành kết quả chấm">' + r.fb + ' phản hồi</span>' : '') + '</td>' +
          (withAction ? '<td class="right"><span class="btn sm primary">Đánh giá</span></td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function reviewHtml(ov) {
    var mine = ov.rows.filter(function (r) { return r.canReview; });
    var direct = ov.rows.filter(function (r) { return r.user.managerId === S.user.id; });
    return '<div class="card"><h2>Phiếu chờ anh/chị đánh giá (' + mine.length + ')</h2>' + rowsTable(mine, true) + '</div>' +
      '<div class="card"><h2>Những người anh/chị trực tiếp phụ trách (' + direct.length + ')</h2>' + rowsTable(direct, false) +
      '<p class="muted small">KPI tổng hợp của một người = điểm phiếu của chính người đó đã được công nhận + KPI của những người do người đó phụ trách. Xem toàn bộ các cấp ở mục <a href="#/baocao">KPI tổng hợp</a>.</p></div>';
  }

  /* ---------- Phiếu đánh giá: bảng công việc theo mẫu Excel ---------- */
  var M = KPI_MODEL;
  var HINT_NAME = 'Nêu rất rõ tên công việc đã làm. Ví dụ: “Tham mưu công văn góp ý dự thảo Kế hoạch hành động khắc phục hạn chế, khuyết điểm của Ban Thường vụ Tỉnh uỷ Quý II/2026”. Không ghi chung chung: “Tham mưu công văn góp ý dự thảo Kế hoạch”.';
  var HINT_QTY = 'Việc từ 01 giờ trở lên: nhập 1. Việc dưới 01 giờ: nhập 60 ÷ số phút thực hiện (ví dụ làm 15 phút → 60/15 = 4).';
  function newId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function periodMonths(p) {
    var a = String(p.startDate).split('-'), b = String(p.endDate).split('-'), y = +a[0], m = +a[1], out = [];
    while ((y < +b[0] || (y === +b[0] && m <= +b[1])) && out.length < 36) { out.push('T' + m + '/' + y); if (++m > 12) { m = 1; y++; } }
    return out.length ? out : ['T' + (+a[1] || 1) + '/' + (+a[0] || new Date().getFullYear())];
  }
  function blankTask() { return { id: newId(), name: '', product: 'Công văn', qty: 1, month: E.months[E.months.length - 1], s: [0, 0, 0, 0, 0], link: '' }; }
  function sumPoints(key) {
    var sum = 0;
    E.tasks.forEach(function (t) { var c = cK(t, key); if (c) sum += (Number(t.qty) || 0) * c.point; });
    return Math.round(sum * 10000) / 10000;
  }
  function ratingOf(score) {
    var rs = (S.config.ratings || []).slice().sort(function (a, b) { return b.min - a.min; });
    for (var i = 0; i < rs.length; i++) if (score >= rs[i].min) return rs[i].name;
    return '';
  }
  function setEval(d) {
    var p = d.perms;
    E = { d: d, tasks: JSON.parse(JSON.stringify(d.ev.tasks || [])), months: periodMonths(d.period), canMgr: p.canScore, sel: {}, editing: {}, orig: {} };
    E.tasks.forEach(function (t) {
      if (!t.s) t.s = [0, 0, 0, 0, 0];
      if (E.canMgr && t.code && !t.locked && (t.H === undefined || t.H === null)) { t.H = 1; t.Q = 1; t.T = suggestT(t); } // điền sẵn: hoàn thành đủ, đạt yêu cầu, tiến độ theo hạn
      if (E.canMgr && !t.code && !KPI_calc(t.m)) t.m = (KPI_calc(t.pm) ? t.pm : t.s).slice(); // điền sẵn: việc lặp lại lấy kết quả chấm kỳ trước, việc khác theo mức cán bộ tự chọn; người đánh giá đổi được
      if (E.canMgr && !t.locked) E.sel[t.id] = true;                                // mặc định chọn sẵn các việc chưa chấm
      if (E.canMgr && !t.locked) { // điền sẵn phần xác nhận theo cán bộ kê; người đánh giá đổi được
        if (t.mProgress == null) t.mProgress = t.progress != null ? t.progress : 100;
        if (!t.mDone) t.mDone = t.doneDate || '';
        if (t.mBonus == null) t.mBonus = t.bonus || 0;
        if (t.ot == null) t.ot = !!(t.deadline && t.mDone && t.mDone < t.deadline);
      }
    });
    E.showMgr = E.canMgr || E.tasks.some(function (t) { return cK(t, 'm'); });
    E.note = '';
    if (p.canEdit && d.ev.status === 'chua_lap' && d.carry && d.carry.tasks.length) { // việc lặp lại từ kỳ trước
      E.tasks = d.carry.tasks;
      E.note = 'Đã tự đưa sang ' + d.carry.tasks.length + ' công việc lặp lại từ ' + d.carry.from + ' kèm mức tự chấm. Kiểm tra, chỉnh lại nếu cần rồi lưu.';
    }
    if (p.canEdit && !E.tasks.length) E.tasks.push(blankTask());
    $('#view').innerHTML = evalHtml();
    updateTotals();
    updateBadge();
    if ((p.canEdit || p.canScore) && !S.cat) ensureCat().then(function () { var sel = $('#catType'); if (sel) { sel.innerHTML = '<option value="">– chọn loại sản phẩm –</option>' + opts(catTypes(), CATQ.type || ''); var l = $('#catList'); if (l) l.innerHTML = ''; } }, function () { /* danh mục chưa nạp: vẫn kê việc ngoài danh mục được */ });
  }
  function opts(list, cur) {
    return list.map(function (o) { return '<option value="' + h(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join('');
  }
  function levelCell(t, ti, key, fi, editable) {
    var f = M.factors[fi], v = (t[key] || [])[fi] || 0;
    if (!editable) return '<td class="lv">' + (v ? '<b>' + v + '</b> · ' + h(f.levels[v - 1][0]) : '<span class="muted">–</span>') + '</td>';
    return '<td class="lv"><select data-lv="' + key + '" data-fi="' + fi + '" data-t="' + ti + '" aria-label="' + f.key + ' – ' + h(f.name) + '"' + (v || t.code ? '' : ' class="empty"') + '>' +
      '<option value="0">' + (t.code ? '– theo mã –' : '– chọn –') + '</option>' + opts(f.levels.map(function (l, i) { return [i + 1, (i + 1) + ' · ' + l[0]]; }), v) + '</select></td>';
  }
  function calcCells(t, key) {
    var c = cK(t, key);
    return '<td class="num calc" data-calc="' + key + 'S">' + calcPart(t, key, c, 'S') + '</td><td class="center calc" data-calc="' + key + 'N">' + calcPart(t, key, c, 'N') +
      '</td><td class="num calc" data-calc="' + key + 'P">' + calcPart(t, key, c, 'P') + '</td>';
  }
  /** Nội dung ô S, N, điểm của một dòng. Việc trong danh mục: ô N ghi mức N của mã (khối tự kê) hoặc hệ số tổng hợp (khối lãnh đạo). */
  function calcPart(t, key, c, part) {
    if (!c) return part === 'P' ? '<b></b>' : '';
    if (part === 'S') return c.s === '' ? '' : fmt(c.s);
    if (part === 'N') return (/^N[1-5]$/.test(c.n) ? '<span class="n n' + c.n.slice(1) + '">' + c.n + '</span>' : '<span class="n">' + h(c.n) + '</span>') +
      (t.code && key === 'm' ? '<div class="muted small" title="Hệ số tổng hợp từ H, Q, T">×' + fmt(KPI_factor(t, (E.d || {}).rule)) + '</div>' : '');
    return '<b>' + f4(c.point) + '</b>';
  }
  function blankMgrTask() { return { id: newId(), isNew: true, name: '', product: 'Công văn', qty: 1, month: E.months[E.months.length - 1], s: [0, 0, 0, 0, 0], m: [0, 0, 0, 0, 0], link: '', note: '' }; }
  function taskRow(t, ti) {
    var canAll = E.d.perms.canEdit, mgr = E.canMgr, selfScore = E.d.perms.selfScore, fixing = !!E.editing[t.id];
    var edit = (canAll && (!t.locked || (selfScore && fixing))) || (mgr && t.isNew); // cán bộ sửa việc chưa bị khoá; người tự chấm bấm Sửa để sửa việc đã chấm; người phụ trách sửa việc mình vừa thêm
    var mEdit = mgr && (!t.locked || fixing || t.isNew);                               // người phụ trách: việc đã chấm phải bấm Sửa mới đổi được
    var months = E.months.indexOf(t.month) < 0 && t.month ? E.months.concat([t.month]) : E.months;
    var name = edit ? '<textarea rows="3" data-fld="name" data-t="' + ti + '" placeholder="' + (t.isNew ? 'Tên công việc thêm cho cấp dưới' : 'Tên công việc (ghi thật rõ việc đã làm)') + '">' + h(t.name) + '</textarea>' +
      (t.isNew ? '' : '<div class="ev-add no-print"><input type="url" data-fld="link" data-t="' + ti + '" value="' + h(t.link || '') + '" placeholder="Đường dẫn minh chứng (không bắt buộc)">' +
        '</div>') :
      '<div class="tname">' + h(t.name) + '</div>' + (t.link ? '<a class="small" href="' + h(t.link) + '" target="_blank" rel="noopener">Minh chứng</a>' : '');
    var pc = KPI_calc(t.pm), tags = (t.locked ? '<span class="badge b-green" title="Người phụ trách đã chấm, cán bộ không sửa được">🔒 Đã chấm' + (t.mDate ? ' ' + h(t.mDate.slice(0, 5)) + ' ' + h(String(t.mTime || '').slice(0, 5)) : '') + '</span>' : '') +
      (t.isNew ? '<span class="badge b-amber">Việc mới, chưa lưu</span>' : '') + (t.by ? '<span class="badge b-purple">Người phụ trách thêm</span>' : '') +
      (!edit && t.repeat ? '<span class="badge b-blue">Lặp lại</span>' : '') + (t.from ? '<span class="badge b-gray">Từ ' + h(t.from) + '</span>' : '') +
      (pc ? '<span class="badge b-purple">Kỳ trước chấm ' + pc.n + ' · ' + fmt(pc.point) + 'đ</span>' : '');
    name += (edit && !t.isNew ? '<label class="chk small no-print"><input type="checkbox" data-fld="repeat" data-t="' + ti + '"' + (t.repeat ? ' checked' : '') + '>Việc lặp lại: tự đưa sang kỳ sau</label>' : '') + (tags ? '<div class="tags">' + tags + '</div>' : '') +
      (!mgr && t.note ? '<div class="mnote"><b>Nhận xét của người phụ trách:</b> ' + h(t.note) + '</div>' : '') + // người tự chấm thấy nhận xét ngay tại công việc
      extraHtml(t, ti, edit && !t.isNew);
    var cells = '<td class="center c-tt">' + (mgr ? '<label class="pick1"><input type="checkbox" data-sel="' + h(t.id) + '"' + (E.sel[t.id] ? ' checked' : '') + ' aria-label="Chọn công việc ' + (ti + 1) + '"><span>' + (ti + 1) + '</span></label>' : (ti + 1)) + '</td><td class="c-name">' + name + '</td>' +
      (edit ? (t.code ? '<td>' + h(t.product) + '</td>' : '<td><select data-fld="product" data-t="' + ti + '" aria-label="Sản phẩm">' + opts(M.products.map(function (x) { return [x, x]; }), t.product) + '</select></td>') +
        '<td><input type="number" min="0.01" step="any" data-fld="qty" data-t="' + ti + '" value="' + h(t.qty) + '" aria-label="Số lượng sản phẩm">' + (t.code && t.unit ? '<div class="muted small">' + h(t.unit) + '</div>' : '') + '</td>' +
        '<td><select data-fld="month" data-t="' + ti + '" aria-label="Tháng thực hiện">' + opts(months.map(function (x) { return [x, x]; }), t.month) + '</select></td>'
        : '<td>' + h(t.product) + '</td><td class="num">' + fmt(t.qty) + (t.code && t.unit ? '<div class="muted small">' + h(t.unit) + '</div>' : '') + '</td><td class="nowrap">' + h(t.month) + '</td>');
    for (var i = 0; i < 5; i++) cells += levelCell(t, ti, 's', i, edit && (!t.isNew || !!t.code));
    cells += calcCells(t, 's');
    if (E.showMgr) {
      for (var k = 0; k < 5; k++) cells += levelCell(t, ti, 'm', k, mEdit);
      cells += calcCells(t, 'm');
    }
    if (mgr) {
      cells += '<td class="c-note">' + (mEdit ? '<textarea rows="2" data-fld="note" data-t="' + ti + '" placeholder="Nhận xét cho việc này (không bắt buộc)" aria-label="Nhận xét cho công việc ' + (ti + 1) + '">' + h(t.note || '') + '</textarea>' + (t.code ? '<div class="tx mg hq"><b>Hệ số xác nhận</b><div class="hqt">' + hqtSel(t, ti, 'H') + hqtSel(t, ti, 'Q') + hqtSel(t, ti, 'T') + '</div></div>' : '') + confirmHtml(t, ti) : (t.note ? h(t.note) : '<span class="muted">–</span>')) + '</td>' +
        '<td class="no-print center nowrap">' + (mEdit ? '<button type="button" class="btn sm ok" data-act="scoreOne" data-t="' + ti + '">' + (t.code ? 'Xác nhận' : 'Chấm điểm') + '</button>' +
          (fixing && t.locked ? ' <button type="button" class="btn sm" data-act="editCancel" data-t="' + ti + '">Huỷ</button>' : '') +
          (t.isNew ? ' <button type="button" class="btn sm danger" title="Bỏ việc vừa thêm" data-act="taskDel" data-t="' + ti + '">×</button>' : '')
          : '<button type="button" class="btn sm" data-act="editRow" data-t="' + ti + '" title="Sửa lại kết quả đã chấm của việc này">Sửa</button>') + '</td>';
    } else if (canAll) cells += '<td class="no-print center nowrap">' + (selfScore && t.locked ? (fixing ? '<button type="button" class="btn sm" data-act="editCancel" data-t="' + ti + '">Huỷ</button>' : '<button type="button" class="btn sm" data-act="editRow" data-t="' + ti + '" title="Sửa lại việc đã chấm">Sửa</button>')
      : edit ? '<button type="button" class="btn sm danger" title="Xoá dòng này" data-act="taskDel" data-t="' + ti + '">×</button>' : '') + '</td>';
    return '<tr data-row="' + ti + '"' + (t.locked ? ' class="locked"' : '') + '>' + cells + '</tr>';
  }
  function tableHtml() {
    var edit = E.d.perms.canEdit, mgr = E.canMgr, fh = M.factors.map(function (f, i) { return '<th class="fh" title="' + h(f.name) + ' (trọng số ' + M.weights[i] + '%)"><b>' + f.key + '</b> – ' + h(f.name) + '</th>'; }).join('');
    var calcH = '<th class="num">S</th><th>N</th><th class="num">Điểm của N</th>';
    return '<div class="tbl-wrap sheet"><table class="tbl sheet"><thead><tr>' +
      '<th rowspan="2" class="c-tt">' + (mgr ? '<label class="pick1"><input type="checkbox" id="selAll" aria-label="Chọn tất cả công việc"><span>TT</span></label>' : 'TT') + '</th><th rowspan="2" class="c-name">Tên công việc</th><th rowspan="2">Sản phẩm</th><th rowspan="2">Số lượng sản phẩm</th><th rowspan="2">Tháng thực hiện</th>' +
      '<th colspan="5" class="g-self">Cán bộ tự đánh giá</th><th colspan="3" class="g-calc">Công thức tự tính toán</th>' +
      (E.showMgr ? '<th colspan="5" class="g-mgr">Lãnh đạo trực tiếp quản lý chấm</th><th colspan="3" class="g-calc">Công thức tự tính toán</th>' : '') +
      (mgr ? '<th rowspan="2" class="g-mgr">Nhận xét từng việc</th><th rowspan="2" class="no-print g-mgr">Chấm</th>' : edit ? '<th rowspan="2" class="no-print"></th>' : '') + '</tr><tr>' + fh + calcH + (E.showMgr ? fh + calcH : '') + '</tr></thead><tbody>' +
      (E.tasks.map(taskRow).join('') || '<tr><td colspan="30" class="muted center">Phiếu chưa có công việc nào.</td></tr>') + '</tbody>' +
      '<tfoot><tr><td class="c-tt"></td><td class="c-name">Tổng cộng: <span id="tCount"></span> công việc</td><td></td><td class="num" id="tQty"></td><td></td>' +
      '<td colspan="7" class="right">Tổng điểm tự chấm (số lượng × điểm của N)</td><td class="num" id="tSelf"></td>' +
      (E.showMgr ? '<td colspan="7" class="right">Tổng điểm các việc đã được chấm</td><td class="num" id="tMgr"></td>' : '') + (mgr ? '<td></td><td class="no-print"></td>' : edit ? '<td class="no-print"></td>' : '') + '</tr></tfoot></table></div>' +
      kpiStripHtml() +
      (mgr ? '<div class="actions no-print" style="margin-top:12px"><button class="btn ok" data-act="scoreSel">Xác nhận, chấm điểm các việc đã chọn</button><button class="btn primary" data-act="assignSel">Giao việc mới đã chọn (chưa chấm)</button><button class="btn warn" data-act="noteSel">Gửi nhận xét, cho sửa lại</button>' +
        '<button class="btn" data-act="mgrAdd">＋ Thêm việc ngoài danh mục (chấm A–E)</button>' +
        (E.tasks.some(function (t) { return KPI_calc(t.pm); }) ? '<button class="btn" data-act="fillMgr" data-src="pm">Lấy kết quả kỳ trước</button>' : '') + '<button class="btn" data-act="fillMgr" data-src="s">Lấy theo mức tự chấm</button></div>' : '') +
      (edit ? '<div class="actions no-print" style="margin-top:12px"><button class="btn" data-act="taskAdd">＋ Thêm việc ngoài danh mục (tự chấm A–E)</button><button class="btn" data-act="pasteOpen">Dán nhiều dòng từ Excel</button>' + ((E.d.myPeriods || []).length ? '<button class="btn" data-act="prevOpen">Lấy việc từ kỳ trước</button>' : '') + '</div>' : '');
  }
  function redrawTable(focusLast) {
    $('#taskBox').innerHTML = tableHtml();
    updateTotals();
    if (focusLast) { var ta = document.querySelectorAll('#taskBox textarea[data-fld="name"]'); if (ta.length) ta[ta.length - 1].focus(); }
  }
  /** Thẻ "Kết quả KPI" trên phiếu: việc tự thực hiện + kết quả của những người do người này phụ trách. */
  function teamHtml() {
    var d = E.d, team = d.team || [], k = d.kpi || { own: 0, total: 0, people: 0, done: 0 }, o = d.owner;
    if (!team.length) return '';
    var sub = Math.round((k.total - k.own) * 100) / 100;
    return '<div class="card"><h2>Kết quả KPI của ' + h(o.fullName) + ' · ' + h(d.period.name) + '</h2>' +
      '<div class="stats" style="margin-bottom:14px">' +
      '<div class="stat"><div class="v">' + (o.selfEval ? fmt(k.own) : '–') + '</div><div class="l">Việc tự thực hiện đã được chấm</div>' + (o.selfEval ? '<div class="x">' + E.tasks.filter(function (t) { return t.locked; }).length + '/' + E.tasks.filter(function (t) { return !t.isNew; }).length + ' việc đã chấm</div>' : '') + '</div>' +
      '<div class="stat"><div class="v">' + fmt(sub) + '</div><div class="l">Kết quả của ' + team.length + ' người do đồng chí phụ trách</div></div>' +
      '<div class="stat hl"><div class="v">' + fmt(k.total) + '</div><div class="l">Tổng KPI</div><div class="x">' + k.done + '/' + k.people + ' người trong phạm vi đã được đánh giá</div></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Người do đồng chí phụ trách</th><th>Cấp</th><th class="num">Số việc</th><th class="num">Điểm việc tự thực hiện</th><th class="num">Kết quả tính cho ' + h(o.fullName) + '</th><th>Trạng thái phiếu</th></tr></thead><tbody>' +
      team.map(function (r) {
        return '<tr class="click" data-act="open" data-u="' + h(r.user.id) + '"><td><b>' + h(r.user.fullName) + '</b><div class="muted small">' + h(r.user.title) + ' · ' + h(unitName(r.user.unitId)) + '</div></td><td>' + h(LEVEL[r.user.level]) + '</td>' +
          '<td class="num">' + (r.taskCount || '–') + '</td><td class="num">' + fmt(r.mgrTotal) + '</td><td class="num"><b>' + fmt(r.kpi) + '</b>' + (r.reports ? '<div class="muted small">gồm cả ' + r.reports + ' người cấp dưới</div>' : '') + '</td><td>' + badge(r.status) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td colspan="4" class="right">' + (o.selfEval ? 'Việc tự thực hiện ' + fmt(k.own) + ' + kết quả cấp dưới ' + fmt(sub) + ' = ' : 'Tổng kết quả cấp dưới = ') + '</td><td class="num">' + fmt(k.total) + '</td><td></td></tr></tfoot></table></div>' +
      '<p class="muted small" style="margin:10px 0 0">Kết quả của một người trong cây đánh giá gồm các việc tự thực hiện đã được chấm (kể cả việc cấp trên thêm) và kết quả của những người ở cây dưới. Việc nào được chấm thì được cộng ngay. Bấm vào một dòng để mở phiếu của người đó.</p></div>';
  }
  function evalHtml() {
    var d = E.d, p = d.perms, ev = d.ev, o = d.owner;
    if (ev.status === 'khong_ke') {
      return (o.id !== S.user.id ? '<p><a href="#/baocao">‹ Quay lại KPI tổng hợp</a></p>' : '') +
        '<div class="card"><h2>' + h(o.fullName) + '</h2><div class="muted">' + h(o.title) + ' · ' + h(unitName(o.unitId)) + ' · ' + h(LEVEL[o.level]) + '</div>' +
        '<p>Chức danh này không tự kê công việc. Kết quả KPI là tổng kết quả của những người do đồng chí phụ trách.</p></div>' + teamHtml();
    }
    var banner = '';
    if (d.period.phase === 'khoa') banner = '<div class="banner gray">Kỳ đánh giá đã khoá, phiếu chỉ xem.</div>';
    else if (ev.status === 'yeu_cau_sua') banner = '<div class="banner amber"><b>Phiếu được yêu cầu sửa.</b> ' + h(ev.mgrComment || '') + '</div>';
    else if (p.canScore && ev.status !== 'da_chot') banner = '<div class="banner blue">' + (ev.status === 'cho_duyet' ? 'Phiếu chờ anh/chị chấm. ' : 'Cán bộ chưa nộp phiếu, anh/chị vẫn chấm trước hoặc thêm việc được. ') + 'Tích ô đầu dòng các việc muốn chấm, chỉnh mức A–E ở khối “Lãnh đạo trực tiếp quản lý chấm” nếu cần, rồi bấm <b>Chấm điểm</b>. Việc lặp lại được điền sẵn kết quả chấm kỳ trước, việc khác điền theo mức cán bộ tự chọn; mức nào cũng đổi được.</div>';
    else if (ev.status === 'cho_duyet') banner = '<div class="banner blue">Phiếu đã nộp, đang chờ ' + h(d.managerName || 'người phụ trách') + ' đánh giá.</div>';
    else if (ev.status === 'da_chot') banner = '<div class="banner green">Kết quả đã được công nhận: <b>' + fmt(ev.finalTotal) + ' điểm' + (ev.rating ? ' – ' + h(ev.rating) : '') + '</b>' +
      (p.addOnly ? '. Các việc đã chấm (🔒) không sửa được; anh/chị vẫn có thể thêm việc mới rồi bấm “Nộp bổ sung” cho đến hạn chốt nhập.' : (o.id === S.user.id ? '. Muốn sửa việc đã chấm, đề nghị người phụ trách gửi nhận xét cho sửa lại.' : '')) + '</div>';
    if (o.id === S.user.id && d.period.phase === 'chot' && !p.canEdit && ev.status !== 'da_chot' && ev.status !== 'cho_duyet') banner += '<div class="banner amber">Kỳ này đã chốt nhập' + (d.period.deadline ? ' (hạn ' + fdate(d.period.deadline) + ')' : '') + ' nên anh/chị không nhập được nữa.</div>';
    if (p.selfScore && p.canEdit) banner += '<div class="banner blue">Đồng chí thuộc cấp trưởng đơn vị nên <b>tự chấm cho mình</b>: mức A–E tự chọn chính là kết quả và được tính vào KPI ngay khi bấm <b>Lưu và chấm điểm</b>. Việc đã chấm muốn đổi thì bấm <b>Sửa</b> ở cuối dòng, chỉnh lại rồi bấm Lưu và chấm điểm.</div>';
    if (E.note) banner += '<div class="banner blue">' + h(E.note) + '</div>';
    if (d.result) banner = '<div class="banner green">Kết quả xếp loại ' + h(d.period.name) + ': <b>' + h(d.result) + '</b></div>' + banner;
    if (p.canEdit && !d.managerName) banner += '<div class="banner amber">Anh/chị chưa được khai người phụ trách đánh giá nên chưa nộp được phiếu (vẫn lưu nháp được). Vui lòng liên hệ quản trị viên.</div>';
    var guide = p.canEdit ? '<details class="card guide no-print"' + (E.tasks.length <= 1 ? ' open' : '') + '><summary>Cách ghi phiếu' + (d.period.deadline ? ' · hạn chốt nhập <b>' + fdate(d.period.deadline) + '</b>' : '') + '</summary>' +
      '<ul><li><b>Tên công việc:</b> ' + h(HINT_NAME) + '</li><li><b>Số lượng sản phẩm:</b> ' + h(HINT_QTY) + '</li>' +
      '<li><b>Danh mục sản phẩm:</b> chọn loại sản phẩm (ví dụ Công văn), bấm <b>Thêm</b> ở sản phẩm đúng với việc đã làm, hoặc tích nhiều sản phẩm rồi bấm “Thêm các sản phẩm đã tích”. Điểm giao chuẩn = điểm chuẩn của mã × số lượng; người phụ trách xác nhận hệ số H (khối lượng), Q (chất lượng), T (tiến độ).</li>' +
      '<li><b>A, B, C, D, E:</b> với việc trong danh mục thì để trống (điểm theo mã); chỉ chọn đủ 5 mức khi muốn điều chỉnh điểm của việc đó. Với việc ngoài danh mục: chọn mức phù hợp cho từng công việc; S, mức N và điểm của N tự tính. Xem giải thích từng mức ở <a href="#/tieuchi">Bảng tiêu chí</a>.</li></ul></details>' : '';
    function commentBox(id, label, value, editable, placeholder) {
      if (editable) return '<label class="f"><span>' + label + '</span><textarea id="' + id + '" rows="2" placeholder="' + placeholder + '">' + h(value) + '</textarea></label>';
      return value ? '<p><b>' + label + ':</b> ' + h(value) + '</p>' : '';
    }
    var btns = '';
    if (p.canEdit) btns += (p.addOnly ? '' : '<button class="btn" data-act="saveSelf">Lưu nháp</button>') + '<button class="btn primary" data-act="saveSelf" data-submit="1">' + (p.selfScore ? 'Lưu và chấm điểm' : p.addOnly ? 'Nộp bổ sung' : 'Nộp phiếu') + '</button>';



    if (p.canReopen) btns += '<button class="btn warn" data-act="reopen">Mở lại để đánh giá lại</button>';
    btns += '<button class="btn" data-act="excelEval">Xuất Excel</button><button class="btn" data-act="print">In / Lưu PDF</button>';

    return '<div class="print-head"><b>' + h(S.config.orgName) + '</b><h2 style="margin-top:10px">BẢNG TỰ ĐÁNH GIÁ KẾT QUẢ CÔNG VIỆC</h2><div>' + h(d.period.name) + ' – ' + h(o.fullName) + ', ' + h(o.title) + ', ' + h(unitName(o.unitId)) + '</div></div>' +
      (o.id !== S.user.id ? '<p class="no-print"><a href="#/' + (S.hasReports ? 'duyet' : 'baocao') + '">‹ Quay lại danh sách</a></p>' : '') +
      '<div class="card no-print"><div class="actions" style="justify-content:space-between"><div><h2>' + h(o.fullName) + '</h2><div class="muted">' + h(o.title) + ' · ' + h(unitName(o.unitId)) + '</div><div class="muted small">Người phụ trách đánh giá: ' + (d.managerName ? '<b>' + h(d.managerName) + '</b>' : 'chưa khai') + '</div></div>' + badge(ev.status) + '</div></div>' +
      banner + guide +
      '<div class="card">' + (p.canEdit || p.canScore ? catBoxHtml() : '') + '<div id="taskBox">' + tableHtml() + '</div></div>' + teamHtml() +
      '<div class="card"><h2>Nhận xét</h2>' +
      (commentBox('selfComment', 'Tự nhận xét của cán bộ', ev.selfComment, p.canEdit, 'Không bắt buộc') +
        commentBox('mgrComment', 'Nhận xét chung của người phụ trách', ev.mgrComment, false, '') || '<div class="muted">Chưa có nhận xét.</div>') +
      '<div class="actions no-print" style="margin-top:8px">' + btns + '</div></div>' +
      '<div class="sign"><div><b>Người tự đánh giá</b></div><div></div><div><b>Lãnh đạo trực tiếp quản lý</b></div></div>' +
      (d.history.length ? '<div class="card no-print"><h2>Lịch sử xử lý</h2><ul class="hist">' + d.history.map(function (x) {
        return '<li><b>' + h(x.action) + '</b> · ' + h(x.userName) + ' <span class="muted">· ' + h(ftime(x.time)) + '</span>' + (x.note ? '<div class="muted">' + h(x.note) + '</div>' : '') + '</li>';
      }).join('') + '</ul></div>' : '');
  }
  function updateRow(ti) {
    var tr = $('tr[data-row="' + ti + '"]'), t = E.tasks[ti];
    if (!tr) return;
    ['s', 'm'].forEach(function (key) {
      var c = cK(t, key);
      var set = function (part, html) { var el = $('[data-calc="' + key + part + '"]', tr); if (el) el.innerHTML = html; };
      ['S', 'N', 'P'].forEach(function (part) { set(part, calcPart(t, key, c, part)); });
    });

  }
  function updateTotals() {
    if (!E) return;
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    var named = E.tasks.filter(function (t) { return t.name || t.code || KPI_calc(t.s); });
    set('tCount', named.length);
    set('tQty', fmt(named.reduce(function (s, t) { return s + (Number(t.qty) || 0); }, 0)));
    set('tSelf', f4(sumPoints('s')));
    set('tMgr', f4(Math.round(E.tasks.reduce(function (a, t) { var c = t.locked ? cK(t, 'm') : null; return a + (c ? (Number(t.qty) || 0) * c.point * (1 + (Number(t.mBonus) || 0) / 100) : 0); }, 0) * 10000) / 10000));
    updateKpiStrip();
  }
  /** Tách văn bản chép từ Excel (các ô cách nhau bằng tab, ô có xuống dòng nằm trong dấu nháy kép). */
  function parseTsv(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"' && cell === '') q = true;
      else if (c === '\t') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function levelOf(fi, text) {
    var v = String(text || '').trim().toLowerCase();
    if (/^[1-5]$/.test(v)) return +v;
    var levels = M.factors[fi].levels;
    for (var i = 0; i < levels.length; i++) if (levels[i][0].toLowerCase() === v) return i + 1;
    return 0;
  }
  function tasksFromPaste(text) {
    return parseTsv(text).map(function (r) {
      r = r.map(function (x) { return String(x).trim(); });
      if (/^(tt|stt)$/i.test(r[0]) || /^tên công việc/i.test(r[0]) || /^tên công việc/i.test(r[1] || '')) return null; // dòng tiêu đề
      if (r.length > 1 && /^\d+([.,]0+)?$/.test(r[0])) r = r.slice(1); // bỏ cột TT nếu có
      var name = r[0] || '';
      if (!name) return null;
      var t = blankTask();
      t.name = name.replace(/\s*\n\s*/g, ' ');
      if (M.products.indexOf(r[1]) >= 0) t.product = r[1]; else if (r[1]) t.product = 'Khác';
      var q = Number(String(r[2] || '').replace(',', '.'));
      if (q > 0) t.qty = q;
      if (/^T\d{1,2}\/\d{4}$/.test(r[3] || '')) t.month = r[3];
      for (var i = 0; i < 5; i++) t.s[i] = levelOf(i, r[4 + i]);
      return t;
    }).filter(Boolean);
  }
  async function exportEvalExcel() {
    if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    var d = E.d, fh = M.factors.map(function (f) { return f.key + ' - ' + f.name; }), blank5 = ['', '', '', '', ''];
    var lv = function (t, key) { return M.factors.map(function (f, i) { var v = (t[key] || [])[i]; return v ? f.levels[v - 1][0] : ''; }); };
    var cc = function (t, key) { var c = cK(t, key); return c ? [c.s, c.n, c.point] : ['', '', '']; };
    var cat = function (t) { var m = cK(t, 'm'), q = Number(t.qty) || 0; return t.code ? [t.code, t.unit || '', t.std, Math.round(t.std * q * 1e4) / 1e4, m ? t.H : '', m ? t.Q : '', m ? t.T : '', m ? Math.round(m.point * q * 1e4) / 1e4 : ''] : ['', '', '', '', '', '', '', '']; };
    var aoa = [
      ['TT', 'Tên công việc', 'Sản phẩm', 'Số lượng sản phẩm', 'Tháng thực hiện', 'Cán bộ tự đánh giá', '', '', '', '', 'Công thức tự tính toán', '', '', 'Lãnh đạo trực tiếp quản lý chấm', '', '', '', '', 'Công thức tự tính toán', '', ''],
      ['', '', '', '', ''].concat(fh, ['S', 'N', 'Điểm của N'], fh, ['S', 'N', 'Điểm của N'], ['Nhận xét của người đánh giá', 'Mã sản phẩm', 'Đơn vị tính', 'Điểm chuẩn', 'Điểm giao chuẩn (G)', 'H', 'Q', 'T', 'Điểm thực đạt (P)'])
    ].concat(E.tasks.map(function (t, i) {
      return [i + 1, t.name, t.product, Number(t.qty) || 0, t.month].concat(lv(t, 's'), cc(t, 's'), E.showMgr ? lv(t, 'm') : blank5, E.showMgr ? cc(t, 'm') : ['', '', ''], [t.note || ''], cat(t));
    }));
    aoa.push(['', 'Tổng điểm (số lượng × điểm của N)', '', '', '', '', '', '', '', '', '', '', sumPoints('s'), '', '', '', '', '', '', '', E.showMgr ? sumPoints('m') : '']);
    var ws = XLSX.utils.aoa_to_sheet(aoa), mg = function (r1, c1, r2, c2) { return { s: { r: r1, c: c1 }, e: { r: r2, c: c2 } }; };
    ws['!merges'] = [mg(0, 0, 1, 0), mg(0, 1, 1, 1), mg(0, 2, 1, 2), mg(0, 3, 1, 3), mg(0, 4, 1, 4), mg(0, 5, 0, 9), mg(0, 10, 0, 12), mg(0, 13, 0, 17), mg(0, 18, 0, 20)];
    ws['!cols'] = [6, 62, 13, 12, 11].concat([24, 24, 24, 24, 24, 7, 6, 10, 24, 24, 24, 24, 24, 7, 6, 10, 40]).map(function (w) { return { wch: w }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (d.owner.fullName || 'Phiếu').replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31));
    XLSX.writeFile(wb, 'KPI_' + (d.owner.fullName + '_' + d.period.name).replace(/[^\p{L}\p{N}]+/gu, '_') + '.xlsx');
  }
  function modelHtml() {
    return '<div class="card"><h2>Cách tính điểm một công việc</h2>' +
      '<p><b>S</b> = ' + M.factors.map(function (f, i) { return f.key + ' × ' + M.weights[i] + '%'; }).join(' + ') + ' (làm tròn 2 chữ số; mỗi tiêu chí lấy điểm 1–5 theo mức đã chọn).</p>' +
      '<div class="tbl-wrap"><table class="tbl" style="max-width:520px"><thead><tr><th>Mức N</th><th>Điểm S</th><th class="num">Điểm của N</th></tr></thead><tbody>' +
      M.nLevels.map(function (n, i) {
        var from = i ? M.nLevels[i - 1].below / 100 : 1, last = i === M.nLevels.length - 1;
        return '<tr><td><span class="n n' + (i + 1) + '">' + n.name + '</span></td><td>' + (i ? 'Từ ' + fmt(from) : 'Dưới ' + fmt(n.below / 100)) + (i && !last ? ' đến dưới ' + fmt(n.below / 100) : '') + (last ? ' đến 5' : '') + '</td><td class="num"><b>' + fmt(n.point) + '</b></td></tr>';
      }).join('') + '</tbody></table></div><p class="muted small">Tổng điểm của phiếu = tổng (số lượng sản phẩm × điểm của N) của tất cả công việc trong kỳ.</p></div>' +
      M.factors.map(function (f, i) {
        var full = f.levels[0].length > 1;
        return '<div class="card"><h2>Tiêu chí ' + f.key + ' – ' + h(f.name) + ' <span class="muted small" style="font-weight:400">· trọng số ' + M.weights[i] + '%</span></h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="num">Điểm</th><th>Mức</th>' +
          (full ? '<th>Cách diễn giải dễ hiểu</th><th>Ví dụ</th>' : '') + '</tr></thead><tbody>' + f.levels.map(function (l, k) {
            return '<tr><td class="num"><b>' + (k + 1) + '</b></td><td>' + h(l[0]) + '</td>' + (full ? '<td>' + h(l[1]) + '</td><td class="muted">' + h(l[2]) + '</td>' : '') + '</tr>';
          }).join('') + '</tbody></table></div></div>';
      }).join('');
  }

  /* ---------- KPI tổng hợp ---------- */
  var reportUnit = '';
  /** Xếp các dòng theo cây phụ trách; mỗi phần tử kèm độ sâu để thụt đầu dòng. */
  function treeRows(rows) {
    var byId = {}, kids = {}, out = [];
    rows.forEach(function (r) { byId[r.user.id] = r; });
    rows.forEach(function (r) { var m = byId[r.user.managerId] ? r.user.managerId : ''; (kids[m] || (kids[m] = [])).push(r); });
    (function walk(id, depth) {
      (kids[id] || []).sort(function (a, b) { return KPI_LEVELS[a.user.level].rank - KPI_LEVELS[b.user.level].rank || a.user.fullName.localeCompare(b.user.fullName, 'vi'); })
        .forEach(function (r) { out.push({ r: r, depth: depth }); if (depth < 30) walk(r.user.id, depth + 1); });
    })('', 0);
    return out;
  }
  /** Các đơn vị xếp theo cây, kèm độ sâu. */
  function unitTree() {
    var kids = {}, ids = {}, out = [];
    S.units.forEach(function (u) { ids[u.id] = true; });
    S.units.forEach(function (u) { var p = ids[u.parentId] ? u.parentId : ''; (kids[p] || (kids[p] = [])).push(u); });
    (function walk(id, depth) { (kids[id] || []).forEach(function (u) { out.push({ u: u, depth: depth }); if (depth < 30) walk(u.id, depth + 1); }); })('', 0);
    return out;
  }
  function unitStats(ov) {
    var tree = unitTree();
    return tree.map(function (x, i) {
      var inside = {}; inside[x.u.id] = true;
      for (var k = i + 1; k < tree.length && tree[k].depth > x.depth; k++) inside[tree[k].u.id] = true; // đơn vị con, cháu
      var rs = ov.rows.filter(function (r) { return r.user.selfEval && inside[r.user.unitId]; });
      var d = rs.filter(function (r) { return r.status === 'da_chot'; });
      var sum = Math.round(rs.reduce(function (s, r) { return s + (r.mgrTotal || 0); }, 0) * 100) / 100;
      return { u: x.u, depth: x.depth, people: rs.length, done: d.length, kpi: sum, avg: rs.length ? sum / rs.length : null };
    }).filter(function (x) { return x.people; });
  }
  function pad(depth) { return '<span style="display:inline-block;width:' + depth * 20 + 'px"></span>' + (depth ? '<span class="muted">└ </span>' : ''); }
  function reportHtml(ov) {
    var p = period();
    var list = reportUnit ? ov.rows.filter(function (r) { return r.user.unitId === reportUnit; }).map(function (r) { return { r: r, depth: 0 }; }) : treeRows(ov.rows);
    var units = S.units.filter(function (u) { return ov.rows.some(function (r) { return r.user.unitId === u.id; }); });
    var us = unitStats(ov);
    return '<div class="print-head"><b>' + h(S.config.orgName) + '</b><h2 style="margin-top:10px">BẢNG TỔNG HỢP KẾT QUẢ KPI</h2><div>' + h(p.name) + (reportUnit ? ' – ' + h(unitName(reportUnit)) : '') + '</div></div>' +
      '<div class="card"><div class="actions no-print" style="margin-bottom:14px">' +
      (units.length > 1 ? '<select id="reportUnit" style="width:auto"><option value="">Theo cây phụ trách (tất cả)</option>' + units.map(function (u) { return '<option value="' + h(u.id) + '"' + (u.id === reportUnit ? ' selected' : '') + '>' + h(u.name) + '</option>'; }).join('') + '</select>' : '') +
      '<button class="btn primary" data-act="excel">Xuất Excel</button><button class="btn" data-act="print">In / Lưu PDF</button></div>' +
      '<h2>Theo cá nhân</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Họ và tên</th><th>Chức vụ</th><th>Đơn vị</th><th>Cấp</th><th class="num">Số việc</th><th class="num">Tự chấm</th><th class="num">Đã được chấm</th><th class="num">KPI tổng hợp</th><th class="num">Số người / đã đánh giá</th><th class="num">Quy đổi bình quân</th><th>Trạng thái</th></tr></thead><tbody>' +
      (list.map(function (x) {
        var r = x.r;
        return '<tr class="click" data-act="open" data-u="' + h(r.user.id) + '"><td>' + pad(x.depth) + '<b>' + h(r.user.fullName) + '</b></td><td>' + h(r.user.title) + '</td><td>' + h(unitName(r.user.unitId)) + '</td><td>' + h(LEVEL[r.user.level]) + '</td>' +
          '<td class="num">' + (r.taskCount || '–') + '</td><td class="num">' + fmt(r.selfTotal) + '</td><td class="num">' + fmt(r.mgrTotal) + '</td><td class="num"><b>' + fmt(r.kpi) + '</b></td>' +
          '<td class="num">' + r.people + ' / ' + r.done + '</td><td class="num">' + fmt(r.people ? r.kpi / r.people : null) + '</td><td>' + badge(r.status) + '</td></tr>';
      }).join('') || '<tr><td colspan="11" class="muted center">Không có dữ liệu.</td></tr>') + '</tbody></table></div>' +
      '<p class="muted small">KPI tổng hợp = điểm phiếu của chính người đó đã được công nhận + KPI của những người do người đó phụ trách. Quy đổi bình quân = KPI tổng hợp ÷ số người tự kê công việc trong phạm vi.</p></div>' +
      '<div class="card"><h2>Theo đơn vị</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Đơn vị</th><th class="num">Số người tự kê</th><th class="num">Đã đánh giá</th><th class="num">Tổng KPI</th><th class="num">Quy đổi bình quân một người</th></tr></thead><tbody>' +
      (us.map(function (x) {
        return '<tr><td>' + pad(x.depth) + '<b>' + h(x.u.name) + '</b> <span class="muted small">' + h(x.u.id) + '</span></td><td class="num">' + x.people + '</td><td class="num">' + x.done + '</td><td class="num"><b>' + fmt(x.kpi) + '</b></td><td class="num">' + fmt(x.avg) + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted center">Không có dữ liệu.</td></tr>') + '</tbody></table></div>' +
      '<p class="muted small">Tổng KPI của đơn vị gồm cả các đơn vị trực thuộc.</p></div>';
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Không tải được thư viện xuất Excel.')); };
      document.head.appendChild(s);
    });
  }
  async function exportExcel() {
    var ov = await overview(), p = period();
    if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    var head = ['TT', 'Họ và tên', 'Chức vụ', 'Đơn vị', 'Cấp', 'Người phụ trách', 'Số công việc', 'Điểm tự chấm', 'Điểm đã được chấm', 'KPI tổng hợp', 'Số người trong phạm vi', 'Đã đánh giá', 'Quy đổi bình quân', 'Trạng thái'];
    var names = {};
    ov.rows.forEach(function (r) { names[r.user.id] = r.user.fullName; });
    var data = treeRows(ov.rows).map(function (x, i) {
      var r = x.r;
      return [i + 1, new Array(x.depth + 1).join('   ') + r.user.fullName, r.user.title, unitName(r.user.unitId), LEVEL[r.user.level], names[r.user.managerId] || '', r.taskCount || 0, r.selfTotal, r.mgrTotal, r.kpi, r.people, r.done, r.people ? Math.round(r.kpi / r.people * 100) / 100 : '', (STATUS[r.status] || [r.status])[0]];
    });
    var ws = XLSX.utils.aoa_to_sheet([[S.config.orgName], ['BẢNG TỔNG HỢP KẾT QUẢ KPI – ' + p.name.toUpperCase()], [], head].concat(data));
    ws['!cols'] = [5, 30, 22, 26, 18, 24, 12, 12, 16, 13, 14, 12, 14, 16].map(function (w) { return { wch: w }; });
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } }];
    var ws2 = XLSX.utils.aoa_to_sheet([['Mã đơn vị', 'Đơn vị', 'Số người tự kê', 'Đã đánh giá', 'Tổng KPI', 'Quy đổi bình quân một người']].concat(unitStats(ov).map(function (x) {
      return [x.u.id, new Array(x.depth + 1).join('   ') + x.u.name, x.people, x.done, x.kpi, x.avg == null ? '' : Math.round(x.avg * 100) / 100];
    })));
    ws2['!cols'] = [14, 40, 14, 12, 12, 24].map(function (w) { return { wch: w }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Theo cá nhân');
    XLSX.utils.book_append_sheet(wb, ws2, 'Theo đơn vị');
    XLSX.writeFile(wb, 'KPI_' + p.name.replace(/[^\p{L}\p{N}]+/gu, '_') + '.xlsx');
  }

  /* ---------- Quản trị ---------- */
  function yn(v) { return v ? 'Có' : '<span class="muted">Không</span>'; }
  function unitOpts(blank) { return (blank ? [['', blank]] : []).concat(unitTree().map(function (x) { return [x.u.id, new Array(x.depth + 1).join('— ') + x.u.name + ' (' + x.u.id + ')']; })); }
  function userName(id) { var u = (ADMIN ? ADMIN.users : []).filter(function (x) { return x.id === id; })[0]; return u ? u.fullName : ''; }
  function managerOpts(selfId) {
    return [['', '(chưa khai)']].concat(ADMIN.users.filter(function (u) { return u.active && u.id !== selfId && KPI_LEVELS[u.level].rank <= KPI_LEVELS.pho.rank; })
      .sort(function (a, b) { return KPI_LEVELS[a.level].rank - KPI_LEVELS[b.level].rank || a.fullName.localeCompare(b.fullName, 'vi'); })
      .map(function (u) { return [u.id, u.fullName + ' – ' + (u.title || LEVEL[u.level]) + ', ' + unitName(u.unitId)]; }));
  }
  var ADM = {
    users: {
      table: 'Users', label: 'Người dùng', add: 'Thêm người dùng', list: function () {
        var order = {}; unitTree().forEach(function (x, i) { order[x.u.id] = i; });
        return ADMIN.users.slice().sort(function (a, b) { return (order[a.unitId] || 0) - (order[b.unitId] || 0) || KPI_LEVELS[a.level].rank - KPI_LEVELS[b.level].rank || a.fullName.localeCompare(b.fullName, 'vi'); });
      },
      cols: [['fullName', 'Họ tên'], ['id', 'CCCD'], ['title', 'Chức vụ'], ['unitId', 'Đơn vị', unitName], ['phone', 'Điện thoại'], ['level', 'Cấp', function (v) { return LEVEL[v]; }],
        ['managerId', 'Người phụ trách đánh giá', function (v) { return v ? h(userName(v) || v) : '<span class="badge b-amber">chưa khai</span>'; }, 1], ['selfEval', 'Tự kê', yn, 1], ['isAdmin', 'Quản trị', yn, 1], ['active', 'Hoạt động', yn, 1]],
      blank: function () { return { level: 'canbo', selfEval: true, active: true, unitId: (S.units[0] || {}).id, managerId: '' }; },
      fields: function (cur, isNew) {
        return [['id', 'Số CCCD (dùng làm tên đăng nhập)', isNew ? 'text' : 'readonly'], ['fullName', 'Họ và tên', 'text'], ['title', 'Chức vụ', 'text'], ['unitId', 'Đơn vị', 'select', unitOpts()],
          ['phone', 'Số điện thoại', 'text'], ['email', 'Email', 'text'],
          ['level', 'Cấp trong cây phụ trách', 'select', Object.keys(LEVEL).map(function (k) { return [k, LEVEL[k]]; })],
          ['managerId', 'Người phụ trách đánh giá (cấp phó trở lên)', 'select', managerOpts(cur.id)],
          ['selfEval', 'Tự kê công việc và tự đánh giá (trưởng đơn vị, thủ trưởng thường không chọn)', 'check'], ['isAdmin', 'Có quyền quản trị hệ thống', 'check'],
          ['isStaff', 'Tham mưu tổng hợp xếp loại (thấy bảng xếp loại toàn cơ quan, nhập tiêu chí chung, trình biểu quyết, chốt)', 'check'],
          ['isVoter', 'Thành viên tập thể lãnh đạo biểu quyết xếp loại', 'check'], ['active', 'Đang hoạt động', 'check']];
      },
      wire: function (form) { // đổi cấp thì đặt lại mặc định "tự kê"
        form.elements.level.addEventListener('change', function () { form.elements.selfEval.checked = KPI_LEVELS[form.elements.level.value].selfEval; });
      }
    },
    units: {
      table: 'Units', label: 'Đơn vị', add: 'Thêm đơn vị', list: function () { return unitTree().map(function (x) { return Object.assign({ depth: x.depth }, x.u); }); },
      cols: [['id', 'Mã đơn vị'], ['name', 'Tên đơn vị', function (v, r) { return pad(r.depth) + '<b>' + h(v) + '</b>'; }, 1], ['parentId', 'Đơn vị cha', function (v) { return v ? unitName(v) + ' (' + v + ')' : '(cấp cao nhất)'; }], ['order', 'Thứ tự']],
      blank: function () { return { order: S.units.length + 1, parentId: (S.units[0] || {}).id || '' }; },
      fields: function (cur, isNew) {
        return [['id', 'Mã đơn vị (chữ không dấu, số; ví dụ VP, BAN-TC)', isNew ? 'text' : 'readonly'], ['name', 'Tên đơn vị', 'text'],
          ['parentId', 'Đơn vị cha', 'select', unitOpts('(cấp cao nhất)').filter(function (o) { return o[0] !== cur.id; })], ['order', 'Thứ tự hiển thị', 'number']];
      }
    },
    periods: {
      table: 'Periods', label: 'Kỳ đánh giá', add: 'Thêm kỳ đánh giá', list: function () { return S.periods; },
      cols: [['name', 'Tên kỳ'], ['type', 'Loại', function (v) { return TYPE[v] || v; }], ['startDate', 'Từ ngày', fdate], ['endDate', 'Đến ngày', fdate], ['deadline', 'Hạn nộp', fdate],
        ['status', 'Trạng thái', function (v, r) { var ph = r.phase; return ph === 'mo' ? '<span class="badge b-green">Đang mở nhập</span>' : ph === 'chot' ? '<span class="badge b-amber">Đã chốt nhập' + (v === 'mo' ? ' (quá hạn)' : '') + '</span>' : '<span class="badge b-gray">Đã khoá</span>'; }, 1]],
      blank: function () { return { type: 'thang', status: 'mo' }; },
      fields: function () {
        return [['name', 'Tên kỳ (ví dụ: Tháng 12/2026, Quý IV/2026)', 'text'], ['type', 'Loại kỳ', 'select', Object.keys(TYPE).map(function (k) { return [k, TYPE[k]]; })],
          ['startDate', 'Từ ngày', 'date'], ['endDate', 'Đến ngày', 'date'], ['deadline', 'Hạn chốt nhập (sau ngày này cán bộ không nhập được; mặc định ngày cuối kỳ)', 'date'], ['status', 'Trạng thái', 'select', [['mo', 'Đang mở (tự chốt nhập sau hạn)'], ['chot', 'Đã chốt nhập: cán bộ không nhập, người phụ trách vẫn chấm'], ['khoa', 'Đã khoá hẳn']]]];
      }
    }
  };
  var IMPORT = {
    users: { title: 'Dán danh sách người dùng từ Excel', cols: 'CCCD, Mã đơn vị, Họ tên, Chức vụ, Số điện thoại, Email, Cấp (không bắt buộc), CCCD người phụ trách (không bắt buộc)',
      note: 'Bỏ trống cột Cấp thì hệ thống đoán theo chức vụ (bắt đầu bằng “Phó” → Phó đơn vị; “Trưởng”, “Chánh” → Trưởng đơn vị; “Chủ tịch” → Thủ trưởng cơ quan; còn lại → Cá nhân), sau đó sửa lại được.' },
    units: { title: 'Dán danh sách đơn vị từ Excel', cols: 'Mã đơn vị, Tên đơn vị, Mã đơn vị cha (không bắt buộc)', note: 'Đơn vị cha phải nằm ở dòng phía trên hoặc đã có sẵn.' }
  };
  function levelFrom(text, title) {
    var v = String(text || '').trim().toLowerCase();
    for (var k in LEVEL) if (k === v || LEVEL[k].toLowerCase() === v) return k;
    var t = String(title || '').trim().toLowerCase();
    if (/^phó/.test(t)) return 'pho';
    if (/^(trưởng|chánh)/.test(t)) return 'truong';
    if (/^chủ tịch/.test(t)) return 'thutruong';
    return 'canbo';
  }
  function cccd(v) { v = String(v || '').replace(/[\s'.]/g, ''); return /^\d{11}$/.test(v) ? '0' + v : v; } // Excel hay làm mất số 0 đầu
  function rowsFromPaste(tab, text) {
    return parseTsv(text).map(function (r) {
      r = r.map(function (x) { return String(x).trim(); });
      if (!r[0] || /^(cccd|mã|stt|tt|số)/i.test(r[0])) return null; // dòng trống, dòng tiêu đề
      if (tab === 'units') return { id: r[0], name: r[1] || '', parentId: r[2] || '', order: 0 };
      return { id: cccd(r[0]), unitId: r[1] || '', fullName: r[2] || '', title: r[3] || '', phone: r[4] || '', email: r[5] || '', level: levelFrom(r[6], r[3]), managerId: cccd(r[7]) };
    }).filter(Boolean);
  }
  function treeHtml() {
    var kids = {}, ids = {};
    var users = ADMIN.users.filter(function (u) { return u.active; });
    users.forEach(function (u) { ids[u.id] = true; });
    users.forEach(function (u) { var m = ids[u.managerId] ? u.managerId : ''; (kids[m] || (kids[m] = [])).push(u); });
    function node(u) {
      var c = (kids[u.id] || []).sort(function (a, b) { return KPI_LEVELS[a.level].rank - KPI_LEVELS[b.level].rank || a.fullName.localeCompare(b.fullName, 'vi'); });
      return '<li><b>' + h(u.fullName) + '</b> <span class="muted">' + h(u.title) + ' · ' + h(unitName(u.unitId)) + '</span> <span class="badge b-gray">' + h(LEVEL[u.level]) + '</span>' +
        (u.selfEval ? '' : ' <span class="badge b-blue">không tự kê</span>') + (c.length ? '<ul>' + c.map(node).join('') + '</ul>' : '') + '</li>';
    }
    var roots = kids[''] || [], top = roots.filter(function (u) { return (kids[u.id] || []).length; }), loose = roots.filter(function (u) { return !(kids[u.id] || []).length; });
    return '<div class="card"><h2>Cây phụ trách đánh giá</h2><p class="muted small">Người ở dòng trên đánh giá phiếu của những người thụt vào ngay bên dưới. Muốn thay đổi, vào tab Người dùng, bấm Sửa và chọn lại “Người phụ trách đánh giá”.</p>' +
      (top.length ? '<ul class="tree">' + top.map(node).join('') + '</ul>' : '<div class="muted">Chưa khai quan hệ phụ trách nào.</div>') + '</div>' +
      (loose.length ? '<div class="card"><h2>Chưa có người phụ trách (' + loose.length + ')</h2><p class="muted small">Những người tự kê công việc trong danh sách này chưa nộp được phiếu cho đến khi được khai người phụ trách. Người đứng đầu cơ quan không cần khai.</p><ul class="tree">' + loose.map(node).join('') + '</ul></div>' : '');
  }
  function adminHtml(tab) {
    var tabNames = { users: 'Người dùng', units: 'Đơn vị', tree: 'Cây phụ trách', periods: 'Kỳ đánh giá', catalog: 'Danh mục sản phẩm', config: 'Xếp loại, cơ quan' };
    if (!tabNames[tab]) tab = 'users';
    var tabs = '<div class="tabs">' + Object.keys(tabNames).map(function (k) { return '<button data-act="tab" data-t="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + tabNames[k] + '</button>'; }).join('') + '</div>';
    if (tab === 'tree') return tabs + treeHtml();
    if (tab === 'catalog') return tabs + catAdminHtml();
    if (tab === 'config') {
      var rs = (S.config.ratings || []).concat([{ name: '', min: '' }]);
      return tabs + '<div class="card" style="max-width:640px"><label class="f"><span>Tên cơ quan (hiện trên phiếu, báo cáo)</span><input type="text" id="cfgOrg" value="' + h(S.config.orgName) + '"></label>' +
        '<h3 style="margin:8px 0">Mức xếp loại theo điểm phiếu cá nhân (không bắt buộc)</h3><table class="tbl"><thead><tr><th>Tên mức xếp loại</th><th class="num">Từ điểm</th></tr></thead><tbody>' +
        rs.map(function (r) { return '<tr data-rating><td><input type="text" value="' + h(r.name) + '" placeholder="Thêm mức mới (không bắt buộc)"></td><td class="num"><input type="number" min="0" step="any" value="' + h(r.min) + '"></td></tr>'; }).join('') +
        '</tbody></table><p class="muted small">Để trống nếu cơ quan chưa quy định xếp loại. Nếu đặt: mức thấp nhất luôn tính từ 0 điểm; xoá tên để bỏ một mức.</p>' +
        '<h3 style="margin:16px 0 8px">Ngưỡng xếp loại chất lượng theo kỳ</h3>' + [['quota', 'Số người xuất sắc không quá bao nhiêu % số người từ “Hoàn thành tốt” trở lên'], ['minScore', 'Tổng điểm (thang 100) tối thiểu để xét xuất sắc'],
          ['minOver', 'Tỷ lệ % nhiệm vụ vượt mức tối thiểu để xét xuất sắc'], ['common', 'Điểm tối đa của nhóm tiêu chí chung (phần còn lại của thang 100 là kết quả nhiệm vụ)'], ['maxBonus', 'Điểm thưởng tối đa của một công việc (% điểm công việc đó)'],
          ['wH', 'Tỷ trọng khối lượng (H) trong điểm thực đạt P = G × H × (wH + wQ×Q + wT×T) / (wH + wQ + wT)'], ['wQ', 'Tỷ trọng chất lượng (Q); ví dụ 1-1-1 là chia đều, 25-50-25 là ưu tiên chất lượng'], ['wT', 'Tỷ trọng tiến độ (T)']]
          .map(function (x) { return '<label class="f"><span>' + x[1] + '</span><input type="number" min="0" max="100" step="any" data-rule="' + x[0] + '" value="' + h((S.config.rule || {})[x[0]]) + '"></label>'; }).join('') +
        '<button class="btn primary" data-act="saveConfig">Lưu cấu hình</button></div>';
    }
    var def = ADM[tab], list = def.list();
    return tabs + '<div class="card"><div class="actions" style="justify-content:flex-end;margin-bottom:12px">' +
      (IMPORT[tab] ? '<button class="btn" data-act="importOpen" data-t="' + tab + '">Dán danh sách từ Excel</button>' : '') +
      '<button class="btn primary" data-act="admAdd" data-t="' + tab + '">' + def.add + '</button></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + def.cols.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
      (list.map(function (r) {
        return '<tr>' + def.cols.map(function (c) { var v = r[c[0]]; return '<td>' + (c[2] ? (c[3] ? c[2](v, r) : h(c[2](v, r))) : h(v)) + '</td>'; }).join('') +
          '<td class="right nowrap"><button class="btn sm" data-act="admEdit" data-t="' + tab + '" data-id="' + h(r.id) + '">Sửa</button> ' +
          (tab === 'users' ? '<button class="btn sm" data-act="admReset" data-id="' + h(r.id) + '">Cấp lại mật khẩu</button> ' : '') +
          '<button class="btn sm danger" data-act="admDel" data-t="' + tab + '" data-id="' + h(r.id) + '">Xoá</button></td></tr>';
      }).join('') || '<tr><td colspan="' + (def.cols.length + 1) + '" class="muted center">Chưa có dữ liệu.</td></tr>') + '</tbody></table></div></div>';
  }
  function formDialog(title, fields, val, wire) {
    return new Promise(function (resolve) {
      modal.innerHTML = '<form class="dlg"><h2>' + h(title) + '</h2>' + fields.map(function (f) {
        var k = f[0], v = val[k];
        if (f[2] === 'check') return '<label class="chk"><input type="checkbox" name="' + k + '"' + (v ? ' checked' : '') + '>' + h(f[1]) + '</label>';
        var input;
        if (f[2] === 'select') input = '<select name="' + k + '">' + f[3].map(function (o) { return '<option value="' + h(o[0]) + '"' + (String(o[0]) === String(v == null ? '' : v) ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join('') + '</select>';
        else if (f[2] === 'readonly') input = '<input type="text" name="' + k + '" value="' + h(v) + '" readonly style="background:#f3f0ed">';
        else if (f[2] === 'textarea') input = '<textarea name="' + k + '" rows="3">' + h(v) + '</textarea>';
        else input = '<input type="' + f[2] + '" name="' + k + '" value="' + h(v) + '"' + (f[2] === 'number' ? ' step="any"' : '') + '>';
        return '<label class="f"><span>' + h(f[1]) + '</span>' + input + '</label>';
      }).join('') + '<div class="actions"><button type="button" class="btn" data-x>Huỷ</button><button class="btn primary">Lưu</button></div></form>';
      var form = $('form', modal);
      $('[data-x]', form).onclick = function () { modal.innerHTML = ''; resolve(null); };
      form.onsubmit = function (ev) {
        ev.preventDefault();
        var out = {};
        fields.forEach(function (f) { var el = form.elements[f[0]]; out[f[0]] = f[2] === 'check' ? el.checked : el.value; });
        resolve({ values: out, button: $('button.primary', form) });
      };
      if (wire) wire(form);
      var first = $('input:not([readonly]),select,textarea', form);
      if (first) first.focus();
    });
  }
  function showPassword(title, user, pass, usedDefault) {
    if (usedDefault || !pass) {
      modal.innerHTML = '<div class="dlg"><h2>' + h(title) + '</h2><p><b>' + h(user) + '</b> dùng <b>mật khẩu mặc định của cơ quan</b> và phải đổi mật khẩu khi đăng nhập lần đầu.</p><div class="actions"><button class="btn primary" data-act="closeModal">Đóng</button></div></div>';
      return;
    }
    modal.innerHTML = '<div class="dlg"><h2>' + h(title) + '</h2><p>Mật khẩu tạm của <b>' + h(user) + '</b> (chỉ hiện một lần, hãy gửi cho cán bộ):</p><code class="big">' + h(pass) + '</code>' +
      '<p class="muted small">Cán bộ sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.</p><div class="actions"><button class="btn primary" data-act="closeModal">Đã ghi lại</button></div></div>';
  }
  async function refreshBoot() { setBoot(await api('bootstrap')); }
  async function adminEdit(tab, id) {
    var def = ADM[tab], isNew = !id;
    var cur = id ? def.list().filter(function (r) { return r.id === id; })[0] : def.blank();
    for (;;) {
      var res = await formDialog(isNew ? def.add : 'Sửa: ' + (cur.fullName || cur.name), def.fields(cur, isNew), cur, def.wire);
      if (!res) return;
      cur = Object.assign({}, cur, res.values);
      try {
        res.button.disabled = true;
        var out = await api('adminSave', { table: def.table, row: cur, isNew: isNew });
        modal.innerHTML = '';
        await refreshBoot();
        await render();
        if (out.tempPassword || out.usedDefault) showPassword('Đã tạo tài khoản', cur.fullName + ' (' + cur.id + ')', out.tempPassword, out.usedDefault);
        else toast('Đã lưu.');
        return;
      } catch (e) { toast(e.message, true); }
    }
  }

  /* ---------- Đổi mật khẩu ---------- */
  function passwordHtml() {
    return (S.user.mustChange ? '<div class="banner amber">Đây là lần đăng nhập đầu tiên bằng mật khẩu tạm. Anh/chị cần đặt mật khẩu mới để tiếp tục.</div>' : '') +
      '<form class="card" id="pwForm" style="max-width:420px">' +
      '<label class="f"><span>Mật khẩu hiện tại</span><input type="password" name="oldPassword" autocomplete="current-password" required></label>' +
      '<label class="f"><span>Mật khẩu mới (ít nhất 8 ký tự)</span><input type="password" name="newPassword" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="f"><span>Nhập lại mật khẩu mới</span><input type="password" name="again" autocomplete="new-password" required></label>' +
      '<button class="btn primary">Đổi mật khẩu</button></form>';
  }

  /* ---------- Xử lý thao tác ---------- */
  var ACT = {
    logout: function () { logout(); },
    toggleSide: function () { // ẩn/hiện bảng bên trái, nhớ lựa chọn cho lần sau
      var off = !sideOff();
      try { localStorage.setItem('kpi_side', off ? 'off' : 'on'); } catch (e) { /* không lưu được thì chỉ đổi trong phiên này */ }
      var sh = $('.shell');
      if (sh) sh.classList.toggle('side-off', off);
    },
    dashUnit: function (el) {
      var own = !!el.dataset.own;
      DASH = DASH.type === 'unit' && DASH.id === el.dataset.id && !!DASH.own === own ? { type: '', id: '' } : { type: 'unit', id: el.dataset.id, own: own };
      redrawDash();
    },
    dashHist: function (el) { DASH = DASH.type === 'hist' && DASH.id === el.dataset.u ? { type: '', id: '' } : { type: 'hist', id: el.dataset.u }; redrawDash(); },
    rankAll: function () { RANK_ALL = !RANK_ALL; redrawDash(); },
    dashUser: function (el) { DASH = { type: 'user', id: el.dataset.u }; redrawDash(); },
    dashBack: function () { DASH = { type: '', id: '' }; redrawDash(); },
    copyRemind: function () {
      var text = remindText(S.ov).text;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Đã chép nội dung nhắc nhở.'); }, function () {
        modal.innerHTML = '<div class="dlg"><h2>Nội dung nhắc nhở</h2><textarea rows="12" readonly>' + h(text) + '</textarea><div class="actions"><button class="btn primary" data-act="closeModal">Đóng</button></div></div>';
      });
    },
    fillMgr: function (el) { // người phụ trách điền nhanh: theo kết quả kỳ trước hoặc theo mức cán bộ tự chấm
      var n = 0;
      E.tasks.forEach(function (t) { var src = el.dataset.src === 'pm' ? t.pm : t.s; if (KPI_calc(src)) { t.m = src.slice(); n++; } });
      redrawTable();
      toast(el.dataset.src === 'pm' ? 'Đã lấy kết quả kỳ trước cho ' + n + ' công việc.' : 'Đã điền theo mức cán bộ tự chấm.');
    },
    redo: function (el) {
      var note = prompt('Cho ' + E.d.owner.fullName + ' đánh giá lại phiếu này. Ghi lý do hoặc nội dung cần sửa:');
      if (note === null) return;
      run(el, async function () {
        var d = await api('review', { evalId: E.d.ev.id, decision: 'redo', comment: note });
        S.ov = null; S.st = null;
        setEval(d);
        toast('Đã mở cho cán bộ đánh giá lại.');
      });
    },
    prevOpen: function () {
      var ps = E.d.myPeriods || [];
      modal.innerHTML = '<div class="dlg" style="max-width:760px"><h2>Lấy công việc từ kỳ trước</h2><label class="f"><span>Chọn kỳ</span><select id="prevSel">' +
        ps.map(function (x) { return '<option value="' + h(x.id) + '">' + h(x.name) + ' (' + x.taskCount + ' việc)</option>'; }).join('') + '</select></label>' +
        '<div id="prevList" class="muted">Đang tải…</div><div class="actions"><button class="btn" data-act="closeModal">Huỷ</button><button class="btn primary" data-act="prevApply">Chuyển sang kỳ này</button></div></div>';
      loadPrev();
    },
    prevApply: function () {
      var add = [];
      document.querySelectorAll('#prevList input[type=checkbox]').forEach(function (c) { if (c.checked && c.dataset.i) add.push(PREV[+c.dataset.i]); });
      if (!add.length) return toast('Chưa chọn công việc nào.', true);
      E.tasks = E.tasks.filter(function (t) { return t.name || t.code || KPI_calc(t.s); }).concat(add);
      modal.innerHTML = '';
      redrawTable();
      toast('Đã chuyển ' + add.length + ' công việc sang kỳ này, kèm mức tự chấm.');
    },
    closeModal: function () { modal.innerHTML = ''; },
    print: function () { window.print(); },
    open: function (el) { location.hash = el.dataset.u === S.user.id && S.user.selfEval ? '#/tudanhgia' : '#/phieu/' + encodeURIComponent(el.dataset.u); },
    tab: function (el) { location.hash = '#/quantri/' + el.dataset.t; },
    excel: function (el) { run(el, exportExcel); },

    taskAdd: function () { E.tasks.push(blankTask()); redrawTable(true); },
    mgrAdd: function () { var t = blankMgrTask(); E.tasks.push(t); E.sel[t.id] = true; E.showMgr = true; redrawTable(true); },
    editRow: function (el) { // mở một việc đã chấm để sửa lại kết quả
      var t = E.tasks[+el.dataset.t];
      E.orig[t.id] = JSON.parse(JSON.stringify(t));
      E.editing[t.id] = true;
      if (E.canMgr) E.sel[t.id] = true;
      redrawTable();
    },
    editCancel: function (el) { // bỏ các thay đổi đang sửa dở của việc đó
      var i = +el.dataset.t, t = E.tasks[i];
      if (E.orig[t.id]) E.tasks[i] = E.orig[t.id];
      delete E.editing[t.id]; delete E.orig[t.id];
      if (E.canMgr) E.sel[t.id] = false;
      redrawTable();
    },
    scoreOne: function (el) { doScore([+el.dataset.t], 'score', el); },
    scoreSel: function (el) { doScore(selectedRows(), 'score', el); },
    noteSel: function (el) { doScore(selectedRows(), 'note', el); },
    taskDel: function (el) {
      var t = E.tasks[+el.dataset.t];
      if ((t.name || t.code || KPI_calc(t.s)) && !confirm('Xoá công việc số ' + (+el.dataset.t + 1) + '?')) return;
      E.tasks.splice(+el.dataset.t, 1);
      redrawTable();
    },
    pasteOpen: function () {
      modal.innerHTML = '<div class="dlg" style="max-width:720px"><h2>Dán nhiều dòng từ Excel</h2>' +
        '<p class="small">Trong tệp Excel mẫu, bôi chọn các dòng công việc từ cột <b>Tên công việc</b> đến cột <b>E</b> (có thể chọn cả cột TT), bấm Ctrl+C rồi dán vào ô dưới đây. Thứ tự cột: Tên công việc, Sản phẩm, Số lượng, Tháng thực hiện, A, B, C, D, E.</p>' +
        '<textarea id="pasteBox" rows="10" placeholder="Dán vào đây (Ctrl+V)"></textarea>' +
        '<div class="actions"><button class="btn" data-act="closeModal">Huỷ</button><button class="btn primary" data-act="pasteApply">Thêm vào phiếu</button></div></div>';
      $('#pasteBox').focus();
    },
    pasteApply: function () {
      var add = tasksFromPaste($('#pasteBox').value);
      if (!add.length) return toast('Không nhận ra dòng công việc nào trong nội dung đã dán.', true);
      E.tasks = E.tasks.filter(function (t) { return t.name || t.code || KPI_calc(t.s); }).concat(add);
      modal.innerHTML = '';
      redrawTable();
      var miss = add.filter(function (t) { return !KPI_calc(t.s); }).length;
      toast('Đã thêm ' + add.length + ' công việc.' + (miss ? ' Còn ' + miss + ' dòng chưa đủ mức A–E, cần chọn bổ sung.' : ''));
    },
    excelEval: function (el) { run(el, exportEvalExcel); },
    saveSelf: function (el) {
      var submit = !!el.dataset.submit;
      var tasks = E.tasks.filter(function (t) { return t.name.trim() || t.code || KPI_calc(t.s); });
      if (submit) {
        if (!tasks.length) return toast('Phiếu chưa có công việc nào.', true);
        for (var i = 0; i < E.tasks.length; i++) {
          var t = E.tasks[i];
          if (tasks.indexOf(t) < 0 || (t.locked && !E.editing[t.id])) continue; // việc đã được chấm (kể cả việc người phụ trách thêm) không cần kiểm tra lại
          if (!t.name.trim()) return toast('Công việc số ' + (i + 1) + ' chưa ghi tên.', true);
          if (!cK(t, 's')) return toast('Công việc số ' + (i + 1) + ' chưa chọn đủ 5 tiêu chí A–E.', true);
          if (t.code && (t.s || []).some(function (v) { return v; }) && !KPI_calc(t.s)) return toast('Công việc số ' + (i + 1) + ': muốn điều chỉnh theo A–E thì chọn đủ 5 mức, không thì để trống cả 5.', true);
        }
        if (!E.d.perms.selfScore && !confirm('Nộp phiếu gồm ' + tasks.length + ' công việc, tổng ' + fmt(sumPoints('s')) + ' điểm tự chấm? Sau khi nộp anh/chị không sửa được, trừ khi được yêu cầu sửa.')) return;
      }
      run(el, async function () {
        var d = await api('saveSelf', { periodId: S.periodId, tasks: tasks, comment: $('#selfComment').value, submit: submit });
        S.ov = null; S.st = null;
        setEval(d);
        toast(!submit ? 'Đã lưu nháp.' : d.perms.selfScore ? 'Đã lưu và chấm điểm.' : 'Đã nộp phiếu.');
      });
    },
    decide: function (el) {
      var ret = el.dataset.d === 'return', comment = $('#mgrComment').value.trim();
      if (ret && !comment) return toast('Vui lòng ghi nội dung yêu cầu sửa vào ô nhận xét.', true);
      if (!ret) {
        for (var i = 0; i < E.tasks.length; i++) if (!cK(E.tasks[i], 'm')) return toast('Công việc số ' + (i + 1) + ' chưa chấm đủ 5 tiêu chí A–E.', true);
        var total = sumPoints('m'), rating = ratingOf(total);
        if (!confirm('Công nhận kết quả ' + fmt(total) + ' điểm' + (rating ? ' – ' + rating : '') + ' cho ' + E.d.owner.fullName + '?')) return;
      }
      run(el, async function () {
        var d = await api('review', { evalId: E.d.ev.id, tasks: E.tasks.map(function (t) { return { id: t.id, m: t.m }; }), comment: comment, decision: el.dataset.d });
        S.ov = null; S.st = null;
        setEval(d);
        toast(ret ? 'Đã gửi yêu cầu sửa.' : 'Đã công nhận kết quả.');
      });
    },
    reopen: function (el) {
      var note = prompt('Lý do mở lại phiếu để đánh giá lại:');
      if (note === null) return;
      run(el, async function () {
        var d = await api('reopen', { evalId: E.d.ev.id, note: note });
        S.ov = null; S.st = null;
        setEval(d);
        toast('Đã mở lại phiếu.');
      });
    },

    importOpen: function (el) {
      var im = IMPORT[el.dataset.t];
      modal.innerHTML = '<div class="dlg" style="max-width:760px"><h2>' + im.title + '</h2><p class="small">Trong Excel, bôi chọn các dòng theo đúng thứ tự cột: <b>' + im.cols + '</b>. Bấm Ctrl+C rồi dán vào ô dưới đây.</p>' +
        '<p class="muted small">' + im.note + '</p><textarea id="importBox" rows="10" placeholder="Dán vào đây (Ctrl+V)"></textarea>' +
        '<div class="actions"><button class="btn" data-act="closeModal">Huỷ</button><button class="btn primary" data-act="importApply" data-t="' + el.dataset.t + '">Nhập danh sách</button></div></div>';
      $('#importBox').focus();
    },
    importApply: function (el) {
      var tab = el.dataset.t, rows = rowsFromPaste(tab, $('#importBox').value);
      if (!rows.length) return toast('Không nhận ra dòng nào trong nội dung đã dán.', true);
      run(el, async function () {
        var res = (await api('adminImport', { table: ADM[tab].table, rows: rows })).results;
        await refreshBoot();
        await render();
        var ok = res.filter(function (r) { return r.ok; });
        modal.innerHTML = '<div class="dlg" style="max-width:760px"><h2>Kết quả nhập: ' + ok.length + ' / ' + res.length + ' dòng</h2>' +
          (tab === 'users' && ok.length ? '<p class="small">Mật khẩu tạm chỉ hiện <b>một lần</b>. Bấm “Chép danh sách” rồi dán vào Excel để gửi cho từng người; mỗi người phải đổi mật khẩu khi đăng nhập lần đầu.</p>' : '') +
          '<div class="tbl-wrap" style="max-height:50vh;overflow:auto"><table class="tbl"><thead><tr><th>' + (tab === 'users' ? 'CCCD' : 'Mã') + '</th><th>Tên</th>' + (tab === 'users' ? '<th>Mật khẩu tạm</th>' : '') + '<th>Kết quả</th></tr></thead><tbody>' +
          res.map(function (r) { return '<tr><td>' + h(r.id) + '</td><td>' + h(r.name) + '</td>' + (tab === 'users' ? '<td>' + (r.usedDefault ? 'Mật khẩu mặc định' : '<code>' + h(r.tempPassword || '') + '</code>') + '</td>' : '') + '<td>' + (r.ok && !r.error ? '<span class="badge b-green">Đã thêm</span>' : '<span class="badge ' + (r.ok ? 'b-amber' : 'b-red') + '">' + h(r.error) + '</span>') + '</td></tr>'; }).join('') +
          '</tbody></table></div><div class="actions">' + (tab === 'users' && ok.length ? '<button class="btn" data-act="copyImport">Chép danh sách</button>' : '') + '<button class="btn primary" data-act="closeModal">Đóng</button></div></div>';
        ACT.copyImport.text = ok.map(function (r) { return r.id + '\t' + r.name + '\t' + (r.usedDefault ? 'Mật khẩu mặc định' : r.tempPassword); }).join('\n');
      });
    },
    copyImport: function () {
      var text = ACT.copyImport.text || '';
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Đã chép. Dán vào Excel để lưu.'); }, function () { toast('Không chép tự động được, hãy bôi chọn bảng và chép tay.', true); });
    },
    admAdd: function (el) { adminEdit(el.dataset.t, ''); },
    admEdit: function (el) { adminEdit(el.dataset.t, el.dataset.id); },
    admDel: function (el) {
      if (!confirm('Xoá bản ghi này? Thao tác không hoàn lại được.')) return;
      run(el, async function () {
        await api('adminDelete', { table: ADM[el.dataset.t].table, id: el.dataset.id });
        await refreshBoot();
        await render();
        toast('Đã xoá.');
      });
    },
    admReset: function (el) {
      var u = ADMIN.users.filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!confirm('Cấp lại mật khẩu tạm cho ' + u.fullName + '?')) return;
      run(el, async function () {
        var r = await api('adminResetPassword', { userId: u.id });
        showPassword('Đã cấp lại mật khẩu', u.fullName + ' (' + u.id + ')', r.tempPassword, r.usedDefault);
      });
    },
    saveConfig: function (el) {
      var ratings = [];
      document.querySelectorAll('[data-rating]').forEach(function (tr) {
        var ins = tr.querySelectorAll('input');
        if (ins[0].value.trim()) ratings.push({ name: ins[0].value.trim(), min: Number(ins[1].value) || 0 });
      });
      run(el, async function () {
        var rl = {};
        document.querySelectorAll('[data-rule]').forEach(function (x) { rl[x.dataset.rule] = x.value; });
        S.config = await api('adminSaveConfig', { config: { orgName: $('#cfgOrg').value, ratings: ratings, rule: rl } });
        await render();
        toast('Đã lưu cấu hình.');
      });
    }
  };

  /* =====================================================================
   * BỔ SUNG: tiến độ – vượt mức – điểm thưởng, minh chứng trên Drive, phản hồi,
   * kho công việc mẫu, xếp loại (tham mưu tổng hợp, biểu quyết)
   * ===================================================================== */
  var RATE_SHORT = { xs: 'Xuất sắc', tot: 'Tốt', ht: 'Hoàn thành', kht: 'Không hoàn thành' };
  var RATE_BADGE = { xs: 'b-green', tot: 'b-blue', ht: 'b-gray', kht: 'b-amber' };
  function fsize(n) { n = Number(n) || 0; return n >= 1048576 ? fmt(n / 1048576) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function evName(x) { return x.id + '_' + x.name; }
  function evLinks(t) {
    return (t.ev || []).map(function (x) { return '<a href="#" class="evl" data-act="evView" data-id="' + h(x.id) + '" title="Mở minh chứng">📎 ' + h(evName(x)) + '</a>'; }).join('');
  }
  /** Phần bổ sung dưới tên công việc: hạn, ngày hoàn thành, tiến độ, điểm thưởng, minh chứng, kết quả xác nhận, phản hồi. */
  function extraHtml(t, ti, edit) {
    var d = E.d, out = t.code ? catInfoHtml(t, ti) : '', maxB = (d.rule || {}).maxBonus || 5, mine = d.owner.id === S.user.id;
    if (edit) {
      out += '<div class="tx no-print"><label>Hạn hoàn thành<input type="date" data-fld="deadline" data-t="' + ti + '" value="' + h(t.deadline || '') + '"></label>' +
        '<label>Ngày hoàn thành<input type="date" data-fld="doneDate" data-t="' + ti + '" value="' + h(t.doneDate || '') + '"></label>' +
        '<label>Tiến độ (%)<input type="number" min="0" max="100" step="1" data-fld="progress" data-t="' + ti + '" value="' + h(t.progress == null ? '' : t.progress) + '" placeholder="100"></label>' +
        '<label>Điểm thưởng đề xuất (%)<input type="number" min="0" max="' + maxB + '" step="0.5" data-fld="bonus" data-t="' + ti + '" value="' + h(t.bonus || '') + '" placeholder="0"></label>' +
        (d.canUpload ? '<button type="button" class="btn sm" data-act="evOpen" data-t="' + ti + '">📎 Minh chứng (' + (t.ev || []).length + '/' + KPI_MAX_EVIDENCE + ')</button>' : '') + '</div>';
    }
    var chips = '';
    if (!edit) {
      if (t.deadline) chips += '<span class="badge b-gray">Hạn ' + h(fdate(t.deadline)) + '</span>';
      if (t.doneDate) chips += '<span class="badge b-gray">Xong ' + h(fdate(t.doneDate)) + '</span>';
      if (t.progress != null && t.progress !== '') chips += '<span class="badge b-gray">Tiến độ ' + h(t.progress) + '%</span>';
      if (Number(t.bonus)) chips += '<span class="badge b-gray">Đề xuất thưởng ' + fmt(t.bonus) + '%</span>';
    }
    if (t.locked && cK(t, 'm')) {
      if (t.mProgress != null && Number(t.mProgress) < 100) chips += '<span class="badge b-amber">Xác nhận hoàn thành ' + h(t.mProgress) + '%</span>';
      if (t.ot && t.oq) chips += '<span class="badge b-green">★ Vượt mức</span>';
      else if (t.ot) chips += '<span class="badge b-blue">Vượt tiến độ</span>';
      else if (t.oq) chips += '<span class="badge b-blue">Vượt chất lượng</span>';
      if (Number(t.mBonus)) chips += '<span class="badge b-green">Thưởng +' + fmt(t.mBonus) + '%</span>';
    }
    if (chips) out += '<div class="tags">' + chips + '</div>';
    if ((t.ev || []).length) out += '<div class="evs">' + evLinks(t) + '</div>';
    if (t.fb) out += '<div class="mnote fb"><b>Phản hồi của cán bộ' + (t.fbDone ? ' (đã được xem xét)' : ' (chờ người phụ trách xem xét)') + ':</b> ' + h(t.fb) + '</div>';
    if (mine && t.locked && t.mBy && t.mBy !== S.user.id && d.period.phase !== 'khoa') out += '<div class="no-print" style="margin-top:6px"><button type="button" class="btn sm" data-act="fbOpen" data-t="' + ti + '">' + (t.fb ? 'Sửa phản hồi' : 'Phản hồi không tán thành') + '</button></div>';
    return out;
  }
  /** Ô người phụ trách xác nhận khi chấm một việc. */
  function confirmHtml(t, ti) {
    var maxB = (E.d.rule || {}).maxBonus || 5;
    return '<div class="tx mg"><label>Tiến độ xác nhận (%)<input type="number" min="0" max="100" step="1" data-fld="mProgress" data-t="' + ti + '" value="' + h(t.mProgress == null ? 100 : t.mProgress) + '"></label>' +
      '<label>Ngày hoàn thành<input type="date" data-fld="mDone" data-t="' + ti + '" value="' + h(t.mDone || '') + '"></label>' +
      '<label>Điểm thưởng (%)<input type="number" min="0" max="' + maxB + '" step="0.5" data-fld="mBonus" data-t="' + ti + '" value="' + h(t.mBonus || 0) + '"></label>' +
      '<label class="ck"><input type="checkbox" data-fld="ot" data-t="' + ti + '"' + (t.ot ? ' checked' : '') + '>Vượt tiến độ</label>' +
      '<label class="ck"><input type="checkbox" data-fld="oq" data-t="' + ti + '"' + (t.oq ? ' checked' : '') + '>Vượt chất lượng</label></div>';
  }

  /* ---------- Minh chứng ---------- */
  function evModal(ti) {
    var t = E.tasks[ti], d = E.d, list = t.ev || [], can = d.perms.canEdit && d.owner.id === S.user.id && (!t.locked || d.perms.selfScore);
    modal.innerHTML = '<div class="dlg" style="max-width:640px"><h2>Minh chứng của công việc số ' + (ti + 1) + '</h2><p class="small">' + h(t.name || '(chưa ghi tên công việc)') + '</p>' +
      '<div class="tbl-wrap"><table class="tbl"><tbody>' + (list.map(function (x) {
        return '<tr><td>📎 <b>' + h(x.id) + '</b>_' + h(x.name) + '<div class="muted small">' + fsize(x.size) + '</div></td><td class="right nowrap"><button class="btn sm" data-act="evView" data-id="' + h(x.id) + '">Xem</button>' +
          (can ? ' <button class="btn sm danger" data-act="evDel" data-id="' + h(x.id) + '" data-t="' + ti + '">Xoá</button>' : '') + '</td></tr>';
      }).join('') || '<tr><td class="muted">Chưa có minh chứng nào.</td></tr>') + '</tbody></table></div>' +
      (can && list.length < KPI_MAX_EVIDENCE ? '<label class="f" style="margin-top:12px"><span>Chọn tệp để tải lên (tối đa 10 MB)</span><input type="file" id="evFile"></label>' : '') +
      '<p class="muted small">Tệp được lưu trên Google Drive của cơ quan tại <b>KPIQTRI / ' + h(d.owner.id) + ' / ' + h(d.period.name.replace(/[\\\/]/g, '-')) + '</b>, tên tệp có mã minh chứng ở đầu. Mỗi công việc tối đa ' + KPI_MAX_EVIDENCE + ' minh chứng. Chỉ anh/chị, những người phụ trách phía trên và quản trị xem được.</p>' +
      '<div class="actions"><button class="btn" data-act="closeModal">Đóng</button>' + (can && list.length < KPI_MAX_EVIDENCE ? '<button class="btn primary" data-act="evUpload" data-t="' + ti + '">Tải lên</button>' : '') + '</div></div>';
  }
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('Không đọc được tệp.')); };
      r.readAsDataURL(file);
    });
  }
  function b64Blob(data, mime) {
    var bin = atob(data), n = bin.length, a = new Uint8Array(n);
    for (var i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: mime || 'application/octet-stream' });
  }

  /* ---------- Tìm và thêm việc từ kho công việc mẫu (trên phiếu tự đánh giá) ---------- */
  var LIBQ = { items: null, loading: false, sel: {} };
  function libBoxHtml() {
    return '<div class="lib no-print"><div class="lib-top"><label for="libQ"><b>Thêm việc từ kho công việc mẫu</b></label>' +
      '<input type="search" id="libQ" placeholder="Gõ mã công việc (ví dụ CV00012) hoặc một phần tên công việc" autocomplete="off">' +
      '<label class="ck"><input type="checkbox" id="libUnit">Tìm cả kho của người cùng đơn vị</label><button type="button" class="btn sm" data-act="libShow">Xem cả kho</button></div><div id="libList"></div></div>';
  }
  function plain(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); }
  function libMatches() {
    var q = plain(($('#libQ') || {}).value).trim(), unit = ($('#libUnit') || {}).checked, words = q.split(/\s+/).filter(Boolean);
    return (LIBQ.items || []).filter(function (x) {
      if (!unit && x.userId !== S.user.id) return false;
      var hay = plain(x.id + ' ' + x.name + ' ' + x.product);
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
  }
  function libRender(force) {
    var box = $('#libList');
    if (!box) return;
    var q = ($('#libQ') || {}).value || '';
    if (!q.trim() && !force && !LIBQ.open) { box.innerHTML = ''; return; }
    if (!LIBQ.items) {
      box.innerHTML = '<div class="muted small" style="padding:8px 0">Đang tải kho công việc mẫu…</div>';
      if (!LIBQ.loading) {
        LIBQ.loading = true;
        api('libraryFind').then(function (r) { LIBQ.items = r.items; LIBQ.loading = false; libRender(force); }, function (e) { LIBQ.loading = false; box.innerHTML = '<div class="muted small">' + h(e.message) + '</div>'; });
      }
      return;
    }
    var all = libMatches(), list = all.slice(0, 60), have = {};
    E.tasks.forEach(function (t) { have[plain(t.name) + '|' + t.product] = true; });
    if (!all.length) { box.innerHTML = '<div class="muted small" style="padding:8px 0">' + (LIBQ.items.length ? 'Không thấy việc mẫu nào khớp.' : 'Kho công việc mẫu của anh/chị chưa có việc nào. Quản trị viên nhập kho ở mục Quản trị › Kho công việc mẫu.') + '</div>'; return; }
    box.innerHTML = '<div class="pick">' + list.map(function (x) {
      var c = KPI_calc(x.s), dup = have[plain(x.name) + '|' + x.product];
      return '<label><input type="checkbox" data-lib="' + h(x.id) + '"' + (LIBQ.sel[x.id] ? ' checked' : '') + '><span><b>' + h(x.id) + '</b> · ' + h(x.name) +
        '<br><span class="muted small">' + h(x.product) + ' · SL ' + fmt(x.qty) + (c ? ' · mức ' + x.s.join('-') + ' → ' + c.n + ' (' + fmt(c.point) + 'đ)' : ' · chưa có mức A–E') +
        (x.userId !== S.user.id ? ' · kho của ' + h(x.ownerName) : '') + (dup ? ' · <b>đã có trong phiếu</b>' : '') + '</span></span></label>';
    }).join('') + '</div><div class="actions" style="margin-top:8px"><button type="button" class="btn primary" data-act="libAdd">Thêm các việc đã tích vào phiếu</button>' +
      '<button type="button" class="btn" data-act="libAll">Tích tất cả việc đang thấy</button><button type="button" class="btn" data-act="libHide">Đóng danh sách</button>' +
      '<span class="muted small">Thấy ' + list.length + (all.length > list.length ? ' trong ' + all.length + ' việc khớp, gõ thêm để thu hẹp' : ' việc') + '</span></div>';
  }

  /* ---------- Quản trị kho công việc mẫu ---------- */
  var LIB = { unit: '', user: '', items: [], counts: {} };
  async function libLoad() {
    LIB.counts = (await api('adminLibraryList', {})).counts;
    LIB.items = LIB.user ? (await api('adminLibraryList', { userId: LIB.user })).items : [];
  }
  function libUsers() { return ADMIN.users.filter(function (u) { return u.unitId === LIB.unit; }).sort(function (a, b) { return KPI_LEVELS[a.level].rank - KPI_LEVELS[b.level].rank || a.fullName.localeCompare(b.fullName, 'vi'); }); }
  function libAdminHtml() {
    var users = LIB.unit ? libUsers() : [], who = ADMIN.users.filter(function (u) { return u.id === LIB.user; })[0], total = 0;
    Object.keys(LIB.counts).forEach(function (k) { total += LIB.counts[k]; });
    var html = '<div class="card"><h2>Kho công việc mẫu <span class="muted small" style="font-weight:400">· ' + total + ' việc mẫu của ' + Object.keys(LIB.counts).length + ' vị trí</span></h2>' +
      '<div class="grid cols-2"><label class="f"><span>1. Chọn đơn vị</span><select id="lbUnit"><option value="">– chọn đơn vị –</option>' + opts(unitOpts(), LIB.unit) + '</select></label>' +
      '<label class="f"><span>2. Chọn cá nhân trong đơn vị</span><select id="lbUser"' + (LIB.unit ? '' : ' disabled') + '><option value="">– chọn cá nhân –</option>' +
      opts(users.map(function (u) { return [u.id, u.fullName + ' – ' + (u.title || LEVEL[u.level]) + ' (' + (LIB.counts[u.id] || 0) + ' việc mẫu)']; }), LIB.user) + '</select></label></div>';
    if (!who) return html + '<p class="muted">Chọn đơn vị rồi chọn cá nhân để xem, thêm, sửa kho công việc mẫu của vị trí đó. Mỗi việc mẫu gắn với số CCCD của vị trí; cán bộ tìm theo mã hoặc tên rồi thêm vào phiếu tự đánh giá, kèm sẵn mức A–E.</p></div>';
    html += '<div class="actions" style="justify-content:space-between;margin:4px 0 12px"><div><b>' + h(who.fullName) + '</b> <span class="muted">· CCCD ' + h(who.id) + ' · ' + LIB.items.length + ' việc mẫu</span></div><div class="actions">' +
      '<button class="btn" data-act="lbImportOpen">Đẩy lên kho bằng Excel</button><button class="btn" data-act="lbExcel">Xuất ra Excel</button><button class="btn primary" data-act="lbEdit" data-id="">Thêm việc mẫu</button></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mã công việc</th><th class="num">TT</th><th>Tên công việc</th><th>Sản phẩm</th><th class="num">Số lượng</th>' +
      M.factors.map(function (f) { return '<th class="center" title="' + h(f.name) + '">' + f.key + '</th>'; }).join('') + '<th class="num">S</th><th>N</th><th class="num">Điểm</th><th></th></tr></thead><tbody>' +
      (LIB.items.map(function (x, i) {
        var c = KPI_calc(x.s);
        return '<tr><td class="nowrap"><b>' + h(x.id) + '</b></td><td class="num">' + (i + 1) + '</td><td>' + h(x.name) + '</td><td>' + h(x.product) + '</td><td class="num">' + fmt(x.qty) + '</td>' +
          x.s.map(function (v, k) { return '<td class="center" title="' + (v ? h(M.factors[k].levels[v - 1][0]) : 'Chưa chọn') + '">' + (v || '<span class="muted">–</span>') + '</td>'; }).join('') +
          '<td class="num">' + (c ? fmt(c.s) : '') + '</td><td>' + (c ? '<span class="n n' + c.n.slice(1) + '">' + c.n + '</span>' : '') + '</td><td class="num"><b>' + (c ? fmt(c.point) : '') + '</b></td>' +
          '<td class="right nowrap"><button class="btn sm" data-act="lbEdit" data-id="' + h(x.id) + '">Sửa</button> <button class="btn sm danger" data-act="lbDel" data-id="' + h(x.id) + '">Xoá</button></td></tr>';
      }).join('') || '<tr><td colspan="14" class="muted center">Vị trí này chưa có việc mẫu nào.</td></tr>') + '</tbody></table></div></div>';
    return html;
  }
  function libRedraw() { $('#view').innerHTML = adminHtml('library'); }
  /** Chuyển các dòng của một sheet theo mẫu "Văn phòng" (TT, Tên công việc, Sản phẩm, Số lượng, Tháng, A, B, C, D, E) thành việc mẫu; việc trùng tên và sản phẩm chỉ giữ một, ưu tiên dòng đã đủ mức A–E. */
  function libFromRows(rows) {
    var map = {}, order = [];
    rows.forEach(function (r) {
      r = (r || []).map(function (x) { return String(x == null ? '' : x).trim(); });
      if (!r.length || /^(tt|stt)$/i.test(r[0]) || /^tên công việc/i.test(r[0]) || /^tên công việc/i.test(r[1] || '') || /^[A-E] - /.test(r[5] || '')) return;
      if (r.length > 1 && (/^\d+([.,]0+)?$/.test(r[0]) || r[0] === '')) r = r.slice(1);
      var name = (r[0] || '').replace(/\s*\n\s*/g, ' ').trim();
      if (!name) return;
      var q = Number(String(r[2] || '').replace(',', '.')), s = [0, 0, 0, 0, 0];
      for (var i = 0; i < 5; i++) s[i] = levelOf(i, r[4 + i]);
      var it = { name: name, product: M.products.indexOf(r[1]) >= 0 ? r[1] : 'Khác', qty: q > 0 ? q : 1, month: /^T\d{1,2}\/\d{4}$/.test(r[3] || '') ? r[3] : '', s: s };
      var key = plain(name) + '|' + it.product;
      if (!map[key]) { map[key] = it; order.push(key); }
      else if (!KPI_calc(map[key].s) && KPI_calc(s)) map[key] = it;
    });
    return order.map(function (k) { return map[k]; });
  }
  var LBX = null; // tệp Excel đang chọn để đẩy lên kho
  function lbImportBody() {
    if (!LBX) return '<p class="muted small">Chưa chọn tệp.</p>';
    var items = LBX.sheets[LBX.sheet] || [], miss = items.filter(function (x) { return !KPI_calc(x.s); }).length;
    return '<label class="f"><span>Sheet chứa công việc của vị trí này</span><select id="lbSheet">' + opts(Object.keys(LBX.sheets).map(function (n) { return [n, n + ' (' + LBX.sheets[n].length + ' việc)']; }), LBX.sheet) + '</select></label>' +
      '<p class="small">Nhận ra <b>' + items.length + '</b> việc khác nhau' + (miss ? ', trong đó ' + miss + ' việc chưa đủ mức A–E (vẫn đưa vào kho, cán bộ tự chọn mức khi dùng)' : '') + '.</p>' +
      '<div class="pick" style="max-height:30vh">' + items.slice(0, 200).map(function (x) { var c = KPI_calc(x.s); return '<label style="cursor:default"><span>' + h(x.name) + '<br><span class="muted small">' + h(x.product) + ' · SL ' + fmt(x.qty) + (c ? ' · ' + c.n : ' · chưa có mức') + '</span></span></label>'; }).join('') + '</div>' +
      '<label class="chk" style="margin-top:12px"><input type="checkbox" id="lbReplace">Thay toàn bộ kho hiện có của vị trí này (không tích: chỉ thêm việc chưa có)</label>';
  }

  /* ---------- Xếp loại ---------- */
  var RT = null;
  function rateSel(kind, r, cur) {
    return '<select data-rk="' + kind + '" data-u="' + h(r.user.id) + '"><option value="">–</option>' + opts(Object.keys(RATE_SHORT).map(function (k) { return [k, RATE_SHORT[k]]; }), cur) + '</select>';
  }
  function rateBadge(k) { return k ? '<span class="badge ' + RATE_BADGE[k] + '">' + RATE_SHORT[k] + '</span>' : '<span class="muted">–</span>'; }
  function ratingHtml() {
    var d = RT, rl = d.rule, open = d.phase !== 'khoa', staff = d.role.staff && open, rows = d.rows.slice().sort(function (a, b) { return b.total - a.total || a.user.fullName.localeCompare(b.user.fullName, 'vi'); });
    var anyProp = open && rows.some(function (r) { return r.can.propose; }), anyVote = open && rows.some(function (r) { return r.can.vote; });
    var q = d.quota, p = period();
    var html = '<div class="card"><h2>Xếp loại chất lượng · ' + h(p.name) + '</h2><div class="stats" style="margin-bottom:12px">' +
      '<div class="stat"><div class="v">' + rows.length + '</div><div class="l">Người trong danh sách</div></div>' +
      '<div class="stat' + (q.proposed > q.proposedMax ? ' s-none' : '') + '"><div class="v">' + q.proposed + ' / ' + q.proposedMax + '</div><div class="l">Tham mưu đề xuất xuất sắc / mức tối đa</div><div class="x">không quá ' + rl.quota + '% của ' + q.proposedBase + ' người từ “Tốt” trở lên</div></div>' +
      '<div class="stat s-done"><div class="v">' + q.decided + ' / ' + q.decidedMax + '</div><div class="l">Đã chốt xuất sắc / mức tối đa</div><div class="x">' + q.decidedBase + ' người đã chốt từ “Tốt” trở lên</div></div>' +
      '<div class="stat"><div class="v">' + d.voters + '</div><div class="l">Thành viên biểu quyết</div><div class="x">' + (d.voters ? 'quản trị khai ở Quản trị › Người dùng' : 'chưa khai: chốt theo đề xuất của tham mưu') + '</div></div></div>' +
      '<p class="muted small" style="margin:0">Quy trình: lãnh đạo trực tiếp đề xuất → bộ phận tham mưu tổng hợp, nhập điểm tiêu chí chung và trình → tập thể lãnh đạo biểu quyết → chốt kết quả. ' +
      'Tổng điểm (thang 100) = tiêu chí chung (tối đa ' + rl.common + ') + kết quả nhiệm vụ (tối đa ' + (100 - rl.common) + ', theo tiến độ được xác nhận của các việc đã chấm). ' +
      'Điều kiện xét xuất sắc: tổng điểm từ ' + rl.minScore + ', hoàn thành 100% nhiệm vụ, ít nhất ' + rl.minOver + '% nhiệm vụ vượt mức cả tiến độ lẫn chất lượng.</p></div>';
    if (!open) html += '<div class="banner gray">Kỳ đánh giá đã khoá, bảng xếp loại chỉ xem.</div>';
    html += '<div class="card"><div class="tbl-wrap"><table class="tbl rate"><thead><tr><th>Họ tên</th><th class="num">Việc đã chấm</th><th class="num">Hoàn thành</th><th class="num">Vượt mức</th><th class="num">Điểm KPI</th>' +
      '<th class="num">Tiêu chí chung</th><th class="num">Kết quả nhiệm vụ</th><th class="num">Tổng điểm</th><th class="center">Đủ điều kiện xuất sắc</th><th>Lãnh đạo đề xuất</th><th>Tham mưu đề xuất</th><th>Biểu quyết</th><th>Kết quả</th></tr></thead><tbody>' +
      (rows.map(function (r) {
        var tally = Object.keys(RATE_SHORT).filter(function (k) { return r.tally[k]; }).map(function (k) { return RATE_SHORT[k] + ': ' + r.tally[k]; }).join(', ');
        var edit = staff && !r.result;
        return '<tr><td><b>' + h(r.user.fullName) + '</b><div class="muted small">' + h(r.user.title || LEVEL[r.user.level]) + ' · ' + h(unitName(r.user.unitId)) + '</div></td>' +
          '<td class="num">' + r.scored + '/' + r.tasks + '</td><td class="num">' + fmt(r.donePct) + '%</td><td class="num">' + fmt(r.overPct) + '%</td><td class="num">' + fmt(r.points) + '</td>' +
          '<td class="num">' + (edit ? '<input type="number" min="0" max="' + rl.common + '" step="0.5" data-rk="common" data-u="' + h(r.user.id) + '" value="' + h(r.common) + '">' : fmt(r.common)) + '</td>' +
          '<td class="num">' + fmt(r.taskScore) + '</td><td class="num"><b>' + fmt(r.total) + '</b></td>' +
          '<td class="center">' + (r.eligible ? '<span class="badge b-green">Đủ</span>' : '<span class="badge b-gray" title="' + h(r.why) + '">Chưa</span><div class="muted small">' + h(r.why) + '</div>') + '</td>' +
          '<td>' + (open && r.can.propose ? rateSel('mgr', r, r.mgrLevel) : rateBadge(r.mgrLevel)) + '</td>' +
          '<td>' + (edit ? rateSel('staff', r, r.staffLevel) : rateBadge(r.staffLevel)) + (r.submitted && !r.result ? '<div class="muted small">đã trình</div>' : '') + '</td>' +
          '<td>' + (open && r.can.vote ? rateSel('vote', r, r.myVote) : (r.myVote ? 'Tôi: ' + RATE_SHORT[r.myVote] : '')) + (r.votes ? '<div class="muted small">' + r.votes + ' phiếu' + (tally ? ' · ' + h(tally) : '') + '</div>' : (r.submitted && !r.result ? '<div class="muted small">chưa có phiếu</div>' : '')) + '</td>' +
          '<td>' + (r.result ? '<b>' + h(KPI_RATE[r.result]) + '</b>' + (staff ? '<div><button class="btn sm" data-act="rtReopen" data-u="' + h(r.user.id) + '">Mở lại</button></div>' : '') : '<span class="muted">Chưa chốt</span>') + '</td></tr>';
      }).join('') || '<tr><td colspan="13" class="muted center">Không có ai trong phạm vi của anh/chị.</td></tr>') + '</tbody></table></div>' +
      '<div class="actions no-print" style="margin-top:12px">' + (anyProp ? '<button class="btn primary" data-act="rtSave" data-m="mgr">Lưu đề xuất của tôi</button>' : '') +
      (staff ? '<button class="btn" data-act="rtSave" data-m="staff">Lưu tham mưu</button><button class="btn primary" data-act="rtSave" data-m="submit">Lưu và trình biểu quyết</button><button class="btn ok" data-act="rtSave" data-m="decide">Chốt kết quả</button>' : '') +
      (anyVote ? '<button class="btn primary" data-act="rtSave" data-m="vote">Gửi phiếu biểu quyết</button>' : '') + '<button class="btn" data-act="rtExcel">Xuất Excel</button></div></div>';
    return html;
  }

  Object.assign(ACT, {
    evOpen: function (el) { evModal(+el.dataset.t); },
    evUpload: function (el) {
      var ti = +el.dataset.t, t = E.tasks[ti], file = ($('#evFile').files || [])[0];
      if (!file) return toast('Chưa chọn tệp.', true);
      if (file.size > 10 * 1024 * 1024) return toast('Tệp quá lớn (tối đa 10 MB).', true);
      run(el, async function () {
        toast('Đang tải tệp lên Google Drive…');
        var r = await api('evidenceAdd', { periodId: S.periodId, taskId: t.id, name: file.name, mime: file.type, data: await readFile(file) });
        t.ev = r.items;
        redrawTable(); evModal(ti);
        toast('Đã tải lên ' + file.name + '.');
      });
    },
    evDel: function (el) {
      var ti = +el.dataset.t;
      if (!confirm('Xoá minh chứng này? Tệp trên Drive sẽ vào thùng rác.')) return;
      run(el, async function () {
        E.tasks[ti].ev = (await api('evidenceRemove', { id: el.dataset.id })).items;
        redrawTable(); evModal(ti);
        toast('Đã xoá minh chứng.');
      });
    },
    evView: function (el) {
      var w = window.open('', '_blank'); // mở sẵn cửa sổ ngay lúc bấm để trình duyệt không chặn
      run(el.tagName === 'BUTTON' ? el : null, async function () {
        try {
          var r = await api('evidenceGet', { id: el.dataset.id }), url = URL.createObjectURL(b64Blob(r.data, r.mime));
          if (w) w.location = url;
          else { var a = document.createElement('a'); a.href = url; a.download = r.name; document.body.appendChild(a); a.click(); a.remove(); }
        } catch (e) { if (w) w.close(); throw e; }
      });
    },
    fbOpen: function (el) {
      var ti = +el.dataset.t, t = E.tasks[ti];
      modal.innerHTML = '<div class="dlg"><h2>Phản hồi không tán thành kết quả chấm</h2><p class="small">' + h(t.name) + '</p>' +
        '<label class="f"><span>Nội dung phản hồi gửi người phụ trách</span><textarea id="fbText" rows="4" placeholder="Nêu rõ không tán thành điểm nào và căn cứ">' + h(t.fb || '') + '</textarea></label>' +
        '<div class="actions"><button class="btn" data-act="closeModal">Huỷ</button><button class="btn primary" data-act="fbSend" data-t="' + ti + '">Gửi phản hồi</button></div></div>';
      $('#fbText').focus();
    },
    fbSend: function (el) {
      var t = E.tasks[+el.dataset.t], text = $('#fbText').value.trim();
      if (!text) return toast('Chưa ghi nội dung phản hồi.', true);
      var dirty = E.d.perms.canEdit && !confirm('Gửi phản hồi sẽ tải lại phiếu; các thay đổi chưa lưu trên phiếu sẽ mất. Tiếp tục?');
      if (dirty) return;
      run(el, async function () {
        var d = await api('feedback', { periodId: S.periodId, taskId: t.id, text: text });
        modal.innerHTML = ''; S.ov = null;
        setEval(d);
        toast('Đã gửi phản hồi cho người phụ trách.');
      });
    },
    libShow: function () { LIBQ.open = true; libRender(true); },
    libHide: function () { LIBQ.open = false; LIBQ.sel = {}; var q = $('#libQ'); if (q) q.value = ''; libRender(); },
    libAll: function () { libMatches().slice(0, 60).forEach(function (x) { LIBQ.sel[x.id] = true; }); libRender(true); },
    libAdd: function () {
      var add = (LIBQ.items || []).filter(function (x) { return LIBQ.sel[x.id]; }).map(function (x) {
        var t = blankTask();
        t.name = x.name; t.product = x.product; t.qty = x.qty; t.s = x.s.slice();
        return t;
      });
      if (!add.length) return toast('Chưa tích việc mẫu nào.', true);
      E.tasks = E.tasks.filter(function (t) { return t.name || t.code || KPI_calc(t.s); }).concat(add);
      LIBQ.sel = {};
      redrawTable(); libRender(true);
      toast('Đã thêm ' + add.length + ' việc từ kho vào phiếu, kèm sẵn sản phẩm, số lượng và mức A–E. Kiểm tra rồi lưu phiếu.');
    },

    lbEdit: function (el) {
      var cur = LIB.items.filter(function (x) { return x.id === el.dataset.id; })[0] || { name: '', product: 'Công văn', qty: 1, s: [0, 0, 0, 0, 0] };
      var val = { name: cur.name, product: cur.product, qty: cur.qty };
      var fields = [['name', 'Tên công việc', 'textarea'], ['product', 'Sản phẩm', 'select', M.products.map(function (x) { return [x, x]; })], ['qty', 'Số lượng sản phẩm', 'number']];
      M.factors.forEach(function (f, i) {
        val['s' + i] = cur.s[i] || 0;
        fields.push(['s' + i, f.key + ' – ' + f.name, 'select', [[0, '– chưa chọn –']].concat(f.levels.map(function (l, k) { return [k + 1, (k + 1) + ' · ' + l[0]]; }))]);
      });
      formDialog(cur.id ? 'Sửa việc mẫu ' + cur.id : 'Thêm việc mẫu', fields, val).then(async function (res) {
        if (!res) return;
        try {
          res.button.disabled = true;
          var v = res.values, item = { id: cur.id || '', name: v.name, product: v.product, qty: v.qty, month: cur.month || '', s: [0, 1, 2, 3, 4].map(function (i) { return +v['s' + i]; }) };
          var r = await api('adminLibrarySave', { userId: LIB.user, item: item });
          LIB.items = r.items; LIB.counts[LIB.user] = r.items.length; LIBQ.items = null;
          modal.innerHTML = ''; libRedraw();
          toast('Đã lưu việc mẫu ' + r.id + '.');
        } catch (e) { res.button.disabled = false; toast(e.message, true); }
      });
    },
    lbDel: function (el) {
      if (!confirm('Xoá việc mẫu ' + el.dataset.id + ' khỏi kho?')) return;
      run(el, async function () {
        LIB.items = (await api('adminLibraryDelete', { id: el.dataset.id })).items; LIB.counts[LIB.user] = LIB.items.length; LIBQ.items = null;
        libRedraw(); toast('Đã xoá.');
      });
    },
    lbExcel: function (el) {
      run(el, async function () {
        if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        var who = ADMIN.users.filter(function (u) { return u.id === LIB.user; })[0], fh = M.factors.map(function (f) { return f.key + ' - ' + f.name; });
        var aoa = [['TT', 'Tên công việc', 'Sản phẩm', 'Số lượng sản phẩm', 'Tháng thực hiện', 'Cán bộ tự đánh giá', '', '', '', '', 'Công thức tự tính toán', '', '', 'CCCD', 'Mã công việc'],
          ['', '', '', '', ''].concat(fh, ['S', 'N', 'Điểm của N', '', ''])];
        LIB.items.forEach(function (x, i) {
          var c = KPI_calc(x.s);
          aoa.push([i + 1, x.name, x.product, x.qty, x.month].concat(x.s.map(function (v, k) { return v ? M.factors[k].levels[v - 1][0] : ''; }), c ? [c.s, c.n, c.point] : ['', '', ''], [who.id, x.id]));
        });
        var ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 5 }, { wch: 60 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, who.fullName.replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31));
        XLSX.writeFile(wb, 'KhoCongViecMau_' + who.fullName.replace(/[^\p{L}\p{N}]+/gu, '_') + '.xlsx');
      });
    },
    lbImportOpen: function () {
      LBX = null;
      var who = ADMIN.users.filter(function (u) { return u.id === LIB.user; })[0];
      modal.innerHTML = '<div class="dlg" style="max-width:720px"><h2>Đẩy lên kho bằng Excel · ' + h(who.fullName) + '</h2>' +
        '<p class="small">Chọn tệp Excel theo mẫu như tệp <b>Văn phòng.xlsx</b>: mỗi vị trí một sheet, các cột TT, Tên công việc, Sản phẩm, Số lượng sản phẩm, Tháng thực hiện, A, B, C, D, E. Tệp do nút “Xuất ra Excel” tạo ra cũng dùng được.</p>' +
        '<label class="f"><span>Tệp Excel (.xlsx)</span><input type="file" id="lbFile" accept=".xlsx,.xls"></label><div id="lbBody">' + lbImportBody() + '</div>' +
        '<div class="actions"><button class="btn" data-act="closeModal">Huỷ</button><button class="btn primary" data-act="lbImportApply">Đẩy lên kho</button></div></div>';
    },
    lbImportApply: function (el) {
      var items = LBX ? LBX.sheets[LBX.sheet] || [] : [];
      if (!items.length) return toast('Chưa có việc nào để đẩy lên. Chọn tệp và sheet trước.', true);
      var replace = $('#lbReplace').checked;
      if (replace && !confirm('Thay toàn bộ ' + LIB.items.length + ' việc mẫu hiện có của vị trí này bằng ' + items.length + ' việc trong tệp?')) return;
      run(el, async function () {
        var r = await api('adminLibraryImport', { userId: LIB.user, items: items, replace: replace });
        LIB.items = r.items; LIB.counts[LIB.user] = r.items.length; LIBQ.items = null;
        modal.innerHTML = ''; libRedraw();
        toast('Đã đưa ' + r.added + ' việc mẫu vào kho' + (r.added < items.length ? ' (bỏ qua ' + (items.length - r.added) + ' việc đã có)' : '') + '.');
      });
    },

    rtSave: function (el) {
      var mode = el.dataset.m, pick = function (kind) {
        var out = {};
        document.querySelectorAll('[data-rk="' + kind + '"]').forEach(function (x) { out[x.dataset.u] = x.value; });
        return out;
      };
      var action, data = { periodId: S.periodId }, msg;
      if (mode === 'mgr') { var m = pick('mgr'); action = 'ratingPropose'; data.items = Object.keys(m).map(function (u) { return { userId: u, level: m[u] }; }); msg = 'Đã lưu đề xuất.'; }
      else if (mode === 'vote') { var v = pick('vote'); action = 'ratingVote'; data.items = Object.keys(v).map(function (u) { return { userId: u, level: v[u] }; }); msg = 'Đã ghi phiếu biểu quyết.'; }
      else if (mode === 'decide') { if (!confirm('Chốt kết quả xếp loại cho những người đã trình biểu quyết?')) return; action = 'ratingDecide'; msg = 'Đã chốt kết quả.'; }
      else {
        var st = pick('staff'), cm = pick('common');
        action = 'ratingStaff'; data.submit = mode === 'submit';
        data.items = Object.keys(st).filter(function (u) { return !data.submit || st[u]; }).map(function (u) { return { userId: u, level: st[u], common: cm[u] }; });
        if (data.submit && !data.items.length) return toast('Chưa đề xuất mức xếp loại cho ai.', true);
        if (data.submit && !confirm('Trình tập thể biểu quyết ' + data.items.length + ' người đã có đề xuất?')) return;
        msg = data.submit ? 'Đã trình biểu quyết ' + data.items.length + ' người.' : 'Đã lưu phần tham mưu.';
      }
      run(el, async function () { RT = await api(action, data); $('#view').innerHTML = ratingHtml(); toast(msg); });
    },
    rtReopen: function (el) {
      if (!confirm('Mở lại kết quả đã chốt của người này để biểu quyết, chốt lại?')) return;
      run(el, async function () { RT = await api('ratingReopen', { periodId: S.periodId, userId: el.dataset.u }); $('#view').innerHTML = ratingHtml(); toast('Đã mở lại.'); });
    },
    rtExcel: function (el) {
      run(el, async function () {
        if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        var p = period(), lv = function (k) { return k ? KPI_RATE[k] : ''; };
        var aoa = [[S.config.orgName], ['BẢNG TỔNG HỢP XẾP LOẠI CHẤT LƯỢNG – ' + p.name.toUpperCase()], [],
          ['TT', 'Họ tên', 'CCCD', 'Chức vụ', 'Đơn vị', 'Việc đã chấm', 'Tổng số việc', 'Hoàn thành (%)', 'Vượt mức (%)', 'Điểm KPI', 'Tiêu chí chung', 'Kết quả nhiệm vụ', 'Tổng điểm', 'Đủ điều kiện xuất sắc', 'Lãnh đạo đề xuất', 'Tham mưu đề xuất', 'Số phiếu biểu quyết', 'Kết quả']];
        RT.rows.slice().sort(function (a, b) { return b.total - a.total; }).forEach(function (r, i) {
          aoa.push([i + 1, r.user.fullName, r.user.id, r.user.title, unitName(r.user.unitId), r.scored, r.tasks, r.donePct, r.overPct, r.points == null ? '' : r.points, r.common, r.taskScore, r.total, r.eligible ? 'Đủ' : 'Chưa: ' + r.why, lv(r.mgrLevel), lv(r.staffLevel), r.votes, lv(r.result)]);
        });
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Xếp loại');
        XLSX.writeFile(wb, 'XepLoai_' + p.name.replace(/[^\p{L}\p{N}]+/gu, '_') + '.xlsx');
      });
    }
  });
  document.addEventListener('input', function (ev) { if (ev.target.id === 'libQ') libRender(); });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.id === 'libUnit') return libRender(true);
    if (el.dataset && el.dataset.lib !== undefined) { LIBQ.sel[el.dataset.lib] = el.checked; return; }
    if (el.id === 'lbUnit') { LIB.unit = el.value; LIB.user = ''; LIB.items = []; return libRedraw(); }
    if (el.id === 'lbUser') { LIB.user = el.value; LIB.items = []; libRedraw(); if (LIB.user) run(null, async function () { LIB.items = (await api('adminLibraryList', { userId: LIB.user })).items; libRedraw(); }); return; }
    if (el.id === 'lbSheet' && LBX) { LBX.sheet = el.value; $('#lbBody').innerHTML = lbImportBody(); return; }
    if (el.id === 'lbFile' && el.files[0]) {
      var file = el.files[0];
      run(null, async function () {
        if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        var wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }), sheets = {};
        wb.SheetNames.forEach(function (n) { var items = libFromRows(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false })); if (items.length) sheets[n] = items; });
        var names = Object.keys(sheets);
        if (!names.length) { LBX = null; $('#lbBody').innerHTML = '<p class="muted small">Không nhận ra công việc nào trong tệp.</p>'; return; }
        var who = ADMIN.users.filter(function (u) { return u.id === LIB.user; })[0], last = plain(who.fullName).split(' ').slice(-2);
        var guess = names.filter(function (n) { return plain(n).indexOf(last.join(' ')) >= 0; })[0] || names.filter(function (n) { return plain(n).split(/[^a-z]+/).indexOf(last[1]) >= 0; })[0] ||
          names.slice().sort(function (x, y) { return sheets[y].length - sheets[x].length; })[0]; // không khớp tên thì lấy sheet nhiều việc nhất
        LBX = { sheets: sheets, sheet: guess };
        $('#lbBody').innerHTML = lbImportBody();
      });
    }
  });

  /* =====================================================================
   * DANH MỤC SẢN PHẨM (thí điểm KPI của Tổ giúp việc): chọn loại → chọn sản phẩm → thêm vào phiếu;
   * điểm giao chuẩn G = điểm chuẩn × số lượng; người phụ trách xác nhận hệ số H, Q, T; điểm thực đạt P.
   * ===================================================================== */
  function cK(t, key) { return KPI_taskCalc(t, key, (E && E.d && E.d.rule) || S.config.rule); }
  function f4(n) { return has(n) ? Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 4 }) : '–'; }
  var CATQ = { sel: {} };
  async function ensureCat() { if (!S.cat) S.cat = (await api('catalog')).items; return S.cat; }
  function catTypes() { var seen = {}, out = []; (S.cat || []).forEach(function (c) { if (c.active && !seen[c.type]) { seen[c.type] = 0; out.push(c.type); } if (c.active) seen[c.type]++; }); return out.map(function (t) { return [t, t + ' (' + seen[t] + ')']; }); }
  function catBoxHtml() {
    return '<div class="lib no-print"><div class="lib-top"><label for="catType"><b>Thêm công việc từ Danh mục sản phẩm</b></label>' +
      '<select id="catType"><option value="">– chọn loại sản phẩm –</option>' + opts(catTypes(), CATQ.type || '') + '</select>' +
      '<input type="search" id="catQ" placeholder="hoặc gõ mã, tên sản phẩm (ví dụ: CV03, báo cáo tháng)" autocomplete="off"></div><div id="catList">' + (S.cat ? '' : '<div class="muted small" style="padding:8px 0">Đang tải danh mục sản phẩm…</div>') + '</div></div>';
  }
  function catMatches() {
    var type = ($('#catType') || {}).value || '', words = plain(($('#catQ') || {}).value).trim().split(/\s+/).filter(Boolean);
    if (!type && !words.length) return null;
    var q = words.join(' '), rank = function (c) { return plain(c.id) === q ? 0 : plain(c.id + ' ' + c.name).indexOf(q) >= 0 ? 1 : words.every(function (w) { return plain(c.id + ' ' + c.name + ' ' + c.type).indexOf(w) >= 0; }) ? 2 : 3; };
    return (S.cat || []).filter(function (c) {
      if (!c.active || (type && c.type !== type)) return false;
      var hay = plain(c.id + ' ' + c.name + ' ' + c.type + ' ' + c.purpose + ' ' + c.example);
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    }).sort(function (a, b) { return words.length ? rank(a) - rank(b) || a.order - b.order : a.order - b.order; }); // khớp mã, tên xếp trước; khớp ở phần ví dụ xếp sau
  }
  function catRender() {
    var box = $('#catList');
    if (!box || !S.cat) return;
    var list = catMatches();
    if (!list) { box.innerHTML = ''; return; }
    if (!list.length) { box.innerHTML = '<div class="muted small" style="padding:8px 0">Không có sản phẩm nào khớp. Việc chưa có trong danh mục: chọn loại “Khác” (mã K01, tính theo số giờ thực hiện) và ghi rõ nội dung.</div>'; return; }
    box.innerHTML = '<div class="pick cat">' + list.map(function (c) {
      return '<label><input type="checkbox" data-cat="' + h(c.id) + '"' + (CATQ.sel[c.id] ? ' checked' : '') + '><span><b>' + h(c.id) + '</b> · ' + h(c.name) +
        '<br><span class="muted small">' + h(c.level) + ' · <b>' + f4(c.point) + ' điểm</b>/' + h(c.unit || 'sản phẩm') + ' · thời gian chuẩn ' + h(c.time) + (c.purpose && c.purpose !== c.type ? ' · ' + h(c.purpose) : '') +
        (c.example ? '<br>Ví dụ: ' + h(c.example.slice(0, 260)) + (c.example.length > 260 ? '…' : '') : '') + '</span></span>' +
        '<button type="button" class="btn sm primary" data-act="catOne" data-id="' + h(c.id) + '">Thêm</button></label>';
    }).join('') + '</div><div class="actions" style="margin-top:8px"><button type="button" class="btn primary" data-act="catAdd">Thêm các sản phẩm đã tích vào phiếu</button>' +
      '<button type="button" class="btn" data-act="catAll">Tích tất cả đang thấy</button><button type="button" class="btn" data-act="catHide">Đóng danh sách</button>' +
      '<span class="muted small">' + list.length + ' sản phẩm. Thêm xong, ghi rõ tên việc đã làm và nhập số lượng.</span></div>';
  }
  /** Tạo dòng công việc từ một mã trong danh mục. Người phụ trách thêm cho cấp dưới thì là việc mới chờ giao hoặc xác nhận. */
  function catTask(c) {
    var t = E.canMgr ? blankMgrTask() : blankTask();
    t.code = c.id; t.name = c.name; t.product = c.type; t.unit = c.unit; t.std = c.point; t.hours = c.hours; t.n = c.level; t.qty = 1;
    if (E.canMgr) { t.H = 1; t.Q = 1; t.T = 1; E.sel[t.id] = true; E.showMgr = true; }
    return t;
  }
  function catPush(ids) {
    var add = (S.cat || []).filter(function (c) { return ids.indexOf(c.id) >= 0; }).map(catTask);
    if (!add.length) return toast('Chưa tích sản phẩm nào.', true);
    E.tasks = E.tasks.filter(function (t) { return t.name || t.code || KPI_calc(t.s); }).concat(add);
    CATQ.sel = {};
    redrawTable(); catRender();
    toast('Đã thêm ' + add.length + ' công việc từ danh mục. Ghi rõ tên việc, nhập số lượng' + (E.canMgr ? ' rồi bấm Giao việc hoặc Xác nhận.' : ' rồi lưu phiếu.'));
  }
  /** Gợi ý hệ số tiến độ theo số ngày làm việc chậm so với hạn. */
  function suggestT(t) {
    var done = t.mDone || t.doneDate;
    if (!t.deadline || !done || done <= t.deadline) return 1;
    var n = 0, d = new Date(t.deadline + 'T00:00:00'), e = new Date(done + 'T00:00:00');
    for (var g = 0; d < e && g < 400; g++) { d = new Date(d.getTime() + 86400000); var w = d.getDay(); if (w >= 1 && w <= 5) n++; }
    return n <= 0 ? 1 : n < 2 ? 0.5 : 0;
  }
  function hqtSel(t, ti, k) {
    return '<label>' + k + '<select data-hqt="' + k + '" data-t="' + ti + '" title="' + { H: 'Khối lượng hoàn thành', Q: 'Chất lượng sản phẩm', T: 'Tiến độ thực hiện' }[k] + '">' +
      KPI_HQT[k].map(function (o) { return '<option value="' + o[0] + '"' + (Number(t[k]) === o[0] ? ' selected' : '') + ' title="' + h(o[1]) + '">' + fmt(o[0]) + ' · ' + h(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  /** Ô gộp 5 cột A–E của việc trong danh mục. Khối tự kê: thông tin mã; khối lãnh đạo: hệ số H, Q, T. */
  function catCells(t, ti, key, editable) {
    if (key === 's') return '<td class="lv cat" colspan="5"><b>' + h(t.code) + '</b> · ' + h(t.n) + ' · điểm chuẩn <b>' + f4(t.std) + '</b>/' + h(t.unit || 'sản phẩm') + '<div class="muted small" data-g="' + ti + '">' + gText(t) + '</div></td>';
    if (editable) return '<td class="lv cat" colspan="5"><div class="hqt">' + hqtSel(t, ti, 'H') + hqtSel(t, ti, 'Q') + hqtSel(t, ti, 'T') + '</div></td>';
    return '<td class="lv cat" colspan="5">' + (cK(t, 'm') ? 'H <b>' + fmt(t.H) + '</b> · Q <b>' + fmt(t.Q) + '</b> · T <b>' + fmt(t.T) + '</b><div class="muted small">Điểm thực đạt P = G × ' + fmt(KPI_factor(t, (E.d || {}).rule)) + ' = <b>' + f4(Math.round(cK(t, 'm').point * (Number(t.qty) || 0) * 1e4) / 1e4) + '</b></div>' : '<span class="muted">Chưa xác nhận</span>') + '</td>';
  }
  /** Dòng tính điểm của việc trong danh mục: G theo điểm chuẩn (hoặc theo A–E nếu đã điều chỉnh), và P sau khi người phụ trách xác nhận. */
  function gText(t) {
    var q = Number(t.qty) || 0, s = cK(t, 's'), m = cK(t, 'm'), r = function (x) { return f4(Math.round(x * 1e4) / 1e4); };
    var out = 'Điểm giao chuẩn G = ' + f4(s.point) + ' × ' + fmt(q) + ' = <b>' + r(s.point * q) + '</b>' + (s.adj ? ' (đã điều chỉnh theo A–E: ' + h(s.n) + ' thay cho ' + h(t.n) + ')' : '');
    if (m) out += '<br>Xác nhận: H <b>' + fmt(t.H) + '</b> · Q <b>' + fmt(t.Q) + '</b> · T <b>' + fmt(t.T) + '</b>' + (m.adj && m.base !== s.point ? ' · lãnh đạo điều chỉnh A–E: ' + h(m.n) + ' (' + f4(m.base) + ' điểm)' : '') +
      ' → điểm thực đạt P = <b>' + r(m.point * q * (1 + (Number(t.mBonus) || 0) / 100)) + '</b>';
    return out;
  }
  function catInfoHtml(t, ti) {
    return '<div class="catinfo"><span class="badge b-blue">' + h(t.code) + '</span> ' + h(t.n) + ' · điểm chuẩn <b>' + f4(t.std) + '</b>/' + h(t.unit || 'sản phẩm') +
      '<div class="muted small" data-g="' + ti + '">' + gText(t) + '</div></div>';
  }
  /** Dải chỉ số của phiếu: G, P, tỷ lệ KPI, giờ chuẩn quy đổi so với quỹ giờ làm việc của kỳ. */
  function kpiStripHtml() {
    return '<div class="stats kpi-strip" style="margin:14px 0 0"><div class="stat"><div class="v" id="kG">–</div><div class="l">Điểm giao chuẩn đã xác nhận (G)</div></div>' +
      '<div class="stat s-done"><div class="v" id="kP">–</div><div class="l">Điểm thực đạt (P)</div></div>' +
      '<div class="stat hl"><div class="v" id="kPct">–</div><div class="l">Tỷ lệ KPI = P / G</div></div>' +
      '<div class="stat"><div class="v" id="kH">–</div><div class="l">Giờ chuẩn quy đổi của phiếu</div><div class="x" id="kHx"></div></div></div>';
  }
  function updateKpiStrip() {
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    var G = 0, P = 0, hours = 0;
    document.querySelectorAll('#taskBox [data-g]').forEach(function (el) { var x = E.tasks[+el.dataset.g]; if (x) el.innerHTML = gText(x); });
    E.tasks.forEach(function (t) {
      var q = Number(t.qty) || 0, s = cK(t, 's'), m = t.locked ? cK(t, 'm') : null;
      hours += q * (t.code ? Number(t.hours) || 0 : s ? s.point * 4 : 0);
      if (m && s) { G += q * s.point; P += q * m.point * (1 + (Number(t.mBonus) || 0) / 100); }
    });
    set('kG', f4(Math.round(G * 10000) / 10000)); set('kP', f4(Math.round(P * 10000) / 10000));
    set('kPct', G ? fmt(P / G * 100) + '%' : '–'); set('kH', fmt(hours) + ' giờ');
    var wh = E.d.workHours || 0;
    set('kHx', wh ? 'quỹ giờ làm việc của kỳ: ' + fmt(wh) + ' giờ' + (hours > wh ? ' · vượt quỹ giờ, cần rà soát kê khai' : '') : '');
  }

  /* ---------- Quản trị Danh mục sản phẩm ---------- */
  var CADM = { type: '' };
  function hoursFromTime(time, point, unit) {
    var t = String(time || '').toLowerCase().replace(/,/g, '.'), fr = function (x) { var p = x.split('/'); return p.length === 2 ? Number(p[0]) / Number(p[1]) : Number(x); }, m;
    if (unit === 'Trang' || /bộ hồ sơ/.test(t)) return Math.round(point * 4 * 1e6) / 1e6;
    if ((m = /^\s*(\d+(?:\/\d+)?)\s*-\s*(\d+(?:\/\d+)?)\s*giờ/.exec(t))) return Math.round((fr(m[1]) + fr(m[2])) / 2 * 1e4) / 1e4;
    if ((m = /^\s*(\d+)\s*phút/.exec(t))) return Math.round(Number(m[1]) / 60 * 1e4) / 1e4;
    if ((m = /^\s*(\d+(?:\/\d+)?)\s*giờ/.exec(t))) return Math.round(fr(m[1]) * 1e4) / 1e4;
    return Math.round(point * 4 * 1e6) / 1e6;
  }
  function catAdminHtml() {
    var all = S.cat || [], types = [], seen = {};
    all.forEach(function (c) { if (!seen[c.type]) { seen[c.type] = 1; types.push(c.type); } });
    var list = all.filter(function (c) { return !CADM.type || c.type === CADM.type; });
    return '<div class="card"><div class="actions" style="justify-content:space-between;margin-bottom:12px"><div><h2 style="margin:0">Danh mục sản phẩm <span class="muted small" style="font-weight:400">· ' + all.length + ' mã, ' + types.length + ' loại</span></h2>' +
      '<label class="f" style="margin:8px 0 0;max-width:340px"><span>Lọc theo loại sản phẩm</span><select id="caType"><option value="">Tất cả các loại</option>' + opts(types.map(function (t) { return [t, t]; }), CADM.type) + '</select></label></div>' +
      '<div class="actions"><button class="btn" data-act="caImportOpen">Nạp từ Excel</button><button class="btn" data-act="caExcel">Xuất ra Excel</button><button class="btn primary" data-act="caEdit" data-id="">Thêm mã sản phẩm</button></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="num">TT</th><th>Loại sản phẩm</th><th>Mã</th><th>Tên sản phẩm</th><th>Thời gian chuẩn</th><th>Mức N</th><th class="num">Điểm chuẩn</th><th>Đơn vị tính</th><th class="num">Giờ chuẩn</th><th></th></tr></thead><tbody>' +
      (list.map(function (c) {
        return '<tr' + (c.active ? '' : ' style="opacity:.55"') + '><td class="num">' + c.order + '</td><td>' + h(c.type) + '</td><td class="nowrap"><b>' + h(c.id) + '</b></td><td>' + h(c.name) + (c.example ? '<div class="muted small">' + h(c.example.slice(0, 180)) + (c.example.length > 180 ? '…' : '') + '</div>' : '') + '</td>' +
          '<td class="nowrap">' + h(c.time) + '</td><td>' + h(c.level) + '</td><td class="num"><b>' + f4(c.point) + '</b></td><td>' + h(c.unit) + '</td><td class="num">' + f4(c.hours) + '</td>' +
          '<td class="right nowrap"><button class="btn sm" data-act="caEdit" data-id="' + h(c.id) + '">Sửa</button> <button class="btn sm danger" data-act="caDel" data-id="' + h(c.id) + '">Xoá</button></td></tr>';
      }).join('') || '<tr><td colspan="10" class="muted center">Danh mục chưa có mã nào. Bấm “Nạp từ Excel” để nạp tệp danh mục của cơ quan.</td></tr>') + '</tbody></table></div>' +
      '<p class="muted small" style="margin:10px 0 0">Điểm giao chuẩn của một công việc = điểm chuẩn của mã × số lượng. Sửa danh mục chỉ áp dụng cho các việc kê sau đó; việc đã kê giữ điểm chuẩn tại thời điểm kê. Giờ chuẩn dùng để đối chiếu với quỹ giờ làm việc của kỳ.</p></div>';
  }
  function caRedraw() { $('#view').innerHTML = adminHtml('catalog'); }
  var CAX = null;
  /** Đọc sheet theo mẫu "DANH MỤC SẢN PHẨM": TT, Loại sản phẩm, Mục đích, Tên sản phẩm, Mã, Ví dụ, Thời gian tiêu chuẩn, Mức N, Điểm theo mức N, Đơn vị tính, (số lượng), Điểm chuẩn. Ô gộp ở cột Loại, Mục đích được điền xuống. */
  function catFromRows(rows) {
    var out = [], type = '', purpose = '';
    rows.forEach(function (r) {
      r = (r || []).map(function (x) { return String(x == null ? '' : x).trim(); });
      if (!r.length || /^tt$/i.test(r[0]) || /mã sản phẩm/i.test(r[4] || '')) return;
      if (r[1]) type = r[1];
      if (r[2]) purpose = r[2];
      var id = r[4] || '', point = Number(String(r[11] || r[8] || '').replace(',', '.'));
      if (!id || !(point > 0)) return;
      var name = (r[3] || '').replace(/\s*\n\s*/g, ' ').trim(), note = /\(Cân nhắc\)/i.test(name) ? ' (đang cân nhắc)' : '';
      name = name.replace(/\s*\(Cân nhắc\)\s*/i, ' ').trim();
      out.push({ order: Number(r[0]) || out.length + 1, type: type, purpose: purpose, name: name, id: id, example: (r[5] || '').replace(/\s+/g, ' ').trim(), time: r[6] || '', level: (r[7] || '') + note,
        point: point, unit: r[9] || '', hours: hoursFromTime(r[6], point, r[9] || '') });
    });
    return out;
  }

  Object.assign(ACT, {
    catOne: function (el) { catPush([el.dataset.id]); },
    catAdd: function () { catPush(Object.keys(CATQ.sel).filter(function (k) { return CATQ.sel[k]; })); },
    catAll: function () { (catMatches() || []).forEach(function (c) { CATQ.sel[c.id] = true; }); catRender(); },
    catHide: function () { CATQ.sel = {}; CATQ.type = ''; var a = $('#catType'), b = $('#catQ'); if (a) a.value = ''; if (b) b.value = ''; catRender(); },
    assignSel: function (el) {
      var rows = selectedRows().filter(function (i) { return E.tasks[i].isNew; });
      if (!rows.length) return toast('Chưa có việc mới nào được chọn để giao. Thêm việc từ danh mục rồi tích ô đầu dòng.', true);
      doScore(rows, 'assign', el);
    },
    caEdit: function (el) {
      var cur = (S.cat || []).filter(function (c) { return c.id === el.dataset.id; })[0], isNew = !cur;
      cur = cur || { id: '', type: CADM.type || '', purpose: '', name: '', example: '', time: '', level: 'N1', point: 0.25, unit: '', hours: '', active: true };
      formDialog(isNew ? 'Thêm mã sản phẩm' : 'Sửa mã ' + cur.id, [['id', 'Mã sản phẩm (ví dụ CV14)', isNew ? 'text' : 'readonly'], ['type', 'Loại sản phẩm', 'text'], ['purpose', 'Mục đích, nhóm nghiệp vụ', 'text'],
        ['name', 'Tên sản phẩm', 'textarea'], ['example', 'Ví dụ sản phẩm thực tế', 'textarea'], ['time', 'Thời gian tiêu chuẩn (ví dụ 02 - 04 giờ)', 'text'], ['level', 'Mức N (ví dụ N2, N1/2)', 'text'],
        ['point', 'Điểm chuẩn một đơn vị (N1 = 0,25; N2 = 0,5; N3 = 1; N4 = 2; N5 = 4)', 'number'], ['unit', 'Đơn vị tính', 'text'], ['hours', 'Giờ chuẩn quy đổi một đơn vị (để trống: tự tính)', 'number'], ['active', 'Đang dùng (bỏ tích để ẩn khỏi danh sách chọn)', 'check']], cur).then(async function (res) {
        if (!res) return;
        try {
          res.button.disabled = true;
          var v = res.values;
          if (!Number(v.hours)) v.hours = hoursFromTime(v.time, Number(v.point) || 0, v.unit);
          v.order = cur.order || 0;
          var r = await api('adminCatalogSave', { item: v, isNew: isNew });
          S.cat = r.items; modal.innerHTML = ''; caRedraw(); toast('Đã lưu mã ' + r.id + '.');
        } catch (e) { res.button.disabled = false; toast(e.message, true); }
      });
    },
    caDel: function (el) {
      if (!confirm('Xoá mã ' + el.dataset.id + ' khỏi danh mục? Các việc đã kê theo mã này vẫn giữ nguyên điểm.')) return;
      run(el, async function () { S.cat = (await api('adminCatalogDelete', { id: el.dataset.id })).items; caRedraw(); toast('Đã xoá.'); });
    },
    caExcel: function (el) {
      run(el, async function () {
        if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        var aoa = [['TT', 'Loại sản phẩm', 'Mục đích', 'Tên sản phẩm', 'Mã Sản phẩm', 'Ví dụ sản phẩm thực tế', 'Thời gian tiêu chuẩn', 'Mức N', 'Điểm theo mức N', 'Đơn vị tính', 'Cán bộ nhập số lượng', 'Điểm chuẩn', 'Giờ chuẩn quy đổi']]
          .concat((S.cat || []).map(function (c) { return [c.order, c.type, c.purpose, c.name, c.id, c.example, c.time, c.level, c.point, c.unit, 1, c.point, c.hours]; }));
        var ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [5, 18, 22, 56, 9, 70, 16, 10, 10, 14, 10, 10, 10].map(function (w) { return { wch: w }; });
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'DM_SAN_PHAM');
        XLSX.writeFile(wb, 'DanhMucSanPham_KPI.xlsx');
      });
    },
    caImportOpen: function () {
      CAX = null;
      modal.innerHTML = '<div class="dlg" style="max-width:760px"><h2>Nạp Danh mục sản phẩm từ Excel</h2>' +
        '<p class="small">Chọn tệp theo mẫu <b>DANH MỤC SẢN PHẨM (THÍ ĐIỂM KPI).xlsx</b>: các cột TT, Loại sản phẩm, Mục đích, Tên sản phẩm, Mã Sản phẩm, Ví dụ, Thời gian tiêu chuẩn, Mức N, Điểm theo mức N, Đơn vị tính, Cán bộ nhập số lượng, Điểm chuẩn. Mã đã có thì cập nhật, mã mới thì thêm.</p>' +
        '<label class="f"><span>Tệp Excel (.xlsx)</span><input type="file" id="caFile" accept=".xlsx,.xls"></label><div id="caBody"><p class="muted small">Chưa chọn tệp.</p></div>' +
        '<label class="chk" style="margin-top:12px"><input type="checkbox" id="caReplace">Thay toàn bộ danh mục (xoá những mã không có trong tệp)</label>' +
        '<div class="actions"><button class="btn" data-act="closeModal">Huỷ</button><button class="btn primary" data-act="caImportApply">Nạp danh mục</button></div></div>';
    },
    caImportApply: function (el) {
      if (!CAX || !CAX.length) return toast('Chưa có mã nào để nạp. Chọn tệp trước.', true);
      var replace = $('#caReplace').checked;
      if (replace && !confirm('Thay toàn bộ danh mục bằng ' + CAX.length + ' mã trong tệp?')) return;
      run(el, async function () {
        var r = await api('adminCatalogImport', { items: CAX, replace: replace });
        S.cat = r.items; modal.innerHTML = ''; caRedraw(); toast('Đã nạp ' + r.saved + ' mã sản phẩm.');
      });
    }
  });
  document.addEventListener('input', function (ev) { if (ev.target.id === 'catQ') catRender(); });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.id === 'catType') { CATQ.type = el.value; return catRender(); }
    if (el.dataset && el.dataset.cat !== undefined) { CATQ.sel[el.dataset.cat] = el.checked; return; }
    if (el.dataset && el.dataset.hqt && E) { // đổi hệ số H, Q, T: tính lại điểm thực đạt của dòng
      var t = E.tasks[+el.dataset.t];
      t[el.dataset.hqt] = Number(el.value);
      if (el.dataset.hqt === 'Q' && t.Q === 0) { t.H = 0; var hs = $('select[data-hqt="H"][data-t="' + el.dataset.t + '"]'); if (hs) hs.value = '0'; }
      updateRow(+el.dataset.t); updateTotals(); return;
    }
    if (el.id === 'caType') { CADM.type = el.value; return caRedraw(); }
    if (el.id === 'caFile' && el.files[0]) {
      var file = el.files[0];
      run(null, async function () {
        if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        var wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }), best = [];
        wb.SheetNames.forEach(function (n) { var items = catFromRows(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true })); if (items.length > best.length) best = items; });
        CAX = best;
        var types = {}; best.forEach(function (c) { types[c.type] = 1; });
        $('#caBody').innerHTML = best.length ? '<p class="small">Nhận ra <b>' + best.length + '</b> mã sản phẩm thuộc <b>' + Object.keys(types).length + '</b> loại.</p><div class="pick" style="max-height:30vh">' +
          best.slice(0, 300).map(function (c) { return '<label style="cursor:default"><span><b>' + h(c.id) + '</b> · ' + h(c.name) + '<br><span class="muted small">' + h(c.type) + ' · ' + h(c.level) + ' · ' + f4(c.point) + ' điểm/' + h(c.unit) + ' · ' + f4(c.hours) + ' giờ</span></span></label>'; }).join('') + '</div>'
          : '<p class="muted small">Không nhận ra mã sản phẩm nào trong tệp.</p>';
      });
    }
  });

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (ev.target.closest('a[href]') && el.tagName === 'TR') return;
    var fn = ACT[el.dataset.act];
    if (fn) { if (el.tagName !== 'A') ev.preventDefault(); fn(el); }
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (!E || !el.dataset || !el.dataset.fld || el.tagName === 'SELECT' || el.dataset.t === undefined) return;
    E.tasks[+el.dataset.t][el.dataset.fld] = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.fld === 'qty') updateTotals();
    if (el.dataset.fld === 'name') updateTotals();
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (!el.dataset) return;
    if (el.id === 'reportUnit') { reportUnit = el.value; render(); return; }
    if (el.id === 'prevSel') { loadPrev(); return; }
    if (E && el.dataset.sel !== undefined) { E.sel[el.dataset.sel] = el.checked; return; }
    if (E && el.id === 'selAll') { E.tasks.forEach(function (t) { E.sel[t.id] = el.checked; }); document.querySelectorAll('input[data-sel]').forEach(function (c) { c.checked = el.checked; }); return; }
    if (el.id === 'prevAll') { document.querySelectorAll('#prevList input[data-i]').forEach(function (c) { c.checked = el.checked; }); return; }
    if (!E) return;
    var ti = +el.dataset.t;
    if (el.dataset.lv) { // chọn mức A..E: tính lại S, N, điểm của dòng
      var t = E.tasks[ti];
      if (!t[el.dataset.lv]) t[el.dataset.lv] = [0, 0, 0, 0, 0];
      t[el.dataset.lv][+el.dataset.fi] = +el.value;
      el.classList.toggle('empty', !+el.value && !t.code);
      updateRow(ti); updateTotals();
    } else if (el.dataset.fld === 'qty') {
      var q = Number(el.value);
      if (!(q > 0)) q = 1;
      el.value = q; E.tasks[ti].qty = q;
      updateTotals();
    } else if (el.dataset.fld && el.tagName === 'SELECT') {
      E.tasks[ti][el.dataset.fld] = el.value;
    } else if (el.dataset.upfile !== undefined && el.files[0]) {
      var file = el.files[0], row = +el.dataset.upfile;
      if (file.size > 5 * 1024 * 1024) return toast('Tệp quá lớn (tối đa 5 MB). Hãy tải lên Drive rồi dán đường dẫn.', true);
      var reader = new FileReader();
      reader.onload = function () {
        toast('Đang tải tệp lên…');
        run(null, async function () {
          var r = await api('upload', { name: file.name, mime: file.type, data: String(reader.result).split(',')[1] });
          E.tasks[row].link = r.url;
          var input = $('input[data-fld="link"][data-t="' + row + '"]');
          if (input) input.value = r.url;
          toast('Đã đính kèm ' + file.name);
        });
      };
      reader.readAsDataURL(file);
    }
  });
  document.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'pwForm') return;
    ev.preventDefault();
    var f = ev.target;
    if (f.newPassword.value !== f.again.value) return toast('Hai lần nhập mật khẩu mới không khớp.', true);
    run($('button', f), async function () {
      var r = await api('changePassword', { oldPassword: f.oldPassword.value, newPassword: f.newPassword.value });
      localStorage.setItem('kpi_token', r.token);
      S.user = r.user;
      toast('Đã đổi mật khẩu.');
      location.hash = '#/tongquan';
      render();
    });
  });
  window.addEventListener('hashchange', render);

  /* ---------- Khởi động ---------- */
  (async function start() {
    if (localStorage.getItem('kpi_token')) {
      try { setBoot(await API.call('bootstrap')); } catch (e) { localStorage.removeItem('kpi_token'); }
    }
    render();
  })();
})();
