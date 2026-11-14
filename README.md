# KPI CÁN BỘ CÔNG CHỨC

Phần mềm đánh giá KPI dành cho cán bộ công chức.

Trang web tĩnh (GitHub Pages) + máy chủ Google Apps Script (dự án `KPIMTTQQTRI`) + dữ liệu trong bảng tính Google `KPIMTTQQTRI`.

## Cấu trúc

| Tệp | Vai trò |
|---|---|
| `index.html`, `assets/` | Giao diện, đưa lên GitHub Pages |
| `assets/config.js` | Nơi dán đường dẫn máy chủ (`API_URL`) |
| `assets/core.js` | Lõi nghiệp vụ: phân quyền, cây phụ trách, tính điểm, KPI tổng hợp |
| `apps-script/Code.gs` | Máy chủ Apps Script: đọc/ghi Google Sheet |
| `apps-script/Core.gs` | **Bản sao y nguyên** của `assets/core.js` |
| `apps-script/Seed.gs` | Tài khoản quản trị khởi đầu (mật khẩu dạng băm). **Không đưa lên GitHub** |
| `apps-script/appsscript.json` | Tệp cấu hình dự án Apps Script |

## Danh mục

- **Đơn vị** (trang tính `DonVi`): Mã đơn vị, Tên đơn vị, Mã đơn vị cha, Thứ tự. Tổ chức dạng cây.
- **Người dùng** (trang tính `NguoiDung`): CCCD (dùng làm tên đăng nhập), Mã đơn vị, Họ tên, Chức vụ, Số điện thoại, Email, cùng các cột phân quyền:
  - **Cấp**: Thủ trưởng cơ quan, Trưởng đơn vị, Phó đơn vị, Cá nhân.
  - **Người phụ trách đánh giá**: CCCD của người đánh giá phiếu của người này. Chỉ chọn được người từ cấp phó trở lên.
  - **Tự kê công việc**: có/không. Mặc định Phó đơn vị và Cá nhân có; Trưởng đơn vị và Thủ trưởng không.
  - **Quản trị**: người được khai danh mục và phân quyền.

## Nguyên tắc đánh giá KPI

1. Cá nhân tự kê công việc và tự chấm 5 tiêu chí A–E cho từng việc, rồi nộp phiếu.
2. Người phụ trách (được quản trị viên khai, từ cấp phó trở lên) chấm lại A–E và **công nhận kết quả**, hoặc **yêu cầu sửa** kèm lý do.
3. KPI tổng hợp của một người = điểm phiếu của chính người đó đã được công nhận + KPI tổng hợp của những người do người đó phụ trách. Từ đó:
   - **Phó đơn vị** = công việc tự làm + các cá nhân mình phụ trách.
   - **Trưởng đơn vị** = tổng KPI của các cấp phó (và những người mình trực tiếp phụ trách).
   - **Thủ trưởng cơ quan** = tổng KPI của các đơn vị.
4. **Quy đổi bình quân** = KPI tổng hợp ÷ số người tự kê công việc trong phạm vi. Đây là cách quy đổi do người dựng hệ thống chọn; nếu cơ quan quy đổi theo cách khác thì sửa ở `assets/app.js` (các chỗ ghi "Quy đổi bình quân").

Trên phiếu của người có cấp dưới, dưới bảng công việc tự thực hiện có thẻ **Kết quả KPI**: liệt kê từng người do người đó phụ trách kèm kết quả, và tổng KPI = việc tự thực hiện + kết quả cấp dưới. Người phụ trách cấp trên mở phiếu sẽ thấy cả hai phần.

Quyền xem: mỗi người thấy phiếu của mình; người phụ trách thấy mọi người nằm dưới mình trong cây phụ trách (mọi cấp); quản trị viên thấy tất cả. Chỉ người phụ trách trực tiếp mới đánh giá được phiếu. Quản trị viên có thể mở lại một phiếu đã công nhận để đánh giá lại.

## Cách lưu phiếu trong bảng tính

Phần cán bộ tự đánh giá và phần người phụ trách đánh giá nằm ở hai trang tính độc lập, mỗi công việc một dòng, cột như biểu Excel mẫu:

| Trang tính | Nội dung | Cột chính |
|---|---|---|
| `PhieuDanhGia` | Cán bộ tự đánh giá | CCCD, Kỳ báo cáo, Mã phiếu, Mã công việc, TT, Tên công việc, Sản phẩm, Số lượng, Tháng thực hiện, A–E, S, N, Điểm của N, Minh chứng, Lặp lại, Đã đánh giá, Ngày giờ đánh giá |
| `DanhGia` | Người phụ trách đánh giá | CCCD, Kỳ đánh giá, Mã phiếu, Mã công việc, các cột công việc, A–E, S, N, Điểm của N, CCCD người đánh giá, Ngày đánh giá, Giờ đánh giá, Khoá/Mở |
| `TongHopPhieu` | Mỗi người mỗi kỳ một dòng | Trạng thái, số công việc, điểm tự chấm, điểm được công nhận, nhận xét |

