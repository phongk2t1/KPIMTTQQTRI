/* ============================================================
 * KPI MTTQ – LÕI NGHIỆP VỤ DÙNG CHUNG
 * Tệp này chạy được ở cả 2 nơi:
 *   - Google Apps Script (apps-script/Core.gs là bản sao y nguyên)
 *   - Trình duyệt, khi chạy thử trên máy (localhost) không có máy chủ
 * Khi sửa tệp này, chép lại sang apps-script/Core.gs.
 * ============================================================ */

/* Các bảng dữ liệu. Tên trường dùng trong mã; tên trang tính và tiêu đề cột tiếng Việt ở KPI_SHEETS, KPI_LABELS. */
var KPI_TABLES = {
  Units: ['id', 'name', 'parentId', 'order'],
  Users: ['id', 'unitId', 'fullName', 'title', 'phone', 'email', 'level', 'managerId', 'selfEval', 'isAdmin', 'active', 'mustChange', 'passHash', 'salt', 'isStaff', 'isVoter', 'extra'],
  Periods: ['id', 'name', 'type', 'startDate', 'endDate', 'deadline', 'status'],
  // Phiếu (tổng hợp): mỗi người mỗi kỳ một dòng: trạng thái, tổng điểm, nhận xét
  Evaluations: ['id', 'periodId', 'userId', 'status', 'taskCount', 'selfTotal', 'mgrTotal', 'finalTotal', 'rating',
    'selfComment', 'mgrComment', 'submittedAt', 'reviewedAt', 'reviewerId', 'updatedAt', 'fbCount', 'gTotal', 'hours'],
  // Cán bộ tự đánh giá: mỗi công việc một dòng, cột như biểu Excel mẫu
  Tasks: ['userId', 'period', 'evalId', 'id', 'order', 'name', 'product', 'qty', 'month', 'a', 'b', 'c', 'd', 'e', 's', 'n', 'point',
    'link', 'repeat', 'from', 'pm', 'evaluated', 'evaluatedAt', 'updatedAt', 'note', 'by',
    'deadline', 'doneDate', 'progress', 'bonus', 'feedback', 'feedbackAt', 'feedbackDone', 'code', 'unit', 'std', 'hours', 'g', 'nstd', 'meta', 'pp', 'workDate', 'purpose', 'spName', 'timeStd', 'actual'],
  // Người phụ trách đánh giá: mỗi công việc một dòng, độc lập với phần cán bộ tự chấm
  Reviews: ['userId', 'period', 'evalId', 'id', 'order', 'name', 'product', 'qty', 'month', 'a', 'b', 'c', 'd', 'e', 's', 'n', 'point',
    'reviewerId', 'date', 'time', 'lock', 'note', 'progress', 'doneDate', 'bonus', 'overTime', 'overQuality', 'h', 'q', 't', 'score', 'pp'],
  // Danh mục sản phẩm chuẩn của cơ quan (thí điểm KPI): mỗi mã một dòng, cột như tệp "DANH MỤC SẢN PHẨM (THÍ ĐIỂM KPI)"
  Catalog: ['order', 'type', 'purpose', 'name', 'id', 'example', 'time', 'level', 'point', 'unit', 'hours', 'active', 'updatedAt'],
  // Kho công việc mẫu: cột như biểu Excel mẫu, thêm CCCD của vị trí trước cột mã công việc
  Library: ['userId', 'id', 'order', 'name', 'product', 'qty', 'month', 'a', 'b', 'c', 'd', 'e', 's', 'n', 'point', 'updatedAt'],
  // Minh chứng tải lên Google Drive: mỗi tệp một dòng
  Evidence: ['id', 'userId', 'periodId', 'period', 'taskId', 'name', 'fileName', 'fileId', 'mime', 'size', 'createdAt'],
  // Xếp loại theo kỳ: lãnh đạo đề xuất, tham mưu tổng hợp, tập thể biểu quyết
  Ratings: ['id', 'periodId', 'period', 'userId', 'common', 'taskScore', 'total', 'donePct', 'overPct', 'mgrLevel', 'mgrBy', 'staffLevel', 'staffBy', 'staffNote',
    'submitted', 'votes', 'result', 'decidedBy', 'decidedAt', 'updatedAt'],
  History: ['id', 'evalId', 'time', 'userId', 'action', 'note'],
  Config: ['id', 'value']
};
var KPI_SHEETS = { Units: 'DonVi', Users: 'NguoiDung', Periods: 'KyDanhGia', Evaluations: 'TongHopPhieu', Tasks: 'PhieuDanhGia', Reviews: 'DanhGia', History: 'LichSu', Config: 'CauHinh',
  Library: 'khocongviecmau', Evidence: 'MinhChung', Ratings: 'XepLoai', Catalog: 'DanhMucSanPham' };
var KPI_LABELS = {
  Units: { id: 'Mã đơn vị', name: 'Tên đơn vị', parentId: 'Mã đơn vị cha', order: 'Thứ tự' },
  Users: {
    id: 'CCCD', unitId: 'Mã đơn vị', fullName: 'Họ tên', title: 'Chức vụ', phone: 'Số điện thoại', email: 'Email',
    extra: 'CCCD quản lý vượt cấp', level: 'Cấp', managerId: 'CCCD người phụ trách', selfEval: 'Tự kê công việc', isAdmin: 'Quản trị', active: 'Hoạt động',
    mustChange: 'Phải đổi mật khẩu', passHash: 'Mật khẩu (đã băm)', salt: 'Muối băm',
    isStaff: 'Tham mưu tổng hợp', isVoter: 'Thành viên biểu quyết'
  },
  Periods: { id: 'Mã kỳ', name: 'Tên kỳ', type: 'Loại', startDate: 'Từ ngày', endDate: 'Đến ngày', deadline: 'Hạn nộp', status: 'Trạng thái' },
  Evaluations: {
    id: 'Mã phiếu', periodId: 'Mã kỳ', userId: 'CCCD', status: 'Trạng thái', taskCount: 'Số công việc', selfTotal: 'Điểm tự chấm',
    mgrTotal: 'Điểm người phụ trách chấm', finalTotal: 'Điểm được công nhận', rating: 'Xếp loại', selfComment: 'Tự nhận xét', mgrComment: 'Nhận xét của người phụ trách',
    submittedAt: 'Lúc nộp', reviewedAt: 'Lúc đánh giá', reviewerId: 'CCCD người đánh giá', updatedAt: 'Cập nhật', fbCount: 'Số phản hồi chờ xem xét',
    gTotal: 'Tổng điểm giao chuẩn đã xác nhận (G)', hours: 'Giờ chuẩn quy đổi'
  },
  Tasks: {
    userId: 'CCCD', period: 'Kỳ báo cáo', evalId: 'Mã phiếu', id: 'Mã công việc', order: 'TT', name: 'Tên công việc', product: 'Sản phẩm',
    qty: 'Số lượng sản phẩm', month: 'Tháng thực hiện', a: 'A - Khối lượng, thời gian lao động tiêu chuẩn', b: 'B - Mức độ nghiên cứu, tư duy và phán đoán chuyên môn',
    c: 'C - Phạm vi phối hợp', d: 'D - Mức độ ảnh hưởng, trách nhiệm và rủi ro', e: 'E - Mức độ đầy đủ, rõ ràng và ổn định của đầu vào',
    s: 'S', n: 'N', point: 'Điểm của N', link: 'Minh chứng', repeat: 'Lặp lại', from: 'Chuyển từ kỳ', pm: 'Kết quả kỳ trước (A,B,C,D,E)',
    evaluated: 'Đã đánh giá', evaluatedAt: 'Ngày giờ đánh giá', updatedAt: 'Cập nhật', note: 'Nhận xét của người đánh giá', by: 'Người thêm việc (CCCD)',
    deadline: 'Hạn hoàn thành', doneDate: 'Ngày hoàn thành', progress: 'Tiến độ (%)', bonus: 'Điểm thưởng đề xuất (%)',
    feedback: 'Phản hồi của cán bộ', feedbackAt: 'Lúc phản hồi', feedbackDone: 'Phản hồi đã xem xét',
    code: 'Mã sản phẩm', unit: 'Đơn vị tính', std: 'Điểm chuẩn một đơn vị', hours: 'Giờ chuẩn một đơn vị', g: 'Điểm giao chuẩn (G)', nstd: 'Mức N theo danh mục', meta: 'Giao nhận nhiệm vụ (ghi tự động)',
    pp: 'Phương pháp (trống = PP1, 2 = PP2)', workDate: 'Ngày thực hiện (PP2)', purpose: 'Mục đích (PP2)', spName: 'Tên sản phẩm (PP2)', timeStd: 'Thời gian chuẩn (PP2)', actual: 'Giờ thực tế (PP2)'
  },
  Reviews: {
    userId: 'CCCD', period: 'Kỳ đánh giá', evalId: 'Mã phiếu', id: 'Mã công việc', order: 'TT', name: 'Tên công việc', product: 'Sản phẩm',
    qty: 'Số lượng sản phẩm', month: 'Tháng thực hiện', a: 'A - Khối lượng, thời gian lao động tiêu chuẩn', b: 'B - Mức độ nghiên cứu, tư duy và phán đoán chuyên môn',
    c: 'C - Phạm vi phối hợp', d: 'D - Mức độ ảnh hưởng, trách nhiệm và rủi ro', e: 'E - Mức độ đầy đủ, rõ ràng và ổn định của đầu vào',
    s: 'S', n: 'N', point: 'Điểm của N', reviewerId: 'CCCD người đánh giá', date: 'Ngày đánh giá', time: 'Giờ đánh giá', lock: 'Khoá/Mở', note: 'Nhận xét',
    progress: 'Tiến độ được xác nhận (%)', doneDate: 'Ngày hoàn thành được xác nhận', bonus: 'Điểm thưởng (%)', overTime: 'Vượt tiến độ', overQuality: 'Vượt chất lượng',
    h: 'Hệ số H (khối lượng)', q: 'Hệ số Q (chất lượng)', t: 'Hệ số T (tiến độ)', score: 'Điểm thực đạt (P)', pp: 'Phương pháp (trống = PP1, 2 = PP2)'
  },
  Catalog: {
    order: 'TT', type: 'Loại sản phẩm', purpose: 'Mục đích', name: 'Tên sản phẩm', id: 'Mã Sản phẩm', example: 'Ví dụ sản phẩm thực tế', time: 'Thời gian tiêu chuẩn',
    level: 'Mức N', point: 'Điểm theo mức N', unit: 'Đơn vị tính', hours: 'Giờ chuẩn quy đổi một đơn vị', active: 'Đang dùng', updatedAt: 'Cập nhật'
  },
  Library: {
    userId: 'CCCD', id: 'Mã công việc', order: 'TT', name: 'Tên công việc', product: 'Sản phẩm', qty: 'Số lượng sản phẩm', month: 'Tháng thực hiện',
    a: 'A - Khối lượng, thời gian lao động tiêu chuẩn', b: 'B - Mức độ nghiên cứu, tư duy và phán đoán chuyên môn', c: 'C - Phạm vi phối hợp',
    d: 'D - Mức độ ảnh hưởng, trách nhiệm và rủi ro', e: 'E - Mức độ đầy đủ, rõ ràng và ổn định của đầu vào', s: 'S', n: 'N', point: 'Điểm của N', updatedAt: 'Cập nhật'
  },
  Evidence: {
    id: 'Mã minh chứng', userId: 'CCCD', periodId: 'Mã kỳ', period: 'Kỳ', taskId: 'Mã công việc', name: 'Tên tệp gốc', fileName: 'Tên tệp trên Drive',
    fileId: 'Mã tệp Drive', mime: 'Loại tệp', size: 'Dung lượng (byte)', createdAt: 'Lúc tải lên'
  },
  Ratings: {
    id: 'Mã', periodId: 'Mã kỳ', period: 'Kỳ', userId: 'CCCD', common: 'Điểm tiêu chí chung', taskScore: 'Điểm kết quả nhiệm vụ', total: 'Tổng điểm (thang 100)',
    donePct: 'Tỷ lệ nhiệm vụ hoàn thành (%)', overPct: 'Tỷ lệ nhiệm vụ vượt mức (%)', mgrLevel: 'Lãnh đạo trực tiếp đề xuất', mgrBy: 'CCCD lãnh đạo đề xuất',
    staffLevel: 'Tham mưu đề xuất', staffBy: 'CCCD người tham mưu', staffNote: 'Ghi chú tham mưu', submitted: 'Đã trình biểu quyết', votes: 'Phiếu biểu quyết',
    result: 'Kết quả xếp loại', decidedBy: 'CCCD người chốt', decidedAt: 'Lúc chốt', updatedAt: 'Cập nhật'
  },
  History: { id: 'Mã', evalId: 'Mã phiếu', time: 'Thời gian', userId: 'CCCD', action: 'Thao tác', note: 'Ghi chú' },
  Config: { id: 'Khoá', value: 'Giá trị' }
};

/* Cấp của người dùng trong cây phụ trách. "Cấp phó trở lên" (rank <= 2) mới được khai làm người phụ trách đánh giá. */
var KPI_LEVELS = {
  thutruong: { name: 'Thủ trưởng cơ quan', rank: 0, selfEval: false },
  truong: { name: 'Trưởng đơn vị', rank: 1, selfEval: false },
  pho: { name: 'Phó đơn vị', rank: 2, selfEval: true },
  canbo: { name: 'Cá nhân', rank: 3, selfEval: true }
};

/* Bốn mức xếp loại chất lượng và các ngưỡng kiểm tra (quản trị sửa được trong Quản trị › Xếp loại, cơ quan). */
var KPI_RATE = { xs: 'Hoàn thành xuất sắc nhiệm vụ', tot: 'Hoàn thành tốt nhiệm vụ', ht: 'Hoàn thành nhiệm vụ', kht: 'Không hoàn thành nhiệm vụ' };
var KPI_RULE = {
  quota: 20,     // số người xuất sắc không quá bao nhiêu % số người từ "Hoàn thành tốt" trở lên
  minScore: 90,  // tổng điểm thang 100 tối thiểu để được xét xuất sắc
  minOver: 30,   // tỷ lệ % nhiệm vụ vượt mức (cả tiến độ lẫn chất lượng) tối thiểu để được xét xuất sắc
  common: 30,    // điểm tối đa của nhóm tiêu chí chung; phần còn lại của thang 100 là kết quả nhiệm vụ
  maxBonus: 5,   // điểm thưởng tối đa của một công việc, tính bằng % điểm công việc đó
  wH: 1, wQ: 1, wT: 1, // tỷ trọng khối lượng, chất lượng, tiến độ trong điểm thực đạt (1-1-1 là chia đều 33,33%)
  useBonus: 0,  // 1 = áp dụng điểm thưởng; 0 = tắt (Báo cáo thí điểm: chưa áp dụng điểm thưởng khi chưa được Ban Thường trực quyết định)
  useRating: 1  // 1 = mở trang xếp loại chất lượng theo kỳ (đề xuất, tham mưu, tập thể biểu quyết, quyết định); 0 = tắt
};
/* Hệ số đánh giá kết quả thực hiện một nhiệm vụ lấy từ Danh mục sản phẩm (Báo cáo đề xuất thí điểm KPI của Tổ giúp việc):
 * điểm giao chuẩn G = điểm chuẩn của mã × số lượng; điểm thực đạt P = G × H × (wH + wQ×Q + wT×T) / (wH + wQ + wT). */
var KPI_HQT = {
  H: [[1, 'Hoàn thành 100% phạm vi được giao'], [0.8, 'Hoàn thành từ 80% đến dưới 100%'], [0.5, 'Hoàn thành từ 60% đến dưới 80%'], [0, 'Hoàn thành dưới 60%, hoặc sản phẩm không được chấp nhận']],
  Q: [[1, 'Đạt yêu cầu'], [0.8, 'Sai sót cơ bản (có lỗi chính tả, thể thức ở lần trình đầu; thiếu nội dung cơ bản)'], [0.5, 'Sai sót nghiêm trọng (lần trình thứ hai vẫn còn lỗi; phải làm lại từ 50%)'], [0, 'Sản phẩm không sử dụng được']],
  T: [[1, 'Đúng hoặc trước hạn; không có hạn cụ thể'], [0.8, 'Chậm dưới 01 ngày làm việc'], [0.5, 'Chậm từ 01 đến dưới 02 ngày làm việc'], [0, 'Chậm từ 02 ngày làm việc trở lên']]
};
function KPI_factor(t, rule) {
  var w = function (k) { var v = Number(rule && rule[k]); return isFinite(v) && v >= 0 && rule && rule[k] !== '' && rule[k] != null ? v : 1; };
  var wH = w('wH'), wQ = w('wQ'), wT = w('wT'), sum = wH + wQ + wT || 3;
  if (!(wH + wQ + wT)) { wH = wQ = wT = 1; }
  return (Number(t.H) || 0) * (wH + wQ * (Number(t.Q) || 0) + wT * (Number(t.T) || 0)) / sum;
}
/** Điểm một đơn vị của công việc.
 * Việc ngoài danh mục: tính theo 5 mức A–E.
 * Việc lấy từ Danh mục sản phẩm: điểm giao chuẩn luôn là điểm chuẩn của mã (định mức áp dụng thống nhất).
 * A–E cán bộ chọn ở khối tự kê chỉ là ĐỀ XUẤT điều chỉnh (trả về ở prop), không làm đổi điểm.
 * Chỉ khi người phụ trách chọn đủ 5 mức A–E ở khối lãnh đạo thì định mức của việc đó mới đổi theo A–E.
 * key 's': điểm giao chuẩn một đơn vị; key 'm': điểm đó × hệ số H, Q, T (chưa xác nhận thì null), base = định mức được áp dụng. */
function KPI_taskCalc(t, key, rule) {
  if (!t || !t.code) return KPI_calc(t && t[key]);
  var std = Number(t.std) || 0, own = KPI_calc(t.s), base = { s: '', n: String(t.n || ''), point: std, prop: own || null };
  if (key === 's') return base;
  if (key === 'm') {
    if (t.H === undefined || t.H === null || t.H === '') return null;
    var lead = KPI_calc(t.m), b = lead || base;
    return { s: lead ? lead.s : '', n: b.n, point: b.point * KPI_factor(t, rule), base: b.point, adj: !!lead };
  }
  return null;
}
/* ---------- Nhật ký sử dụng ----------
 * Mỗi lượt đăng nhập và mỗi thao tác xem, thêm, sửa, xoá ghi một dòng vào trang tính NhatKy (chỉ ghi nối đuôi, không đọc lại).
 * Để không phình dữ liệu: cùng một người xem cùng một nội dung trong viewGap giây chỉ ghi một lần;
 * dòng cũ hơn keepDays ngày (hoặc vượt maxRows dòng) được gộp thành số lượt theo tháng – người – chức năng ở trang NhatKyTongHop rồi xoá. */
var KPI_LOG = { keepDays: 90, maxRows: 20000, viewGap: 600 };
var KPI_LOG_KINDS = { dangnhap: 'Đăng nhập', xem: 'Xem', them: 'Thêm', sua: 'Sửa', xoa: 'Xoá', khac: 'Khác' };
var KPI_LOG_ACTIONS = {
  login: ['dangnhap', 'Đăng nhập'], bootstrap: ['xem', 'Mở ứng dụng'], changePassword: ['sua', 'Đổi mật khẩu'],
  overview: ['xem', 'Xem tổng quan, KPI tổng hợp'], stats: ['xem', 'Xem thống kê tổng quan'], getEvaluation: ['xem', 'Xem phiếu đánh giá'],
  tasksFrom: ['xem', 'Lấy việc từ kỳ trước'], saveSelf: ['sua', 'Lưu / nộp phiếu tự đánh giá'], review: ['sua', 'Duyệt / trả lại phiếu'],
  score: ['sua', 'Chấm điểm, nhận xét, giao việc'], reopen: ['sua', 'Mở lại phiếu đã chốt'], upload: ['them', 'Tải tệp lên'],
  pp2Get: ['xem', 'Xem phiếu PP2'], pp2List: ['xem', 'Xem danh sách đánh giá PP2'], pp2Save: ['sua', 'Lưu kê khai PP2'], pp2Score: ['sua', 'Chấm H, Q, T (PP2)'], pp2Assign: ['them', 'Giao việc (PP2)'],
  feedback: ['sua', 'Phản hồi không tán thành'], taskAccept: ['sua', 'Xác nhận / phản hồi nhiệm vụ được giao'], taskReassign: ['sua', 'Giao lại / rút nhiệm vụ'], taskExtend: ['sua', 'Gia hạn nhiệm vụ'],
  assignBoard: ['xem', 'Xem trang Giao việc'], assignMany: ['them', 'Giao việc cho nhiều người'],
  evidenceSources: ['xem', 'Xem tệp kết quả của cấp dưới'], evidenceBorrow: ['them', 'Lấy tệp kết quả của cấp dưới'], evidenceAdd: ['them', 'Thêm minh chứng'], evidenceRemove: ['xoa', 'Xoá minh chứng'], evidenceGet: ['xem', 'Mở minh chứng'],
  catalog: ['xem', 'Xem danh mục sản phẩm'], adminCatalogSave: ['sua', 'Thêm / sửa mã danh mục'], adminCatalogDelete: ['xoa', 'Xoá mã danh mục'], adminCatalogImport: ['them', 'Nạp danh mục từ Excel'],
  libraryFind: ['xem', 'Tìm trong kho việc mẫu'], adminLibraryList: ['xem', 'Xem kho việc mẫu'], adminLibrarySave: ['sua', 'Thêm / sửa việc mẫu'], adminLibraryDelete: ['xoa', 'Xoá việc mẫu'], adminLibraryImport: ['them', 'Nạp kho việc mẫu từ Excel'],
  rating: ['xem', 'Xem bảng xếp loại'], ratingPropose: ['sua', 'Đề xuất xếp loại'], ratingStaff: ['sua', 'Tham mưu xếp loại'], ratingVote: ['sua', 'Biểu quyết xếp loại'], ratingDecide: ['sua', 'Quyết định xếp loại'], ratingReopen: ['sua', 'Mở lại xếp loại'],
  adminList: ['xem', 'Mở trang quản trị'], adminSave: ['sua', 'Thêm / sửa người dùng, đơn vị, kỳ'], adminImport: ['them', 'Nạp danh sách từ Excel'], adminDelete: ['xoa', 'Xoá người dùng, đơn vị, kỳ'],
  adminResetPassword: ['sua', 'Cấp lại mật khẩu'], adminSaveConfig: ['sua', 'Lưu cấu hình']
};
var KPI_MAX_EVIDENCE = 3; // số minh chứng tối đa của một công việc

// Mẫu chưa quy định ngưỡng xếp loại; quản trị viên tự thêm trong mục Quản trị nếu cần.
var KPI_DEFAULT_RATINGS = [];

/* Bộ tiêu chí lấy từ tệp mẫu "Văn phòng.xlsx" (các sheet A, B, C, D, E, N, Trang tính1).
 * Mỗi mức: [tên mức, cách diễn giải dễ hiểu, ví dụ]. Vị trí trong mảng + 1 = điểm của mức (1..5). */
