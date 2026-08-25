# Discord Translate Bot

Bot Discord tự động phát hiện ngôn ngữ và dịch tin nhắn sang các ngôn ngữ khác trong cộng đồng, dùng **Gemini API (Google AI Studio)** — có gói miễn phí, không cần thẻ billing. Phù hợp cho server có thành viên đến từ nhiều quốc gia.

## Cách hoạt động

- Mỗi tin nhắn văn bản trong kênh được bật tính năng dịch sẽ được:
  1. Tách riêng phần mention, emoji tùy chỉnh, URL, code block để không bị dịch sai (giữ nguyên, ghép lại sau khi dịch).
  2. Gửi **một lần gọi Gemini API duy nhất**: model vừa xác định ngôn ngữ gốc, vừa dịch sang tất cả ngôn ngữ đích được cấu hình, trả về theo JSON schema cố định (dùng structured output của Gemini nên không lo parse sai định dạng).
  3. Trả lời (reply) tin nhắn gốc bằng một embed gồm bản dịch cho từng ngôn ngữ.
- Vì dùng LLM thay vì dịch máy thuần túy, bản dịch giữ ngữ cảnh và thuật ngữ chuyên ngành tốt hơn, đúng giọng văn/trang trọng-thân mật của bản gốc.
- Có cache 1 giờ cho kết quả dịch (theo nội dung + bộ ngôn ngữ đích) để giảm số lần gọi API khi nhiều người lặp lại câu giống nhau (chào hỏi, cảm ơn...).
- Có rate limiter theo số request/phút (mặc định 10) để không vượt hạn mức miễn phí; nếu hàng đợi quá tải, tin nhắn đó sẽ bị bỏ qua thay vì dịch trễ hàng chục giây gây rối loạn thứ tự chat.

## 1. Tạo bot Discord

1. Vào https://discord.com/developers/applications → **New Application**.
2. Tab **Bot** → **Reset Token** để lấy token, lưu vào biến `DISCORD_TOKEN`.
3. Trong tab **Bot**, bật **MESSAGE CONTENT INTENT** (bắt buộc để đọc nội dung tin nhắn).
4. Tab **OAuth2 → URL Generator**: chọn scope `bot` và `applications.commands`; quyền cần thiết: `Send Messages`, `Read Message History`, `Embed Links`, `View Channels`.
5. Dùng URL sinh ra để mời bot vào server.
6. Lấy `CLIENT_ID` (Application ID) ở tab **General Information**.
7. (Tùy chọn) Lấy `GUILD_ID` của server (bật Developer Mode trong Discord → chuột phải vào server → Copy Server ID) để đăng ký slash command tức thì cho riêng server đó thay vì chờ tối đa 1 giờ khi đăng ký toàn cục.

## 2. Lấy Gemini API key (miễn phí)

1. Vào https://aistudio.google.com/apikey (đăng nhập bằng tài khoản Google).
2. Bấm **Create API key** → chọn hoặc tạo một project Google Cloud (không cần bật billing để dùng gói free tier).
3. Copy API key, lưu vào `GEMINI_API_KEY`.
4. **Quan trọng:** gói miễn phí có giới hạn số request/phút và request/ngày theo từng model, và các con số này Google có thể thay đổi theo thời gian. Kiểm tra hạn mức hiện tại tại https://ai.google.dev/pricing (mục "Free tier") trước khi chọn model ở bước dưới, rồi chỉnh `GEMINI_RPM_LIMIT` trong `.env` cho khớp (nên đặt thấp hơn hạn mức thật một chút để có biên an toàn).
5. Lưu ý: dữ liệu gửi qua Gemini API dùng theo gói miễn phí (free tier) có thể được Google dùng để cải thiện sản phẩm — nếu cộng đồng có nội dung nhạy cảm, nên đọc kỹ điều khoản tại https://ai.google.dev/gemini-api/terms trước khi dùng.

## 3. Cài đặt

```bash
npm install
cp .env.example .env
```

Điền vào `.env`:

```
DISCORD_TOKEN=token_bot_cua_ban
CLIENT_ID=application_id_cua_bot
GUILD_ID=id_server_de_dang_ky_lenh_nhanh   # có thể để trống
GEMINI_API_KEY=api_key_gemini_cua_ban
GEMINI_MODEL=gemini-2.0-flash              # doi neu Google doi ten model free tier
GEMINI_RPM_LIMIT=10                        # chinh theo han muc free tier hien tai
LOG_LEVEL=info
```

## 4. Đăng ký slash command và chạy bot

```bash
npm run deploy   # đăng ký /translate-languages, /translate-channel, /translate-status
npm start        # chạy bot
```

Dùng `npm run dev` khi phát triển để bot tự khởi động lại khi sửa code (Node 18.11+).

## 5. Cấu hình cho cộng đồng

Mặc định bot bật sẵn 5 ngôn ngữ: Tiếng Việt, English, 日本語, 한국어, 中文. Chỉnh lại bằng slash command (yêu cầu quyền **Manage Server**):

- `/translate-languages set codes:vi,en,ja,ko,fr,es` — đặt danh sách ngôn ngữ của cộng đồng.
- `/translate-languages list` — xem danh sách hiện tại.
- `/translate-channel ignore` — loại trừ kênh hiện tại khỏi tự động dịch (dùng cho kênh log, bot-command...).
- `/translate-channel only` — thêm kênh hiện tại vào danh sách "chỉ dịch trong các kênh này" (khi danh sách này có ít nhất 1 kênh, bot chỉ hoạt động trong các kênh đó).
- `/translate-channel reset` — xóa mọi giới hạn kênh, dịch ở mọi kênh.
- `/translate-status` — xem cấu hình hiện tại, model/rate limit đang dùng, số bản dịch đang được cache.

Danh sách mã ngôn ngữ có tên/cờ hiển thị đẹp nằm ở [src/services/languageCatalog.js](src/services/languageCatalog.js) — có thể bổ sung thêm ngôn ngữ vào bảng `CATALOG` nếu cần. Mã không có trong bảng vẫn dịch được bình thường, chỉ là hiển thị tên thô và cờ mặc định 🏳️.

Lưu ý: càng nhiều ngôn ngữ đích, prompt gửi đi càng dài và phản hồi JSON càng lớn (mỗi ngôn ngữ là một field) — nên chỉ bật những ngôn ngữ thành viên thực sự dùng để tiết kiệm quota free tier.

## 6. Lưu ý khi mở rộng quy mô (80+ thành viên, tiếp tục tăng)

- Cấu hình được lưu trong `data/config.json` — nếu chạy nhiều instance bot cùng lúc (không khuyến khích), cần chuyển sang một DB thực sự (SQLite/Postgres) để tránh ghi đè lẫn nhau.
- Gói miễn phí Gemini giới hạn theo request/phút **và** request/ngày. Khi cộng đồng đông lên, có thể chạm trần request/ngày trước cả trần/phút — theo dõi lỗi "Đã đạt giới hạn tốc độ/quota" trong log (đặt `LOG_LEVEL=debug` để xem chi tiết) để biết khi nào cần nâng cấp lên gói trả phí (pay-as-you-go) của Gemini API, thường rẻ hơn đáng kể so với Cloud Translation API cho cùng khối lượng.
- Nếu muốn đổi provider dịch khác sau này (DeepL, Claude, hay Gemini bản trả phí), chỉ cần thay [src/services/geminiTranslate.js](src/services/geminiTranslate.js) — phần còn lại của bot chỉ gọi một hàm duy nhất `translateMessage(cleanText, languages, apiKey)`.