- Các cột A–E ghi dạng `2. Trên 01 đến 02 giờ` (số đứng đầu là điểm của mức).
- Hai trang nối với nhau bằng **Mã công việc**; một phiếu gom theo **Mã phiếu**.
- Máy chủ chỉ tìm và đọc/ghi đúng các dòng của phiếu đang thao tác, không nạp cả trang tính.
- Xem, lọc, thống kê trực tiếp trên bảng tính thì được. **Không sửa tay** các cột mã, A–E, Khoá/Mở: phần mềm ghi lại cả nhóm dòng mỗi lần lưu.
- Nâng cấp từ bản cũ (công việc dạng JSON): chạy hàm `migrateV2()` một lần; trang cũ được giữ lại với tên `PhieuDanhGia_cu`.

## Kỳ đánh giá, chốt nhập và khoá việc đã chấm

- Mỗi kỳ có **hạn chốt nhập** (mặc định ngày cuối kỳ). Qua hạn, hoặc khi quản trị viên đặt trạng thái "Đã chốt nhập", cán bộ không nhập được nữa; người phụ trách vẫn chấm được. "Đã khoá hẳn" thì không ai thay đổi được.
- Công việc đã được người phụ trách chấm thì bị khoá (🔒): cán bộ không sửa, không xoá được. Khi kỳ còn mở nhập, cán bộ vẫn thêm được việc mới rồi bấm **Nộp bổ sung**.
- Muốn sửa việc đã chấm, người phụ trách trực tiếp bấm **Cho đánh giá lại** (hoặc **Yêu cầu sửa**); phiếu đó sửa được cả khi kỳ đã chốt nhập.

## Người phụ trách chấm theo từng công việc

- Mở phiếu của cấp dưới: mỗi công việc có ô chọn ở đầu dòng, khối A–E của lãnh đạo, ô **Nhận xét** và nút **Chấm điểm** ở cuối dòng.
- Mức A–E được điền sẵn: việc lặp lại lấy kết quả chấm kỳ trước, việc khác lấy theo mức cán bộ tự chọn. Người phụ trách đổi mức nào cũng được, kể cả với việc đã chấm.
- **Chấm điểm** (từng dòng) hoặc **Chấm điểm các việc đã chọn**: lưu điểm và khoá các việc đó. Khi mọi việc của phiếu đã được chấm, phiếu chuyển sang "Đã đánh giá" và điểm được tính vào KPI.
- **Gửi nhận xét, cho sửa lại**: lưu nhận xét và mở khoá các việc đã chọn để cán bộ điều chỉnh; cán bộ thấy nhận xét ngay tại công việc đó trên phiếu của mình.
- **Thêm công việc cho cấp dưới**: người phụ trách ghi tên việc, chấm A–E rồi bấm Chấm điểm; việc được đưa thẳng vào phiếu của cấp dưới (kể cả khi cấp dưới chưa lập phiếu), có nhãn "Người phụ trách thêm". Cột tự chấm của việc này để trống và không tính vào điểm tự chấm.
- Trong bảng tính: nhận xét nằm ở cột "Nhận xét" của `DanhGia` và "Nhận xét của người đánh giá" của `PhieuDanhGia`; việc do người phụ trách thêm có CCCD ở cột "Người thêm việc (CCCD)". Sau khi nâng cấp có thêm cột, chạy hàm `upgradeSheets()` một lần.

## Việc lặp lại và lấy việc từ kỳ trước

- Trên phiếu, tích **Việc lặp lại** cho những việc làm thường xuyên. Sang kỳ mới, khi cán bộ mở phiếu chưa lập, các việc này tự hiện sẵn kèm mức tự chấm.
- Nút **Lấy việc từ kỳ trước**: chọn một kỳ đã có phiếu, tích các việc cần chuyển sang kỳ hiện tại.
- Việc chuyển sang nhớ kết quả người phụ trách đã chấm ở kỳ gốc. Khi chấm, người phụ trách bấm **Lấy kết quả kỳ trước** để dùng lại, hoặc **Lấy theo mức tự chấm**, rồi chỉ chỉnh chỗ cần thiết.

## Tổng quan (dashboard)

- Số đơn vị, số cán bộ công chức, số đã được đánh giá, số chưa; chọn kỳ ở góc trên để thống kê theo kỳ.
- Biểu đồ tiến độ chung và tiến độ từng đơn vị; bấm vào một đơn vị để xem tiến độ từng cá nhân.
- Danh sách người phụ trách: bấm vào cấp trưởng, cấp phó để xem các cá nhân họ phụ trách.
- Thẻ **Nhắc nhở**: ai chưa nộp, người phụ trách nào còn phiếu chờ chấm; có nút chép nội dung để gửi qua Zalo, email (phần mềm không tự gửi tin).

## Dữ liệu mẫu