var KPI_MODEL = {
  weights: [35, 30, 15, 15, 5], // trọng số % của A, B, C, D, E
  factors: [
    { key: 'A', name: 'Khối lượng, thời gian lao động tiêu chuẩn', levels: [
      ['Đến 01 giờ'], ['Trên 01 đến 02 giờ'], ['Trên 02 đến 04 giờ'], ['Trên 04 đến 08 giờ'], ['Trên 08 đến 16 giờ']] },
    { key: 'B', name: 'Mức độ nghiên cứu, tư duy và phán đoán chuyên môn', levels: [
      ['Thực hiện theo mẫu/quy trình có sẵn', 'Gần như đã biết phải làm gì và làm thế nào', 'Soạn giấy mời theo mẫu; nhập danh sách; chuyển tiếp công văn; cập nhật số liệu theo biểu có sẵn'],
      ['Kiểm tra, đối chiếu và xử lý theo quy định rõ', 'Phải kiểm tra, đối chiếu nhưng phương án xử lý đã tương đối rõ', 'Rà soát hồ sơ theo quy định; góp ý văn bản đơn giản; kiểm tra số liệu và chỉnh sai sót; xử lý yêu cầu có căn cứ rõ'],
      ['Tổng hợp, phân tích và đề xuất phương án', 'Phải tự xử lý thông tin và đưa ra nhận định/phương án', 'Báo cáo tổng hợp có nhận xét; xây dựng kế hoạch thông thường; tổng hợp ý kiến nhiều bộ phận và đề xuất cách xử lý'],
      ['Nghiên cứu sâu, cân nhắc nhiều căn cứ/phương án', 'Phải đọc nhiều căn cứ, cân nhắc nhiều phương án, không có đáp án ngay', 'Công văn giải trình phức tạp; phát biểu kết luận; báo cáo chuyên sâu; tham mưu xử lý vấn đề có nhiều cách giải quyết'],
      ['Xây dựng quan điểm, cơ chế hoặc giải pháp mới', 'Phải hình thành cách tiếp cận mới hoặc xử lý vấn đề chiến lược, nhạy cảm', 'Xây dựng đề án mới; tham mưu cơ chế chưa có tiền lệ; báo cáo chiến lược; đề xuất giải pháp lớn, nhạy cảm hoặc tác động rộng']] },
    { key: 'C', name: 'Phạm vi phối hợp', levels: [
      ['Cá nhân tự thực hiện, sử dụng một nguồn thông tin', 'Chủ yếu cá nhân tự làm, sử dụng một nguồn hoặc thông tin có sẵn', 'Soạn văn bản từ hồ sơ đã đầy đủ'],
      ['Phối hợp với một cá nhân hoặc một bộ phận nội bộ', 'Cần trao đổi với 01 cá nhân hoặc 01 bộ phận nội bộ', 'Phối hợp với kế toán hoặc một Ban'],
      ['Phối hợp nhiều ban trong cơ quan hoặc một cơ quan bên ngoài', 'Phải làm việc với nhiều Ban trong cơ quan hoặc 01 cơ quan bên ngoài', 'Tổng hợp ý kiến 3 Ban; làm việc với 1 sở/ngành'],
      ['Phối hợp nhiều cơ quan, địa phương hoặc nhiều cấp', 'Phải làm việc với nhiều cơ quan, địa phương hoặc nhiều cấp', 'Tổng hợp từ nhiều xã, nhiều sở/ngành'],
      ['Liên ngành, liên cấp, phạm vi toàn tỉnh, Trung ương hoặc quốc tế', 'Phạm vi toàn tỉnh, Trung ương hoặc có nhiều cấp, nhiều ngành cùng tham gia', 'Nhiệm vụ liên ngành cấp tỉnh, phối hợp Trung ương - tỉnh - cơ sở']] },
    { key: 'D', name: 'Mức độ ảnh hưởng, trách nhiệm và rủi ro', levels: [
      ['Ảnh hưởng nhỏ, dễ phát hiện và sửa chữa', 'Sai sót dễ phát hiện, dễ sửa, ít ảnh hưởng đến người khác', 'Sai thể thức, lỗi nhỏ trong việc nội bộ'],
      ['Ảnh hưởng đến một hoạt động hoặc một bộ phận', 'Sai hoặc chậm gây khó khăn cho một hoạt động hoặc một bộ phận', 'Chậm tài liệu một cuộc họp, sai danh sách một hoạt động'],
      ['Ảnh hưởng đến nhiều đơn vị, tài chính, tài sản hoặc tiến độ chung', 'Có thể ảnh hưởng tiến độ chung, tài chính, tài sản hoặc nhiều đơn vị', 'Sai số liệu tổng hợp, hồ sơ tài chính, tiến độ liên quan nhiều Ban'],
      ['Ảnh hưởng đến hoạt động cơ quan, quyết định của lãnh đạo hoặc uy tín đơn vị', 'Sai có thể dẫn đến quyết định không phù hợp hoặc ảnh hưởng uy tín cơ quan', 'Văn bản tham mưu lãnh đạo, kết luận, nội dung quan trọng'],
      ['Rủi ro cao về chính trị, pháp lý, tài chính, bí mật nhà nước hoặc uy tín của tỉnh', 'Có thể gây hậu quả lớn về chính trị, pháp lý, tài chính, bí mật hoặc uy tín cấp tỉnh', 'Vấn đề nhạy cảm, pháp lý lớn, bí mật nhà nước, quyết định có tác động rộng']] },
    { key: 'E', name: 'Mức độ đầy đủ, rõ ràng và ổn định của đầu vào', levels: [
      ['Yêu cầu rõ, dữ liệu đầy đủ, biểu mẫu và quy trình ổn định', 'Biết rõ phải làm gì, dữ liệu/căn cứ đã đủ', 'Hồ sơ đầy đủ, yêu cầu rõ, mẫu có sẵn'],
      ['Có một số thông tin cần bổ sung nhưng nguồn cung cấp rõ', 'Còn thiếu một số thông tin nhưng biết rõ lấy ở đâu', 'Thiếu 1–2 số liệu, có đầu mối cung cấp'],
      ['Phải thu thập từ nhiều nguồn hoặc có một số nội dung chưa rõ', 'Đầu vào chưa đầy đủ, phải tìm thêm và tổng hợp', 'Phải hỏi nhiều Ban/xã, lấy nhiều nguồn dữ liệu'],
      ['Thông tin thiếu, không thống nhất, phải kiểm tra hoặc xác minh nhiều lần', 'Không chỉ thiếu mà còn phải kiểm tra, xác minh nhiều lần', 'Số liệu không thống nhất, các đơn vị báo khác nhau'],
      ['Yêu cầu thay đổi lớn, dữ liệu rất thiếu hoặc mâu thuẫn, chưa có tiền lệ', 'Yêu cầu thay đổi lớn, dữ liệu thiếu nhiều, mâu thuẫn hoặc chưa có tiền lệ', 'Chưa rõ yêu cầu cuối cùng, thông tin biến động liên tục']] }
  ],
  // S (nhân 100) nhỏ hơn "below" thì thuộc mức N đó; point = "Điểm của N"
  nLevels: [
    { name: 'N1', below: 180, point: 0.25 }, { name: 'N2', below: 260, point: 0.5 }, { name: 'N3', below: 340, point: 1 },
    { name: 'N4', below: 420, point: 2 }, { name: 'N5', below: 501, point: 4 }
  ],
  products: ['Công văn', 'Báo cáo', 'Kế hoạch', 'Tờ trình', 'Thông báo', 'Quyết định', 'Nghị quyết', 'Chương trình', 'Đề án', 'Dự án',
    'Phương án', 'Hướng dẫn', 'Quy chế', 'Quy định', 'Chỉ thị', 'Biên bản', 'Giấy mời', 'Giấy giới thiệu', 'Giấy ủy quyền', 'Giấy nghỉ phép',
    'Công điện', 'Thông cáo', 'Hợp đồng', 'Bản ghi nhớ', 'Bản thỏa thuận', 'Phiếu gửi', 'Phiếu chuyển', 'Phiếu báo', 'Thư công', 'Khác']
};

/** Tính S, mức N và điểm của N từ 5 mức A..E (mỗi mức 1..5). Thiếu mức nào thì trả về null, như ô trống trong Excel. */
function KPI_calc(levels) {
  var sum = 0;
  for (var i = 0; i < 5; i++) {
    var v = Number(levels && levels[i]);
    if (!(v >= 1 && v <= 5) || v !== Math.round(v)) return null;
    sum += v * KPI_MODEL.weights[i]; // cộng số nguyên để không sai số thập phân ở các ngưỡng 1,8 / 2,6 / 3,4 / 4,2
  }
  for (var k = 0; k < KPI_MODEL.nLevels.length; k++) {
    var n = KPI_MODEL.nLevels[k];
    if (sum < n.below) return { s: sum / 100, n: n.name, point: n.point };
  }
  return null;
}

/**
 * store: { all(table), insert(table,row), update(table,id,patch), remove(table,id),
 *          group(table,field,value) -> các dòng có field = value, replaceGroup(table,field,value,rows) -> thay toàn bộ nhóm đó,
 *          insertMany(table,rows), updateMany(table,[{id,patch}]) -> ghi nhiều dòng trong một lần }
 * env.defaultPass?() -> { salt, passHash } của mật khẩu mặc định (nếu cơ quan có đặt)
 * env:   { hash(str), uuid(), secret(), uploadFile?(name,mime,base64) }
 */
