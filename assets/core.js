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
  Users: ['id', 'unitId', 'fullName', 'title', 'phone', 'email', 'level', 'managerId', 'selfEval', 'isAdmin', 'active', 'mustChange', 'passHash', 'salt', 'isStaff', 'isVoter'],
  Periods: ['id', 'name', 'type', 'startDate', 'endDate', 'deadline', 'status'],
  // Phiếu (tổng hợp): mỗi người mỗi kỳ một dòng: trạng thái, tổng điểm, nhận xét
  Evaluations: ['id', 'periodId', 'userId', 'status', 'taskCount', 'selfTotal', 'mgrTotal', 'finalTotal', 'rating',
    'selfComment', 'mgrComment', 'submittedAt', 'reviewedAt', 'reviewerId', 'updatedAt', 'fbCount'],
  // Cán bộ tự đánh giá: mỗi công việc một dòng, cột như biểu Excel mẫu
  Tasks: ['userId', 'period', 'evalId', 'id', 'order', 'name', 'product', 'qty', 'month', 'a', 'b', 'c', 'd', 'e', 's', 'n', 'point',
    'link', 'repeat', 'from', 'pm', 'evaluated', 'evaluatedAt', 'updatedAt', 'note', 'by',
    'deadline', 'doneDate', 'progress', 'bonus', 'feedback', 'feedbackAt', 'feedbackDone'],
  // Người phụ trách đánh giá: mỗi công việc một dòng, độc lập với phần cán bộ tự chấm
  Reviews: ['userId', 'period', 'evalId', 'id', 'order', 'name', 'product', 'qty', 'month', 'a', 'b', 'c', 'd', 'e', 's', 'n', 'point',
    'reviewerId', 'date', 'time', 'lock', 'note', 'progress', 'doneDate', 'bonus', 'overTime', 'overQuality'],
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
  Library: 'khocongviecmau', Evidence: 'MinhChung', Ratings: 'XepLoai' };