`apps-script/DuLieuMau.gs` (không đưa lên GitHub) chứa các phiếu thật lấy từ tệp Excel. Hàm `importSample()` trong `Code.gs` nạp chúng vào bảng tính: mỗi tháng một kỳ; tháng nào người phụ trách đã chấm đủ thì ở trạng thái đã đánh giá, còn lại chờ chấm.

## Cách chấm điểm một công việc (theo tệp mẫu `Văn phòng.xlsx`)

- `S = A×35% + B×30% + C×15% + D×15% + E×5%`, làm tròn 2 chữ số.
- Mức N: S dưới 1,8 là N1; dưới 2,6 là N2; dưới 3,4 là N3; dưới 4,2 là N4; đến 5 là N5.
- Điểm của N: N1 = 0,25; N2 = 0,5; N3 = 1; N4 = 2; N5 = 4.
- Điểm phiếu = tổng (số lượng sản phẩm × điểm của N).
- Các mức A–E, bảng N và danh mục sản phẩm nằm trong `KPI_MODEL` ở `assets/core.js`.

## Triển khai

### Máy chủ Apps Script (dự án KPIMTTQQTRI)

1. Mở dự án `KPIMTTQQTRI` trên <https://script.google.com>.
2. Tạo 3 tệp tập lệnh `Code`, `Core`, `Seed` và dán nội dung các tệp cùng tên trong `apps-script/`.
3. **Cài đặt dự án** › bật "Hiển thị tệp kê khai appsscript.json", dán nội dung `apps-script/appsscript.json`.
4. Chọn hàm `setup`, bấm **Chạy**, cấp quyền khi được hỏi. Hàm này mở bảng tính có mã ghi ở `KPI_SHEET_ID` trong `Code.gs`, tạo các trang tính và tài khoản quản trị khởi đầu. Máy chủ chỉ xin quyền với Google Trang tính.
5. **Triển khai › Tùy chọn triển khai mới › Ứng dụng web**: Thực thi dưới dạng *Tôi*, Người có quyền truy cập *Bất kỳ ai*. Sao chép đường dẫn kết thúc bằng `/exec`.
6. Sau khi `setup` chạy xong có thể xoá tệp `Seed` khỏi dự án.

Mỗi lần sửa mã Apps Script phải **Quản lý triển khai › Chỉnh sửa › Phiên bản mới** thì thay đổi mới có hiệu lực.

### Giao diện trên GitHub Pages

1. Dán đường dẫn `/exec` vào `API_URL` trong `assets/config.js`, đưa thay đổi lên kho GitHub.
2. Trong kho: **Settings › Pages › Deploy from a branch › main / (root)**.

### Thiết lập ban đầu

Quản trị viên đăng nhập bằng CCCD, vào **Quản trị**:

1. **Đơn vị**: khai cây đơn vị (thêm từng đơn vị hoặc dán danh sách từ Excel).
2. **Người dùng**: thêm từng người hoặc dán danh sách từ Excel. Mỗi tài khoản mới có mật khẩu tạm, hiện một lần; người dùng buộc đổi khi đăng nhập lần đầu.
3. Với từng người: chọn **Cấp** và **Người phụ trách đánh giá**. Tab **Cây phụ trách** cho thấy ai đánh giá ai và ai chưa được khai.
4. **Kỳ đánh giá**: tạo kỳ tháng/quý/năm, đặt hạn nộp, khoá kỳ khi xong.

## Lưu ý vận hành

- **Không đưa lên GitHub** tệp Excel chứa dữ liệu thật, `apps-script/Seed.gs` và `apps-script/DuLieuMau.gs`. `.gitignore` đã chặn.
- Mật khẩu chỉ lưu dạng băm SHA-256 có muối. Quên mật khẩu quản trị: chạy hàm `resetAdminPassword` trong Apps Script.
- Bảng tính chứa CCCD, số điện thoại, email: chỉ chia sẻ bảng tính cho người có trách nhiệm. Số điện thoại và email chỉ hiện với chính người đó và quản trị viên.
- Không đổi tên trang tính và dòng tiêu đề trong bảng tính. Sửa tay dữ liệu thì giữ đúng mã đơn vị và CCCD.
- Minh chứng: cán bộ dán đường dẫn (ví dụ liên kết tệp trên Drive của mình). Chức năng tải tệp trực tiếp đã tắt để máy chủ không cần quyền trên toàn bộ Google Drive.
- Quy mô phù hợp: vài chục đến vài trăm người dùng. Apps Script xử lý lần lượt từng yêu cầu (mỗi thao tác 1–3 giây).

## Chạy thử trên máy

```bash
python3 -m http.server 8765
```

Mở `http://localhost:8765`. Mở `http://localhost:8765/?thu=1` (hoặc để trống `API_URL`) thì trang dùng dữ liệu mẫu lưu trong trình duyệt (tài khoản thử hiện ngay dưới ô đăng nhập). Trên trang thật không có chế độ này.

## Khi sửa lõi nghiệp vụ

```bash
cp assets/core.js apps-script/Core.gs
```

rồi dán lại nội dung `Core.gs` vào dự án Apps Script và triển khai phiên bản mới.