function KPI_createCore(store, env) {
  var TOKEN_DAYS = 7;

  function err(msg, code) { var e = new Error(msg); e.kpi = true; e.code = code || ''; throw e; }
  function str(v) { return v == null ? '' : String(v); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function on(v) { return v === true || v === 1 || v === '1' || v === 'TRUE' || v === 'true'; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r4(x) { return Math.round(x * 10000) / 10000; }
  function cut(v, n) { return str(v).trim().slice(0, n); }
  function nowIso() { return new Date().toISOString(); }
  function has(v) { return v !== undefined && v !== null && v !== ''; }
  function find(t, id) {
    id = str(id);
    if (!id) return null;
    var rows = store.all(t);
    for (var i = 0; i < rows.length; i++) if (str(rows[i].id) === id) return rows[i];
    return null;
  }
  function byOrder(a, b) { return num(a.order) - num(b.order) || str(a.name).localeCompare(str(b.name), 'vi'); }
  function rank(u) { return (KPI_LEVELS[str(u.level)] || KPI_LEVELS.canbo).rank; }

  /* ---------- Giai đoạn của kỳ đánh giá ----------
   * 'mo'   : cán bộ được nhập, người phụ trách được chấm.
   * 'chot' : đã chốt nhập (quản trị chốt, hoặc đã qua hạn nhập): cán bộ không nhập được nữa, người phụ trách vẫn chấm.
   * 'khoa' : khoá hẳn, không ai thay đổi được. */
  function today() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); } // ngày theo giờ Việt Nam
  function phaseOf(period) {
    if (!period || period.status === 'khoa') return 'khoa';
    if (period.status === 'chot' || (str(period.deadline) && today() > str(period.deadline))) return 'chot';
    return 'mo';
  }
  function periodOut(p) {
    return { id: str(p.id), name: str(p.name), type: str(p.type), startDate: str(p.startDate), endDate: str(p.endDate), deadline: str(p.deadline), status: str(p.status), phase: phaseOf(p) };
  }

  /* ---------- Cấu hình ---------- */
  function cfg(key, def) {
    var r = find('Config', key);
    if (!r || str(r.value) === '') return def;
    try { return JSON.parse(r.value); } catch (e) { return def; }
  }
  function setCfg(key, value) {
    var v = JSON.stringify(value);
    if (find('Config', key)) store.update('Config', key, { value: v });
    else store.insert('Config', { id: key, value: v });
  }
  function publicConfig() {
    return { orgName: cfg('orgName', 'Ủy ban Mặt trận Tổ quốc Việt Nam'), ratings: cfg('ratings', KPI_DEFAULT_RATINGS), rule: rule() };
  }
  /** Các ngưỡng xếp loại đang áp dụng: giá trị quản trị đã đặt, thiếu thì lấy mặc định. */
  function rule() {
    var saved = cfg('rule', {}) || {}, o = {};
    Object.keys(KPI_RULE).forEach(function (k) { o[k] = has(saved[k]) && num(saved[k]) >= 0 ? num(saved[k]) : KPI_RULE[k]; });
    return o;
  }
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  function pct(v) { return Math.min(Math.max(Math.round(num(v)), 0), 100); }
  function catalogMap() { var m = {}; store.all('Catalog').forEach(function (r) { m[str(r.id)] = r; }); return m; }
  /** Hệ số hợp lệ của thang H, Q hoặc T; giá trị lạ thì lấy 1. */
  function coef(kind, v) { var x = has(v) ? num(v) : 1; return KPI_HQT[kind].some(function (o) { return o[0] === x; }) ? x : 1; }
  function tcalc(t, key) { return KPI_taskCalc(t, key, rule()); }
  /** Giờ chuẩn quy đổi của một phiếu: việc trong danh mục theo giờ chuẩn của mã; việc ngoài danh mục theo mức N (N1 = 1 giờ … N5 = 16 giờ). */
  function hoursOf(tasks) {
    var sum = 0;
    tasks.forEach(function (t) { var c = t.code ? null : KPI_calc(t.s); sum += num(t.qty) * (t.code ? num(t.hours) : c ? c.point * 4 : 0); });
    return r2(sum);
  }
  /** Tổng điểm giao chuẩn của các việc đã được xác nhận. */
  function gLocked(tasks) {
    var sum = 0;
    tasks.forEach(function (t) { var m = t.locked ? tcalc(t, 'm') : null, c = m ? tcalc(t, 's') : null; if (c) sum += num(t.qty) * (t.code ? m.base : c.point); });
    return r4(sum);
  }
  /** Số ngày làm việc (thứ Hai đến thứ Sáu) của kỳ × 8 giờ. */
  function workHours(period) {
    var a = new Date(str(period.startDate) + 'T00:00:00Z'), b = new Date(str(period.endDate) + 'T00:00:00Z'), n = 0;
    if (isNaN(a) || isNaN(b)) return 0;
    for (var d = a, g = 0; d <= b && g < 800; d = new Date(d.getTime() + 86400000), g++) { var w = d.getUTCDay(); if (w >= 1 && w <= 5) n++; }
    return n * 8;
  }
  function bonusOf(v) { var rl = rule(); return rl.useBonus ? r2(Math.min(Math.max(num(v), 0), rl.maxBonus)) : 0; } // điểm thưởng đang tắt thì luôn là 0
  function needRating() { if (!rule().useRating) err('Chức năng xếp loại chất lượng đang tắt trong thời gian thí điểm. Quản trị hệ thống bật lại ở Quản trị > Cấu hình khi cơ quan quyết định áp dụng.'); }
  /** Mã kế tiếp dạng <tiền tố><số>, ví dụ CV00012, MC000007. */
  function codeMaker(table, prefix, width) {
    var max = 0;
    store.all(table).forEach(function (r) { var id = str(r.id); if (id.indexOf(prefix) === 0) { var n = parseInt(id.slice(prefix.length), 10); if (n > max) max = n; } });
    return function () { max++; var d = String(max); while (d.length < width) d = '0' + d; return prefix + d; };
  }
  function ratingOf(score) {
    var rs = cfg('ratings', KPI_DEFAULT_RATINGS).slice().sort(function (a, b) { return num(b.min) - num(a.min); });
    for (var i = 0; i < rs.length; i++) if (score >= num(rs[i].min)) return rs[i].name;
    return '';
  }

  /* ---------- Tài khoản, phiên đăng nhập ---------- */
  /** full = true: kèm số điện thoại, email (chỉ trả cho chính người đó và quản trị viên). */
  /** Quản lý vượt cấp: những người ngoài quan hệ phụ trách trực tiếp vẫn được giao việc, đánh giá cán bộ này (quản trị khai ở tài khoản của cán bộ). */
  function extraOf(u) { return str(u.extra).split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function isBoss(me, owner) { return str(owner.managerId) === str(me.id) || extraOf(owner).indexOf(str(me.id)) >= 0; }
  function extraIds(me) { var o = {}; store.all('Users').forEach(function (u) { if (on(u.active) && extraOf(u).indexOf(str(me.id)) >= 0) o[str(u.id)] = true; }); return o; }
  /** Đơn vị unitId có nằm trong đơn vị rootId (chính nó hoặc đơn vị con, cháu) không. */
  function unitWithin(unitId, rootId) {
    var by = {}; store.all('Units').forEach(function (u) { by[str(u.id)] = u; });
    for (var cur = str(unitId), g = 0; cur && g < 20; g++) { if (cur === str(rootId)) return true; cur = by[cur] ? str(by[cur].parentId) : ''; }
    return false;
  }
  /** Ai được giao việc cho ai: người phụ trách trực tiếp và quản lý vượt cấp; mọi cấp trên trong cây phụ trách; Trưởng, Phó đơn vị với người cấp thấp hơn
   *  trong đơn vị mình và các đơn vị con, kể cả Trưởng đơn vị con. Người giao việc là người xác nhận kết quả việc mình giao (Báo cáo thí điểm KPI, mục III.2). */
  function canAssign(me, owner) {
    if (str(me.id) === str(owner.id) || !on(owner.active)) return false;
    if (isBoss(me, owner) || subtreeIds(me.id, reportsMap())[str(owner.id)]) return true;
    var rm = rank(me), ro = rank(owner);
    if (rm > KPI_LEVELS.pho.rank || !str(me.unitId) || !unitWithin(owner.unitId, me.unitId)) return false;
    return rm < ro || (ro === KPI_LEVELS.truong.rank && str(owner.unitId) !== str(me.unitId));
  }
  function pub(u, full) {
    var o = {
      id: str(u.id), unitId: str(u.unitId), fullName: str(u.fullName), title: str(u.title), level: str(u.level) || 'canbo',
      managerId: str(u.managerId), selfEval: on(u.selfEval), isAdmin: on(u.isAdmin), active: on(u.active), mustChange: on(u.mustChange),
      isStaff: on(u.isStaff), isVoter: on(u.isVoter), extra: extraOf(u)
    };
    if (full) { o.phone = str(u.phone); o.email = str(u.email); }
    return o;
  }
  function passHash(salt, password) { return env.hash(str(salt) + '|' + str(password)); }
  function makeToken(u) {
    var exp = Date.now() + TOKEN_DAYS * 86400000;
    return str(u.id) + '.' + exp + '.' + env.hash(env.secret() + '|' + u.id + '|' + exp + '|' + u.passHash);
  }
  function auth(token) {
    var p = str(token).split('.');
    var u = p.length === 3 ? find('Users', p[0]) : null;
    if (!u || !on(u.active) || num(p[1]) < Date.now() ||
      env.hash(env.secret() + '|' + u.id + '|' + p[1] + '|' + u.passHash) !== p[2]) {
      err('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'AUTH');
    }
    return u;
  }
  /** Mật khẩu ban đầu cho tài khoản mới / cấp lại: mật khẩu mặc định của cơ quan nếu có (đã băm sẵn), không thì sinh mật khẩu tạm ngẫu nhiên. */
  function initialPass() {
    var dp = env.defaultPass ? env.defaultPass() : null;
    if (dp && str(dp.salt) && str(dp.passHash)) return { salt: str(dp.salt), passHash: str(dp.passHash), temp: '', usedDefault: true };
    var p = tempPassword(), salt = env.uuid();
    return { salt: salt, passHash: passHash(salt, p), temp: p, usedDefault: false };
  }
  function tempPassword() { return 'Kpi' + env.uuid().replace(/[^a-zA-Z0-9]/g, '').slice(0, 7) + '9'; }
  function setPassword(userId, password, mustChange) {
    var salt = env.uuid();
    store.update('Users', userId, { salt: salt, passHash: passHash(salt, password), mustChange: mustChange ? 1 : 0 });
  }

  /* ---------- Cây phụ trách ---------- */
  /** managerId -> danh sách người đang hoạt động do người đó phụ trách đánh giá. */
  function reportsMap() {
    var map = {};
    store.all('Users').forEach(function (u) {
      if (!on(u.active) || !str(u.managerId)) return;
      (map[str(u.managerId)] || (map[str(u.managerId)] = [])).push(u);
    });
    return map;
  }
  /** Tập CCCD của mọi người nằm dưới `id` trong cây phụ trách (mọi cấp). */
  function subtreeIds(id, map) {
    var out = {}, stack = [str(id)];
    while (stack.length) {
      (map[stack.pop()] || []).forEach(function (u) { if (!out[str(u.id)]) { out[str(u.id)] = true; stack.push(str(u.id)); } });
    }
    return out;
  }
  function canView(me, owner, map) {
    if (str(me.id) === str(owner.id) || on(me.isAdmin) || extraOf(owner).indexOf(str(me.id)) >= 0) return true;
    return !!subtreeIds(me.id, map || reportsMap())[str(owner.id)] || canAssign(me, owner);
  }

  /* ---------- Công việc, tính điểm ---------- */
  function cleanLevels(a) {
    var out = [];
    for (var i = 0; i < 5; i++) { var v = Math.round(num(a && a[i])); out.push(v >= 1 && v <= 5 ? v : 0); }
    return out;
  }
  function defaultMonth(period) {
    var p = str(period.startDate).split('-');
    return p.length === 3 ? 'T' + Number(p[1]) + '/' + p[0] : '';
  }
  function cleanTask(t, period, cat) {
    t = t || {};
    var qty = num(t.qty);
    if (!(qty > 0)) qty = 1;
    var link = str(t.link).trim();
    var out = {
      id: cut(t.id, 40) || env.uuid(),
      name: cut(t.name, 2000),
      product: KPI_MODEL.products.indexOf(t.product) >= 0 ? t.product : 'Khác',
      qty: r2(Math.min(qty, 1000)),
      month: /^T\d{1,2}\/\d{4}$/.test(str(t.month)) ? str(t.month) : defaultMonth(period),
      s: cleanLevels(t.s),
      link: /^https?:\/\/\S+$/i.test(link) ? link.slice(0, 500) : ''
    };
    if (str(t.code)) { // việc chọn từ Danh mục sản phẩm: điểm chuẩn, giờ chuẩn, đơn vị tính lấy theo danh mục, không theo máy khách
      var c = (cat || catalogMap())[str(t.code)];
      if (!c) err('Mã sản phẩm ' + cut(t.code, 30) + ' không có trong Danh mục sản phẩm.');
      out.code = str(c.id); out.std = num(c.point); out.hours = num(c.hours); out.unit = str(c.unit); out.n = str(c.level);
      out.product = cut(c.type, 100) || 'Khác';
      out.qty = Math.round(Math.min(qty, 100000) * 100) / 100;
      if (!out.name) out.name = cut(c.name, 2000);
    }
    if (DATE.test(str(t.deadline))) out.deadline = str(t.deadline);   // hạn hoàn thành
    if (DATE.test(str(t.doneDate))) out.doneDate = str(t.doneDate);   // ngày hoàn thành thực tế
    if (has(t.progress)) out.progress = pct(t.progress);              // tiến độ %, để trống coi như đã xong
    if (bonusOf(t.bonus)) out.bonus = bonusOf(t.bonus);               // điểm thưởng cán bộ đề xuất (%)
    if (DATE.test(str(t.workDate))) out.workDate = str(t.workDate);      // ngày thực hiện (cách kê của PP2, lưu chung một dòng)
    if (num(t.actual) > 0) out.actual = r2(Math.min(num(t.actual), 10000)); // giờ thực tế
    if (on(t.repeat)) out.repeat = true;                       // việc lặp lại: tự đưa sang kỳ sau
    if (KPI_calc(cleanLevels(t.pm))) out.pm = cleanLevels(t.pm); // mức người phụ trách đã chấm ở kỳ trước
    if (cut(t.from, 60)) out.from = cut(t.from, 60);             // tên kỳ mà việc này được chuyển sang
    return out;
  }
  /** Điểm của phiếu = tổng (số lượng × điểm của N) của từng công việc. key: 's' tự chấm, 'm' người phụ trách chấm. */
  function sumPoints(tasks, key) {
    var sum = 0;
    tasks.forEach(function (t) { var c = tcalc(t, key); if (c) sum += num(t.qty) * c.point * (key === 'm' ? 1 + num(t.mBonus) / 100 : 1); });
    return r4(sum);
  }
  /* Công việc lưu mỗi việc một dòng ở 2 bảng độc lập: Tasks (cán bộ tự chấm) và Reviews (người phụ trách chấm).
   * Trong bộ nhớ, một công việc vẫn là { id, name, product, qty, month, s[5], link, repeat, from, pm[5], m[5], locked, mBy, mDate, mTime }. */
  var KEYS = ['a', 'b', 'c', 'd', 'e'];
  function levelText(i, v) { v = Math.round(num(v)); return v >= 1 && v <= 5 ? v + '. ' + KPI_MODEL.factors[i].levels[v - 1][0] : ''; } // "2. Trên 01 đến 02 giờ"
  function levelsOf(row) { return cleanLevels(KEYS.map(function (k) { return parseInt(str(row[k]), 10); })); }
  function stamp() { // ngày, giờ Việt Nam
    var d = new Date(Date.now() + 7 * 3600000).toISOString();
    return { date: d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4), time: d.slice(11, 19) };
  }
  function loadTasks(evalId) {
    if (!str(evalId)) return [];
    var reviews = {};
    store.group('Reviews', 'evalId', evalId).forEach(function (r) { reviews[str(r.id)] = r; });
    return store.group('Tasks', 'evalId', evalId).slice().sort(function (a, b) { return num(a.order) - num(b.order); }).map(function (r) {
      var t = { id: str(r.id), name: str(r.name), product: str(r.product), qty: num(r.qty) || 1, month: str(r.month), s: levelsOf(r), link: str(r.link) };
      if (str(r.repeat)) t.repeat = true;
      if (str(r.from)) t.from = str(r.from);
      var pm = cleanLevels(str(r.pm).split(','));
      if (KPI_calc(pm)) t.pm = pm;
      if (str(r.code)) { t.code = str(r.code); t.unit = str(r.unit); t.std = num(r.std); t.hours = num(r.hours); t.n = str(r.nstd) || str(r.n); } // việc lấy từ Danh mục sản phẩm
      if (str(r.meta)) { try { var mx = JSON.parse(str(r.meta)); if (mx && typeof mx === 'object') t.x = mx; } catch (e) { /* bỏ qua ô ghi tự động bị sửa tay */ } }
      if (str(r.by)) t.by = str(r.by);                    // việc do người phụ trách thêm cho cấp dưới
      if (str(r.deadline)) t.deadline = str(r.deadline);
      if (str(r.doneDate)) t.doneDate = str(r.doneDate);
      if (str(r.progress) !== '') t.progress = pct(r.progress);
      if (bonusOf(r.bonus)) t.bonus = bonusOf(r.bonus);
      if (str(r.workDate)) t.workDate = str(r.workDate);
      if (num(r.actual) > 0) t.actual = num(r.actual);
      if (str(r.feedback)) { t.fb = str(r.feedback); t.fbAt = str(r.feedbackAt); if (str(r.feedbackDone)) t.fbDone = true; } // cán bộ phản hồi không tán thành
      if (str(r.note)) t.note = str(r.note);
      var v = reviews[t.id];
      if (v) {
        if (str(v.note)) t.note = str(v.note);            // nhận xét của người đánh giá cho riêng việc này
        var m = levelsOf(v);
        if (t.code && str(v.h) !== '') { // việc trong danh mục: người phụ trách xác nhận bằng hệ số H, Q, T; A–E nếu có là phần điều chỉnh thêm
          t.H = num(v.h); t.Q = num(v.q); t.T = num(v.t);
          if (KPI_calc(m)) t.m = m;
          t.mBy = str(v.reviewerId); t.mDate = str(v.date); t.mTime = str(v.time); if (str(v.lock) === 'Khoá') t.locked = true;
          if (str(v.progress) !== '') t.mProgress = pct(v.progress);
          if (str(v.doneDate)) t.mDone = str(v.doneDate);
          if (bonusOf(v.bonus)) t.mBonus = bonusOf(v.bonus);
          if (str(v.overTime)) t.ot = true;
          if (str(v.overQuality)) t.oq = true;
        } else if (KPI_calc(m)) { t.m = m; t.mBy = str(v.reviewerId); t.mDate = str(v.date); t.mTime = str(v.time); if (str(v.lock) === 'Khoá') t.locked = true;
          if (str(v.progress) !== '') t.mProgress = pct(v.progress);
          if (str(v.doneDate)) t.mDone = str(v.doneDate);
          if (bonusOf(v.bonus)) t.mBonus = bonusOf(v.bonus);
          if (str(v.overTime)) t.ot = true;      // vượt tiến độ
          if (str(v.overQuality)) t.oq = true;   // vượt chất lượng
        }
      }
      return t;
    });
  }
  /** Ghi lại toàn bộ công việc của một phiếu vào 2 bảng. */
  function writeTasks(evalId, userId, period, tasks) {
    if (tasks.length > 400) err('Phiếu có quá nhiều công việc (tối đa 400).');
    var pname = str(period.name), now = nowIso();
    function base(t, i, key) {
      var lv = t[key], c = tcalc(t, key), row = { userId: str(userId), period: pname, evalId: str(evalId), id: t.id, order: i + 1, name: t.name, product: t.product, qty: t.qty, month: t.month };
      KEYS.forEach(function (k, j) { row[k] = levelText(j, (lv || [])[j]); });
      row.s = c ? c.s : ''; row.n = c ? c.n : ''; row.point = c ? r4(c.point) : '';
      return row;
    }
    store.replaceGroup('Tasks', 'evalId', evalId, tasks.map(function (t, i) {
      var row = base(t, i, 's'), done = !!(t.locked && tcalc(t, 'm'));
      row.code = t.code || ''; row.unit = t.code ? t.unit || '' : ''; row.std = t.code ? num(t.std) : ''; row.hours = t.code ? num(t.hours) : '';
      row.g = t.code ? r4(((t.locked && tcalc(t, 'm')) || { base: num(t.std) }).base * num(t.qty)) : ''; row.nstd = t.code ? str(t.n) : '';
      row.link = t.link || ''; row.repeat = t.repeat ? 'Có' : ''; row.from = t.from || ''; row.pm = KPI_calc(t.pm) ? t.pm.join(',') : '';
      row.evaluated = done ? 'Có' : ''; row.evaluatedAt = done ? (str(t.mDate) + ' ' + str(t.mTime)).trim() : ''; row.updatedAt = now;
      row.note = t.note || ''; row.by = t.by || ''; row.meta = t.x && Object.keys(t.x).length ? JSON.stringify(t.x) : '';
      row.deadline = t.deadline || ''; row.doneDate = t.doneDate || ''; row.progress = has(t.progress) ? t.progress : ''; row.bonus = t.bonus || '';
      row.workDate = t.workDate || ''; row.actual = t.actual || '';
      row.feedback = t.fb || ''; row.feedbackAt = t.fb ? str(t.fbAt) : ''; row.feedbackDone = t.fb && t.fbDone ? 'Có' : '';
      return row;
    }));
    var reviewed = [];
    tasks.forEach(function (t, i) {
      if (!tcalc(t, 'm') && !t.note) return;
      var row = base(t, i, 'm'), mc = tcalc(t, 'm');
      row.h = t.code && mc ? num(t.H) : ''; row.q = t.code && mc ? num(t.Q) : ''; row.t = t.code && mc ? num(t.T) : '';
      row.score = mc ? r4(mc.point * num(t.qty) * (1 + num(t.mBonus) / 100)) : '';
      row.reviewerId = str(t.mBy); row.date = str(t.mDate); row.time = str(t.mTime); row.lock = t.locked ? 'Khoá' : 'Mở'; row.note = t.note || '';
      row.progress = has(t.mProgress) ? t.mProgress : ''; row.doneDate = t.mDone || ''; row.bonus = t.mBonus || '';
      row.overTime = t.ot ? 'Có' : ''; row.overQuality = t.oq ? 'Có' : '';
      reviewed.push(row);
    });
    store.replaceGroup('Reviews', 'evalId', evalId, reviewed);
  }
  /** Tổng điểm các việc đã được người phụ trách chấm (đã khoá). */
  function sumLocked(tasks) {
    var sum = 0;
    tasks.forEach(function (t) { var c = t.locked ? tcalc(t, 'm') : null; if (c) sum += num(t.qty) * c.point * (1 + num(t.mBonus) / 100); });
    return r4(sum);
  }
  /** Số công việc cán bộ đã phản hồi không tán thành mà người phụ trách chưa xem xét lại. */
  function fbCount(tasks) { return tasks.filter(function (t) { return t.fb && !t.fbDone; }).length || ''; }
  /** Ghi phần xác nhận của người chấm cho một việc: tiến độ, ngày hoàn thành, điểm thưởng, vượt tiến độ, vượt chất lượng. x: giá trị người chấm gửi lên (thiếu thì lấy theo cán bộ kê). */
  function confirmTask(t, x) {
    x = x || {};
    t.mProgress = has(x.progress) ? pct(x.progress) : (has(t.progress) ? t.progress : 100);
    t.mDone = DATE.test(str(x.doneDate)) ? str(x.doneDate) : (t.doneDate || '');
    t.mBonus = has(x.bonus) ? bonusOf(x.bonus) : (t.bonus || 0);
    var early = !!(t.deadline && t.mDone && t.mDone < t.deadline);
    t.ot = has(x.ot) ? on(x.ot) : early;
    t.oq = on(x.oq);
    if (!t.ot) delete t.ot;
    if (!t.oq) delete t.oq;
    if (t.fb) t.fbDone = true; // đã xem xét phản hồi của cán bộ
  }
  function allLocked(tasks) { return tasks.length > 0 && tasks.every(function (t) { return t.locked && tcalc(t, 'm'); }); }
  function headerRow(fields) {
    var row = {};
    KPI_TABLES.Evaluations.forEach(function (k) { row[k] = k in fields ? fields[k] : ''; });
    return row;
  }

  /* ---------- Phiếu đánh giá ---------- */
  function evalOf(periodId, userId) {
    var rows = store.all('Evaluations');
    for (var i = 0; i < rows.length; i++) {
      if (str(rows[i].periodId) === str(periodId) && str(rows[i].userId) === str(userId)) return rows[i];
    }
    return null;
  }
  function evOut(ev, owner, withTasks) {
    if (!ev) {
      return {
        id: '', status: owner && !on(owner.selfEval) ? 'khong_ke' : 'chua_lap', tasks: [], taskCount: 0, selfTotal: null, mgrTotal: null, gTotal: null, hours: null,
        finalTotal: null, rating: '', selfComment: '', mgrComment: '', submittedAt: '', reviewedAt: ''
      };
    }
    function n(v) { return has(v) ? num(v) : null; }
    return {
      id: str(ev.id), status: str(ev.status), tasks: withTasks ? loadTasks(ev.id) : [], taskCount: num(ev.taskCount),
      selfTotal: n(ev.selfTotal), mgrTotal: n(ev.mgrTotal), gTotal: n(ev.gTotal), hours: n(ev.hours), finalTotal: n(ev.finalTotal), rating: str(ev.rating),
      selfComment: str(ev.selfComment), mgrComment: str(ev.mgrComment), submittedAt: str(ev.submittedAt), reviewedAt: str(ev.reviewedAt)
    };
  }
  function perms(me, ev, owner, period) {
    var ph = phaseOf(period), open = ph !== 'khoa', input = ph === 'mo';
    var st = ev ? str(ev.status) : 'chua_lap';
    var self = str(me.id) === str(owner.id), mine = !self && isBoss(me, owner), asg = !self && !mine && canAssign(me, owner);
    var canSelf = self && on(owner.selfEval);
    var selfScore = canSelf && rank(owner) <= KPI_LEVELS.truong.rank; // trưởng đơn vị, thủ trưởng: tự chấm cho mình, mức tự chọn là kết quả
    return {
      selfScore: selfScore,
      // cán bộ nhập khi kỳ còn mở nhập; riêng phiếu được người phụ trách cho đánh giá lại thì sửa được cả sau khi chốt nhập
      canEdit: canSelf && ((input && (selfScore || st === 'chua_lap' || st === 'nhap' || st === 'da_chot')) || (open && st === 'yeu_cau_sua')),
      addOnly: canSelf && !selfScore && input && st === 'da_chot', // phiếu đã chấm: chỉ được bổ sung việc mới
      canReview: open && mine && st === 'cho_duyet',
      // người phụ trách trực tiếp: chấm từng việc, ghi nhận xét, thêm việc cho cấp dưới ở mọi trạng thái phiếu khi kỳ chưa khoá
      canScore: open && (mine || asg) && on(owner.selfEval),
      limited: asg, // cấp trên không trực tiếp phụ trách: chỉ giao việc và xác nhận việc do chính mình giao
      canRedo: open && mine && st === 'da_chot',     // người phụ trách cho cán bộ đánh giá lại
      canReopen: open && on(me.isAdmin) && st === 'da_chot'
    };
  }
  function log(evalId, me, action, note) {
    store.insert('History', { id: env.uuid(), evalId: evalId, time: nowIso(), userId: me.id, action: action, note: cut(note, 1000) });
  }
  function needPeriod(id) { return find('Periods', id) || err('Không tìm thấy kỳ đánh giá.'); }
  function loadEval(me, evalId) {
    var ev = find('Evaluations', evalId) || err('Không tìm thấy phiếu đánh giá.');
    var owner = find('Users', ev.userId) || err('Không tìm thấy cán bộ của phiếu.');
    var period = needPeriod(ev.periodId);
    return { ev: ev, owner: owner, period: period, p: perms(me, ev, owner, period), tasks: loadTasks(ev.id) };
  }

  /* ---------- KPI tổng hợp theo cây phụ trách ----------
   * KPI(người) = điểm phiếu của chính người đó đã được người phụ trách công nhận (nếu có tự kê)
   *            + tổng KPI của những người do người đó phụ trách.
   * Suy ra: phó đơn vị = việc tự làm + các cá nhân mình phụ trách; trưởng đơn vị = tổng các cấp phó;
   * thủ trưởng cơ quan = tổng các đơn vị. */
  function kpiCalculator(periodId, map) {
    var own = {}, full = {}, memo = {};
    store.all('Evaluations').forEach(function (e) {
      // điểm các việc đã được chấm (mgrTotal) được cộng ngay, kể cả khi phiếu chưa chấm xong hết và kể cả việc do cấp trên thêm
      if (str(e.periodId) === str(periodId) && has(e.mgrTotal)) { own[str(e.userId)] = num(e.mgrTotal); if (e.status === 'da_chot') full[str(e.userId)] = true; }
    });
    function calc(u, path) {
      var id = str(u.id);
      if (memo[id]) return memo[id];
      if (path[id]) return { kpi: 0, people: 0, done: 0 }; // phòng vòng lặp do sửa tay trong Sheet
      path[id] = true;
      var r = { kpi: 0, people: 0, done: 0 };
      if (on(u.selfEval)) { r.people = 1; if (id in own) r.kpi = own[id]; if (full[id]) r.done = 1; }
      (map[id] || []).forEach(function (c) { var x = calc(c, path); r.kpi += x.kpi; r.people += x.people; r.done += x.done; });
      delete path[id];
      r.kpi = r2(r.kpi);
      return (memo[id] = r);
    }
    return function (u) { return calc(u, {}); };
  }

  /* ---------- PP2 theo cây phụ trách (giống PP1) ----------
   * Kết quả PP2 của một người = các việc tự thực hiện đã được chấm + kết quả của mọi người ở cây dưới.
   * Cộng dồn điểm chuẩn G, G·H, G·H·Q, G·H·T và điểm thực đạt P rồi mới tính a, b, c, KPI trên tổng. */
  var P2_KEYS = ['G', 'GH', 'GHQ', 'GHT', 'P', 'n', 'done'];
  function p2Zero() { return { G: 0, GH: 0, GHQ: 0, GHT: 0, P: 0, n: 0, done: 0 }; }
  function p2Plus(a, b) { P2_KEYS.forEach(function (k) { a[k] += b[k]; }); return a; }
  function p2Round(a) { var o = {}; P2_KEYS.forEach(function (k) { o[k] = Math.round(a[k] * 1e4) / 1e4; }); return o; }
  function p2OwnOf(tasks) {
    var r = p2Zero(), ru = rule();
    tasks.forEach(function (t) {
      r.n++;
      var q = num(t.qty) || 0, sv = KPI_taskCalc(t, 's', ru), m = KPI_taskCalc(t, 'm', ru);
      if (!t.locked || !m) return;
      var g = Math.round((t.code ? m.base : sv ? sv.point : 0) * q * 1e4) / 1e4, p = Math.round(m.point * q * (1 + (num(t.mBonus) || 0) / 100) * 1e4) / 1e4;
      r.G += g; r.P += p;
      if (t.code) { r.GH += g * num(t.H); r.GHQ += g * num(t.H) * num(t.Q); r.GHT += g * num(t.H) * num(t.T); }
      else { r.GH += p; r.GHQ += p; r.GHT += p; }
      r.done++;
    });
    return r;
  }
  function p2Calculator(periodId, map) {
    var evs = {}, memo = {};
    store.all('Evaluations').forEach(function (e) { if (str(e.periodId) === str(periodId)) evs[str(e.userId)] = e; });
    function calc(u, path) {
      var id = str(u.id);
      if (memo[id]) return memo[id];
      if (path[id]) return { own: p2Zero(), total: p2Zero(), people: 0 };
      path[id] = true;
      var own = on(u.selfEval) && evs[id] ? p2OwnOf(loadTasks(evs[id].id)) : p2Zero(), total = p2Plus(p2Zero(), own), people = 0;
      (map[id] || []).forEach(function (c) { var x = calc(c, path); p2Plus(total, x.total); people += x.people + 1; });
      delete path[id];
      return (memo[id] = { own: p2Round(own), total: p2Round(total), people: people });
    }
    return function (u) { return calc(u, {}); };
  }

  /* ---------- Các thao tác ---------- */
  var A = {};

  function login(d) {
    var name = str(d.username).trim().toLowerCase();
    var users = store.all('Users');
    if (!users.length) err('Hệ thống chưa được khởi tạo. Quản trị viên cần chạy hàm setup() trước.');
    var u = users.filter(function (x) { return str(x.id).toLowerCase() === name; })[0];
    if (!u || !on(u.active) || !str(u.passHash) || passHash(u.salt, d.password) !== str(u.passHash)) {
      err('Sai tên đăng nhập hoặc mật khẩu.');
    }
    return { token: makeToken(u), boot: A.bootstrap(u, { pre: d.pre, periodId: d.periodId }) };
  }

  /** Đơn vị người gọi được biết: quản trị thấy cả cây; người khác chỉ thấy đơn vị của mình, của những người mình phụ trách và các đơn vị cấp trên của chúng. */
  function unitsFor(me) {
    var all = store.all('Units').slice().sort(byOrder);
    if (on(me.isAdmin)) return all;
    var scope = subtreeIds(me.id, reportsMap()), byId = {}, keep = {};
    all.forEach(function (u) { byId[str(u.id)] = u; });
    store.all('Users').forEach(function (u) {
      if (str(u.id) !== str(me.id) && !(on(u.active) && scope[str(u.id)])) return;
      for (var id = str(u.unitId), g = 0; id && byId[id] && !keep[id] && g < 50; g++) { keep[id] = true; id = str(byId[id].parentId); }
    });
    return all.filter(function (u) { return keep[str(u.id)]; });
  }

  A.bootstrap = function (me, d) {
    var out = bootOf(me);
    // Gửi kèm số liệu trang Tổng quan của kỳ đang mở để trình duyệt không phải gọi thêm hai lượt nữa.
    if (d && d.pre) {
      try {
        var ps = out.periods, p = ps.filter(function (x) { return x.id === str(d.periodId); })[0] || ps.filter(function (x) { return x.phase === 'mo'; })[0] || ps.filter(function (x) { return x.phase !== 'khoa'; })[0] || ps[0];
        if (p) out.pre = { periodId: p.id, ov: A.overview(me, { periodId: p.id }), st: A.stats(me) };
      } catch (e) { /* thiếu số liệu kèm thì trình duyệt tự gọi */ }
    }
    return out;
  };
  function bootOf(me) {
    return {
      user: pub(me, true),
      hasReports: !!(reportsMap()[str(me.id)] || []).length || !!Object.keys(extraIds(me)).length,
      units: unitsFor(me).map(function (u) { return { id: str(u.id), name: str(u.name), parentId: str(u.parentId), order: num(u.order) }; }),
      periods: store.all('Periods').slice().sort(function (a, b) { return str(b.startDate).localeCompare(str(a.startDate)); }).map(periodOut),
      config: publicConfig(),
      canUpload: !!env.evidence,
      canAssign: on(me.isAdmin) || rank(me) <= KPI_LEVELS.pho.rank || !!(reportsMap()[str(me.id)] || []).length || !!Object.keys(extraIds(me)).length
    };
  };

  A.changePassword = function (me, d) {
    if (passHash(me.salt, d.oldPassword) !== str(me.passHash)) err('Mật khẩu hiện tại không đúng.');
    if (str(d.newPassword).length < 8) err('Mật khẩu mới phải có ít nhất 8 ký tự.');
    if (d.newPassword === d.oldPassword) err('Mật khẩu mới phải khác mật khẩu hiện tại.');
    setPassword(me.id, d.newPassword, false);
    var u = find('Users', me.id);
    return { token: makeToken(u), user: pub(u, true) };
  };

  /** Mọi người trong phạm vi được xem của người gọi, kèm phiếu kỳ này và KPI tổng hợp. */
  A.overview = function (me, d) {
    var period = needPeriod(d.periodId), map = reportsMap();
    var scope = on(me.isAdmin) ? null : subtreeIds(me.id, map);
    if (scope) { var ex = extraIds(me); Object.keys(ex).forEach(function (k) { scope[k] = true; }); } // người được quản lý vượt cấp
    var users = store.all('Users').filter(function (u) { return on(u.active) && (!scope || scope[str(u.id)] || str(u.id) === str(me.id)); });
    var evs = {};
    store.all('Evaluations').forEach(function (e) { evs[str(e.periodId) + '|' + str(e.userId)] = e; });
    var kpi = kpiCalculator(period.id, map), pc2 = d.p2 ? p2Calculator(period.id, map) : null;
    var rows = users.map(function (u) {
      var ev = evs[str(period.id) + '|' + str(u.id)];
      var o = evOut(ev, u), p = perms(me, ev, u, period), k = kpi(u);
      return {
        user: pub(u), evalId: o.id, status: o.status, taskCount: o.taskCount, selfTotal: o.selfTotal, mgrTotal: o.mgrTotal,
        finalTotal: o.finalTotal, rating: o.status === 'da_chot' ? o.rating : '', submittedAt: o.submittedAt, canReview: p.canReview, fb: ev ? num(ev.fbCount) : 0, gTotal: o.gTotal, hours: o.hours,
        kpi: k.kpi, people: k.people, done: k.done, reports: (map[str(u.id)] || []).length
      };
    }).map(function (r, i) { if (pc2) r.p2 = pc2(users[i]); return r; });
    var trend = store.all('Periods').slice().sort(function (a, b) { return str(a.startDate).localeCompare(str(b.startDate)); })
      .map(function (p) { var k = kpiCalculator(p.id, map)(me); return { periodId: str(p.id), name: str(p.name), avg: k.done || k.kpi > 0 ? k.kpi : null, count: k.done }; });
    return { rows: rows, trend: trend };
  };

  /** Số liệu nhiều kỳ cho dashboard: điểm từng kỳ của mọi người trong phạm vi được xem (chính mình, những người mình phụ trách; quản trị thấy tất cả). */
  A.stats = function (me) {
    var admin = on(me.isAdmin), scope = admin ? null : subtreeIds(me.id, reportsMap()), ok = {};
    var users = store.all('Users');
    users.forEach(function (u) { if (on(u.active) && (!scope || scope[str(u.id)] || str(u.id) === str(me.id))) ok[str(u.id)] = true; });
    function n(v) { return has(v) ? num(v) : null; }
    var out = { rows: [] };
    store.all('Evaluations').forEach(function (e) {
      if (!ok[str(e.userId)]) return;
      out.rows.push({ userId: str(e.userId), periodId: str(e.periodId), status: str(e.status), taskCount: num(e.taskCount), selfTotal: n(e.selfTotal), mgrTotal: n(e.mgrTotal) });
    });
    if (admin) {
      var act = users.filter(function (u) { return on(u.active); });
      out.accounts = {
        active: act.length, locked: users.length - act.length,
        mustChange: act.filter(function (u) { return on(u.mustChange); }).length,
        noManager: act.filter(function (u) { return on(u.selfEval) && !str(u.managerId); }).length
      };
    }
    return out;
  };

  A.getEvaluation = function (me, d) {
    var period = needPeriod(d.periodId);
    var owner = d.userId ? find('Users', d.userId) : me;
    if (!owner) err('Không tìm thấy cán bộ.');
    if (!canView(me, owner)) err('Anh/chị không có quyền xem phiếu này.');
    var ev = evalOf(period.id, owner.id);
    var names = {};
    store.all('Users').forEach(function (u) { names[str(u.id)] = str(u.fullName); });
    var history = !ev ? [] : store.all('History').filter(function (x) { return str(x.evalId) === str(ev.id); })
      .sort(function (a, b) { return str(b.time).localeCompare(str(a.time)); })
      .map(function (x) { return { time: str(x.time), userName: names[str(x.userId)] || '', action: str(x.action), note: str(x.note) }; });
    var out = {
      period: periodOut(period), owner: pub(owner), managerName: names[str(owner.managerId)] || '', ev: evOut(ev, owner, true),
      perms: perms(me, ev, owner, period), history: history
    };
    var evd = {};
    evidenceOf(owner.id, period.id).forEach(function (x) { (evd[str(x.taskId)] || (evd[str(x.taskId)] = [])).push(evidenceOut(x)); });
    out.ev.tasks.forEach(function (t) { if (evd[t.id]) t.ev = evd[t.id]; });
    out.canUpload = !!env.evidence;
    out.rule = rule();
    out.workHours = workHours(period);
    var rated = find('Ratings', str(period.id) + '|' + str(owner.id));
    out.result = rated && KPI_RATE[str(rated.result)] ? KPI_RATE[str(rated.result)] : '';
    // Kết quả của một người trong cây đánh giá = việc tự thực hiện đã được công nhận + kết quả của những người mình phụ trách.
    // Trả kèm danh sách cấp dưới trực tiếp để hiện ngay trên phiếu của người đó.
    var map = reportsMap(), kc = kpiCalculator(period.id, map), pc = p2Calculator(period.id, map), evs = {};
    store.all('Evaluations').forEach(function (e) { if (str(e.periodId) === str(period.id)) evs[str(e.userId)] = e; });
    out.team = (map[str(owner.id)] || []).slice().sort(function (a, b) { return rank(a) - rank(b) || str(a.fullName).localeCompare(str(b.fullName), 'vi'); })
      .map(function (u) {
        var e = evs[str(u.id)], k = kc(u);
        return {
          user: pub(u), status: e ? str(e.status) : (on(u.selfEval) ? 'chua_lap' : 'khong_ke'), taskCount: e ? num(e.taskCount) : 0,
          finalTotal: e && e.status === 'da_chot' ? num(e.finalTotal) : null, mgrTotal: e && has(e.mgrTotal) ? num(e.mgrTotal) : null, kpi: k.kpi, people: k.people, done: k.done, reports: (map[str(u.id)] || []).length, p2: pc(u)
        };
      });
    var ko = kc(owner);
    out.kpi = { own: ev && has(ev.mgrTotal) ? num(ev.mgrTotal) : 0, total: ko.kpi, people: ko.people, done: ko.done };
    out.p2 = pc(owner);
    if (str(me.id) === str(owner.id) && on(owner.selfEval)) {
      var mine = store.all('Evaluations').filter(function (e) { return str(e.userId) === str(owner.id) && num(e.taskCount) > 0; });
      var byPeriod = {};
      store.all('Periods').forEach(function (p) { byPeriod[str(p.id)] = p; });
      var earlier = mine.filter(function (e) { var p = byPeriod[str(e.periodId)]; return p && str(p.id) !== str(period.id); })
        .sort(function (a, b) { return str(byPeriod[str(b.periodId)].startDate).localeCompare(str(byPeriod[str(a.periodId)].startDate)); });
      // các kỳ khác đã có phiếu, để chọn "lấy việc từ kỳ trước"
      out.myPeriods = earlier.map(function (e) { var p = byPeriod[str(e.periodId)]; return { id: str(p.id), name: str(p.name), taskCount: num(e.taskCount) }; });
      // phiếu kỳ này chưa lập: tự đưa sang các việc đã đánh dấu "lặp lại" ở kỳ gần nhất trước đó
      if (!ev && out.perms.canEdit) {
        var prev = earlier.filter(function (e) { return str(byPeriod[str(e.periodId)].startDate) < str(period.startDate); })[0];
        if (prev) {
          var carried = loadTasks(prev.id).filter(function (t) { return t.repeat; }).map(function (t) { return carryTask(t, period, str(byPeriod[str(prev.periodId)].name)); });
          if (carried.length) out.carry = { from: str(byPeriod[str(prev.periodId)].name), tasks: carried };
        }
      }
    }
    return out;
  };

  /** Bản sao một công việc để đưa sang kỳ khác: giữ mức tự chấm, nhớ mức người phụ trách đã chấm ở kỳ gốc. */
  function carryTask(t, period, fromName) {
    var c = { id: env.uuid(), name: str(t.name), product: str(t.product), qty: num(t.qty) || 1, month: defaultMonth(period), s: cleanLevels(t.s), link: '', from: fromName };
    if (t.repeat) c.repeat = true;
    if (t.code) { c.code = t.code; c.std = t.std; c.hours = t.hours; c.unit = t.unit; c.n = t.n; }
    if (!t.code && KPI_calc(t.m)) c.pm = cleanLevels(t.m);
    return c;
  }

  /** Các công việc trong phiếu của chính mình ở một kỳ khác, đã chuyển thành bản sao cho kỳ đang làm. */
  A.tasksFrom = function (me, d) {
    var target = needPeriod(d.periodId), src = needPeriod(d.fromPeriodId);
    var srcEv = evalOf(src.id, me.id);
    return { from: str(src.name), tasks: (srcEv ? loadTasks(srcEv.id) : []).map(function (t) { return carryTask(t, target, str(src.name)); }) };
  };

  A.saveSelf = function (me, d) {
    var period = needPeriod(d.periodId);
    var ev = evalOf(period.id, me.id);
    if (!on(me.selfEval)) err('Chức danh của anh/chị không tự kê công việc; KPI được tổng hợp từ cấp dưới.');
    if (!perms(me, ev, me, period).canEdit) {
      var ph = phaseOf(period);
      err(ph === 'khoa' ? 'Kỳ đánh giá đã khoá, không thể chỉnh sửa.' : ph === 'chot' ? 'Kỳ đã chốt nhập (hết hạn ' + str(period.deadline).split('-').reverse().join('/') + '). Chỉ sửa được khi người phụ trách cho đánh giá lại.' : 'Phiếu đã nộp, đang chờ người phụ trách chấm nên chưa sửa được.');
    }
    var p0 = perms(me, ev, me, period);
    var old = {}, seen = {}, oldList = ev ? loadTasks(ev.id) : [], catMap = catalogMap();
    oldList.forEach(function (t) { old[t.id] = t; });
    if (p0.addOnly && !d.submit) err('Phiếu đã được người phụ trách chấm. Anh/chị chỉ có thể bổ sung công việc mới rồi bấm "Nộp bổ sung".');
    // việc đã được người phụ trách chấm thì giữ nguyên, cán bộ không sửa, không xoá được
    var locked = p0.selfScore ? [] : oldList.filter(function (t) { return t.locked; }); // người tự chấm sửa được cả việc đã chấm của mình
    var tasks = locked.concat((Array.isArray(d.tasks) ? d.tasks : []).slice(0, 400)
      .filter(function (t) { return p0.selfScore || !(t && old[t.id] && old[t.id].locked); })
      .map(function (t) { return cleanTask(t, period, catMap); })
      .filter(function (t) { return t.name || t.code || t.s.some(function (v) { return v; }); }));
    tasks.forEach(function (t, i) { // việc trong danh mục: 5 mức A–E hoặc để trống cả, hoặc chọn đủ
      if (t.code && !t.locked && t.s.some(function (v) { return v; }) && !KPI_calc(t.s)) err('Công việc số ' + (i + 1) + ' (mã ' + t.code + '): muốn điều chỉnh theo A–E thì chọn đủ 5 mức, không thì để trống cả 5.');
    });
    tasks.forEach(function (t) { if (old[t.id] && old[t.id].x) t.x = old[t.id].x; }); // giữ thông tin giao nhận, gia hạn
    tasks.forEach(function (t, i) {
      if (t.locked) { seen[t.id] = true; return; }
      if (seen[t.id]) t.id = env.uuid();
      seen[t.id] = true;
      if (old[t.id] && old[t.id].note) t.note = old[t.id].note;
      if (old[t.id] && old[t.id].by) t.by = old[t.id].by;
      if (old[t.id] && old[t.id].code && t.code === old[t.id].code && has(old[t.id].H)) { // giữ hệ số người phụ trách đã xác nhận
        t.H = old[t.id].H; t.Q = old[t.id].Q; t.T = old[t.id].T; t.mBy = old[t.id].mBy; t.mDate = old[t.id].mDate; t.mTime = old[t.id].mTime;
        ['mProgress', 'mDone', 'mBonus', 'ot', 'oq'].forEach(function (k) { if (has(old[t.id][k])) t[k] = old[t.id][k]; });
      }
      if (old[t.id] && old[t.id].m) { // giữ điểm người phụ trách đã chấm khi phiếu bị trả lại
        t.m = old[t.id].m; t.mBy = old[t.id].mBy; t.mDate = old[t.id].mDate; t.mTime = old[t.id].mTime;
        ['mProgress', 'mDone', 'mBonus', 'ot', 'oq'].forEach(function (k) { if (has(old[t.id][k])) t[k] = old[t.id][k]; });
      }
      if (old[t.id] && old[t.id].fb) { t.fb = old[t.id].fb; t.fbAt = old[t.id].fbAt; if (old[t.id].fbDone) t.fbDone = true; }
      if (!d.submit) return;
      if (!t.name) err('Công việc số ' + (i + 1) + ' chưa ghi tên công việc.');
      if (!tcalc(t, 's') && !(old[t.id] && old[t.id].by && tcalc(old[t.id], 'm'))) err('Công việc số ' + (i + 1) + ' chưa chọn đủ 5 tiêu chí A, B, C, D, E.');
    });
    if (d.submit) {
      if (!tasks.length) err('Phiếu chưa có công việc nào.');
      if (p0.selfScore) { // tự chấm: mức tự chọn chính là kết quả, ghi nhận ngay
        var at = stamp();
        tasks.forEach(function (t) {
          if (t.code) { if (!has(t.H)) { t.H = 1; t.Q = 1; t.T = 1; } confirmTask(t, { ot: t.ot, oq: t.oq }); } // việc trong danh mục: tự xác nhận hoàn thành đủ, đạt, đúng hạn nếu cấp trên chưa xác nhận
          else if (old[t.id] && old[t.id].by && KPI_calc(old[t.id].m) && !KPI_calc(t.s)) { t.m = old[t.id].m; } // việc cấp trên thêm: giữ mức cấp trên chấm
          else t.m = t.s.slice();
          t.locked = true; t.mBy = str(me.id); t.mDate = at.date; t.mTime = at.time;
          confirmTask(t, { ot: t.ot, oq: t.oq });
        });
      } else {
        var mgr = find('Users', me.managerId);
        if (!mgr || !on(mgr.active)) err('Anh/chị chưa được khai người phụ trách đánh giá. Vui lòng liên hệ quản trị viên.');
      }
    } else if (p0.selfScore) tasks.forEach(function (t) { delete t.locked; }); // lưu nháp: chưa tính điểm
    var patch = {};
    patch.taskCount = tasks.length; patch.selfTotal = sumPoints(tasks, 's'); patch.selfComment = cut(d.comment, 2000);
    var done = d.submit && allLocked(tasks); // mọi việc đã được chấm sẵn: không cần chờ chấm nữa
    patch.status = done ? 'da_chot' : d.submit ? 'cho_duyet' : (ev && ev.status === 'yeu_cau_sua' ? 'yeu_cau_sua' : 'nhap');
    patch.updatedAt = nowIso(); patch.mgrTotal = tasks.some(function (t) { return t.locked; }) ? sumLocked(tasks) : '';
    patch.finalTotal = done ? sumLocked(tasks) : ''; patch.rating = done ? ratingOf(patch.finalTotal) : ''; patch.fbCount = fbCount(tasks);
    patch.gTotal = tasks.some(function (t) { return t.locked; }) ? gLocked(tasks) : ''; patch.hours = hoursOf(tasks);
    if (d.submit) patch.submittedAt = nowIso();
    var id;
    if (ev) { id = ev.id; store.update('Evaluations', id, patch); }
    else {
      id = env.uuid();
      patch.id = id; patch.periodId = period.id; patch.userId = me.id;
      store.insert('Evaluations', headerRow(patch));
    }
    writeTasks(id, me.id, period, tasks);
    evidenceOf(me.id, period.id).forEach(function (x) { if (!seen[str(x.taskId)]) dropEvidence(x); }); // việc đã xoá khỏi phiếu: bỏ luôn minh chứng của nó
    if (d.submit && p0.selfScore) { store.update('Evaluations', id, { reviewerId: me.id, reviewedAt: nowIso() }); log(id, me, 'Tự chấm điểm', patch.taskCount + ' công việc, điểm: ' + patch.mgrTotal); }
    else if (d.submit) log(id, me, 'Nộp phiếu tự đánh giá', patch.taskCount + ' công việc, điểm tự chấm: ' + patch.selfTotal);
    return A.getEvaluation(me, { periodId: period.id });
  };

  /** Người phụ trách đánh giá phiếu: công nhận kết quả (decision 'approve') hoặc trả lại ('return'). */
  A.review = function (me, d) {
    var x = loadEval(me, d.evalId);
    if (d.decision === 'redo') { // cho cán bộ đánh giá lại phiếu đã chấm
      if (!x.p.canRedo) err('Chỉ người phụ trách trực tiếp mới cho đánh giá lại được, và kỳ phải chưa khoá.');
      x.tasks.forEach(function (t) { delete t.locked; });
      writeTasks(x.ev.id, x.owner.id, x.period, x.tasks);
      var re = {};
      re.status = 'yeu_cau_sua'; re.finalTotal = ''; re.mgrTotal = ''; re.rating = ''; re.updatedAt = nowIso(); re.mgrComment = cut(d.comment, 2000);
      store.update('Evaluations', x.ev.id, re);
      log(x.ev.id, me, 'Cho đánh giá lại', d.comment);
      return A.getEvaluation(me, { periodId: x.period.id, userId: x.owner.id });
    }
    if (!x.p.canReview) err('Anh/chị không phải người phụ trách đánh giá phiếu này, hoặc phiếu không ở trạng thái chờ đánh giá.');
    var comment = cut(d.comment, 2000);
    var patch = { updatedAt: nowIso(), mgrComment: comment };
    if (d.decision === 'return') {
      if (!comment) err('Vui lòng ghi rõ nội dung yêu cầu sửa.');
      patch.status = 'yeu_cau_sua'; patch.mgrTotal = ''; patch.finalTotal = ''; patch.rating = '';
      x.tasks.forEach(function (t) { delete t.locked; });
      writeTasks(x.ev.id, x.owner.id, x.period, x.tasks);
      store.update('Evaluations', x.ev.id, patch);
      log(x.ev.id, me, 'Yêu cầu sửa', comment);
    } else {
      var src = {}, at = stamp();
      (Array.isArray(d.tasks) ? d.tasks : []).forEach(function (t) { if (t && t.id) src[t.id] = t; });
      x.tasks.forEach(function (t) {
        var m = cleanLevels((src[t.id] || {}).m);
        if (t.code) { if (!has(t.H)) { t.H = 1; t.Q = 1; t.T = 1; } }
        else t.m = KPI_calc(m) ? m : (KPI_calc(t.m) ? t.m : t.s); // không chấm lại thì lấy theo mức đã có
        t.locked = true;                                      // đã chấm: cán bộ không sửa được nữa
        t.mBy = str(me.id); t.mDate = at.date; t.mTime = at.time;
      });
      writeTasks(x.ev.id, x.owner.id, x.period, x.tasks);
      patch.mgrTotal = sumPoints(x.tasks, 'm');
      patch.finalTotal = patch.mgrTotal;
      patch.rating = ratingOf(patch.finalTotal);
      patch.status = 'da_chot'; patch.reviewerId = me.id; patch.reviewedAt = nowIso();
      store.update('Evaluations', x.ev.id, patch);
      log(x.ev.id, me, 'Người phụ trách đánh giá', 'Điểm công nhận: ' + patch.finalTotal + (patch.rating ? ' – ' + patch.rating : ''));
    }
    return A.getEvaluation(me, { periodId: x.period.id, userId: x.owner.id });
  };

  /** Người phụ trách chấm theo từng công việc.
   * d: { periodId, userId, mode: 'score' | 'note', tasks: [{ id, m, note }  hoặc  { isNew, name, product, qty, month, m, note }] }
   *  - 'score': chấm các việc được gửi lên (kèm nhận xét nếu có) và khoá chúng; việc isNew là việc người phụ trách thêm cho cấp dưới.
   *  - 'note' : chỉ ghi nhận xét và mở khoá các việc đó để cán bộ điều chỉnh. */
  A.score = function (me, d) {
    var period = needPeriod(d.periodId);
    var owner = find('Users', d.userId) || err('Không tìm thấy cán bộ.');
    var ev = evalOf(period.id, owner.id);
    if (!perms(me, ev, owner, period).canScore) {
      err(phaseOf(period) === 'khoa' ? 'Kỳ đánh giá đã khoá.' : 'Chỉ người phụ trách trực tiếp hoặc quản lý vượt cấp mới chấm điểm được cho cán bộ này.');
    }
    var tasks = ev ? loadTasks(ev.id) : [], byId = {}, at = stamp(), unlock = d.mode === 'note', assign = d.mode === 'assign', n = 0, added = 0, catMap = catalogMap();
    var lim = perms(me, ev, owner, period).limited;
    tasks.forEach(function (t) { byId[t.id] = t; });
    (Array.isArray(d.tasks) ? d.tasks : []).slice(0, 400).forEach(function (x) {
      x = x || {};
      var t = byId[str(x.id)], note = cut(x.note, 1000);
      if (t && lim && str(t.by) !== str(me.id)) err('Anh/chị chỉ xác nhận được công việc do chính mình giao; các việc khác do người phụ trách trực tiếp của cán bộ đánh giá.');
      if (!t) {
        if (!x.isNew || unlock) return;
        t = cleanTask({ code: x.code, name: x.name, product: x.product, qty: x.qty, month: x.month, deadline: x.deadline, workDate: x.workDate, actual: x.actual }, period, catMap);
        if (!t.name) err('Công việc thêm cho cấp dưới chưa ghi tên.');
        t.by = str(me.id);
        if (assign) t.x = { acc: 'cho', at: nowIso() }; // giao việc: chờ cán bộ xác nhận
        if (str(x.src)) { // giao nối tiếp: lấy từ một việc người giao đang được giao
          var myEv = evalOf(period.id, me.id), srcT = myEv ? loadTasks(myEv.id).filter(function (y) { return y.id === str(x.src); })[0] : null;
          if (!srcT) err('Không tìm thấy nhiệm vụ nguồn trong phiếu của anh/chị ở kỳ này.');
          t.x = t.x || {}; t.x.src = { u: str(me.id), t: srcT.id, n: cut(srcT.name, 200) };
        }
        tasks.push(t); added++;
        if (assign) { n++; return; } // chỉ giao việc: chưa xác nhận kết quả
      } else if (assign) return;
      var label = '“' + t.name.slice(0, 50) + (t.name.length > 50 ? '…' : '') + '”';
      if (unlock) {
        if (!note) err('Hãy ghi nhận xét cho công việc ' + label + ' để cán bộ biết cần điều chỉnh gì.');
        t.note = note; delete t.locked;
      } else {
        if (t.code) { // việc trong danh mục: xác nhận bằng hệ số H (khối lượng), Q (chất lượng), T (tiến độ)
          var H = coef('H', x.h), Q = coef('Q', x.q), T = coef('T', x.t);
          if (Q === 0) H = 0; // sản phẩm không sử dụng được thì không ghi nhận khối lượng
          if ((H < 1 || Q < 1 || T < 1) && !note) err('Công việc ' + label + ' bị giảm điểm: hãy ghi rõ lý do ở ô nhận xét để cán bộ được biết.');
          var lm = cleanLevels(x.m);
          if (lm.some(function (v) { return v; }) && !KPI_calc(lm)) err('Công việc ' + label + ': muốn điều chỉnh theo A–E thì chọn đủ 5 mức ở khối lãnh đạo, không thì để trống cả 5.');
          if (KPI_calc(lm)) t.m = lm; else delete t.m;
          t.H = H; t.Q = Q; t.T = T; t.note = note; t.locked = true; t.mBy = str(me.id); t.mDate = at.date; t.mTime = at.time;
          confirmTask(t, x); // tiến độ xác nhận, ngày hoàn thành, điểm thưởng, vượt tiến độ, vượt chất lượng
        } else {
          var m = cleanLevels(x.m);
          if (!KPI_calc(m)) err('Công việc ' + label + ' chưa chọn đủ 5 mức A, B, C, D, E.');
          t.m = m; t.note = note; t.locked = true; t.mBy = str(me.id); t.mDate = at.date; t.mTime = at.time;
          confirmTask(t, x);
        }
      }
      n++;
    });
    if (!n) err('Chưa chọn công việc nào.');
    var cur = ev ? str(ev.status) : 'nhap', done = !assign && allLocked(tasks);
    var status = done ? 'da_chot' : assign ? (cur === 'da_chot' ? 'cho_duyet' : cur) : unlock ? (cur === 'cho_duyet' || cur === 'da_chot' ? 'yeu_cau_sua' : cur) : (cur === 'da_chot' ? 'cho_duyet' : cur);
    var patch = {
      status: status, taskCount: tasks.length, selfTotal: sumPoints(tasks, 's'), updatedAt: nowIso(),
      mgrTotal: tasks.some(function (t) { return t.locked; }) ? sumLocked(tasks) : '',
      finalTotal: done ? sumLocked(tasks) : '', rating: done ? ratingOf(sumLocked(tasks)) : '', fbCount: fbCount(tasks),
      gTotal: tasks.some(function (t) { return t.locked; }) ? gLocked(tasks) : '', hours: hoursOf(tasks)
    };
    if (done) { patch.reviewerId = me.id; patch.reviewedAt = nowIso(); }
    var id;
    if (ev) { id = ev.id; store.update('Evaluations', id, patch); }
    else { id = env.uuid(); patch.id = id; patch.periodId = period.id; patch.userId = owner.id; store.insert('Evaluations', headerRow(patch)); }
    writeTasks(id, owner.id, period, tasks);
    log(id, me, assign ? 'Giao ' + n + ' công việc' : unlock ? 'Nhận xét, cho sửa lại ' + n + ' công việc' : 'Chấm điểm ' + n + ' công việc' + (added ? ' (thêm mới ' + added + ')' : ''),
      done ? 'Đã chấm đủ, điểm công nhận: ' + patch.finalTotal : '');
    return A.getEvaluation(me, { periodId: period.id, userId: owner.id });
  };

  A.reopen = function (me, d) {
    var x = loadEval(me, d.evalId);
    if (!x.p.canReopen) err('Không thể mở lại phiếu này.');
    store.update('Evaluations', x.ev.id, { status: 'cho_duyet', finalTotal: '', rating: '', updatedAt: nowIso() });
    log(x.ev.id, me, 'Mở lại phiếu để đánh giá lại', d.note);
    return A.getEvaluation(me, { periodId: x.period.id, userId: x.owner.id });
  };

  A.upload = function (me, d) {
    if (!env.uploadFile) err('Máy chủ chưa bật chức năng tải tệp. Vui lòng dán đường dẫn minh chứng.');
    var data = str(d.data);
    if (!data || data.length > 7 * 1024 * 1024) err('Tệp quá lớn (tối đa 5 MB).');
    return env.uploadFile(cut(me.id, 50) + '_' + cut(d.name, 150), cut(d.mime, 100), data);
  };

  /* ---------- Cán bộ phản hồi không tán thành kết quả chấm của một công việc ---------- */
  A.feedback = function (me, d) {
    var period = needPeriod(d.periodId);
    if (phaseOf(period) === 'khoa') err('Kỳ đánh giá đã khoá.');
    var ev = evalOf(period.id, me.id) || err('Anh/chị chưa có phiếu ở kỳ này.');
    var tasks = loadTasks(ev.id), t = tasks.filter(function (x) { return x.id === str(d.taskId); })[0] || err('Không tìm thấy công việc.');
    if (!t.locked || str(t.mBy) === str(me.id)) err('Chỉ phản hồi được công việc đã được người phụ trách chấm.');
    var text = cut(d.text, 1000);
    if (!text) err('Chưa ghi nội dung phản hồi.');
    t.fb = text; t.fbAt = nowIso(); delete t.fbDone;
    writeTasks(ev.id, me.id, period, tasks);
    store.update('Evaluations', ev.id, { fbCount: fbCount(tasks), updatedAt: nowIso() });
    log(ev.id, me, 'Phản hồi không tán thành kết quả chấm', '“' + t.name.slice(0, 80) + '”: ' + text);
    return A.getEvaluation(me, { periodId: period.id });
  };

  /* ---------- Minh chứng trên Google Drive ----------
   * Tệp nằm ở KPIQTRI / <CCCD> / <tên kỳ> / <mã minh chứng>_<tên tệp>. Tệp không chia sẻ công khai: người được xem phiếu tải qua máy chủ. */
  function evidenceOf(userId, periodId) {
    return store.all('Evidence').filter(function (x) { return str(x.userId) === str(userId) && str(x.periodId) === str(periodId); });
  }
  function evidenceOut(x) { return { id: str(x.id), name: str(x.name), size: num(x.size) }; }
  function dropEvidence(x) {
    var shared = store.all('Evidence').some(function (y) { return str(y.id) !== str(x.id) && str(y.fileId) === str(x.fileId); }); // tệp còn được việc khác dùng (cấp trên lấy làm minh chứng)
    try { if (!shared && env.evidence && str(x.fileId)) env.evidence.remove(str(x.fileId)); } catch (e) { /* tệp đã bị xoá tay trên Drive: vẫn bỏ dòng */ }
    store.remove('Evidence', str(x.id));
  }
  /** Kiểm tra người gọi được thêm, bớt minh chứng cho một công việc trong phiếu của chính mình. */
  function evidenceGate(me, period, taskId) {
    var ev = evalOf(period.id, me.id), p = perms(me, ev, me, period);
    if (!p.canEdit) err('Phiếu đang không cho chỉnh sửa nên không thay đổi minh chứng được.');
    var t = ev ? loadTasks(ev.id).filter(function (x) { return x.id === taskId; })[0] : null;
    if (t && t.locked && !p.selfScore) err('Công việc đã được chấm, không thay đổi minh chứng được.');
  }
  A.evidenceAdd = function (me, d) {
    if (!env.evidence) err('Máy chủ chưa bật lưu minh chứng trên Google Drive.');
    var period = needPeriod(d.periodId), taskId = cut(d.taskId, 40);
    if (!taskId) err('Thiếu mã công việc.');
    evidenceGate(me, period, taskId);
    var mine = evidenceOf(me.id, period.id).filter(function (x) { return str(x.taskId) === taskId; });
    if (mine.length >= KPI_MAX_EVIDENCE) err('Mỗi công việc tối đa ' + KPI_MAX_EVIDENCE + ' minh chứng.');
    var data = str(d.data);
    if (!data) err('Tệp trống.');
    if (data.length > 14 * 1024 * 1024) err('Tệp quá lớn (tối đa 10 MB).');
    var name = cut(d.name, 150).replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '_') || 'minh-chung';
    var mime = cut(d.mime, 100) || 'application/octet-stream';
    var code = codeMaker('Evidence', 'MC', 6)(), fileName = code + '_' + name;
    var saved = env.evidence.save(str(me.id), str(period.name), fileName, mime, data);
    store.insert('Evidence', {
      id: code, userId: str(me.id), periodId: str(period.id), period: str(period.name), taskId: taskId, name: name, fileName: fileName,
      fileId: str(saved.fileId), mime: mime, size: num(saved.size), createdAt: nowIso()
    });
    return { items: evidenceOf(me.id, period.id).filter(function (x) { return str(x.taskId) === taskId; }).map(evidenceOut) };
  };
  A.evidenceRemove = function (me, d) {
    var x = find('Evidence', d.id) || err('Không tìm thấy minh chứng.');
    if (str(x.userId) !== str(me.id)) err('Chỉ người tải lên mới xoá được minh chứng.');
    var period = needPeriod(x.periodId), taskId = str(x.taskId);
    evidenceGate(me, period, taskId);
    dropEvidence(x);
    return { items: evidenceOf(me.id, period.id).filter(function (y) { return str(y.taskId) === taskId; }).map(evidenceOut) };
  };
  /** Tải nội dung một minh chứng. Chỉ chính chủ, những người phụ trách phía trên và quản trị xem được. */
  A.evidenceGet = function (me, d) {
    var x = find('Evidence', d.id) || err('Không tìm thấy minh chứng.');
    var owner = find('Users', x.userId) || err('Không tìm thấy cán bộ của minh chứng.');
    if (!canView(me, owner)) err('Anh/chị không có quyền xem minh chứng này.');
    if (!env.evidence) err('Máy chủ chưa bật lưu minh chứng trên Google Drive.');
    var f = env.evidence.read(str(x.fileId));
    return { name: str(x.name), mime: str(x.mime) || f.mime, data: f.data };
  };

  /* ---------- Giao – nhận nhiệm vụ: xác nhận, phản hồi, giao lại, gia hạn, lấy minh chứng của cấp dưới ---------- */
  function ownTask(me, d) { // việc trong phiếu của chính người gọi
    var period = needPeriod(d.periodId);
    if (phaseOf(period) === 'khoa') err('Kỳ đánh giá đã khoá.');
    var ev = evalOf(period.id, me.id) || err('Anh/chị chưa có phiếu ở kỳ này.');
    var tasks = loadTasks(ev.id), t = tasks.filter(function (x) { return x.id === str(d.taskId); })[0] || err('Không tìm thấy công việc.');
    return { period: period, ev: ev, tasks: tasks, t: t, owner: me };
  }
  function bossTask(me, d) { // việc trong phiếu của người mình phụ trách hoặc quản lý vượt cấp
    var period = needPeriod(d.periodId);
    if (phaseOf(period) === 'khoa') err('Kỳ đánh giá đã khoá.');
    var owner = find('Users', d.userId) || err('Không tìm thấy cán bộ.');
    var admin = on(me.isAdmin) && str(me.id) !== str(owner.id), boss = isBoss(me, owner); // quản trị được gia hạn, giao lại, rút việc đã giao thay người giao
    if (!boss && !admin && !canAssign(me, owner)) err('Chỉ cấp trên của cán bộ hoặc quản trị mới thực hiện được.');
    var ev = evalOf(period.id, owner.id) || err('Cán bộ chưa có phiếu ở kỳ này.');
    var tasks = loadTasks(ev.id), t = tasks.filter(function (x) { return x.id === str(d.taskId); })[0] || err('Không tìm thấy công việc.');
    if (!boss && admin && !str(t.by)) err('Quản trị chỉ thao tác được với công việc do cấp trên giao, không phải việc cán bộ tự kê.');
    if (!boss && !admin && str(t.by) !== str(me.id)) err('Anh/chị chỉ thao tác được với công việc do chính mình giao.');
    return { period: period, ev: ev, tasks: tasks, t: t, owner: owner, admin: admin };
  }
  function saveTaskSet(c, me, action, note) {
    writeTasks(c.ev.id, c.owner.id, c.period, c.tasks);
    store.update('Evaluations', c.ev.id, { taskCount: c.tasks.length, selfTotal: sumPoints(c.tasks, 's'), hours: hoursOf(c.tasks), updatedAt: nowIso() });
    log(c.ev.id, me, action, note);
    return A.getEvaluation(me, { periodId: c.period.id, userId: c.owner.id });
  }
  /** Cán bộ xác nhận việc được giao, hoặc phản hồi "chưa hợp lý" (mỗi việc chỉ phản hồi một lần). */
  A.taskAccept = function (me, d) {
    var c = ownTask(me, d), t = c.t, x = t.x || {};
    if (x.acc !== 'cho') err('Công việc này không ở trạng thái chờ xác nhận.');
    if (on(d.ok)) { x.acc = 'ok'; x.okAt = nowIso(); t.x = x; return saveTaskSet(c, me, 'Xác nhận nhiệm vụ được giao', '“' + t.name.slice(0, 80) + '”'); }
    if (x.fbUsed) err('Mỗi nhiệm vụ chỉ được phản hồi một lần.');
    var text = cut(d.note, 1000);
    if (!text) err('Hãy ghi lý do phản hồi để người giao việc biết.');
    x.acc = 'fb'; x.fbNote = text; x.fbAt = nowIso(); x.fbUsed = 1; t.x = x;
    return saveTaskSet(c, me, 'Phản hồi nhiệm vụ được giao chưa hợp lý', '“' + t.name.slice(0, 80) + '”: ' + text);
  };
  /** Người giao xem phản hồi rồi giao lại (việc tự chuyển sang đã xác nhận) hoặc rút việc đã giao. */
  A.taskReassign = function (me, d) {
    var c = bossTask(me, d), t = c.t, x = t.x || {};
    if (on(d.drop)) {
      if (t.locked) err('Công việc đã được đánh giá, không rút được.');
      if (str(t.by) !== str(me.id) && !(c.admin && str(t.by))) err('Chỉ rút được công việc do chính anh/chị giao.');
      c.tasks.splice(c.tasks.indexOf(t), 1);
      evidenceOf(c.owner.id, c.period.id).filter(function (e) { return str(e.taskId) === t.id; }).forEach(dropEvidence);
      return saveTaskSet(c, me, 'Rút nhiệm vụ đã giao', '“' + t.name.slice(0, 80) + '”');
    }
    if (x.acc !== 'fb') err('Công việc này không có phản hồi đang chờ xử lý.');
    x.acc = 'ok'; x.reAt = nowIso(); t.x = x;
    return saveTaskSet(c, me, 'Giao lại nhiệm vụ sau phản hồi', '“' + t.name.slice(0, 80) + '”');
  };
  /** Người phụ trách gia hạn hoàn thành cho một việc chưa được đánh giá. */
  A.taskExtend = function (me, d) {
    var c = bossTask(me, d), t = c.t, to = str(d.deadline);
    if (t.locked) err('Công việc đã được đánh giá, không gia hạn được.');
    if (!DATE.test(to)) err('Chưa chọn hạn hoàn thành mới.');
    if (t.deadline && to <= t.deadline) err('Hạn mới phải sau hạn hiện tại (' + t.deadline.split('-').reverse().join('/') + ').');
    var x = t.x || {};
    x.ext = (Array.isArray(x.ext) ? x.ext : []).concat([{ from: t.deadline || '', to: to, by: str(me.id), at: nowIso(), why: cut(d.why, 300) }]).slice(-10);
    t.x = x; t.deadline = to;
    return saveTaskSet(c, me, 'Gia hạn nhiệm vụ', '“' + t.name.slice(0, 80) + '” đến ' + to.split('-').reverse().join('/') + (cut(d.why, 300) ? ': ' + cut(d.why, 300) : ''));
  };
  /** Trang Giao việc: những người được giao việc, các việc mình đã giao và các việc mình được giao trong kỳ, kèm tiến độ để cảnh báo. */
  A.assignBoard = function (me, d) {
    var period = needPeriod(d.periodId), names = {}, evs = {}, lock = {}, tasks = [], admin = on(me.isAdmin), unitOf = {};
    var users = store.all('Users').filter(function (u) { return on(u.active); });
    users.forEach(function (u) { names[str(u.id)] = str(u.fullName); unitOf[str(u.id)] = str(u.unitId); });
    store.all('Evaluations').forEach(function (e) { if (str(e.periodId) === str(period.id)) evs[str(e.id)] = e; });
    store.all('Reviews').forEach(function (r) { if (evs[str(r.evalId)]) lock[str(r.id)] = r; });
    store.all('Tasks').forEach(function (r) {
      var e = evs[str(r.evalId)];
      if (!e || !str(r.by)) return;
      var out = str(r.by) === str(me.id), inn = str(e.userId) === str(me.id);
      if (!out && !inn && !admin) return; // quản trị xem toàn bộ việc đã giao trong cơ quan để báo cáo, nhắc tiến độ
      var x = {}, L = lock[str(r.id)] || {}, locked = str(L.lock) === 'Khoá';
      try { x = JSON.parse(str(r.meta) || '{}') || {}; } catch (err2) { x = {}; }
      tasks.push({ dir: out || (admin && !inn) ? 'out' : 'in', userId: str(e.userId), by: str(r.by), taskId: str(r.id), name: str(r.name), code: str(r.code), qty: num(r.qty) || 1, unit: str(r.unit),
        deadline: str(r.deadline), doneDate: locked && str(L.doneDate) ? str(L.doneDate) : str(r.doneDate), progress: locked && str(L.progress) !== '' ? num(L.progress) : (str(r.progress) === '' ? null : num(r.progress)),
        acc: str(x.acc), ext: Array.isArray(x.ext) ? x.ext.length : 0, src: !!x.src, locked: locked, h: locked ? str(L.h) : '', q: locked ? str(L.q) : '', t: locked ? str(L.t) : '',
        score: locked ? num(L.score) : null, g: num(r.g), evStatus: str(e.status) });
    });
    return { today: nowVn().slice(0, 10), names: names, tasks: tasks, admin: admin, unitOf: admin ? unitOf : {}, period: str(period.name),
      people: users.filter(function (u) { return on(u.selfEval) && canAssign(me, u); }).map(function (u) { return pub(u); }) };
  };
  /** Giao cùng một việc cho nhiều người một lượt. Mỗi người một dòng kết quả; người lỗi không làm hỏng người khác. */
  A.assignMany = function (me, d) {
    var ids = (Array.isArray(d.userIds) ? d.userIds : []).map(str).filter(Boolean).slice(0, 60), k = d.task || {}, results = [];
    if (!ids.length) err('Chưa chọn người nhận việc.');
    if (!str(k.code) && !cut(k.name, 2000)) err('Chưa chọn mã sản phẩm hoặc ghi tên công việc.');
    ids.forEach(function (id) {
      try {
        A.score(me, { periodId: d.periodId, userId: id, mode: 'assign', tasks: [{ isNew: true, code: k.code, name: k.name, product: k.product, qty: k.qty, month: k.month, deadline: k.deadline, src: k.src }] });
        results.push({ userId: id, ok: true });
      } catch (e) { if (!e.kpi) throw e; results.push({ userId: id, ok: false, error: e.message }); }
    });
    return { results: results };
  };

  /** Việc đã được đánh giá của những người mình phụ trách (kỳ này) có minh chứng, để lấy làm minh chứng cho việc của mình. */
  A.evidenceSources = function (me, d) {
    var period = needPeriod(d.periodId), out = [], taskId = str(d.taskId);
    store.all('Users').forEach(function (u) {
      if (!on(u.active) || !isBoss(me, u)) return;
      var ev = evalOf(period.id, u.id);
      if (!ev) return;
      var files = {};
      evidenceOf(u.id, period.id).forEach(function (e) { (files[str(e.taskId)] || (files[str(e.taskId)] = [])).push(evidenceOut(e)); });
      loadTasks(ev.id).forEach(function (t) {
        if (!t.locked || !files[t.id]) return;
        out.push({ userId: str(u.id), fullName: str(u.fullName), taskId: t.id, name: t.name, files: files[t.id], linked: !!(t.x && t.x.src && t.x.src.t === taskId) });
      });
    });
    out.sort(function (a, b) { return (b.linked ? 1 : 0) - (a.linked ? 1 : 0) || a.fullName.localeCompare(b.fullName, 'vi'); });
    return { items: out };
  };
  /** Lấy tệp kết quả của cấp dưới làm minh chứng cho việc của mình: dùng chung tệp trên Drive, không sao chép. */
  A.evidenceBorrow = function (me, d) {
    var period = needPeriod(d.periodId), taskId = cut(d.taskId, 40);
    if (!taskId) err('Thiếu mã công việc.');
    evidenceGate(me, period, taskId);
    var from = find('Users', d.fromUserId) || err('Không tìm thấy cán bộ cấp dưới.');
    if (!isBoss(me, from)) err('Chỉ lấy được tệp kết quả của người do anh/chị phụ trách.');
    var fev = evalOf(period.id, from.id), ft = fev ? loadTasks(fev.id).filter(function (x) { return x.id === str(d.fromTaskId); })[0] : null;
    if (!ft || !ft.locked) err('Chỉ lấy được tệp của công việc đã được đánh giá.');
    var mine = evidenceOf(me.id, period.id).filter(function (x) { return str(x.taskId) === taskId; });
    var src = evidenceOf(from.id, period.id).filter(function (x) { return str(x.taskId) === ft.id && !mine.some(function (m) { return str(m.fileId) === str(x.fileId); }); });
    if (!src.length) err('Công việc đó không có tệp minh chứng nào chưa lấy.');
    if (mine.length + src.length > KPI_MAX_EVIDENCE) err('Mỗi công việc tối đa ' + KPI_MAX_EVIDENCE + ' minh chứng; hiện có ' + mine.length + ', định lấy thêm ' + src.length + '.');
    var mk = codeMaker('Evidence', 'MC', 6);
    src.forEach(function (x) {
      store.insert('Evidence', { id: mk(), userId: str(me.id), periodId: str(period.id), period: str(period.name), taskId: taskId,
        name: cut('[' + str(from.fullName) + '] ' + str(x.name), 150), fileName: str(x.fileName), fileId: str(x.fileId), mime: str(x.mime), size: num(x.size), createdAt: nowIso() });
    });
    return { items: evidenceOf(me.id, period.id).filter(function (x) { return str(x.taskId) === taskId; }).map(evidenceOut) };
  };

  /* ---------- ĐÁNH GIÁ KPI PP2: kê khai theo ngày, chấm H – Q – T, tính a, b, c, KPI như bảng tính "Hệ thống kê khai và đánh giá KPI" ----------
   * Lưu chung trang PhieuDanhGia (phần cán bộ kê) và DanhGia (phần lãnh đạo chấm) với cột "Phương pháp" = 2.
   * Mã phiếu của PP2 có dạng PP2|<mã kỳ>|<CCCD>, không trùng mã phiếu nào của PP1 và không có dòng ở TongHopPhieu,
   * nên mọi trang của PP1 (tự đánh giá, đánh giá cấp dưới, tổng quan, KPI tổng hợp, xếp loại, giao việc) không đọc thấy các dòng này. */
  function pp2Key(period, userId) { return 'PP2|' + str(period.id) + '|' + str(userId); }
  function pp2Row(r, v) {
    var o = { id: str(r.id), name: str(r.name), workDate: str(r.workDate), type: str(r.product), purpose: str(r.purpose), spName: str(r.spName), code: str(r.code), timeStd: str(r.timeStd),
      actual: str(r.actual) === '' ? '' : num(r.actual), qty: str(r.qty) === '' ? '' : num(r.qty), unit: str(r.unit), std: num(r.std), g: num(r.g), link: str(r.link) };
    if (str(r.by)) o.asg = str(r.by);            // việc do lãnh đạo giao
    if (str(r.deadline)) o.deadline = str(r.deadline);
    if (v && str(v.h) !== '') {
      o.H = num(v.h); o.Q = num(v.q); o.T = num(v.t); o.by = str(v.reviewerId); o.at = (str(v.date) + ' ' + str(v.time)).trim(); o.locked = str(v.lock) === 'Khoá';
      o.p = r4(o.g * o.H * (1 + o.Q + o.T) / 3);
    }
    if (v && str(v.note)) o.note = str(v.note);
    return o;
  }
  function pp2Load(period, userId) {
    var key = pp2Key(period, userId), rv = {};
    store.group('Reviews', 'evalId', key).forEach(function (r) { rv[str(r.id)] = r; });
    return store.group('Tasks', 'evalId', key).slice().sort(function (a, b) { return num(a.order) - num(b.order); }).map(function (r) { return pp2Row(r, rv[str(r.id)]); });
  }
  /** Các trường cán bộ còn thiếu của một dòng (đúng danh sách bắt buộc của bảng tính: mã sản phẩm không bắt buộc, điểm chuẩn phải lớn hơn 0). */
  function pp2Missing(o) {
    var miss = [];
    if (o.src === 'pp1') { // việc kê ở phiếu PP1: chỉ cần có tên và điểm chuẩn
      if (!o.name) miss.push('Nội dung công việc');
      if (!(num(o.g) > 0)) miss.push(o.code ? 'Điểm chuẩn' : 'Điểm chuẩn (chưa chọn đủ 5 mức A–E ở phiếu PP1)');
      return miss;
    }
    if (!o.name) miss.push('Nội dung công việc');
    if (!o.workDate) miss.push('Ngày thực hiện');
    if (!o.type) miss.push('Loại sản phẩm');
    if (!o.purpose) miss.push('Mục đích');
    if (!o.spName) miss.push('Tên sản phẩm');
    if (!(num(o.actual) > 0)) miss.push('Giờ thực tế');
    if (!(num(o.qty) > 0)) miss.push('Số lượng');
    if (o.spName && !(num(o.g) > 0) && num(o.qty) > 0) miss.push('Điểm chuẩn');
    return miss;
  }
  /** Thống kê của một phiếu PP2: giờ chuẩn quy đổi, giờ thực tế đã kê, quỹ giờ của kỳ, số việc được giao. */
  function pp2Stats(period, rows, cat) {
    var std = 0, act = 0, asg = 0, pp1 = 0;
    rows.forEach(function (o) {
      if (o.src === 'pp1') { std += num(o.hrs); pp1++; return; }
      var c = o.code ? cat[str(o.code)] : null;
      o.hrs = c && num(o.qty) > 0 ? r2(num(c.hours) * num(o.qty)) : 0;
      std += o.hrs; act += num(o.actual); if (o.asg) asg++;
    });
    return { stdHours: r2(std), actHours: r2(act), workHours: workHours(period), assigned: asg, fromPp1: pp1 };
  }
  function pp2Scored(o) { return o.src === 'pp1' ? !!o.locked && has(o.p) : has(o.H) && has(o.Q) && has(o.T) && o.locked; }
  /** Các việc cán bộ đã kê ở phiếu PP1 của cùng kỳ, đưa vào phiếu PP2 dưới dạng dòng chỉ xem (không sao chép, không ghi lại):
   *  việc theo mã danh mục giữ H, Q, T lãnh đạo đã xác nhận; việc chấm theo A–E lấy điểm tự kê làm điểm chuẩn và điểm lãnh đạo chấm làm điểm thực đạt. */
  function pp1AsRows(period, owner, cat) {
    var ev = evalOf(period.id, owner.id);
    if (!ev) return [];
    return loadTasks(ev.id).map(function (t) {
      var sc = tcalc(t, 's'), m = t.locked ? tcalc(t, 'm') : null, q = num(t.qty) || 1, c = t.code ? cat[str(t.code)] : null;
      var o = { id: 'pp1:' + t.id, src: 'pp1', name: t.name, workDate: t.mDone || t.doneDate || '', type: t.product, purpose: c ? str(c.purpose) : '', spName: c ? str(c.name) : '', code: t.code || '',
        timeStd: c ? str(c.time) : '', actual: '', qty: q, unit: t.unit || '', std: t.code ? (m ? m.base : num(t.std)) : (sc ? sc.point : 0), link: t.link || '', ae: !t.code, n: m ? m.n : sc ? sc.n : '' };
      o.g = r4(o.std * q);
      o.hrs = r2(q * (t.code ? num(t.hours) : sc ? sc.point * 4 : 0)); // giờ chuẩn quy đổi, cùng cách tính của phiếu PP1
      if (m) {
        o.locked = true; o.p = r4(q * m.point * (1 + num(t.mBonus) / 100)); o.by = str(t.mBy); o.at = (str(t.mDate) + ' ' + str(t.mTime)).trim();
        if (t.code) { o.H = num(t.H); o.Q = num(t.Q); o.T = num(t.T); }
      }
      if (t.note) o.note = t.note;
      return o;
    });
  }
  /** a, b, c, KPI của một người: chỉ tính khi không còn dòng kê khai thiếu hoặc chưa chấm (như ô R3:R7 của bảng tính). */
  function pp2Sum(rows) {
    var G = 0, GH = 0, GHQ = 0, GHT = 0, P = 0, done = 0, lack = 0, wait = 0, issues = [];
    rows.forEach(function (o, i) {
      var miss = pp2Missing(o);
      if (miss.length) { lack++; issues.push('Dòng ' + (i + 1) + ': thiếu ' + miss.join(', ')); return; }
      if (!pp2Scored(o)) { wait++; issues.push('Dòng ' + (i + 1) + ': chưa chấm H, Q, T'); return; }
      if (o.src === 'pp1' && o.ae) { G += o.g; GH += o.p; GHQ += o.p; GHT += o.p; P += o.p; done++; return; } // việc PP1 chấm theo A–E: không có H, Q, T riêng
      G += o.g; GH += o.g * o.H; GHQ += o.g * o.H * o.Q; GHT += o.g * o.H * o.T; P += o.src === 'pp1' ? o.p : o.g * o.H * (1 + o.Q + o.T) / 3; done++;
    });
    var ready = !lack && !wait && G > 0;
    var a = ready ? GH / G : null, b = ready ? GHQ / G : null, c = ready ? GHT / G : null;
    return { rows: rows.length, done: done, lack: lack, wait: wait, issues: issues, G: r4(G), P: r4(P), ready: ready,
      a: a, b: b, c: c, kpi: ready ? (a + b + c) / 3 : null,
      status: lack || wait ? 'Chưa tính: ' + lack + ' dòng kê khai thiếu; ' + wait + ' dòng chưa chấm.' : G <= 0 ? 'Chưa có nhiệm vụ đã chấm đủ.' : 'Đã chấm đủ ' + done + ' nhiệm vụ' };
  }
  function pp2Write(period, owner, rows) {
    var key = pp2Key(period, owner.id), base = { userId: str(owner.id), period: str(period.name), evalId: key, pp: '2' }, at = nowIso();
    store.replaceGroup('Tasks', 'evalId', key, rows.map(function (o, i) {
      var r = { id: o.id, order: i + 1, name: o.name, product: o.type, qty: has(o.qty) ? o.qty : '', link: o.link || '', code: o.code, unit: o.unit, std: o.std || '', g: o.g || '',
        workDate: o.workDate, purpose: o.purpose, spName: o.spName, timeStd: o.timeStd, actual: has(o.actual) ? o.actual : '', updatedAt: at, by: o.asg || '', deadline: o.deadline || '' };
      Object.keys(base).forEach(function (k) { r[k] = base[k]; });
      return r;
    }));
    store.replaceGroup('Reviews', 'evalId', key, rows.filter(function (o) { return has(o.H) || o.note; }).map(function (o, i) {
      var d = str(o.at).split(' '), r = { id: o.id, order: i + 1, name: o.name, product: o.type, qty: has(o.qty) ? o.qty : '', reviewerId: o.by || '', date: d[0] || '', time: d[1] || '',
        lock: o.locked ? 'Khoá' : '', note: o.note || '', h: has(o.H) ? o.H : '', q: has(o.H) ? o.Q : '', t: has(o.H) ? o.T : '', score: has(o.H) ? r4(o.g * o.H * (1 + o.Q + o.T) / 3) : '' };
      Object.keys(base).forEach(function (k) { r[k] = base[k]; });
      return r;
    }));
  }
  function pp2Clean(x, cat) {
    x = x || {};
    var c = str(x.code) ? cat[str(x.code)] : null, link = cut(x.link, 500), qty = num(x.qty), act = num(x.actual);
    var o = { id: cut(x.id, 40) || env.uuid(), name: cut(x.name, 2000).replace(/\s*\n\s*/g, ' '), workDate: DATE.test(str(x.workDate)) ? str(x.workDate) : '',
      type: c ? cut(c.type, 100) : cut(x.type, 100), purpose: c ? cut(c.purpose, 200) : cut(x.purpose, 200), spName: c ? cut(c.name, 500) : '', code: c ? str(c.id) : '',
      timeStd: c ? str(c.time) : '', unit: c ? str(c.unit) : '', std: c ? num(c.point) : 0,
      actual: act > 0 ? r2(Math.min(act, 10000)) : '', qty: qty > 0 ? r2(Math.min(qty, 100000)) : '', link: /^https?:\/\/\S+$/i.test(link) ? link : '' };
    o.g = c && o.qty ? r4(o.std * o.qty) : 0;
    return o;
  }
  function pp2Perms(me, owner, period) {
    var ph = phaseOf(period), self = str(me.id) === str(owner.id);
    return { canEdit: self && on(owner.selfEval) && ph === 'mo', canScore: !self && isBoss(me, owner) && ph !== 'khoa' };
  }
  function pp2Out(me, period, owner, rows) {
    var names = {}; store.all('Users').forEach(function (u) { names[str(u.id)] = str(u.fullName); });
    rows.forEach(function (o) { if (o.by) o.byName = names[o.by] || o.by; });
    // Phiếu PP2 gồm cả các việc đã kê ở phiếu PP1 của cùng kỳ (đều là công việc của cán bộ, chỉ khác cách đánh giá), xếp trước các dòng kê theo PP2.
    var cat0 = catalogMap(), all = pp1AsRows(period, owner, cat0).concat(rows);
    all.forEach(function (o) { if (o.by && !o.byName) o.byName = names[o.by] || o.by; });
    return { period: periodOut(period), owner: pub(owner), managerName: names[str(owner.managerId)] || '', perms: pp2Perms(me, owner, period), rows: all, sum: pp2Sum(all), stats: pp2Stats(period, all, cat0) };
  }
  A.pp2Get = function (me, d) {
    var period = needPeriod(d.periodId), owner = d.userId ? find('Users', d.userId) : me;
    if (!owner) err('Không tìm thấy cán bộ.');
    if (!canView(me, owner)) err('Anh/chị không có quyền xem phiếu này.');
    return pp2Out(me, period, owner, pp2Load(period, owner.id));
  };
  /** Cán bộ lưu kê khai: dòng lãnh đạo đã chấm thì giữ nguyên, các dòng khác lấy theo nội dung gửi lên. */
  A.pp2Save = function (me, d) {
    err('Trang đánh giá PP2 đã được nâng cấp để dùng chung phiếu với PP1. Anh/chị tải lại trang (bấm F5) rồi thao tác lại.');
    var period = needPeriod(d.periodId);
    if (!pp2Perms(me, me, period).canEdit) err(phaseOf(period) === 'mo' ? 'Tài khoản này không tự kê công việc.' : 'Kỳ đánh giá đã chốt nhập nên không lưu kê khai được.');
    var old = {}, cat = catalogMap(), seen = {}, rows = [];
    pp2Load(period, me.id).forEach(function (o) { old[o.id] = o; });
    (Array.isArray(d.rows) ? d.rows : []).slice(0, 300).forEach(function (x) {
      var id = cut((x || {}).id, 40), keep = old[id];
      if (id.indexOf('pp1:') === 0 || (x || {}).src === 'pp1') return; // việc của phiếu PP1 không lưu lại ở PP2
      if (keep && keep.locked) { if (!seen[id]) { seen[id] = 1; rows.push(keep); } return; }
      var o = pp2Clean(x, cat);
      if (!o.name && !o.workDate && !o.type && !o.code && !o.actual && !o.qty) return; // dòng trống
      if (seen[o.id]) o.id = env.uuid();
      seen[o.id] = 1;
      if (keep && keep.note) o.note = keep.note; // nhận xét khi lãnh đạo trả lại
      if (keep && keep.asg) { o.asg = keep.asg; if (keep.deadline) o.deadline = keep.deadline; } // việc lãnh đạo giao: giữ người giao và hạn
      rows.push(o);
    });
    Object.keys(old).forEach(function (id) { if ((old[id].locked || old[id].asg) && !seen[id]) rows.push(old[id]); }); // không xoá được dòng đã chấm, dòng lãnh đạo giao
    pp2Write(period, me, rows);
    return pp2Out(me, period, me, pp2Load(period, me.id));
  };
  /** Lãnh đạo trực tiếp chấm H, Q, T từng dòng; mode 'open' = bỏ chấm để cán bộ sửa lại. */
  A.pp2Score = function (me, d) {
    err('Trang đánh giá PP2 đã được nâng cấp để dùng chung phiếu với PP1. Anh/chị tải lại trang (bấm F5) rồi thao tác lại.');
    var period = needPeriod(d.periodId), owner = find('Users', d.userId) || err('Không tìm thấy cán bộ.');
    if (!pp2Perms(me, owner, period).canScore) err(phaseOf(period) === 'khoa' ? 'Kỳ đánh giá đã khoá.' : 'Chỉ người phụ trách trực tiếp hoặc quản lý vượt cấp mới chấm được cho cán bộ này.');
    var rows = pp2Load(period, owner.id), by = {}, at = stamp(), n = 0;
    rows.forEach(function (o) { by[o.id] = o; });
    (Array.isArray(d.items) ? d.items : []).slice(0, 300).forEach(function (x) {
      var o = by[str((x || {}).id)];
      if (!o) return;
      var label = '“' + o.name.slice(0, 50) + (o.name.length > 50 ? '…' : '') + '”', note = cut(x.note, 1000);
      if (d.mode === 'drop') { // rút việc mình đã giao, chưa chấm
        if (o.locked) err('Dòng ' + label + ' đã chấm, không rút được.');
        if (str(o.asg) !== str(me.id)) err('Chỉ rút được việc do chính anh/chị giao.');
        rows.splice(rows.indexOf(o), 1); n++; return;
      }
      if (d.mode === 'open') {
        if (!note) err('Hãy ghi nhận xét cho dòng ' + label + ' để cán bộ biết cần sửa gì.');
        delete o.H; delete o.Q; delete o.T; delete o.locked; delete o.p; o.note = note; o.by = str(me.id); o.at = at.date + ' ' + at.time; n++; return;
      }
      var miss = pp2Missing(o);
      if (miss.length) err('Dòng ' + label + ' còn thiếu ' + miss.join(', ') + ' nên chưa chấm được.');
      if (!has(x.h) || !has(x.q) || !has(x.t)) err('Dòng ' + label + ' chưa chọn đủ H, Q, T.');
      var H = coef('H', x.h), Q = coef('Q', x.q), T = coef('T', x.t);
      if (Q === 0) H = 0; // sản phẩm không sử dụng được thì không ghi nhận khối lượng
      if ((H < 1 || Q < 1 || T < 1) && !note) err('Dòng ' + label + ' bị giảm điểm: hãy ghi rõ lý do ở ô nhận xét để cán bộ được biết.');
      o.H = H; o.Q = Q; o.T = T; o.note = note; o.locked = true; o.by = str(me.id); o.at = at.date + ' ' + at.time; n++;
    });
    if (!n) err('Chưa chọn dòng nào.');
    pp2Write(period, owner, rows);
    return pp2Out(me, period, owner, pp2Load(period, owner.id));
  };
  /** Lãnh đạo giao việc vào phiếu PP2 của cấp dưới (như giao việc ở PP1): dòng mới mang tên người giao, cán bộ bổ sung ngày, giờ thực tế rồi lãnh đạo chấm. */
  A.pp2Assign = function (me, d) {
    err('Trang đánh giá PP2 đã được nâng cấp để dùng chung phiếu với PP1. Anh/chị tải lại trang (bấm F5) rồi thao tác lại.');
    var period = needPeriod(d.periodId), owner = find('Users', d.userId) || err('Không tìm thấy cán bộ.');
    if (!pp2Perms(me, owner, period).canScore) err(phaseOf(period) === 'khoa' ? 'Kỳ đánh giá đã khoá.' : 'Chỉ người phụ trách trực tiếp hoặc quản lý vượt cấp mới giao việc được cho cán bộ này.');
    var rows = pp2Load(period, owner.id), cat = catalogMap(), n = 0;
    (Array.isArray(d.items) ? d.items : []).slice(0, 100).forEach(function (x) {
      var o = pp2Clean(x, cat);
      o.id = env.uuid();
      if (!o.name && !o.code) return;
      if (!o.name) o.name = o.spName;
      o.asg = str(me.id);
      if (DATE.test(str((x || {}).deadline))) o.deadline = str(x.deadline);
      rows.push(o); n++;
    });
    if (!n) err('Chưa có việc mới nào để giao. Hãy thêm dòng, ghi nội dung hoặc chọn sản phẩm.');
    pp2Write(period, owner, rows);
    return pp2Out(me, period, owner, pp2Load(period, owner.id));
  };
  /** Danh sách người mình đánh giá theo PP2 (quản trị: toàn bộ người tự kê), kèm tình trạng và KPI. Đọc hai trang tính một lần. */
  A.pp2List = function (me, d) {
    var period = needPeriod(d.periodId), pre = 'PP2|' + str(period.id) + '|', tk = {}, rv = {}, admin = on(me.isAdmin), cat = catalogMap();
    store.all('Reviews').forEach(function (r) { if (str(r.evalId).indexOf(pre) === 0) rv[str(r.evalId) + '#' + str(r.id)] = r; });
    store.all('Tasks').forEach(function (r) { var e = str(r.evalId); if (e.indexOf(pre) === 0) (tk[e] || (tk[e] = [])).push(r); });
    var out = store.all('Users').filter(function (u) { return on(u.active) && on(u.selfEval) && str(u.id) !== str(me.id) && (admin || isBoss(me, u)); }).map(function (u) {
      var key = pre + str(u.id), rows = pp1AsRows(period, u, cat).concat((tk[key] || []).slice().sort(function (a, b) { return num(a.order) - num(b.order); }).map(function (r) { return pp2Row(r, rv[key + '#' + str(r.id)]); })), sm = pp2Sum(rows);
      var stt = pp2Stats(period, rows, cat);
      return { stdHours: stt.stdHours, actHours: stt.actHours, assigned: stt.assigned, user: pub(u), rows: sm.rows, done: sm.done, lack: sm.lack, wait: sm.wait, G: sm.G, P: sm.P, kpi: sm.kpi, a: sm.a, b: sm.b, c: sm.c, status: sm.status, canScore: isBoss(me, u) };
    });
    return { period: periodOut(period), rows: out, workHours: workHours(period) };
  };
  /** Chạy tay MỘT LẦN: đưa các dòng đã lưu riêng theo PP2 (mã phiếu PP2|kỳ|CCCD) về chung phiếu với PP1, rồi xoá các dòng riêng đó.
   *  Từ nay PP1 và PP2 dùng chung một phiếu, một bộ dòng ở PhieuDanhGia và DanhGia; hai trang chỉ khác cách trình bày và cách chấm. */
  function pp2Migrate() {
    var groups = {}, out = [], cat = catalogMap();
    store.all('Tasks').forEach(function (r) { var e = str(r.evalId); if (e.indexOf('PP2|') === 0) groups[e] = 1; });
    Object.keys(groups).forEach(function (key) {
      var p = key.split('|'), period = find('Periods', p[1]), owner = find('Users', p[2]);
      if (!period || !owner) { out.push('Bỏ qua ' + key + ' (không thấy kỳ hoặc người dùng)'); return; }
      var rows = pp2Load(period, owner.id), ev = evalOf(period.id, owner.id), tasks = ev ? loadTasks(ev.id) : [], add = 0;
      rows.forEach(function (o) {
        if (tasks.some(function (t) { return t.name === o.name && str(t.workDate) === str(o.workDate); })) return;
        var t = cleanTask({ code: o.code, name: o.name || '(chưa ghi tên)', product: o.type, qty: o.qty || 1, deadline: o.deadline, workDate: o.workDate, actual: o.actual, link: o.link }, period, cat);
        if (o.asg) t.by = o.asg;
        if (o.note) t.note = o.note;
        if (t.code && o.locked && has(o.H)) {
          var d = str(o.at).split(' ');
          t.H = o.H; t.Q = o.Q; t.T = o.T; t.locked = true; t.mBy = str(o.by); t.mDate = d[0] || ''; t.mTime = d[1] || '';
          confirmTask(t, { doneDate: o.workDate });
        }
        tasks.push(t); add++;
      });
      var cur = ev ? str(ev.status) : 'nhap', done = allLocked(tasks), locked = tasks.some(function (t) { return t.locked; });
      var patch = { status: done ? 'da_chot' : cur === 'da_chot' ? 'cho_duyet' : cur, taskCount: tasks.length, selfTotal: sumPoints(tasks, 's'), updatedAt: nowIso(),
        mgrTotal: locked ? sumLocked(tasks) : '', finalTotal: done ? sumLocked(tasks) : '', rating: done ? ratingOf(sumLocked(tasks)) : '', fbCount: fbCount(tasks),
        gTotal: locked ? gLocked(tasks) : '', hours: hoursOf(tasks) };
      var id;
      if (ev) { id = ev.id; store.update('Evaluations', id, patch); }
      else { id = env.uuid(); patch.id = id; patch.periodId = period.id; patch.userId = owner.id; store.insert('Evaluations', headerRow(patch)); }
      writeTasks(id, owner.id, period, tasks);
      store.replaceGroup('Tasks', 'evalId', key, []);
      store.replaceGroup('Reviews', 'evalId', key, []);
      out.push(str(owner.fullName) + ' – ' + str(period.name) + ': chuyển ' + add + '/' + rows.length + ' dòng về phiếu chung; phiếu có ' + tasks.length + ' việc, trạng thái ' + patch.status + ', G=' + patch.gTotal + ', P=' + patch.mgrTotal);
    });
    return out.length ? out : ['Không còn dòng PP2 lưu riêng nào.'];
  }
  /** Nạp dòng PP2 cho một người (chạy tay từ trình soạn Apps Script để chuyển số liệu từ bảng tính sang). Bỏ qua dòng đã có cùng nội dung và ngày. */
  function pp2Import(userId, periodId, items, reviewerId) {
    var period = needPeriod(periodId), owner = find('Users', userId) || err('Không tìm thấy người dùng ' + userId + '.');
    var rows = pp2Load(period, owner.id), cat = catalogMap(), at = stamp(), added = 0;
    (items || []).forEach(function (x) {
      var o = pp2Clean(x, cat);
      if (rows.some(function (r) { return r.name === o.name && r.workDate === o.workDate; })) return;
      if (has(x.h)) { o.H = coef('H', x.h); o.Q = coef('Q', x.q); o.T = coef('T', x.t); o.note = cut(x.note, 1000); o.locked = true; o.by = str(reviewerId || owner.managerId); o.at = at.date + ' ' + at.time; }
      rows.push(o); added++;
    });
    pp2Write(period, owner, rows);
    var sm = pp2Sum(pp2Load(period, owner.id));
    return str(owner.fullName) + ' – ' + str(period.name) + ': thêm ' + added + ' dòng; ' + sm.status + (sm.ready ? ' a=' + r4(sm.a) + ' b=' + r4(sm.b) + ' c=' + r4(sm.c) + ' KPI=' + r4(sm.kpi) : '');
  }

  /* ---------- Danh mục sản phẩm chuẩn (thí điểm KPI) ----------
   * Cán bộ chọn loại sản phẩm, chọn mã, nhập số lượng; điểm giao chuẩn = điểm chuẩn của mã × số lượng. Chỉ quản trị sửa danh mục. */
  function catOut(r) {
    return { id: str(r.id), order: num(r.order), type: str(r.type), purpose: str(r.purpose), name: str(r.name), example: str(r.example), time: str(r.time),
      level: str(r.level), point: num(r.point), unit: str(r.unit), hours: num(r.hours), active: str(r.active) === '' ? true : on(r.active) };
  }
  function catClean(x, order) {
    x = x || {};
    var id = cut(x.id, 30), point = num(x.point);
    if (!/^[^\s,;|]+$/.test(id)) err('Mã sản phẩm không được để trống hoặc chứa khoảng trắng (ví dụ: CV01).');
    if (!cut(x.name, 500)) err('Mã ' + id + ' chưa có tên sản phẩm.');
    if (!cut(x.type, 100)) err('Mã ' + id + ' chưa có loại sản phẩm.');
    if (!(point > 0)) err('Mã ' + id + ' chưa có điểm chuẩn (số lớn hơn 0).');
    var hours = num(x.hours);
    return { order: num(x.order) || order || 0, type: cut(x.type, 100), purpose: cut(x.purpose, 200), name: cut(x.name, 500), id: id, example: cut(x.example, 2000),
      time: cut(x.time, 100), level: cut(x.level, 40), point: point, unit: cut(x.unit, 60), hours: hours > 0 ? hours : r4(point * 4),
      active: has(x.active) && !on(x.active) ? 0 : 1, updatedAt: nowIso() };
  }
  function catList(all) {
    return store.all('Catalog').map(catOut).filter(function (c) { return all || c.active; }).sort(function (a, b) { return a.order - b.order || a.id.localeCompare(b.id); });
  }
  A.catalog = function (me) { return { items: catList(on(me.isAdmin)) }; };
  A.adminCatalogSave = function (me, d) {
    var cur = find('Catalog', (d.item || {}).id), maxOrder = 0;
    store.all('Catalog').forEach(function (r) { if (num(r.order) > maxOrder) maxOrder = num(r.order); });
    var c = catClean(d.item, cur ? num(cur.order) : maxOrder + 1);
    if (d.isNew && cur) err('Mã sản phẩm ' + c.id + ' đã có trong danh mục.');
    if (!d.isNew && !cur) err('Không tìm thấy mã sản phẩm cần sửa.');
    if (cur) store.update('Catalog', c.id, c); else store.insert('Catalog', c);
    return { id: c.id, items: catList(true) };
  };
  A.adminCatalogDelete = function (me, d) {
    if (!find('Catalog', d.id)) err('Không tìm thấy mã sản phẩm.');
    store.remove('Catalog', str(d.id)); // các phiếu đã kê giữ nguyên điểm chuẩn tại thời điểm kê
    return { items: catList(true) };
  };
  /** Nạp nhiều mã một lần (từ tệp Excel theo mẫu danh mục). Mã đã có thì cập nhật, mã mới thì thêm; replace = true thì thay toàn bộ danh mục. */
  function catalogPut(items, replace) {
    var rows = [], seen = {};
    (Array.isArray(items) ? items : []).slice(0, 2000).forEach(function (x, i) {
      var c = catClean(x, i + 1);
      if (seen[c.id]) err('Mã sản phẩm ' + c.id + ' bị lặp trong tệp.');
      seen[c.id] = true; rows.push(c);
    });
    if (!rows.length) err('Không có mã sản phẩm nào để nạp.');
    var patches = [], fresh = [];
    rows.forEach(function (c) { if (find('Catalog', c.id)) patches.push({ id: c.id, patch: c }); else fresh.push(c); });
    if (replace) store.all('Catalog').map(function (r) { return str(r.id); }).forEach(function (id) { if (!seen[id]) store.remove('Catalog', id); });
    if (patches.length) store.updateMany('Catalog', patches);
    if (fresh.length) store.insertMany('Catalog', fresh);
    return rows.length;
  }
  A.adminCatalogImport = function (me, d) { return { saved: catalogPut(d.items, !!d.replace), items: catList(true) }; };
  /** Nạp danh mục từ trình soạn thảo Apps Script. */
  function importCatalog(items) { return catalogPut(items, true); }

  /* ---------- Kho công việc mẫu ----------
   * Mỗi việc mẫu gắn với CCCD của một vị trí. Cán bộ tìm theo mã hoặc tên rồi thêm vào phiếu, kèm sẵn sản phẩm, số lượng và mức A–E. */
  function libClean(x) {
    x = x || {};
    var qty = num(x.qty);
    return {
      name: cut(x.name, 2000).replace(/\s*\n\s*/g, ' '), product: KPI_MODEL.products.indexOf(x.product) >= 0 ? x.product : 'Khác',
      qty: r2(Math.min(qty > 0 ? qty : 1, 1000)), month: /^T\d{1,2}\/\d{4}$/.test(str(x.month)) ? str(x.month) : '', s: cleanLevels(x.s)
    };
  }
  function libRow(userId, id, order, c) {
    var k = KPI_calc(c.s), row = { userId: str(userId), id: id, order: order, name: c.name, product: c.product, qty: c.qty, month: c.month, updatedAt: nowIso() };
    KEYS.forEach(function (key, j) { row[key] = levelText(j, c.s[j]); });
    row.s = k ? k.s : ''; row.n = k ? k.n : ''; row.point = k ? k.point : '';
    return row;
  }
  function libOut(r, names) {
    return { id: str(r.id), userId: str(r.userId), ownerName: names ? names[str(r.userId)] || '' : '', order: num(r.order), name: str(r.name), product: str(r.product), qty: num(r.qty) || 1, month: str(r.month), s: levelsOf(r) };
  }
  function libOf(userId) {
    return store.group('Library', 'userId', str(userId)).filter(function (r) { return str(r.id) !== ''; }).slice().sort(function (a, b) { return num(a.order) - num(b.order); });
  }
  /** Việc mẫu người gọi được dùng: của vị trí mình trước, rồi của những người cùng đơn vị. */
  A.libraryFind = function (me) {
    var ids = {}, names = {};
    store.all('Users').forEach(function (u) { if (on(u.active) && str(u.unitId) === str(me.unitId)) { ids[str(u.id)] = true; names[str(u.id)] = str(u.fullName); } });
    ids[str(me.id)] = true; names[str(me.id)] = str(me.fullName);
    var items = store.all('Library').filter(function (r) { return ids[str(r.userId)]; }).map(function (r) { return libOut(r, names); });
    items.sort(function (a, b) { return (a.userId === str(me.id) ? 0 : 1) - (b.userId === str(me.id) ? 0 : 1) || a.ownerName.localeCompare(b.ownerName, 'vi') || a.order - b.order; });
    return { items: items };
  };
  /** Không gửi userId: số việc mẫu của từng người. Có userId: danh sách việc mẫu của người đó. */
  A.adminLibraryList = function (me, d) {
    if (!str(d.userId)) {
      var counts = {};
      store.all('Library').forEach(function (r) { counts[str(r.userId)] = (counts[str(r.userId)] || 0) + 1; });
      return { counts: counts };
    }
    return { items: libOf(d.userId).map(function (r) { return libOut(r); }) };
  };
  A.adminLibrarySave = function (me, d) {
    var owner = find('Users', d.userId) || err('Chưa chọn cá nhân của kho công việc mẫu.');
    var c = libClean(d.item), id = str((d.item || {}).id);
    if (!c.name) err('Chưa nhập tên công việc.');
    if (id) {
      var cur = find('Library', id) || err('Không tìm thấy công việc mẫu ' + id + '.');
      if (str(cur.userId) !== str(owner.id)) err('Công việc mẫu ' + id + ' không thuộc cá nhân đang chọn.');
      store.update('Library', id, libRow(owner.id, id, num(cur.order), c));
    } else {
      var order = 0;
      libOf(owner.id).forEach(function (r) { if (num(r.order) > order) order = num(r.order); });
      id = codeMaker('Library', 'CV', 5)();
      store.insert('Library', libRow(owner.id, id, order + 1, c));
    }
    return { id: id, items: libOf(owner.id).map(function (r) { return libOut(r); }) };
  };
  A.adminLibraryDelete = function (me, d) {
    var cur = find('Library', d.id) || err('Không tìm thấy công việc mẫu.');
    store.remove('Library', str(cur.id));
    return { items: libOf(cur.userId).map(function (r) { return libOut(r); }) };
  };
  /** Đẩy nhiều việc mẫu lên kho của một người (từ tệp Excel theo mẫu). replace = true: thay toàn bộ kho của người đó. */
  function libraryPut(userId, items, replace) {
    var old = replace ? [] : libOf(userId), order = 0, next = codeMaker('Library', 'CV', 5), seen = {}, added = 0;
    old.forEach(function (r) { if (num(r.order) > order) order = num(r.order); seen[str(r.name).toLowerCase() + '|' + str(r.product)] = true; });
    var rows = [];
    (Array.isArray(items) ? items : []).slice(0, 2000).forEach(function (x) {
      var c = libClean(x), key = c.name.toLowerCase() + '|' + c.product;
      if (!c.name || seen[key]) return; // trùng tên và sản phẩm với việc đã có thì bỏ qua
      seen[key] = true;
      rows.push(libRow(userId, next(), ++order, c)); added++;
    });
    if (replace) store.replaceGroup('Library', 'userId', str(userId), rows);
    else if (rows.length) store.insertMany('Library', rows);
    return added;
  }
  A.adminLibraryImport = function (me, d) {
    var owner = find('Users', d.userId) || err('Chưa chọn cá nhân của kho công việc mẫu.');
    var added = libraryPut(owner.id, d.items, !!d.replace);
    return { added: added, items: libOf(owner.id).map(function (r) { return libOut(r); }) };
  };
  /** Nạp kho từ trình soạn thảo Apps Script. data: [{ userId, items: [...] }]. Trả về số việc đã nạp của từng người. */
  function importLibrary(data, replace) {
    var report = [];
    (data || []).forEach(function (g) {
      var u = find('Users', g.userId);
      if (!u) { report.push(str(g.userId) + ': không có tài khoản, bỏ qua'); return; }
      report.push(str(u.fullName) + ' (' + str(u.id) + '): ' + libraryPut(u.id, g.items, replace !== false) + ' việc mẫu');
    });
    return report;
  }

  /* ---------- Xếp loại theo kỳ: lãnh đạo đề xuất → tham mưu tổng hợp → tập thể biểu quyết → chốt ----------
   * Tổng điểm thang 100 = điểm tiêu chí chung (tối đa rule.common, người tham mưu nhập, mặc định đủ)
   *                     + điểm kết quả nhiệm vụ = (100 − rule.common) × tỷ lệ hoàn thành.
   * Tỷ lệ hoàn thành = bình quân tiến độ được xác nhận của các công việc, việc điểm cao tính nặng hơn; việc chưa được chấm coi như chưa hoàn thành.
   * Điều kiện xét xuất sắc: tổng điểm ≥ rule.minScore, 100% công việc hoàn thành, ít nhất rule.minOver % công việc vượt mức (cả tiến độ lẫn chất lượng).
   * Số người xuất sắc không quá rule.quota % số người từ "Hoàn thành tốt" trở lên (làm tròn từ 0,5; nhóm dưới 5 người được 1). */
  function ratingStats(period) {
    var evs = {}, byEval = {}, rv = {}, out = {};
    store.all('Evaluations').forEach(function (e) { if (str(e.periodId) === str(period.id)) { evs[str(e.id)] = e; byEval[str(e.id)] = []; } });
    store.all('Tasks').forEach(function (r) { if (byEval[str(r.evalId)]) byEval[str(r.evalId)].push(r); });
    store.all('Reviews').forEach(function (v) { if (byEval[str(v.evalId)]) rv[str(v.evalId) + '|' + str(v.id)] = v; });
    Object.keys(byEval).forEach(function (eid) {
      var n = 0, scored = 0, done = 0, over = 0, wSum = 0, wDone = 0;
      byEval[eid].forEach(function (r) {
        var v = rv[eid + '|' + str(r.id)], inCat = !!str(r.code), locked = v && str(v.lock) === 'Khoá';
        var sc = KPI_calc(levelsOf(r)) || (inCat ? { point: num(r.std) } : null);
        var m = !locked ? null : inCat ? (str(v.h) !== '' ? (KPI_calc(levelsOf(v)) || sc) : null) : KPI_calc(levelsOf(v));
        var w = (num(r.qty) || 1) * (m ? m.point : sc ? sc.point : KPI_MODEL.nLevels[0].point);
        var prog = !m ? 0 : str(v.progress) !== '' ? pct(v.progress) : inCat ? Math.round(num(v.h) * 100) : 100;
        n++; wSum += w; wDone += w * prog / 100;
        if (m) { scored++; if (prog >= 100) done++; if (str(v.overTime) && str(v.overQuality)) over++; }
      });
      out[str(evs[eid].userId)] = {
        tasks: n, scored: scored, donePct: n ? r2(done / n * 100) : 0, overPct: n ? r2(over / n * 100) : 0, ratio: wSum ? wDone / wSum : 0,
        points: has(evs[eid].mgrTotal) ? num(evs[eid].mgrTotal) : null
      };
    });
    return out;
  }
  function ratingId(period, userId) { return str(period.id) + '|' + str(userId); }
  function ratingPut(period, userId, patch) {
    var id = ratingId(period, userId);
    patch.updatedAt = nowIso();
    if (find('Ratings', id)) { store.update('Ratings', id, patch); return; }
    var row = {};
    KPI_TABLES.Ratings.forEach(function (k) { row[k] = k in patch ? patch[k] : ''; });
    row.id = id; row.periodId = str(period.id); row.period = str(period.name); row.userId = str(userId);
    store.insert('Ratings', row);
  }
  function votesOf(row) { try { var v = JSON.parse(str(row && row.votes) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function isStaff(me) { return on(me.isAdmin) || on(me.isStaff); }
  function quotaMax(n, rl) { return n <= 0 ? 0 : n < 5 ? 1 : Math.floor(n * rl.quota / 100 + 0.5); }
  /** Điểm thang 100 và việc đủ điều kiện xét xuất sắc của một người. */
  function ratingScore(st, row, rl) {
    st = st || { tasks: 0, scored: 0, donePct: 0, overPct: 0, ratio: 0, points: null };
    var common = row && str(row.common) !== '' ? Math.min(num(row.common), rl.common) : rl.common;
    var taskScore = r2((100 - rl.common) * st.ratio), total = r2(common + taskScore);
    var why = [];
    if (total < rl.minScore) why.push('tổng điểm ' + total + ' dưới ' + rl.minScore);
    if (!st.tasks || st.donePct < 100) why.push('chưa hoàn thành 100% nhiệm vụ');
    if (st.overPct < rl.minOver) why.push('nhiệm vụ vượt mức ' + st.overPct + '% dưới ' + rl.minOver + '%');
    return { common: common, taskScore: taskScore, total: total, eligible: !why.length, why: why.join('; ') };
  }
  function ratingPeople() { return store.all('Users').filter(function (u) { return on(u.active) && on(u.selfEval); }); }
  /** Kiểm tra số người xuất sắc theo cột `field` ('staffLevel' hoặc 'result') của toàn cơ quan. */
  function quotaOf(period, field, rl, changes) {
    var people = {}, level = {}, xs = 0, base = 0;
    ratingPeople().forEach(function (u) { people[str(u.id)] = true; });
    store.all('Ratings').forEach(function (r) { if (str(r.periodId) === str(period.id)) level[str(r.userId)] = str(r[field]); });
    Object.keys(changes || {}).forEach(function (k) { level[k] = changes[k]; });
    Object.keys(level).forEach(function (k) {
      if (!people[k]) return;
      if (level[k] === 'xs') { xs++; base++; } else if (level[k] === 'tot') base++;
    });
    return { xs: xs, base: base, max: quotaMax(base, rl) };
  }
  /** changes: { CCCD: mức mới } sẽ được ghi; kiểm tra trước khi ghi để lỗi thì không lưu dở dang. */
  function needQuota(period, field, rl, changes) {
    var q = quotaOf(period, field, rl, changes);
    if (q.xs > q.max) err('Số người xếp “' + KPI_RATE.xs + '” là ' + q.xs + ', vượt mức cho phép ' + q.max + ' (không quá ' + rl.quota + '% của ' + q.base + ' người từ “Hoàn thành tốt” trở lên). Hãy điều chỉnh rồi lưu lại.');
  }
  function openPeriod(id) { var p = needPeriod(id); if (phaseOf(p) === 'khoa') err('Kỳ đánh giá đã khoá.'); return p; }

  A.rating = function (me, d) {
    needRating();
    var period = needPeriod(d.periodId), rl = rule(), staff = isStaff(me), voter = on(me.isVoter);
    var map = reportsMap(), scope = subtreeIds(me.id, map), stats = ratingStats(period), rows = {};
    store.all('Ratings').forEach(function (r) { if (str(r.periodId) === str(period.id)) rows[str(r.userId)] = r; });
    var list = ratingPeople().filter(function (u) {
      var r = rows[str(u.id)];
      return staff || scope[str(u.id)] || str(u.id) === str(me.id) || (voter && r && on(r.submitted));
    }).map(function (u) {
      var r = rows[str(u.id)], st = stats[str(u.id)], sc = ratingScore(st, r, rl), votes = votesOf(r), tally = {}, nVotes = 0;
      Object.keys(votes).forEach(function (k) { if (KPI_RATE[votes[k]]) { tally[votes[k]] = (tally[votes[k]] || 0) + 1; nVotes++; } });
      var decided = !!(r && KPI_RATE[str(r.result)]), self = str(u.id) === str(me.id);
      var mine = str(u.managerId) === str(me.id);
      return {
        user: pub(u), tasks: st ? st.tasks : 0, scored: st ? st.scored : 0, donePct: st ? st.donePct : 0, overPct: st ? st.overPct : 0, points: st ? st.points : null,
        common: sc.common, taskScore: sc.taskScore, total: sc.total, eligible: sc.eligible, why: sc.why,
        mgrLevel: r ? str(r.mgrLevel) : '', staffLevel: (staff || mine || decided) && r ? str(r.staffLevel) : '', staffNote: staff && r ? str(r.staffNote) : '',
        submitted: !!(r && on(r.submitted)), tally: staff || voter ? tally : {}, votes: nVotes, myVote: voter ? str(votes[str(me.id)] || '') : '',
        result: decided ? str(r.result) : '',
        can: { propose: mine && !decided, vote: voter && !self && !!(r && on(r.submitted)) && !decided }
      };
    });
    var qs = quotaOf(period, 'staffLevel', rl), qr = quotaOf(period, 'result', rl);
    return {
      rows: list, rule: rl, role: { staff: staff, voter: voter }, phase: phaseOf(period),
      voters: store.all('Users').filter(function (u) { return on(u.active) && on(u.isVoter); }).length,
      quota: { proposed: qs.xs, proposedMax: qs.max, proposedBase: qs.base, decided: qr.xs, decidedMax: qr.max, decidedBase: qr.base }
    };
  };
  function levelOrBlank(v) { return KPI_RATE[str(v)] ? str(v) : ''; }
  /** Lãnh đạo trực tiếp đề xuất mức xếp loại cho những người mình phụ trách. */
  A.ratingPropose = function (me, d) {
    needRating();
    var period = openPeriod(d.periodId), n = 0;
    (Array.isArray(d.items) ? d.items : []).forEach(function (x) {
      var u = find('Users', x.userId) || err('Không tìm thấy cán bộ.');
      if (str(u.managerId) !== str(me.id)) err('Chỉ người phụ trách trực tiếp mới đề xuất xếp loại cho ' + str(u.fullName) + '.');
      var cur = find('Ratings', ratingId(period, u.id));
      if (cur && KPI_RATE[str(cur.result)]) err(str(u.fullName) + ' đã được chốt kết quả xếp loại.');
      ratingPut(period, u.id, { mgrLevel: levelOrBlank(x.level), mgrBy: str(me.id) }); n++;
    });
    if (!n) err('Chưa có đề xuất nào.');
    return A.rating(me, { periodId: period.id });
  };
  /** Bộ phận tham mưu tổng hợp: nhập điểm tiêu chí chung, đề xuất mức xếp loại; submit = true thì trình tập thể biểu quyết. */
  A.ratingStaff = function (me, d) {
    needRating();
    if (!isStaff(me)) err('Chỉ người được giao tham mưu tổng hợp hoặc quản trị mới thực hiện được bước này.');
    var period = openPeriod(d.periodId), rl = rule(), stats = ratingStats(period), todo = [], changes = {};
    (Array.isArray(d.items) ? d.items : []).forEach(function (x) {
      var u = find('Users', x.userId) || err('Không tìm thấy cán bộ.');
      var cur = find('Ratings', ratingId(period, u.id));
      if (cur && KPI_RATE[str(cur.result)]) return; // đã chốt: giữ nguyên
      var common = has(x.common) ? r2(Math.min(Math.max(num(x.common), 0), rl.common)) : rl.common, level = levelOrBlank(x.level);
      var sc = ratingScore(stats[str(u.id)], { common: common }, rl), st = stats[str(u.id)] || {};
      if (level === 'xs' && !sc.eligible) err(str(u.fullName) + ' chưa đủ điều kiện xét “' + KPI_RATE.xs + '”: ' + sc.why + '.');
      if (d.submit && !level) err('Chưa đề xuất mức xếp loại cho ' + str(u.fullName) + '.');
      var patch = { common: common, taskScore: sc.taskScore, total: sc.total, donePct: st.donePct || 0, overPct: st.overPct || 0, staffLevel: level, staffBy: str(me.id), staffNote: cut(x.note, 500) };
      if (d.submit) patch.submitted = 1;
      todo.push([u.id, patch]); changes[str(u.id)] = level;
    });
    if (!todo.length) err('Không có dòng nào để lưu.');
    needQuota(period, 'staffLevel', rl, changes);
    todo.forEach(function (x) { ratingPut(period, x[0], x[1]); });
    return A.rating(me, { periodId: period.id });
  };
  /** Thành viên tập thể lãnh đạo biểu quyết mức xếp loại cho những người đã được trình. */
  A.ratingVote = function (me, d) {
    needRating();
    if (!on(me.isVoter)) err('Anh/chị không thuộc thành phần biểu quyết.');
    var period = openPeriod(d.periodId), n = 0;
    (Array.isArray(d.items) ? d.items : []).forEach(function (x) {
      var level = levelOrBlank(x.level), cur = find('Ratings', ratingId(period, x.userId));
      if (!level) return;
      if (!cur || !on(cur.submitted)) err('Có người chưa được trình biểu quyết.');
      if (KPI_RATE[str(cur.result)]) return;
      if (str(x.userId) === str(me.id)) err('Không biểu quyết cho chính mình.');
      var votes = votesOf(cur);
      votes[str(me.id)] = level;
      ratingPut(period, x.userId, { votes: JSON.stringify(votes) }); n++;
    });
    if (!n) err('Chưa chọn mức xếp loại nào để biểu quyết.');
    return A.rating(me, { periodId: period.id });
  };
  /** Chốt kết quả theo đa số phiếu. Bằng phiếu thì lấy theo đề xuất của tham mưu. Cơ quan chưa khai thành phần biểu quyết thì chốt theo đề xuất của tham mưu. */
  A.ratingDecide = function (me, d) {
    needRating();
    if (!isStaff(me)) err('Chỉ người được giao tham mưu tổng hợp hoặc quản trị mới chốt được kết quả.');
    var period = openPeriod(d.periodId), rl = rule(), stats = ratingStats(period), only = {}, todo = [], changes = {};
    var hasVoters = store.all('Users').some(function (u) { return on(u.active) && on(u.isVoter); });
    (Array.isArray(d.userIds) ? d.userIds : []).forEach(function (id) { only[str(id)] = true; });
    store.all('Ratings').slice().forEach(function (r) {
      if (str(r.periodId) !== str(period.id) || !on(r.submitted) || KPI_RATE[str(r.result)]) return;
      if (Object.keys(only).length && !only[str(r.userId)]) return;
      var u = find('Users', r.userId), name = u ? str(u.fullName) : str(r.userId), votes = votesOf(r), tally = {}, top = 0, best = [];
      Object.keys(votes).forEach(function (k) { if (KPI_RATE[votes[k]]) tally[votes[k]] = (tally[votes[k]] || 0) + 1; });
      Object.keys(tally).forEach(function (k) { if (tally[k] > top) { top = tally[k]; best = [k]; } else if (tally[k] === top) best.push(k); });
      var result;
      if (!top) { if (hasVoters) err(name + ' chưa có phiếu biểu quyết nào.'); result = str(r.staffLevel); }
      else result = best.length === 1 ? best[0] : (best.indexOf(str(r.staffLevel)) >= 0 ? str(r.staffLevel) : err(name + ': các mức bằng phiếu nhau, cần biểu quyết lại.'));
      if (!KPI_RATE[result]) err(name + ' chưa có mức xếp loại để chốt.');
      if (result === 'xs') { var sc = ratingScore(stats[str(r.userId)], r, rl); if (!sc.eligible) err(name + ' chưa đủ điều kiện xếp “' + KPI_RATE.xs + '”: ' + sc.why + '.'); }
      todo.push([str(r.userId), result]); changes[str(r.userId)] = result;
    });
    if (!todo.length) err('Không có ai đang chờ chốt kết quả. Hãy trình biểu quyết trước.');
    needQuota(period, 'result', rl, changes);
    todo.forEach(function (x) { ratingPut(period, x[0], { result: x[1], decidedBy: str(me.id), decidedAt: nowIso() }); });
    return A.rating(me, { periodId: period.id });
  };
  /** Mở lại kết quả đã chốt của một người để biểu quyết, chốt lại. */
  A.ratingReopen = function (me, d) {
    needRating();
    if (!isStaff(me)) err('Chỉ người được giao tham mưu tổng hợp hoặc quản trị mới mở lại được kết quả.');
    var period = openPeriod(d.periodId);
    if (!find('Ratings', ratingId(period, d.userId))) err('Chưa có kết quả để mở lại.');
    ratingPut(period, d.userId, { result: '', decidedBy: '', decidedAt: '' });
    return A.rating(me, { periodId: period.id });
  };

  /* ---------- Quản trị (chỉ người có quyền Quản trị) ---------- */
  A.adminList = function () {
    return { users: store.all('Users').map(function (u) { return pub(u, true); }) };
  };

  function checkManager(userId, managerId) {
    managerId = str(managerId);
    if (!managerId) return '';
    if (managerId === str(userId)) err('Không thể tự phụ trách đánh giá chính mình.');
    var m = find('Users', managerId) || err('Không tìm thấy người phụ trách có CCCD ' + managerId + '.');
    if (rank(m) > KPI_LEVELS.pho.rank) err('Người phụ trách đánh giá phải từ cấp phó trở lên (' + str(m.fullName) + ' đang ở cấp Cá nhân).');
    for (var cur = m, guard = 0; cur && guard < 100; guard++) { // không để cây phụ trách thành vòng tròn
      if (str(cur.id) === str(userId)) err('Không hợp lệ: ' + str(m.fullName) + ' đang nằm dưới quyền phụ trách của người này.');
      cur = find('Users', cur.managerId);
    }
    return managerId;
  }
  var SAVERS = {
    Units: function (r, isNew) {
      var id = cut(r.id, 30);
      if (!/^[A-Za-z0-9._-]+$/.test(id)) err('Mã đơn vị chỉ gồm chữ không dấu, số, dấu chấm hoặc gạch (ví dụ: VP, BAN-TC).');
      if (!cut(r.name, 200)) err('Chưa nhập tên đơn vị.');
      var parentId = str(r.parentId);
      if (parentId) {
        for (var cur = find('Units', parentId) || err('Không tìm thấy đơn vị cha ' + parentId + '.'), guard = 0; cur && guard < 100; guard++) {
          if (str(cur.id) === id) err('Đơn vị cha không được là chính nó hoặc đơn vị con của nó.');
          cur = find('Units', cur.parentId);
        }
      }
      return { id: id, name: cut(r.name, 200), parentId: parentId, order: num(r.order) };
    },
    Users: function (r, isNew, me) {
      var id = cut(r.id, 20);
      if (!/^\d{9,12}$/.test(id)) err('Số CCCD phải gồm 12 chữ số (chấp nhận CMND 9 chữ số).');
      if (!cut(r.fullName, 200)) err('Chưa nhập họ tên.');
      if (!find('Units', r.unitId)) err('Mã đơn vị không tồn tại: ' + (str(r.unitId) || '(trống)') + '.');
      var level = KPI_LEVELS[r.level] ? r.level : 'canbo';
      var email = cut(r.email, 200);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err('Email không hợp lệ.');
      if (!isNew && KPI_LEVELS[level].rank > KPI_LEVELS.pho.rank && (reportsMap()[id] || []).length) {
        err('Người này đang phụ trách đánh giá người khác, không thể chuyển xuống cấp Cá nhân. Hãy đổi người phụ trách của họ trước.');
      }
      if (!isNew && id === str(me.id) && (!on(r.isAdmin) || !on(r.active))) err('Không thể tự bỏ quyền quản trị hoặc tự khoá tài khoản của mình.');
      return {
        id: id, unitId: str(r.unitId), fullName: cut(r.fullName, 200), title: cut(r.title, 200), phone: cut(r.phone, 20).replace(/[^\d+ .-]/g, ''),
        email: email, level: level, managerId: checkManager(id, r.managerId),
        extra: extraOf({ extra: r.extra }).filter(function (x, k, a) { return a.indexOf(x) === k; }).map(function (x) {
          if (x === id) err('Không thể tự làm quản lý vượt cấp của chính mình.');
          if (!find('Users', x)) err('Không tìm thấy người quản lý vượt cấp có CCCD ' + x + '.');
          return x;
        }).join(', '),
        selfEval: (has(r.selfEval) ? on(r.selfEval) : KPI_LEVELS[level].selfEval) ? 1 : 0, isAdmin: on(r.isAdmin) ? 1 : 0, active: on(r.active) ? 1 : 0,
        isStaff: on(r.isStaff) ? 1 : 0, isVoter: on(r.isVoter) ? 1 : 0
      };
    },
    Periods: function (r) {
      if (!cut(r.name, 200)) err('Chưa nhập tên kỳ đánh giá.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str(r.startDate)) || !/^\d{4}-\d{2}-\d{2}$/.test(str(r.endDate))) err('Chưa chọn ngày bắt đầu, ngày kết thúc.');
      if (str(r.endDate) < str(r.startDate)) err('Ngày kết thúc phải sau ngày bắt đầu.');
      return {
        id: cut(r.id, 40) || 'ky_' + env.uuid().slice(0, 8), name: cut(r.name, 200), type: ['thang', 'quy', 'nam'].indexOf(r.type) >= 0 ? r.type : 'thang',
        startDate: str(r.startDate), endDate: str(r.endDate),
        deadline: /^\d{4}-\d{2}-\d{2}$/.test(str(r.deadline)) ? str(r.deadline) : str(r.endDate),
        status: r.status === 'khoa' || r.status === 'chot' ? r.status : 'mo'
      };
    }
  };

  /** d: { table, row, isNew }. Mã đơn vị và CCCD do người dùng nhập nên phải nói rõ là thêm mới hay sửa. */
  A.adminSave = function (me, d) {
    var saver = SAVERS[d.table] || err('Bảng dữ liệu không hợp lệ.');
    var isNew = !!d.isNew, out = {};
    var clean = saver(d.row || {}, isNew, me);
    var exists = find(d.table, clean.id);
    if (isNew) {
      if (exists) err((d.table === 'Users' ? 'Số CCCD ' : 'Mã ') + clean.id + ' đã tồn tại.');
      if (d.table === 'Users') { var ip = initialPass(); clean.salt = ip.salt; clean.passHash = ip.passHash; clean.mustChange = 1; out.tempPassword = ip.temp; out.usedDefault = ip.usedDefault; }
      store.insert(d.table, clean);
    } else {
      if (!exists) err('Không tìm thấy bản ghi cần sửa.');
      store.update(d.table, clean.id, clean);
    }
    out.id = clean.id;
    return out;
  };

  /** Nhập nhiều dòng một lần (dán từ Excel). Người dùng được kiểm tra hết rồi ghi vào bảng tính trong MỘT lần
   * (vài trăm người vẫn chỉ mất vài giây); người phụ trách gán sau nên thứ tự dòng không quan trọng. */
  A.adminImport = function (me, d) {
    if (d.table !== 'Users' && d.table !== 'Units') err('Chỉ nhập hàng loạt được Đơn vị và Người dùng.');
    var rows = (Array.isArray(d.rows) ? d.rows : []).slice(0, 1000), results = [], fresh = [], seen = {};
    rows.forEach(function (r) {
      var res = { id: str(r.id), name: str(r.fullName || r.name) };
      try {
        var row = {}; Object.keys(r).forEach(function (k) { row[k] = r[k]; });
        if (d.table === 'Units') { // đơn vị ít và đơn vị cha phải có trước: ghi lần lượt
          A.adminSave(me, { table: 'Units', row: row, isNew: true });
        } else {
          row.managerId = ''; row.active = true;
          var clean = SAVERS.Users(row, true, me);
          if (find('Users', clean.id) || seen[clean.id]) err('Số CCCD ' + clean.id + ' đã tồn tại.');
          seen[clean.id] = true;
          var ip = initialPass();
          clean.salt = ip.salt; clean.passHash = ip.passHash; clean.mustChange = 1;
          res.id = clean.id; res.tempPassword = ip.temp; res.usedDefault = ip.usedDefault;
          fresh.push(clean);
        }
        res.ok = true;
      } catch (e) { if (!e.kpi) throw e; res.ok = false; res.error = e.message; }
      results.push(res);
    });
    if (d.table === 'Users') {
      if (fresh.length) store.insertMany('Users', fresh);
      var patches = [];
      rows.forEach(function (r, i) {
        if (!results[i].ok || !str(r.managerId)) return;
        try {
          var m = checkManager(results[i].id, r.managerId), u = find('Users', results[i].id);
          u.managerId = m; // cập nhật ngay trong bộ nhớ để các dòng sau kiểm tra vòng lặp đúng
          patches.push({ id: results[i].id, patch: { managerId: m } });
        } catch (e) { if (!e.kpi) throw e; results[i].error = 'Đã tạo, nhưng chưa gán được người phụ trách: ' + e.message; }
      });
      if (patches.length) store.updateMany('Users', patches);
    }
    return { results: results };
  };

  /** Đặt lại mật khẩu mặc định cho mọi tài khoản không có quyền quản trị; bổ sung các cột hệ thống còn trống
   * cho những dòng nhập tay thẳng vào bảng tính. Chỉ gọi từ trình soạn thảo Apps Script. */
  function resetAllPasswords() {
    var dp = env.defaultPass ? env.defaultPass() : null;
    if (!dp || !str(dp.salt) || !str(dp.passHash)) err('Chưa khai mật khẩu mặc định (KPI_DEFAULT_PASS trong Seed.gs).');
    var patches = [], n = { reset: 0, fixed: 0, admin: 0 };
    store.all('Users').forEach(function (u) {
      var patch = {}, level = KPI_LEVELS[str(u.level)] ? str(u.level) : 'canbo';
      if (str(u.level) !== level) patch.level = level;
      if (str(u.active) === '') patch.active = 1;                                   // dòng nhập tay chưa có cột hệ thống
      if (str(u.selfEval) === '') patch.selfEval = KPI_LEVELS[level].selfEval ? 1 : 0;
      if (str(u.isAdmin) === '') patch.isAdmin = 0;
      if (Object.keys(patch).length) n.fixed++;
      if (on(u.isAdmin)) n.admin++;
      else { patch.salt = str(dp.salt); patch.passHash = str(dp.passHash); patch.mustChange = 1; n.reset++; }
      if (Object.keys(patch).length) patches.push({ id: str(u.id), patch: patch });
    });
    if (patches.length) store.updateMany('Users', patches);
    return n;
  }

  A.adminDelete = function (me, d) {
    var id = str(d.id);
    if (!SAVERS[d.table] || !find(d.table, id)) err('Không tìm thấy bản ghi cần xoá.');
    if (d.table === 'Units') {
      if (store.all('Users').some(function (u) { return str(u.unitId) === id; })) err('Đơn vị đang có người dùng, không thể xoá.');
      if (store.all('Units').some(function (u) { return str(u.parentId) === id; })) err('Đơn vị đang có đơn vị con, không thể xoá.');
    }
    if (d.table === 'Users') {
      if (id === str(me.id)) err('Không thể xoá tài khoản đang đăng nhập.');
      if (store.all('Users').some(function (u) { return str(u.managerId) === id; })) err('Người này đang phụ trách đánh giá người khác. Hãy đổi người phụ trách của họ trước.');
      if (store.all('Evaluations').some(function (e) { return str(e.userId) === id; })) err('Người này đã có phiếu đánh giá. Hãy bỏ chọn "Đang hoạt động" thay vì xoá.');
    }
    if (d.table === 'Periods' && store.all('Evaluations').some(function (e) { return str(e.periodId) === id; })) {
      err('Kỳ đã có phiếu đánh giá. Hãy khoá kỳ thay vì xoá.');
    }
    store.remove(d.table, id);
    return { id: id };
  };

  A.adminResetPassword = function (me, d) {
    if (!find('Users', d.userId)) err('Không tìm thấy tài khoản.');
    var ip = initialPass();
    store.update('Users', d.userId, { salt: ip.salt, passHash: ip.passHash, mustChange: 1 });
    return { tempPassword: ip.temp, usedDefault: ip.usedDefault };
  };

  A.adminSaveConfig = function (me, d) {
    var c = d.config || {};
    if (!cut(c.orgName, 300)) err('Chưa nhập tên cơ quan.');
    var ratings = (Array.isArray(c.ratings) ? c.ratings : []).map(function (r) {
      return { min: Math.max(num(r.min), 0), name: cut(r.name, 200) };
    }).filter(function (r) { return r.name; }).sort(function (a, b) { return b.min - a.min; });
    if (ratings.length) ratings[ratings.length - 1].min = 0;
    setCfg('orgName', cut(c.orgName, 300));
    setCfg('ratings', ratings);
    if (c.rule) {
      var rl = {};
      Object.keys(KPI_RULE).forEach(function (k) { var v = num(c.rule[k]); rl[k] = has(c.rule[k]) && v >= 0 && v <= 100 ? v : KPI_RULE[k]; });
      setCfg('rule', rl);
    }
    return publicConfig();
  };

  /* ---------- Dữ liệu khởi tạo ----------
   * opts.admin: { id, fullName?, salt, passHash } (mật khẩu đã băm sẵn) hoặc { id, password } (chỉ dùng khi chạy thử).
   * opts.sample: thêm cây đơn vị, người dùng và phiếu mẫu để chạy thử trên máy. */
  function seed(opts) {
    opts = opts || {};
    var out = {};
    if (store.all('Users').length) return out;
    store.insert('Units', { id: 'UBMT', name: 'Ủy ban MTTQ Việt Nam tỉnh', parentId: '', order: 1 });
    store.insert('Units', { id: 'VP', name: 'Văn phòng', parentId: 'UBMT', order: 1 });
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function period(yy, mm, status) {
      var last = new Date(yy, mm + 1, 0).getDate(), id = 'ky_' + yy + pad(mm + 1);
      store.insert('Periods', {
        id: id, name: 'Tháng ' + pad(mm + 1) + '/' + yy, type: 'thang', startDate: yy + '-' + pad(mm + 1) + '-01',
        endDate: yy + '-' + pad(mm + 1) + '-' + last, deadline: yy + '-' + pad(mm + 1) + '-' + last, status: status
      });
      return find('Periods', id);
    }
    var cur = period(y, m, 'mo');
    setCfg('orgName', 'Ủy ban Mặt trận Tổ quốc Việt Nam tỉnh');
    setCfg('ratings', KPI_DEFAULT_RATINGS);

    function addUser(id, fullName, title, unitId, level, managerId, extra) {
      var row = {
        id: id, unitId: unitId, fullName: fullName, title: title, phone: '', email: '', level: level, managerId: managerId || '',
        selfEval: KPI_LEVELS[level].selfEval ? 1 : 0, isAdmin: 0, active: 1, mustChange: 0, passHash: '', salt: ''
      };
      Object.keys(extra || {}).forEach(function (k) { row[k] = extra[k]; });
      store.insert('Users', row);
      return find('Users', id);
    }
    var a = opts.admin || {};
    if (!a.id) { a = { id: '000000000000', password: (out.adminPassword = tempPassword()) }; out.mustChange = true; }
    out.adminId = a.id;
    var admin = addUser(a.id, a.fullName || 'Quản trị hệ thống', a.title || 'Chuyên viên', 'VP', 'canbo', '',
      { isAdmin: 1, salt: str(a.salt), passHash: str(a.passHash), mustChange: out.mustChange ? 1 : 0 });
    if (a.password) setPassword(a.id, a.password, !!out.mustChange);
    if (!opts.sample) return out;

    // ----- Dữ liệu mẫu để chạy thử (không dùng trên máy chủ thật) -----
    var P = a.password;
    [['BTC', 'Ban Tổ chức - Kiểm tra'], ['BPT', 'Ban Phong trào']].forEach(function (u, i) { store.insert('Units', { id: u[0], name: u[1], parentId: 'UBMT', order: i + 2 }); });
    var people = [
      ['100000000001', 'Nguyễn Văn An', 'Chủ tịch', 'UBMT', 'thutruong', ''],
      ['100000000002', 'Đỗ Minh Khang', 'Chánh Văn phòng', 'VP', 'truong', '100000000001'],
      ['100000000003', 'Vũ Thị Hoa', 'Phó Chánh Văn phòng', 'VP', 'pho', '100000000002'],
      ['100000000004', 'Lê Văn Cường', 'Phó Chánh Văn phòng', 'VP', 'pho', '100000000002'],
      ['100000000005', 'Hoàng Thị Dung', 'Chuyên viên', 'VP', 'canbo', '100000000003'],
      ['100000000006', 'Ngô Thị Giang', 'Chuyên viên', 'VP', 'canbo', '100000000004'],
      ['100000000007', 'Trần Thị Bình', 'Trưởng ban', 'BTC', 'truong', '100000000001'],
      ['100000000008', 'Bùi Văn Em', 'Phó Trưởng ban', 'BTC', 'pho', '100000000007'],
      ['100000000009', 'Đặng Văn Hải', 'Chuyên viên', 'BTC', 'canbo', '100000000008'],
      ['100000000010', 'Lý Thị Yến', 'Chuyên viên', 'BPT', 'canbo', '']
    ].map(function (p) { var u = addUser(p[0], p[1], p[2], p[3], p[4], p[5]); setPassword(u.id, P, false); return find('Users', u.id); });
    store.update('Users', admin.id, { managerId: '100000000003' });
    people.push(find('Users', admin.id));
    var samples = [
      ['Tham mưu công văn góp ý dự thảo kế hoạch công tác quý của cơ quan', 'Công văn', 1, [2, 2, 2, 1, 1]],
      ['Xây dựng báo cáo kết quả công tác tháng của đơn vị', 'Báo cáo', 1, [3, 3, 2, 2, 2]],
      ['Soạn giấy mời họp giao ban theo mẫu', 'Giấy mời', 2, [1, 1, 1, 1, 1]],
      ['Tham mưu kế hoạch tổ chức hội nghị tập huấn nghiệp vụ cho cơ sở', 'Kế hoạch', 1, [4, 3, 3, 3, 2]],
      ['Tổng hợp ý kiến các ban và dự thảo tờ trình xin chủ trương', 'Tờ trình', 1, [3, 3, 3, 2, 2]],
      ['Tham mưu quyết định phê duyệt dự toán hoạt động', 'Quyết định', 1, [4, 4, 3, 3, 3]],
      ['Ghi biên bản và dự thảo thông báo kết luận cuộc họp', 'Thông báo', 1, [2, 2, 2, 2, 1]]
    ];
    function mk(u, p, status, k) {
      var tasks = [], n = 3 + (k % 3), at = stamp();
      for (var i = 0; i < n; i++) {
        var sp = samples[(k * 2 + i) % samples.length];
        var t = { id: env.uuid(), name: sp[0], product: sp[1], qty: sp[2], month: defaultMonth(p), s: sp[3].slice(), link: '' };
        if (status === 'nhap' && i === n - 1) t.s = [sp[3][0], 0, 0, 0, 0];
        if (i === 0) t.repeat = true;
        if (status === 'da_chot') { t.m = sp[3].slice(); if ((i + k) % 4 === 0 && t.m[1] > 1) t.m[1]--; t.locked = true; t.mBy = str(u.managerId); t.mDate = at.date; t.mTime = at.time; }
        tasks.push(t);
      }
      var row = headerRow({});
      row.id = env.uuid(); row.periodId = p.id; row.userId = u.id; row.status = status;
      row.taskCount = tasks.length; row.selfTotal = sumPoints(tasks, 's'); row.updatedAt = nowIso();
      if (status !== 'nhap') row.submittedAt = nowIso();
      if (status === 'da_chot') { row.mgrTotal = row.finalTotal = sumPoints(tasks, 'm'); row.reviewedAt = nowIso(); row.reviewerId = u.managerId; }
      store.insert('Evaluations', row);
      writeTasks(row.id, u.id, p, tasks);
      store.insert('History', { id: env.uuid(), evalId: row.id, time: nowIso(), userId: u.id, action: status === 'nhap' ? 'Lập phiếu' : 'Nộp phiếu tự đánh giá', note: '' });
    }
    var doers = people.filter(function (u) { return on(u.selfEval) && str(u.managerId); });
    for (var back = 2; back >= 1; back--) {
      var dt = new Date(y, m - back, 1), old = period(dt.getFullYear(), dt.getMonth(), 'khoa');
      doers.forEach(function (u, i) { mk(u, old, 'da_chot', i + back); });
    }
    var st = ['da_chot', 'cho_duyet', 'nhap', 'cho_duyet', 'da_chot', null, 'cho_duyet'];
    doers.forEach(function (u, i) { if (st[i % st.length]) mk(u, cur, st[i % st.length], i); });
    return out;
  }

  /** months: [{ month: 'T10/2026' | 'thuongxuyen', tasks: [{name, product, qty, s, m?}] }].
   * Tạo kỳ tháng nếu chưa có, ghi đè phiếu của người đó trong kỳ. Việc "thường xuyên" vào kỳ đang mở gần nhất, dạng nháp, đánh dấu lặp lại. */
  function importEvals(userId, months) {
    var u = find('Users', userId) || err('Không tìm thấy người dùng ' + userId);
    var report = [];
    (months || []).forEach(function (mo) {
      var period, routine = mo.month === 'thuongxuyen';
      if (routine) {
        period = store.all('Periods').filter(function (p) { return phaseOf(p) === 'mo'; })
          .sort(function (a, b) { return str(b.startDate).localeCompare(str(a.startDate)); })[0];
        if (!period) { report.push('Bỏ qua việc thường xuyên: không có kỳ nào đang mở nhập'); return; }
        var has = evalOf(period.id, u.id);
        if (has && num(has.taskCount) > 0) { report.push('Bỏ qua việc thường xuyên: ' + str(period.name) + ' đã có phiếu, không ghi đè'); return; }
      } else {
        var mm = /^T(\d{1,2})\/(\d{4})$/.exec(str(mo.month));
        if (!mm) return;
        var m2 = (mm[1].length < 2 ? '0' : '') + mm[1], id = 'ky_' + mm[2] + m2, last = new Date(Number(mm[2]), Number(mm[1]), 0).getDate();
        period = find('Periods', id);
        if (!period) {
          store.insert('Periods', { id: id, name: 'Tháng ' + m2 + '/' + mm[2], type: 'thang', startDate: mm[2] + '-' + m2 + '-01', endDate: mm[2] + '-' + m2 + '-' + last, deadline: mm[2] + '-' + m2 + '-' + last, status: 'mo' });
          period = find('Periods', id);
        }
      }
      var tasks = (mo.tasks || []).map(function (t) {
        var c = cleanTask(t, period);
        if (routine) c.repeat = true;
        var m = cleanLevels(t.m);
        if (KPI_calc(m)) c.m = m;
        return c;
      });
      var full = tasks.length && tasks.every(function (t) { return KPI_calc(t.m); });
      var at = stamp();
      tasks.forEach(function (t) { if (KPI_calc(t.m)) { t.mBy = str(u.managerId); t.mDate = at.date; t.mTime = at.time; if (full) t.locked = true; } });
      var status = routine ? 'nhap' : (full ? 'da_chot' : 'cho_duyet');
      var row = headerRow({});
      row.periodId = period.id; row.userId = u.id; row.status = status; row.taskCount = tasks.length;
      row.selfTotal = sumPoints(tasks, 's'); row.updatedAt = nowIso();
      if (!routine) row.submittedAt = nowIso();
      if (full) { row.mgrTotal = row.finalTotal = sumPoints(tasks, 'm'); row.rating = ratingOf(row.finalTotal); row.reviewedAt = nowIso(); row.reviewerId = str(u.managerId); }
      var ev = evalOf(period.id, u.id);
      if (ev) { row.id = ev.id; store.update('Evaluations', ev.id, row); }
      else { row.id = env.uuid(); store.insert('Evaluations', row); }
      writeTasks(row.id, u.id, period, tasks);
      log(row.id, u, 'Nạp từ tệp Excel', tasks.length + ' công việc');
      report.push(str(period.name) + ': ' + tasks.length + ' việc, ' + status + ', tự chấm ' + row.selfTotal + (full ? ', công nhận ' + row.finalTotal : ''));
    });
    return report;
  }

  /** header: các trường của phiếu theo tên trường mới; tasks: danh sách công việc dạng cũ (đọc từ JSON). Bỏ qua nếu mã phiếu đã có. */
  function migrateEval(header, tasks) {
    if (find('Evaluations', header.id)) return 'Bỏ qua (đã có): ' + header.id;
    var period = find('Periods', header.periodId) || { name: str(header.periodId) };
    var at = stamp(), when = str(header.reviewedAt);
    if (/^\d{4}-\d{2}-\d{2}T/.test(when)) { var d = new Date(new Date(when).getTime() + 7 * 3600000).toISOString(); at = { date: d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4), time: d.slice(11, 19) }; }
    var list = (Array.isArray(tasks) ? tasks : []).map(function (t) {
      var c = cleanTask(t, period), m = cleanLevels(t.m);
      if (KPI_calc(m)) { c.m = m; c.mBy = str(header.reviewerId); c.mDate = at.date; c.mTime = at.time; if (t.locked) c.locked = true; }
      return c;
    });
    store.insert('Evaluations', headerRow(header));
    writeTasks(header.id, header.userId, period, list);
    return str(period.name) + ' – ' + str(header.userId) + ': ' + list.length + ' việc, ' + str(header.status);
  }

  function run(req) {
    try {
      var d = req.data || {};
      if (req.action === 'login') return { ok: true, data: login(d) };
      var me = auth(req.token);
      req._me = me; // để ghi nhật ký sử dụng
      if (!Object.prototype.hasOwnProperty.call(A, req.action)) err('Yêu cầu không hợp lệ.');
      if (req.action.indexOf('admin') === 0 && !on(me.isAdmin)) err('Chỉ quản trị viên mới được thực hiện thao tác này.');
      return { ok: true, data: A[req.action](me, d) };
    } catch (e) {
      return { ok: false, error: e.kpi ? e.message : 'Lỗi hệ thống: ' + e.message, code: e.code || '' };
    }
  }
  function handle(req) {
    req = req || {};
    var res = run(req);
    try { logUse(req, res); } catch (e) { /* ghi nhật ký hỏng không được làm hỏng thao tác chính */ }
    return res;
  }

  /* ---------- Nhật ký sử dụng ---------- */
  function nowVn() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' '); } // giờ Việt Nam: 2026-11-15 09:30:00
  function logKeep() { var v = num(cfg('logKeepDays', KPI_LOG.keepDays)); return v >= 7 && v <= 3650 ? Math.round(v) : KPI_LOG.keepDays; }
  function logId(v) { v = str(v).trim(); return /^\d{9,11}$/.test(v) ? ('000' + v).slice(-12) : v; } // Sheet có thể làm mất số 0 đầu của CCCD
  /** Ghi một dòng nhật ký cho thao tác vừa chạy. Không bao giờ ghi mật khẩu hay nội dung dữ liệu, chỉ ghi ai – làm gì – trên đối tượng nào – kết quả. */
  function logUse(req, res) {
    if (!env.usage) return;
    var action = str(req.action), d = req.data || {};
    if (!action || action === 'adminUsage') return;
    var info = KPI_LOG_ACTIONS[action] || ['khac', action];
    var uid = action === 'login' ? cut(str(d.username).trim().toLowerCase(), 20) : req._me ? str(req._me.id) : '';
    if (!uid) return; // phiên hết hạn hoặc yêu cầu không rõ người gọi
    var target = [d.table, d.userId, d.periodId, d.id, d.code, d.taskId].filter(function (x) { return typeof x === 'string' || typeof x === 'number'; })
      .map(function (x) { return cut(x, 40); }).filter(Boolean).join(' · ');
    if (info[0] === 'xem' && res.ok && !env.usage.once(uid + '|' + action + '|' + target, KPI_LOG.viewGap)) return;
    env.usage.add([nowVn(), uid, info[0], action, cut(target, 120), res.ok ? '' : cut(res.error, 120)]);
    if (env.locked && env.usage.once('gop-nhat-ky', 21600)) compactLog();
  }
  /** Gộp các dòng nhật ký quá hạn lưu (hoặc vượt số dòng tối đa) thành số lượt theo tháng rồi xoá. Chỉ gọi khi đang giữ khoá ghi. */
  function compactLog() {
    var head = env.usage.head(), day = new Date(Date.now() + 7 * 3600000 - logKeep() * 86400000).toISOString().slice(0, 10);
    if (!head.count || (str(head.first) >= day && head.count <= KPI_LOG.maxRows)) return 0;
    var rows = env.usage.rows(), n = 0;
    while (n < rows.length && str(rows[n][0]) < day) n++;
    if (rows.length - n > KPI_LOG.maxRows) n = rows.length - KPI_LOG.maxRows;
    if (!n) return 0;
    var map = {}, order = [];
    env.usage.sums().forEach(function (r) { var k = [str(r[0]), logId(r[1]), str(r[3])].join('|'); if (!map[k]) order.push(k); map[k] = [str(r[0]), logId(r[1]), str(r[2]), str(r[3]), num(r[4]), num(r[5])]; });
    rows.slice(0, n).forEach(function (r) {
      var k = [str(r[0]).slice(0, 7), logId(r[1]), str(r[3])].join('|');
      if (!map[k]) { order.push(k); map[k] = [str(r[0]).slice(0, 7), logId(r[1]), str(r[2]), str(r[3]), 0, 0]; }
      map[k][4]++; if (str(r[5])) map[k][5]++;
    });
    env.usage.setSums(order.sort().map(function (k) { return map[k].map(String); }));
    env.usage.drop(n);
    return n;
  }
  /** Số liệu cho trang Nhật ký sử dụng của quản trị: khối số lượt theo ngày – người – chức năng trong khoảng ngày, kèm các dòng chi tiết mới nhất. */
  A.adminUsage = function (me, d) {
    if (!env.usage) err('Máy chủ này chưa bật ghi nhật ký sử dụng.');
    if (has(d.keepDays)) { var kd = Math.round(num(d.keepDays)); if (!(kd >= 7 && kd <= 3650)) err('Số ngày lưu nhật ký chi tiết phải từ 7 đến 3650.'); setCfg('logKeepDays', kd); }
    if (env.locked) compactLog();
    var today = nowVn().slice(0, 10);
    var to = DATE.test(str(d.to)) ? str(d.to) : today;
    var from = DATE.test(str(d.from)) ? str(d.from) : new Date(Date.parse(to + 'T00:00:00Z') - 29 * 86400000).toISOString().slice(0, 10);
    if (from > to) err('Ngày bắt đầu phải trước ngày kết thúc.');
    var rows = env.usage.rows(), cube = {}, detail = [];
    rows.forEach(function (r) {
      var t = str(r[0]), dayOf = t.slice(0, 10);
      if (dayOf < from || dayOf > to) return;
      var uid = logId(r[1]), ok = str(r[5]) ? 0 : 1, k = [dayOf, uid, str(r[3]), ok].join('|');
      var c = cube[k] || (cube[k] = [dayOf, uid, str(r[3]), ok, 0, '']);
      c[4]++; c[5] = t;
      detail.push([t, uid, str(r[2]), str(r[3]), str(r[4]), str(r[5])]);
    });
    var out = Object.keys(cube).map(function (k) { return cube[k]; });
    env.usage.sums().forEach(function (r) { // các tháng đã gộp: chỉ còn số lượt theo tháng
      var m = str(r[0]);
      if (m < from.slice(0, 7) || m > to.slice(0, 7)) return;
      var all = num(r[4]), bad = num(r[5]);
      if (all - bad > 0) out.push([m, logId(r[1]), str(r[3]), 1, all - bad, '']);
      if (bad > 0) out.push([m, logId(r[1]), str(r[3]), 0, bad, '']);
    });
    return { from: from, to: to, keepDays: logKeep(), maxRows: KPI_LOG.maxRows, viewGap: KPI_LOG.viewGap, stored: rows.length, inRange: detail.length,
      cube: out, detail: detail.slice(-1000).reverse() };
  };

  return { handle: handle, pp2Import: pp2Import, pp2Migrate: pp2Migrate, seed: seed, importEvals: importEvals, migrateEval: migrateEval, resetAllPasswords: resetAllPasswords, importLibrary: importLibrary, importCatalog: importCatalog };
}