var KPI_LABELS = {
  Units: { id: 'Mã đơn vị', name: 'Tên đơn vị', parentId: 'Mã đơn vị cha', order: 'Thứ tự' },
  Users: {
    id: 'CCCD', unitId: 'Mã đơn vị', fullName: 'Họ tên', title: 'Chức vụ', phone: 'Số điện thoại', email: 'Email',
    level: 'Cấp', managerId: 'CCCD người phụ trách', selfEval: 'Tự kê công việc', isAdmin: 'Quản trị', active: 'Hoạt động',
    mustChange: 'Phải đổi mật khẩu', passHash: 'Mật khẩu (đã băm)', salt: 'Muối băm',
    isStaff: 'Tham mưu tổng hợp', isVoter: 'Thành viên biểu quyết'
  },
  Periods: { id: 'Mã kỳ', name: 'Tên kỳ', type: 'Loại', startDate: 'Từ ngày', endDate: 'Đến ngày', deadline: 'Hạn nộp', status: 'Trạng thái' },
  Evaluations: {
    id: 'Mã phiếu', periodId: 'Mã kỳ', userId: 'CCCD', status: 'Trạng thái', taskCount: 'Số công việc', selfTotal: 'Điểm tự chấm',
    mgrTotal: 'Điểm người phụ trách chấm', finalTotal: 'Điểm được công nhận', rating: 'Xếp loại', selfComment: 'Tự nhận xét', mgrComment: 'Nhận xét của người phụ trách',
    submittedAt: 'Lúc nộp', reviewedAt: 'Lúc đánh giá', reviewerId: 'CCCD người đánh giá', updatedAt: 'Cập nhật', fbCount: 'Số phản hồi chờ xem xét'
  },
  Tasks: {
    userId: 'CCCD', period: 'Kỳ báo cáo', evalId: 'Mã phiếu', id: 'Mã công việc', order: 'TT', name: 'Tên công việc', product: 'Sản phẩm',
    qty: 'Số lượng sản phẩm', month: 'Tháng thực hiện', a: 'A - Khối lượng, thời gian lao động tiêu chuẩn', b: 'B - Mức độ nghiên cứu, tư duy và phán đoán chuyên môn',
    c: 'C - Phạm vi phối hợp', d: 'D - Mức độ ảnh hưởng, trách nhiệm và rủi ro', e: 'E - Mức độ đầy đủ, rõ ràng và ổn định của đầu vào',
    s: 'S', n: 'N', point: 'Điểm của N', link: 'Minh chứng', repeat: 'Lặp lại', from: 'Chuyển từ kỳ', pm: 'Kết quả kỳ trước (A,B,C,D,E)',
    evaluated: 'Đã đánh giá', evaluatedAt: 'Ngày giờ đánh giá', updatedAt: 'Cập nhật', note: 'Nhận xét của người đánh giá', by: 'Người thêm việc (CCCD)',
    deadline: 'Hạn hoàn thành', doneDate: 'Ngày hoàn thành', progress: 'Tiến độ (%)', bonus: 'Điểm thưởng đề xuất (%)',
    feedback: 'Phản hồi của cán bộ', feedbackAt: 'Lúc phản hồi', feedbackDone: 'Phản hồi đã xem xét'
  },
  Reviews: {
    userId: 'CCCD', period: 'Kỳ đánh giá', evalId: 'Mã phiếu', id: 'Mã công việc', order: 'TT', name: 'Tên công việc', product: 'Sản phẩm',
    qty: 'Số lượng sản phẩm', month: 'Tháng thực hiện', a: 'A - Khối lượng, thời gian lao động tiêu chuẩn', b: 'B - Mức độ nghiên cứu, tư duy và phán đoán chuyên môn',
    c: 'C - Phạm vi phối hợp', d: 'D - Mức độ ảnh hưởng, trách nhiệm và rủi ro', e: 'E - Mức độ đầy đủ, rõ ràng và ổn định của đầu vào',
    s: 'S', n: 'N', point: 'Điểm của N', reviewerId: 'CCCD người đánh giá', date: 'Ngày đánh giá', time: 'Giờ đánh giá', lock: 'Khoá/Mở', note: 'Nhận xét',
    progress: 'Tiến độ được xác nhận (%)', doneDate: 'Ngày hoàn thành được xác nhận', bonus: 'Điểm thưởng (%)', overTime: 'Vượt tiến độ', overQuality: 'Vượt chất lượng'
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
  maxBonus: 5    // điểm thưởng tối đa của một công việc, tính bằng % điểm công việc đó
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
  function bonusOf(v) { return r2(Math.min(Math.max(num(v), 0), rule().maxBonus)); }
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
  function pub(u, full) {
    var o = {
      id: str(u.id), unitId: str(u.unitId), fullName: str(u.fullName), title: str(u.title), level: str(u.level) || 'canbo',
      managerId: str(u.managerId), selfEval: on(u.selfEval), isAdmin: on(u.isAdmin), active: on(u.active), mustChange: on(u.mustChange),
      isStaff: on(u.isStaff), isVoter: on(u.isVoter)
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
    if (str(me.id) === str(owner.id) || on(me.isAdmin)) return true;
    return !!subtreeIds(me.id, map || reportsMap())[str(owner.id)];
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
  function cleanTask(t, period) {
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
    if (DATE.test(str(t.deadline))) out.deadline = str(t.deadline);   // hạn hoàn thành
    if (DATE.test(str(t.doneDate))) out.doneDate = str(t.doneDate);   // ngày hoàn thành thực tế
    if (has(t.progress)) out.progress = pct(t.progress);              // tiến độ %, để trống coi như đã xong
    if (bonusOf(t.bonus)) out.bonus = bonusOf(t.bonus);               // điểm thưởng cán bộ đề xuất (%)
    if (on(t.repeat)) out.repeat = true;                       // việc lặp lại: tự đưa sang kỳ sau
    if (KPI_calc(cleanLevels(t.pm))) out.pm = cleanLevels(t.pm); // mức người phụ trách đã chấm ở kỳ trước
    if (cut(t.from, 60)) out.from = cut(t.from, 60);             // tên kỳ mà việc này được chuyển sang
    return out;
  }
  /** Điểm của phiếu = tổng (số lượng × điểm của N) của từng công việc. key: 's' tự chấm, 'm' người phụ trách chấm. */
  function sumPoints(tasks, key) {
    var sum = 0;
    tasks.forEach(function (t) { var c = KPI_calc(t[key]); if (c) sum += num(t.qty) * c.point * (key === 'm' ? 1 + num(t.mBonus) / 100 : 1); });
    return r2(sum);
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
      if (str(r.by)) t.by = str(r.by);                    // việc do người phụ trách thêm cho cấp dưới
      if (str(r.deadline)) t.deadline = str(r.deadline);
      if (str(r.doneDate)) t.doneDate = str(r.doneDate);
      if (str(r.progress) !== '') t.progress = pct(r.progress);
      if (num(r.bonus)) t.bonus = num(r.bonus);
      if (str(r.feedback)) { t.fb = str(r.feedback); t.fbAt = str(r.feedbackAt); if (str(r.feedbackDone)) t.fbDone = true; } // cán bộ phản hồi không tán thành
      if (str(r.note)) t.note = str(r.note);
      var v = reviews[t.id];
      if (v) {
        if (str(v.note)) t.note = str(v.note);            // nhận xét của người đánh giá cho riêng việc này
        var m = levelsOf(v);
        if (KPI_calc(m)) { t.m = m; t.mBy = str(v.reviewerId); t.mDate = str(v.date); t.mTime = str(v.time); if (str(v.lock) === 'Khoá') t.locked = true;
          if (str(v.progress) !== '') t.mProgress = pct(v.progress);
          if (str(v.doneDate)) t.mDone = str(v.doneDate);
          if (num(v.bonus)) t.mBonus = num(v.bonus);
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
    function base(t, i, lv) {
      var c = KPI_calc(lv), row = { userId: str(userId), period: pname, evalId: str(evalId), id: t.id, order: i + 1, name: t.name, product: t.product, qty: t.qty, month: t.month };
      KEYS.forEach(function (k, j) { row[k] = levelText(j, (lv || [])[j]); });
      row.s = c ? c.s : ''; row.n = c ? c.n : ''; row.point = c ? c.point : '';
      return row;
    }
    store.replaceGroup('Tasks', 'evalId', evalId, tasks.map(function (t, i) {
      var row = base(t, i, t.s), done = !!(t.locked && KPI_calc(t.m));
      row.link = t.link || ''; row.repeat = t.repeat ? 'Có' : ''; row.from = t.from || ''; row.pm = KPI_calc(t.pm) ? t.pm.join(',') : '';
      row.evaluated = done ? 'Có' : ''; row.evaluatedAt = done ? (str(t.mDate) + ' ' + str(t.mTime)).trim() : ''; row.updatedAt = now;
      row.note = t.note || ''; row.by = t.by || '';
      row.deadline = t.deadline || ''; row.doneDate = t.doneDate || ''; row.progress = has(t.progress) ? t.progress : ''; row.bonus = t.bonus || '';
      row.feedback = t.fb || ''; row.feedbackAt = t.fb ? str(t.fbAt) : ''; row.feedbackDone = t.fb && t.fbDone ? 'Có' : '';
      return row;
    }));
    var reviewed = [];
    tasks.forEach(function (t, i) {
      if (!KPI_calc(t.m) && !t.note) return;
      var row = base(t, i, t.m);
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
    tasks.forEach(function (t) { var c = t.locked ? KPI_calc(t.m) : null; if (c) sum += num(t.qty) * c.point * (1 + num(t.mBonus) / 100); });
    return r2(sum);
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
  function allLocked(tasks) { return tasks.length > 0 && tasks.every(function (t) { return t.locked && KPI_calc(t.m); }); }
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
        id: '', status: owner && !on(owner.selfEval) ? 'khong_ke' : 'chua_lap', tasks: [], taskCount: 0, selfTotal: null, mgrTotal: null,
        finalTotal: null, rating: '', selfComment: '', mgrComment: '', submittedAt: '', reviewedAt: ''
      };
    }
    function n(v) { return has(v) ? num(v) : null; }
    return {
      id: str(ev.id), status: str(ev.status), tasks: withTasks ? loadTasks(ev.id) : [], taskCount: num(ev.taskCount),
      selfTotal: n(ev.selfTotal), mgrTotal: n(ev.mgrTotal), finalTotal: n(ev.finalTotal), rating: str(ev.rating),
      selfComment: str(ev.selfComment), mgrComment: str(ev.mgrComment), submittedAt: str(ev.submittedAt), reviewedAt: str(ev.reviewedAt)
    };
  }
  function perms(me, ev, owner, period) {
    var ph = phaseOf(period), open = ph !== 'khoa', input = ph === 'mo';
    var st = ev ? str(ev.status) : 'chua_lap';
    var self = str(me.id) === str(owner.id), mine = !self && str(owner.managerId) === str(me.id);
    var canSelf = self && on(owner.selfEval);
    var selfScore = canSelf && rank(owner) <= KPI_LEVELS.truong.rank; // trưởng đơn vị, thủ trưởng: tự chấm cho mình, mức tự chọn là kết quả
    return {
      selfScore: selfScore,
      // cán bộ nhập khi kỳ còn mở nhập; riêng phiếu được người phụ trách cho đánh giá lại thì sửa được cả sau khi chốt nhập
      canEdit: canSelf && ((input && (selfScore || st === 'chua_lap' || st === 'nhap' || st === 'da_chot')) || (open && st === 'yeu_cau_sua')),
      addOnly: canSelf && !selfScore && input && st === 'da_chot', // phiếu đã chấm: chỉ được bổ sung việc mới
      canReview: open && mine && st === 'cho_duyet',
      // người phụ trách trực tiếp: chấm từng việc, ghi nhận xét, thêm việc cho cấp dưới ở mọi trạng thái phiếu khi kỳ chưa khoá
      canScore: open && mine && on(owner.selfEval),
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
    return { token: makeToken(u), boot: A.bootstrap(u) };
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

  A.bootstrap = function (me) {
    return {
      user: pub(me, true),
      hasReports: !!(reportsMap()[str(me.id)] || []).length,
      units: unitsFor(me).map(function (u) { return { id: str(u.id), name: str(u.name), parentId: str(u.parentId), order: num(u.order) }; }),
      periods: store.all('Periods').slice().sort(function (a, b) { return str(b.startDate).localeCompare(str(a.startDate)); }).map(periodOut),
      config: publicConfig(),
      canUpload: !!env.evidence
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
    var users = store.all('Users').filter(function (u) { return on(u.active) && (!scope || scope[str(u.id)] || str(u.id) === str(me.id)); });
    var evs = {};
    store.all('Evaluations').forEach(function (e) { evs[str(e.periodId) + '|' + str(e.userId)] = e; });
    var kpi = kpiCalculator(period.id, map);
    var rows = users.map(function (u) {
      var ev = evs[str(period.id) + '|' + str(u.id)];
      var o = evOut(ev, u), p = perms(me, ev, u, period), k = kpi(u);
      return {
        user: pub(u), evalId: o.id, status: o.status, taskCount: o.taskCount, selfTotal: o.selfTotal, mgrTotal: o.mgrTotal,
        finalTotal: o.finalTotal, rating: o.status === 'da_chot' ? o.rating : '', submittedAt: o.submittedAt, canReview: p.canReview, fb: ev ? num(ev.fbCount) : 0,
        kpi: k.kpi, people: k.people, done: k.done, reports: (map[str(u.id)] || []).length
      };
    });
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
    var rated = find('Ratings', str(period.id) + '|' + str(owner.id));
    out.result = rated && KPI_RATE[str(rated.result)] ? KPI_RATE[str(rated.result)] : '';
    // Kết quả của một người trong cây đánh giá = việc tự thực hiện đã được công nhận + kết quả của những người mình phụ trách.
    // Trả kèm danh sách cấp dưới trực tiếp để hiện ngay trên phiếu của người đó.
    var map = reportsMap(), kc = kpiCalculator(period.id, map), evs = {};
    store.all('Evaluations').forEach(function (e) { if (str(e.periodId) === str(period.id)) evs[str(e.userId)] = e; });
    out.team = (map[str(owner.id)] || []).slice().sort(function (a, b) { return rank(a) - rank(b) || str(a.fullName).localeCompare(str(b.fullName), 'vi'); })
      .map(function (u) {
        var e = evs[str(u.id)], k = kc(u);
        return {
          user: pub(u), status: e ? str(e.status) : (on(u.selfEval) ? 'chua_lap' : 'khong_ke'), taskCount: e ? num(e.taskCount) : 0,
          finalTotal: e && e.status === 'da_chot' ? num(e.finalTotal) : null, mgrTotal: e && has(e.mgrTotal) ? num(e.mgrTotal) : null, kpi: k.kpi, people: k.people, done: k.done, reports: (map[str(u.id)] || []).length
        };
      });
    var ko = kc(owner);
    out.kpi = { own: ev && has(ev.mgrTotal) ? num(ev.mgrTotal) : 0, total: ko.kpi, people: ko.people, done: ko.done };
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
    if (KPI_calc(t.m)) c.pm = cleanLevels(t.m);
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
    var old = {}, seen = {}, oldList = ev ? loadTasks(ev.id) : [];
    oldList.forEach(function (t) { old[t.id] = t; });
    if (p0.addOnly && !d.submit) err('Phiếu đã được người phụ trách chấm. Anh/chị chỉ có thể bổ sung công việc mới rồi bấm "Nộp bổ sung".');
    // việc đã được người phụ trách chấm thì giữ nguyên, cán bộ không sửa, không xoá được
    var locked = p0.selfScore ? [] : oldList.filter(function (t) { return t.locked; }); // người tự chấm sửa được cả việc đã chấm của mình
    var tasks = locked.concat((Array.isArray(d.tasks) ? d.tasks : []).slice(0, 400)
      .filter(function (t) { return p0.selfScore || !(t && old[t.id] && old[t.id].locked); })
      .map(function (t) { return cleanTask(t, period); })
      .filter(function (t) { return t.name || t.s.some(function (v) { return v; }); }));
    tasks.forEach(function (t, i) {
      if (t.locked) { seen[t.id] = true; return; }
      if (seen[t.id]) t.id = env.uuid();
      seen[t.id] = true;
      if (old[t.id] && old[t.id].note) t.note = old[t.id].note;
      if (old[t.id] && old[t.id].by) t.by = old[t.id].by;
      if (old[t.id] && old[t.id].m) { // giữ điểm người phụ trách đã chấm khi phiếu bị trả lại
        t.m = old[t.id].m; t.mBy = old[t.id].mBy; t.mDate = old[t.id].mDate; t.mTime = old[t.id].mTime;
        ['mProgress', 'mDone', 'mBonus', 'ot', 'oq'].forEach(function (k) { if (has(old[t.id][k])) t[k] = old[t.id][k]; });
      }
      if (old[t.id] && old[t.id].fb) { t.fb = old[t.id].fb; t.fbAt = old[t.id].fbAt; if (old[t.id].fbDone) t.fbDone = true; }
      if (!d.submit) return;
      if (!t.name) err('Công việc số ' + (i + 1) + ' chưa ghi tên công việc.');
      if (!KPI_calc(t.s) && !(old[t.id] && old[t.id].by && KPI_calc(old[t.id].m))) err('Công việc số ' + (i + 1) + ' chưa chọn đủ 5 tiêu chí A, B, C, D, E.');
    });
    if (d.submit) {
      if (!tasks.length) err('Phiếu chưa có công việc nào.');
      if (p0.selfScore) { // tự chấm: mức tự chọn chính là kết quả, ghi nhận ngay
        var at = stamp();
        tasks.forEach(function (t) {
          if (old[t.id] && old[t.id].by && KPI_calc(old[t.id].m) && !KPI_calc(t.s)) { t.m = old[t.id].m; } // việc cấp trên thêm: giữ mức cấp trên chấm
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
        t.m = KPI_calc(m) ? m : (KPI_calc(t.m) ? t.m : t.s); // không chấm lại thì lấy theo mức đã có
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
      err(phaseOf(period) === 'khoa' ? 'Kỳ đánh giá đã khoá.' : 'Chỉ người phụ trách trực tiếp mới chấm điểm được cho cán bộ này.');
    }
    var tasks = ev ? loadTasks(ev.id) : [], byId = {}, at = stamp(), unlock = d.mode === 'note', n = 0, added = 0;
    tasks.forEach(function (t) { byId[t.id] = t; });
    (Array.isArray(d.tasks) ? d.tasks : []).slice(0, 400).forEach(function (x) {
      x = x || {};
      var t = byId[str(x.id)], note = cut(x.note, 1000);
      if (!t) {
        if (!x.isNew || unlock) return;
        t = cleanTask({ name: x.name, product: x.product, qty: x.qty, month: x.month, deadline: x.deadline }, period);
        if (!t.name) err('Công việc thêm cho cấp dưới chưa ghi tên.');
        t.by = str(me.id);
        tasks.push(t); added++;
      }
      var label = '“' + t.name.slice(0, 50) + (t.name.length > 50 ? '…' : '') + '”';
      if (unlock) {
        if (!note) err('Hãy ghi nhận xét cho công việc ' + label + ' để cán bộ biết cần điều chỉnh gì.');
        t.note = note; delete t.locked;
      } else {
        var m = cleanLevels(x.m);
        if (!KPI_calc(m)) err('Công việc ' + label + ' chưa chọn đủ 5 mức A, B, C, D, E.');
        t.m = m; t.note = note; t.locked = true; t.mBy = str(me.id); t.mDate = at.date; t.mTime = at.time;
        confirmTask(t, x);
      }
      n++;
    });
    if (!n) err('Chưa chọn công việc nào.');
    var cur = ev ? str(ev.status) : 'nhap', done = allLocked(tasks);
    var status = done ? 'da_chot' : unlock ? (cur === 'cho_duyet' || cur === 'da_chot' ? 'yeu_cau_sua' : cur) : (cur === 'da_chot' ? 'cho_duyet' : cur);
    var patch = {
      status: status, taskCount: tasks.length, selfTotal: sumPoints(tasks, 's'), updatedAt: nowIso(),
      mgrTotal: tasks.some(function (t) { return t.locked; }) ? sumLocked(tasks) : '',
      finalTotal: done ? sumLocked(tasks) : '', rating: done ? ratingOf(sumLocked(tasks)) : '', fbCount: fbCount(tasks)
    };
    if (done) { patch.reviewerId = me.id; patch.reviewedAt = nowIso(); }
    var id;
    if (ev) { id = ev.id; store.update('Evaluations', id, patch); }
    else { id = env.uuid(); patch.id = id; patch.periodId = period.id; patch.userId = owner.id; store.insert('Evaluations', headerRow(patch)); }
    writeTasks(id, owner.id, period, tasks);
    log(id, me, unlock ? 'Nhận xét, cho sửa lại ' + n + ' công việc' : 'Chấm điểm ' + n + ' công việc' + (added ? ' (thêm mới ' + added + ')' : ''),
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
    try { if (env.evidence && str(x.fileId)) env.evidence.remove(str(x.fileId)); } catch (e) { /* tệp đã bị xoá tay trên Drive: vẫn bỏ dòng */ }
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
        var v = rv[eid + '|' + str(r.id)], m = v && str(v.lock) === 'Khoá' ? KPI_calc(levelsOf(v)) : null, sc = KPI_calc(levelsOf(r));
        var w = (num(r.qty) || 1) * (m ? m.point : sc ? sc.point : KPI_MODEL.nLevels[0].point), prog = m ? (str(v.progress) !== '' ? pct(v.progress) : 100) : 0;
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

  function handle(req) {
    try {
      req = req || {};
      var d = req.data || {};
      if (req.action === 'login') return { ok: true, data: login(d) };
      var me = auth(req.token);
      if (!Object.prototype.hasOwnProperty.call(A, req.action)) err('Yêu cầu không hợp lệ.');
      if (req.action.indexOf('admin') === 0 && !on(me.isAdmin)) err('Chỉ quản trị viên mới được thực hiện thao tác này.');
      return { ok: true, data: A[req.action](me, d) };
    } catch (e) {
      return { ok: false, error: e.kpi ? e.message : 'Lỗi hệ thống: ' + e.message, code: e.code || '' };
    }
  }

  return { handle: handle, seed: seed, importEvals: importEvals, migrateEval: migrateEval, resetAllPasswords: resetAllPasswords, importLibrary: importLibrary };
}
