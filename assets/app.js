/* Giao diện phần mềm KPI CÁN BỘ CÔNG CHỨC */
(function () {
  'use strict';
  var API = window.KPI_API, CFG = window.KPI_CONFIG || {};
  var app = document.getElementById('app'), modal = document.getElementById('modal');
  var S = { user: null, hasReports: false, units: [], periods: [], config: {}, canUpload: false, periodId: '', ov: null, ovKey: '' };
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
    S.ov = null;
  }
  function logout() {
    localStorage.removeItem('kpi_token');
    S.user = null; S.ov = null; E = null; ADMIN = null; DASH = { type: '', id: '' };
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

  var TITLES = { tongquan: 'Tổng quan', tudanhgia: 'Phiếu tự đánh giá', phieu: 'Phiếu đánh giá', duyet: 'Đánh giá cấp dưới', baocao: 'KPI tổng hợp', quantri: 'Quản trị hệ thống', tieuchi: 'Bảng tiêu chí chấm điểm', matkhau: 'Đổi mật khẩu' };
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
    var view = shell(route, TITLES[route], ['tongquan', 'tudanhgia', 'phieu', 'duyet', 'baocao'].indexOf(route) >= 0);
    try {
      var needPeriod = ['tongquan', 'tudanhgia', 'phieu', 'duyet', 'baocao'].indexOf(route) >= 0;
      if (needPeriod && !S.periodId) {
        view.innerHTML = '<div class="card">Chưa có kỳ đánh giá nào. ' + (S.user.isAdmin ? 'Vào <a href="#/quantri/periods">Quản trị › Kỳ đánh giá</a> để tạo.' : 'Vui lòng liên hệ quản trị viên.') + '</div>';
        return;
      }
      var html;
      if (route === 'tongquan') html = dashboardHtml(await overview());
      else if (route === 'duyet') html = reviewHtml(await overview());
      else if (route === 'baocao') html = reportHtml(await overview());
      else if (route === 'tudanhgia' || route === 'phieu') {
        var d = await api('getEvaluation', { periodId: S.periodId, userId: route === 'phieu' ? arg : '' });
        if (seq !== renderSeq) return;
        setEval(d);
        return;
      } else if (route === 'quantri') {
        ADMIN = await api('adminList');
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
      if (r.status === 'da_chot') { g.done++; g.sum += r.finalTotal || 0; }
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
      '<span class="rt">' + (lead ? '<b>' + fmt(r.kpi) + '</b> <span class="muted small">KPI</span>' : badge(r.status) + (r.finalTotal != null ? ' <b>' + fmt(r.finalTotal) + '</b>' : '')) + '</span></button>';
  }
  function sortPeople(a, b) { return KPI_LEVELS[a.user.level].rank - KPI_LEVELS[b.user.level].rank || a.user.fullName.localeCompare(b.user.fullName, 'vi'); }
  function focusHtml(rows) {
    if (!DASH.type) return '';
    var title, list, crumbs = '<button data-act="dashBack">‹ Đóng</button>';
    if (DASH.type === 'unit') {
      var ids = unitIdsUnder(DASH.id);
      list = rows.filter(function (r) { return ids[r.user.unitId]; }).sort(sortPeople);
      title = 'Đơn vị: ' + unitName(DASH.id);
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
      (DASH.type === 'unit' ? 'Danh sách cá nhân trong đơn vị (gồm đơn vị trực thuộc). Bấm vào một người để mở phiếu; bấm vào người phụ trách để xem nhóm của họ.' : 'Những người do đồng chí này trực tiếp phụ trách. Bấm vào cấp phó, cấp trưởng để xem tiếp các cá nhân họ phụ trách; bấm vào cá nhân để mở phiếu.') + '</div></div>' +
      '<div class="people">' + (list.map(function (r) { return personHtml(rows, r); }).join('') || '<div class="muted">Không có ai.</div>') + '</div></div>';
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
    var html = '';

    if (me.selfEval) {
      html += '<div class="card"><h2>Phiếu của tôi · ' + h(p.name) + '</h2><div class="stats" style="margin-bottom:12px">' +
        '<div class="stat"><div class="l">Trạng thái</div><div class="v" style="font-size:18px;margin-top:6px">' + badge(mine.status) + '</div></div>' +
        '<div class="stat"><div class="v">' + (mine.taskCount || 0) + '</div><div class="l">Công việc đã kê</div></div>' +
        '<div class="stat"><div class="v">' + fmt(mine.selfTotal) + '</div><div class="l">Điểm tự chấm</div></div>' +
        '<div class="stat s-done"><div class="v">' + fmt(mine.finalTotal) + '</div><div class="l">Điểm được công nhận</div></div></div>' +
        '<div class="actions"><a class="btn primary" href="#/tudanhgia">Mở phiếu tự đánh giá</a><span class="muted">' + h(dl) + '</span>' +
        (!me.managerId ? '<span class="badge b-amber">Chưa được khai người phụ trách đánh giá</span>' : '') + '</div></div>';
    }
    if (!others.length && !me.isAdmin) return html + '<div class="card"><h2>Điểm của tôi qua các kỳ</h2>' + trendHtml(ov.trend) + '</div>';

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

    var tree = unitTree(), byUnit = tree.map(function (x) {
      var ids = unitIdsUnder(x.u.id);
      return { u: x.u, depth: x.depth, g: groupOf(rows.filter(function (r) { return ids[r.user.unitId]; })) };
    }).filter(function (x) { return x.g.n; });
    html += '<div class="grid cols-2"><div class="card"><h2>Tiến độ đánh giá · ' + h(p.name) + '</h2>' + donut(all) + (dl ? '<p class="muted small" style="margin:12px 0 0">' + h(dl) + '</p>' : '') + '</div>' +
      '<div class="card"><h2>Tiến độ chấm điểm từng đơn vị</h2>' + byUnit.map(function (x) {
        return '<button class="bar-row' + (DASH.type === 'unit' && DASH.id === x.u.id ? ' on' : '') + '" data-act="dashUnit" data-id="' + h(x.u.id) + '" title="Bấm để xem danh sách cá nhân"><span>' + pad(x.depth) + h(x.u.name) + '</span>' + stackBar(x.g) +
          '<span class="right small"><b>' + x.g.done + '/' + x.g.n + '</b> · ' + fmt(x.g.sum) + 'đ</span></button>';
      }).join('') + '<div class="legend">' + GROUPS.map(function (x) { return '<span><i style="background:' + x[2] + '"></i>' + x[1] + '</span>'; }).join('') + '</div><p class="muted small" style="margin:8px 0 0">Bấm vào một đơn vị để xem tiến độ từng cá nhân.</p></div></div>';

    html += focusHtml(rows);

    var base = mine.reports ? rows.filter(function (r) { return r.user.managerId === me.id; }) : rows.filter(function (r) { return r.reports > 0 && !rows.some(function (x) { return x.user.id === r.user.managerId; }); });
    if (base.length) {
      html += '<div class="card"><h2>' + (mine.reports ? 'Những người tôi trực tiếp phụ trách' : 'Theo người phụ trách') + '</h2><div class="people">' + base.sort(sortPeople).map(function (r) { return personHtml(rows, r); }).join('') + '</div>' +
        '<p class="muted small" style="margin:10px 0 0">Bấm vào cấp trưởng, cấp phó để xem các cá nhân họ phụ trách; bấm vào cá nhân để mở phiếu.</p></div>';
    }

    var rm = remindText(ov), ks = Object.keys(rm.pend);
    html += '<div class="grid cols-2"><div class="card"><h2>Nhắc nhở</h2>' +
      (rm.late.length || ks.length ? '' : '<div class="muted">Không còn ai phải nhắc trong kỳ này.</div>') +
      (rm.late.length ? '<p style="margin:0 0 6px"><b>' + rm.late.length + '</b> người chưa nộp phiếu' + (dl ? ' · <span class="muted">' + h(dl) + '</span>' : '') + '</p><div class="tbl-wrap" style="max-height:240px;overflow:auto"><table class="tbl"><tbody>' + rm.late.map(function (r) {
        return '<tr class="click" data-act="open" data-u="' + h(r.user.id) + '"><td>' + h(r.user.fullName) + '<div class="muted small">' + h(unitName(r.user.unitId)) + '</div></td><td class="right">' + badge(r.status) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '') +
      (ks.length ? '<p style="margin:12px 0 6px"><b>Người phụ trách còn phiếu chờ chấm</b></p>' + ks.map(function (k) { return '<div class="bar-row" style="grid-template-columns:1fr auto"><span>' + h(rm.names[k] || 'Chưa khai người phụ trách') + '</span><span class="badge b-blue">' + rm.pend[k] + ' phiếu</span></div>'; }).join('') : '') +
      (rm.late.length || ks.length ? '<div class="actions" style="margin-top:12px"><button class="btn" data-act="copyRemind">Chép nội dung nhắc nhở</button><span class="muted small">Dán vào Zalo, email để gửi</span></div>' : '') + '</div>' +
      '<div class="card"><h2>KPI tổng hợp ' + (wide ? 'của tôi' : 'do tôi phụ trách') + ' qua các kỳ</h2>' + trendHtml(ov.trend) + '</div></div>';
    return html;
  }

  /* ---------- Đánh giá cấp dưới ---------- */
  function rowsTable(rows, withAction) {
    if (!rows.length) return '<div class="muted">Không có ai.</div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Họ tên</th><th>Đơn vị</th><th>Cấp</th><th class="num">Số việc</th><th class="num">Tự chấm</th><th class="num">Được công nhận</th><th class="num">KPI tổng hợp</th><th>Trạng thái</th>' + (withAction ? '<th></th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="click" data-act="open" data-u="' + h(r.user.id) + '"><td><b>' + h(r.user.fullName) + '</b><div class="muted small">' + h(r.user.title) + '</div></td><td>' + h(unitName(r.user.unitId)) + '</td><td>' + h(LEVEL[r.user.level]) + '</td>' +
          '<td class="num">' + (r.taskCount || '–') + '</td><td class="num">' + fmt(r.selfTotal) + '</td><td class="num">' + fmt(r.finalTotal) + '</td><td class="num"><b>' + fmt(r.kpi) + '</b></td><td>' + badge(r.status) + '</td>' +
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
    E.tasks.forEach(function (t) { var c = KPI_calc(t[key]); if (c) sum += (Number(t.qty) || 0) * c.point; });
    return Math.round(sum * 100) / 100;
  }
  function ratingOf(score) {
    var rs = (S.config.ratings || []).slice().sort(function (a, b) { return b.min - a.min; });
    for (var i = 0; i < rs.length; i++) if (score >= rs[i].min) return rs[i].name;
    return '';
  }
  function setEval(d) {
    var p = d.perms;
    E = { d: d, tasks: JSON.parse(JSON.stringify(d.ev.tasks || [])), months: periodMonths(d.period), canMgr: p.canReview };
    E.tasks.forEach(function (t) {
      if (!t.s) t.s = [0, 0, 0, 0, 0];
      if (E.canMgr && !KPI_calc(t.m)) t.m = (KPI_calc(t.pm) ? t.pm : t.s).slice(); // điền sẵn: kết quả kỳ trước nếu có, không thì theo mức cán bộ tự chọn
    });
    E.showMgr = E.canMgr || E.tasks.some(function (t) { return KPI_calc(t.m); });
    E.note = '';
    if (p.canEdit && d.ev.status === 'chua_lap' && d.carry && d.carry.tasks.length) { // việc lặp lại từ kỳ trước
      E.tasks = d.carry.tasks;
      E.note = 'Đã tự đưa sang ' + d.carry.tasks.length + ' công việc lặp lại từ ' + d.carry.from + ' kèm mức tự chấm. Kiểm tra, chỉnh lại nếu cần rồi lưu.';
    }
    if (p.canEdit && !E.tasks.length) E.tasks.push(blankTask());
    $('#view').innerHTML = evalHtml();
    updateTotals();
    updateBadge();
  }
  function opts(list, cur) {
    return list.map(function (o) { return '<option value="' + h(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join('');
  }
  function levelCell(t, ti, key, fi, editable) {
    var f = M.factors[fi], v = (t[key] || [])[fi] || 0;
    if (!editable) return '<td class="lv">' + (v ? '<b>' + v + '</b> · ' + h(f.levels[v - 1][0]) : '<span class="muted">–</span>') + '</td>';
    return '<td class="lv"><select data-lv="' + key + '" data-fi="' + fi + '" data-t="' + ti + '" aria-label="' + f.key + ' – ' + h(f.name) + '"' + (v ? '' : ' class="empty"') + '>' +
      '<option value="0">– chọn –</option>' + opts(f.levels.map(function (l, i) { return [i + 1, (i + 1) + ' · ' + l[0]]; }), v) + '</select></td>';
  }
  function calcCells(t, key) {
    var c = KPI_calc(t[key]);
    return '<td class="num calc" data-calc="' + key + 'S">' + (c ? fmt(c.s) : '') + '</td><td class="center calc" data-calc="' + key + 'N">' + (c ? '<span class="n n' + c.n.slice(1) + '">' + c.n + '</span>' : '') +
      '</td><td class="num calc" data-calc="' + key + 'P"><b>' + (c ? fmt(c.point) : '') + '</b></td>';
  }
  function taskRow(t, ti) {
    var canAll = E.d.perms.canEdit, edit = canAll && !t.locked, months = E.months.indexOf(t.month) < 0 && t.month ? E.months.concat([t.month]) : E.months;
    var name = edit ? '<textarea rows="3" data-fld="name" data-t="' + ti + '" placeholder="Tên công việc (ghi thật rõ việc đã làm)">' + h(t.name) + '</textarea>' +
      '<div class="ev-add no-print"><input type="url" data-fld="link" data-t="' + ti + '" value="' + h(t.link || '') + '" placeholder="Đường dẫn minh chứng (không bắt buộc)">' +
      (S.canUpload ? '<label class="btn sm">Tải tệp<input type="file" hidden data-upfile="' + ti + '"></label>' : '') + '</div>' :
      '<div class="tname">' + h(t.name) + '</div>' + (t.link ? '<a class="small" href="' + h(t.link) + '" target="_blank" rel="noopener">Minh chứng</a>' : '');
    var pc = KPI_calc(t.pm), tags = (t.locked ? '<span class="badge b-green" title="Người phụ trách đã chấm, cán bộ không sửa được">🔒 Đã chấm</span>' : '') +
      (!edit && t.repeat ? '<span class="badge b-blue">Lặp lại</span>' : '') + (t.from ? '<span class="badge b-gray">Từ ' + h(t.from) + '</span>' : '') +
      (pc ? '<span class="badge b-purple">Kỳ trước chấm ' + pc.n + ' · ' + fmt(pc.point) + 'đ</span>' : '');
    name += (edit ? '<label class="chk small no-print"><input type="checkbox" data-fld="repeat" data-t="' + ti + '"' + (t.repeat ? ' checked' : '') + '>Việc lặp lại: tự đưa sang kỳ sau</label>' : '') + (tags ? '<div class="tags">' + tags + '</div>' : '');
    var cells = '<td class="center c-tt">' + (ti + 1) + '</td><td class="c-name">' + name + '</td>' +
      (edit ? '<td><select data-fld="product" data-t="' + ti + '" aria-label="Sản phẩm">' + opts(M.products.map(function (x) { return [x, x]; }), t.product) + '</select></td>' +
        '<td><input type="number" min="0.01" step="any" data-fld="qty" data-t="' + ti + '" value="' + h(t.qty) + '" aria-label="Số lượng sản phẩm"></td>' +
        '<td><select data-fld="month" data-t="' + ti + '" aria-label="Tháng thực hiện">' + opts(months.map(function (x) { return [x, x]; }), t.month) + '</select></td>'
        : '<td>' + h(t.product) + '</td><td class="num">' + fmt(t.qty) + '</td><td class="nowrap">' + h(t.month) + '</td>');
    for (var i = 0; i < 5; i++) cells += levelCell(t, ti, 's', i, edit);
    cells += calcCells(t, 's');
    if (E.showMgr) {
      for (var k = 0; k < 5; k++) cells += levelCell(t, ti, 'm', k, E.canMgr);
      cells += calcCells(t, 'm');
    }
    if (canAll) cells += '<td class="no-print center">' + (edit ? '<button type="button" class="btn sm danger" title="Xoá dòng này" data-act="taskDel" data-t="' + ti + '">×</button>' : '') + '</td>';
    return '<tr data-row="' + ti + '"' + (t.locked ? ' class="locked"' : '') + '>' + cells + '</tr>';
  }
  function tableHtml() {
    var edit = E.d.perms.canEdit, fh = M.factors.map(function (f, i) { return '<th class="fh" title="' + h(f.name) + ' (trọng số ' + M.weights[i] + '%)"><b>' + f.key + '</b> – ' + h(f.name) + '</th>'; }).join('');
    var calcH = '<th class="num">S</th><th>N</th><th class="num">Điểm của N</th>';
    return '<div class="tbl-wrap sheet"><table class="tbl sheet"><thead><tr>' +
      '<th rowspan="2" class="c-tt">TT</th><th rowspan="2" class="c-name">Tên công việc</th><th rowspan="2">Sản phẩm</th><th rowspan="2">Số lượng sản phẩm</th><th rowspan="2">Tháng thực hiện</th>' +
      '<th colspan="5" class="g-self">Cán bộ tự đánh giá</th><th colspan="3" class="g-calc">Công thức tự tính toán</th>' +
      (E.showMgr ? '<th colspan="5" class="g-mgr">Lãnh đạo trực tiếp quản lý chấm</th><th colspan="3" class="g-calc">Công thức tự tính toán</th>' : '') +
      (edit ? '<th rowspan="2" class="no-print"></th>' : '') + '</tr><tr>' + fh + calcH + (E.showMgr ? fh + calcH : '') + '</tr></thead><tbody>' +
      (E.tasks.map(taskRow).join('') || '<tr><td colspan="30" class="muted center">Phiếu chưa có công việc nào.</td></tr>') + '</tbody>' +
      '<tfoot><tr><td class="c-tt"></td><td class="c-name">Tổng cộng: <span id="tCount"></span> công việc</td><td></td><td class="num" id="tQty"></td><td></td>' +
      '<td colspan="7" class="right">Tổng điểm tự chấm (số lượng × điểm của N)</td><td class="num" id="tSelf"></td>' +
      (E.showMgr ? '<td colspan="7" class="right">Tổng điểm được công nhận</td><td class="num" id="tMgr"></td>' : '') + (edit ? '<td class="no-print"></td>' : '') + '</tr></tfoot></table></div>' +
      (edit ? '<div class="actions no-print" style="margin-top:12px"><button class="btn primary" data-act="taskAdd">＋ Thêm công việc</button><button class="btn" data-act="pasteOpen">Dán nhiều dòng từ Excel</button>' + ((E.d.myPeriods || []).length ? '<button class="btn" data-act="prevOpen">Lấy việc từ kỳ trước</button>' : '') + '</div>' : '');
  }
  function redrawTable(focusLast) {
    $('#taskBox').innerHTML = tableHtml();
    updateTotals();
    if (focusLast) { var ta = document.querySelectorAll('#taskBox textarea[data-fld="name"]'); if (ta.length) ta[ta.length - 1].focus(); }
  }
  function evalHtml() {
    var d = E.d, p = d.perms, ev = d.ev, o = d.owner;
    if (ev.status === 'khong_ke') {
      return (o.id !== S.user.id ? '<p><a href="#/baocao">‹ Quay lại KPI tổng hợp</a></p>' : '') +
        '<div class="card"><h2>' + h(o.fullName) + '</h2><div class="muted">' + h(o.title) + ' · ' + h(unitName(o.unitId)) + ' · ' + h(LEVEL[o.level]) + '</div>' +
        '<p>Chức danh này không tự kê công việc. KPI được tổng hợp từ kết quả của những người do đồng chí phụ trách, xem ở mục <a href="#/baocao">KPI tổng hợp</a>.</p></div>';
    }
    var banner = '';
    if (d.period.phase === 'khoa') banner = '<div class="banner gray">Kỳ đánh giá đã khoá, phiếu chỉ xem.</div>';
    else if (ev.status === 'yeu_cau_sua') banner = '<div class="banner amber"><b>Phiếu được yêu cầu sửa.</b> ' + h(ev.mgrComment || '') + '</div>';
    else if (p.canReview) banner = '<div class="banner blue">Phiếu chờ anh/chị đánh giá. Khối “Lãnh đạo trực tiếp quản lý chấm” đã điền sẵn theo mức cán bộ tự chọn, chỉnh lại những mức chưa phù hợp rồi bấm <b>Công nhận kết quả</b>.</div>';
    else if (ev.status === 'cho_duyet') banner = '<div class="banner blue">Phiếu đã nộp, đang chờ ' + h(d.managerName || 'người phụ trách') + ' đánh giá.</div>';
    else if (ev.status === 'da_chot') banner = '<div class="banner green">Kết quả đã được công nhận: <b>' + fmt(ev.finalTotal) + ' điểm' + (ev.rating ? ' – ' + h(ev.rating) : '') + '</b>' +
      (p.addOnly ? '. Các việc đã chấm (🔒) không sửa được; anh/chị vẫn có thể thêm việc mới rồi bấm “Nộp bổ sung” cho đến hạn chốt nhập.' : (o.id === S.user.id ? '. Muốn sửa, đề nghị người phụ trách bấm “Cho đánh giá lại”.' : '')) + '</div>';
    if (o.id === S.user.id && d.period.phase === 'chot' && !p.canEdit && ev.status !== 'da_chot' && ev.status !== 'cho_duyet') banner += '<div class="banner amber">Kỳ này đã chốt nhập' + (d.period.deadline ? ' (hạn ' + fdate(d.period.deadline) + ')' : '') + ' nên anh/chị không nhập được nữa.</div>';
    if (E.note) banner += '<div class="banner blue">' + h(E.note) + '</div>';
    if (p.canEdit && !d.managerName) banner += '<div class="banner amber">Anh/chị chưa được khai người phụ trách đánh giá nên chưa nộp được phiếu (vẫn lưu nháp được). Vui lòng liên hệ quản trị viên.</div>';
    var guide = p.canEdit ? '<details class="card guide no-print"' + (E.tasks.length <= 1 ? ' open' : '') + '><summary>Cách ghi phiếu' + (d.period.deadline ? ' · hạn chốt nhập <b>' + fdate(d.period.deadline) + '</b>' : '') + '</summary>' +
      '<ul><li><b>Tên công việc:</b> ' + h(HINT_NAME) + '</li><li><b>Số lượng sản phẩm:</b> ' + h(HINT_QTY) + '</li>' +
      '<li><b>A, B, C, D, E:</b> chọn mức phù hợp cho từng công việc; S, mức N và điểm của N tự tính. Xem giải thích từng mức ở <a href="#/tieuchi">Bảng tiêu chí</a>.</li></ul></details>' : '';
    function commentBox(id, label, value, editable, placeholder) {
      if (editable) return '<label class="f"><span>' + label + '</span><textarea id="' + id + '" rows="2" placeholder="' + placeholder + '">' + h(value) + '</textarea></label>';
      return value ? '<p><b>' + label + ':</b> ' + h(value) + '</p>' : '';
    }
    var btns = '';
    if (p.canEdit) btns += (p.addOnly ? '' : '<button class="btn" data-act="saveSelf">Lưu nháp</button>') + '<button class="btn primary" data-act="saveSelf" data-submit="1">' + (p.addOnly ? 'Nộp bổ sung' : 'Nộp phiếu') + '</button>';
    if (p.canReview) btns += (E.tasks.some(function (t) { return KPI_calc(t.pm); }) ? '<button class="btn" data-act="fillMgr" data-src="pm">Lấy kết quả kỳ trước</button>' : '') + '<button class="btn" data-act="fillMgr" data-src="s">Lấy theo mức tự chấm</button>';
    if (p.canRedo) btns += '<button class="btn warn" data-act="redo">Cho đánh giá lại</button>';
    if (p.canReview) btns += '<button class="btn ok" data-act="decide" data-d="approve">Công nhận kết quả</button><button class="btn warn" data-act="decide" data-d="return">Yêu cầu sửa</button>';
    if (p.canReopen) btns += '<button class="btn warn" data-act="reopen">Mở lại để đánh giá lại</button>';
    btns += '<button class="btn" data-act="excelEval">Xuất Excel</button><button class="btn" data-act="print">In / Lưu PDF</button>';

    return '<div class="print-head"><b>' + h(S.config.orgName) + '</b><h2 style="margin-top:10px">BẢNG TỰ ĐÁNH GIÁ KẾT QUẢ CÔNG VIỆC</h2><div>' + h(d.period.name) + ' – ' + h(o.fullName) + ', ' + h(o.title) + ', ' + h(unitName(o.unitId)) + '</div></div>' +
      (o.id !== S.user.id ? '<p class="no-print"><a href="#/' + (S.hasReports ? 'duyet' : 'baocao') + '">‹ Quay lại danh sách</a></p>' : '') +
      '<div class="card no-print"><div class="actions" style="justify-content:space-between"><div><h2>' + h(o.fullName) + '</h2><div class="muted">' + h(o.title) + ' · ' + h(unitName(o.unitId)) + '</div><div class="muted small">Người phụ trách đánh giá: ' + (d.managerName ? '<b>' + h(d.managerName) + '</b>' : 'chưa khai') + '</div></div>' + badge(ev.status) + '</div></div>' +
      banner + guide +
      '<div class="card"><div id="taskBox">' + tableHtml() + '</div></div>' +
      '<div class="card"><h2>Nhận xét</h2>' +
      (commentBox('selfComment', 'Tự nhận xét của cán bộ', ev.selfComment, p.canEdit, 'Không bắt buộc') +
        commentBox('mgrComment', 'Nhận xét của người phụ trách', ev.mgrComment, p.canReview, 'Bắt buộc khi yêu cầu sửa') || '<div class="muted">Chưa có nhận xét.</div>') +
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
      var c = KPI_calc(t[key]);
      var set = function (part, html) { var el = $('[data-calc="' + key + part + '"]', tr); if (el) el.innerHTML = html; };
      set('S', c ? fmt(c.s) : ''); set('N', c ? '<span class="n n' + c.n.slice(1) + '">' + c.n + '</span>' : ''); set('P', '<b>' + (c ? fmt(c.point) : '') + '</b>');
    });
  }
  function updateTotals() {
    if (!E) return;
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    var named = E.tasks.filter(function (t) { return t.name || KPI_calc(t.s); });
    set('tCount', named.length);
    set('tQty', fmt(named.reduce(function (s, t) { return s + (Number(t.qty) || 0); }, 0)));
    set('tSelf', fmt(sumPoints('s'))); set('tMgr', fmt(sumPoints('m')));
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
    var cc = function (t, key) { var c = KPI_calc(t[key]); return c ? [c.s, c.n, c.point] : ['', '', '']; };
    var aoa = [
      ['TT', 'Tên công việc', 'Sản phẩm', 'Số lượng sản phẩm', 'Tháng thực hiện', 'Cán bộ tự đánh giá', '', '', '', '', 'Công thức tự tính toán', '', '', 'Lãnh đạo trực tiếp quản lý chấm', '', '', '', '', 'Công thức tự tính toán', '', ''],
      ['', '', '', '', ''].concat(fh, ['S', 'N', 'Điểm của N'], fh, ['S', 'N', 'Điểm của N'])
    ].concat(E.tasks.map(function (t, i) {
      return [i + 1, t.name, t.product, Number(t.qty) || 0, t.month].concat(lv(t, 's'), cc(t, 's'), E.showMgr ? lv(t, 'm') : blank5, E.showMgr ? cc(t, 'm') : ['', '', '']);
    }));
    aoa.push(['', 'Tổng điểm (số lượng × điểm của N)', '', '', '', '', '', '', '', '', '', '', sumPoints('s'), '', '', '', '', '', '', '', E.showMgr ? sumPoints('m') : '']);
    var ws = XLSX.utils.aoa_to_sheet(aoa), mg = function (r1, c1, r2, c2) { return { s: { r: r1, c: c1 }, e: { r: r2, c: c2 } }; };
    ws['!merges'] = [mg(0, 0, 1, 0), mg(0, 1, 1, 1), mg(0, 2, 1, 2), mg(0, 3, 1, 3), mg(0, 4, 1, 4), mg(0, 5, 0, 9), mg(0, 10, 0, 12), mg(0, 13, 0, 17), mg(0, 18, 0, 20)];
    ws['!cols'] = [6, 62, 13, 12, 11].concat([24, 24, 24, 24, 24, 7, 6, 10, 24, 24, 24, 24, 24, 7, 6, 10]).map(function (w) { return { wch: w }; });
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
      var sum = Math.round(d.reduce(function (s, r) { return s + r.finalTotal; }, 0) * 100) / 100;
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
      '<h2>Theo cá nhân</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Họ và tên</th><th>Chức vụ</th><th>Đơn vị</th><th>Cấp</th><th class="num">Số việc</th><th class="num">Tự chấm</th><th class="num">Được công nhận</th><th class="num">KPI tổng hợp</th><th class="num">Số người / đã đánh giá</th><th class="num">Quy đổi bình quân</th><th>Trạng thái</th></tr></thead><tbody>' +
      (list.map(function (x) {
        var r = x.r;
        return '<tr class="click" data-act="open" data-u="' + h(r.user.id) + '"><td>' + pad(x.depth) + '<b>' + h(r.user.fullName) + '</b></td><td>' + h(r.user.title) + '</td><td>' + h(unitName(r.user.unitId)) + '</td><td>' + h(LEVEL[r.user.level]) + '</td>' +
          '<td class="num">' + (r.taskCount || '–') + '</td><td class="num">' + fmt(r.selfTotal) + '</td><td class="num">' + fmt(r.finalTotal) + '</td><td class="num"><b>' + fmt(r.kpi) + '</b></td>' +
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
    var head = ['TT', 'Họ và tên', 'Chức vụ', 'Đơn vị', 'Cấp', 'Người phụ trách', 'Số công việc', 'Điểm tự chấm', 'Điểm được công nhận', 'KPI tổng hợp', 'Số người trong phạm vi', 'Đã đánh giá', 'Quy đổi bình quân', 'Trạng thái'];
    var names = {};
    ov.rows.forEach(function (r) { names[r.user.id] = r.user.fullName; });
    var data = treeRows(ov.rows).map(function (x, i) {
      var r = x.r;
      return [i + 1, new Array(x.depth + 1).join('   ') + r.user.fullName, r.user.title, unitName(r.user.unitId), LEVEL[r.user.level], names[r.user.managerId] || '', r.taskCount || 0, r.selfTotal, r.finalTotal, r.kpi, r.people, r.done, r.people ? Math.round(r.kpi / r.people * 100) / 100 : '', (STATUS[r.status] || [r.status])[0]];
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
          ['selfEval', 'Tự kê công việc và tự đánh giá (trưởng đơn vị, thủ trưởng thường không chọn)', 'check'], ['isAdmin', 'Có quyền quản trị hệ thống', 'check'], ['active', 'Đang hoạt động', 'check']];
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
    var tabNames = { users: 'Người dùng', units: 'Đơn vị', tree: 'Cây phụ trách', periods: 'Kỳ đánh giá', config: 'Xếp loại, cơ quan' };
    if (!tabNames[tab]) tab = 'users';
    var tabs = '<div class="tabs">' + Object.keys(tabNames).map(function (k) { return '<button data-act="tab" data-t="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + tabNames[k] + '</button>'; }).join('') + '</div>';
    if (tab === 'tree') return tabs + treeHtml();
    if (tab === 'config') {
      var rs = (S.config.ratings || []).concat([{ name: '', min: '' }]);
      return tabs + '<div class="card" style="max-width:640px"><label class="f"><span>Tên cơ quan (hiện trên phiếu, báo cáo)</span><input type="text" id="cfgOrg" value="' + h(S.config.orgName) + '"></label>' +
        '<h3 style="margin:8px 0">Mức xếp loại theo điểm phiếu cá nhân (không bắt buộc)</h3><table class="tbl"><thead><tr><th>Tên mức xếp loại</th><th class="num">Từ điểm</th></tr></thead><tbody>' +
        rs.map(function (r) { return '<tr data-rating><td><input type="text" value="' + h(r.name) + '" placeholder="Thêm mức mới (không bắt buộc)"></td><td class="num"><input type="number" min="0" step="any" value="' + h(r.min) + '"></td></tr>'; }).join('') +
        '</tbody></table><p class="muted small">Để trống nếu cơ quan chưa quy định xếp loại. Nếu đặt: mức thấp nhất luôn tính từ 0 điểm; xoá tên để bỏ một mức.</p><button class="btn primary" data-act="saveConfig">Lưu cấu hình</button></div>';
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
  function showPassword(title, user, pass) {
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
        if (out.tempPassword) showPassword('Đã tạo tài khoản', cur.fullName + ' (' + cur.id + ')', out.tempPassword);
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
    dashUnit: function (el) { DASH = DASH.type === 'unit' && DASH.id === el.dataset.id ? { type: '', id: '' } : { type: 'unit', id: el.dataset.id }; redrawDash(); },
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
        S.ov = null;
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
      E.tasks = E.tasks.filter(function (t) { return t.name || KPI_calc(t.s); }).concat(add);
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
    taskDel: function (el) {
      var t = E.tasks[+el.dataset.t];
      if ((t.name || KPI_calc(t.s)) && !confirm('Xoá công việc số ' + (+el.dataset.t + 1) + '?')) return;
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
      E.tasks = E.tasks.filter(function (t) { return t.name || KPI_calc(t.s); }).concat(add);
      modal.innerHTML = '';
      redrawTable();
      var miss = add.filter(function (t) { return !KPI_calc(t.s); }).length;
      toast('Đã thêm ' + add.length + ' công việc.' + (miss ? ' Còn ' + miss + ' dòng chưa đủ mức A–E, cần chọn bổ sung.' : ''));
    },
    excelEval: function (el) { run(el, exportEvalExcel); },
    saveSelf: function (el) {
      var submit = !!el.dataset.submit;
      var tasks = E.tasks.filter(function (t) { return t.name.trim() || KPI_calc(t.s); });
      if (submit) {
        if (!tasks.length) return toast('Phiếu chưa có công việc nào.', true);
        for (var i = 0; i < E.tasks.length; i++) {
          var t = E.tasks[i];
          if (tasks.indexOf(t) < 0) continue;
          if (!t.name.trim()) return toast('Công việc số ' + (i + 1) + ' chưa ghi tên.', true);
          if (!KPI_calc(t.s)) return toast('Công việc số ' + (i + 1) + ' chưa chọn đủ 5 tiêu chí A–E.', true);
        }
        if (!confirm('Nộp phiếu gồm ' + tasks.length + ' công việc, tổng ' + fmt(sumPoints('s')) + ' điểm tự chấm? Sau khi nộp anh/chị không sửa được, trừ khi được yêu cầu sửa.')) return;
      }
      run(el, async function () {
        var d = await api('saveSelf', { periodId: S.periodId, tasks: tasks, comment: $('#selfComment').value, submit: submit });
        S.ov = null;
        setEval(d);
        toast(submit ? 'Đã nộp phiếu.' : 'Đã lưu nháp.');
      });
    },
    decide: function (el) {
      var ret = el.dataset.d === 'return', comment = $('#mgrComment').value.trim();
      if (ret && !comment) return toast('Vui lòng ghi nội dung yêu cầu sửa vào ô nhận xét.', true);
      if (!ret) {
        for (var i = 0; i < E.tasks.length; i++) if (!KPI_calc(E.tasks[i].m)) return toast('Công việc số ' + (i + 1) + ' chưa chấm đủ 5 tiêu chí A–E.', true);
        var total = sumPoints('m'), rating = ratingOf(total);
        if (!confirm('Công nhận kết quả ' + fmt(total) + ' điểm' + (rating ? ' – ' + rating : '') + ' cho ' + E.d.owner.fullName + '?')) return;
      }
      run(el, async function () {
        var d = await api('review', { evalId: E.d.ev.id, tasks: E.tasks.map(function (t) { return { id: t.id, m: t.m }; }), comment: comment, decision: el.dataset.d });
        S.ov = null;
        setEval(d);
        toast(ret ? 'Đã gửi yêu cầu sửa.' : 'Đã công nhận kết quả.');
      });
    },
    reopen: function (el) {
      var note = prompt('Lý do mở lại phiếu để đánh giá lại:');
      if (note === null) return;
      run(el, async function () {
        var d = await api('reopen', { evalId: E.d.ev.id, note: note });
        S.ov = null;
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
          res.map(function (r) { return '<tr><td>' + h(r.id) + '</td><td>' + h(r.name) + '</td>' + (tab === 'users' ? '<td><code>' + h(r.tempPassword || '') + '</code></td>' : '') + '<td>' + (r.ok && !r.error ? '<span class="badge b-green">Đã thêm</span>' : '<span class="badge ' + (r.ok ? 'b-amber' : 'b-red') + '">' + h(r.error) + '</span>') + '</td></tr>'; }).join('') +
          '</tbody></table></div><div class="actions">' + (tab === 'users' && ok.length ? '<button class="btn" data-act="copyImport">Chép danh sách</button>' : '') + '<button class="btn primary" data-act="closeModal">Đóng</button></div></div>';
        ACT.copyImport.text = ok.map(function (r) { return r.id + '\t' + r.name + '\t' + r.tempPassword; }).join('\n');
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
        showPassword('Đã cấp lại mật khẩu', u.fullName + ' (' + u.id + ')', r.tempPassword);
      });
    },
    saveConfig: function (el) {
      var ratings = [];
      document.querySelectorAll('[data-rating]').forEach(function (tr) {
        var ins = tr.querySelectorAll('input');
        if (ins[0].value.trim()) ratings.push({ name: ins[0].value.trim(), min: Number(ins[1].value) || 0 });
      });
      run(el, async function () {
        S.config = await api('adminSaveConfig', { config: { orgName: $('#cfgOrg').value, ratings: ratings } });
        await render();
        toast('Đã lưu cấu hình.');
      });
    }
  };

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
    if (el.id === 'prevAll') { document.querySelectorAll('#prevList input[data-i]').forEach(function (c) { c.checked = el.checked; }); return; }
    if (!E) return;
    var ti = +el.dataset.t;
    if (el.dataset.lv) { // chọn mức A..E: tính lại S, N, điểm của dòng
      var t = E.tasks[ti];
      if (!t[el.dataset.lv]) t[el.dataset.lv] = [0, 0, 0, 0, 0];
      t[el.dataset.lv][+el.dataset.fi] = +el.value;
      el.classList.toggle('empty', !+el.value);
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
