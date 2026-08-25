# Discord Translate Bot

Bot Discord tự động phát hiện ngôn ngữ và dịch tin nhắn sang các ngôn ngữ khác trong cộng đồng, dùng **Gemini API (Google AI Studio)** — có gói miễn phí, không cần thẻ billing. Phù hợp cho server có thành viên đến từ nhiều quốc gia.

📄 Xem [tờ hướng dẫn sử dụng song ngữ Việt/Anh](docs/guide.txt) (liệt kê đầy đủ các slash command cho thành viên và admin).

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
GEMINI_MODEL=gemini-3.5-flash-lite          # doi neu Google doi ten model free tier
GEMINI_RPM_LIMIT=15                        # chinh theo han muc free tier hien tai
LOG_LEVEL=info
PORT=3000                                  # chi dung khi deploy len nen tang yeu cau health check HTTP
```

## 4. Đăng ký slash command và chạy bot

```bash
npm run deploy   # đăng ký /translate-languages, /translate-channel, /translate-status, /mute-language, /member-list
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

Mỗi thành viên (không cần quyền admin) cũng có thể tự quản lý ngôn ngữ cho tin nhắn của riêng mình:

- `/mute-language toggle code:de` — bật/tắt mute một ngôn ngữ; khi đã mute, **tin nhắn của chính người đó** sẽ không còn được dịch sang ngôn ngữ đó nữa (không ảnh hưởng tin nhắn của người khác).
- `/mute-language list` — xem các ngôn ngữ mình đang mute.

Lưu ý: Discord không cho phép bot hiển thị nội dung khác nhau cho từng người xem trên cùng một tin nhắn công khai, nên "mute" ở đây chỉ áp dụng cho tin nhắn do chính người dùng đó gửi, không thể ẩn một ngôn ngữ chỉ với riêng người xem.

Danh sách mã ngôn ngữ có tên/cờ hiển thị đẹp nằm ở [src/services/languageCatalog.js](src/services/languageCatalog.js) — có thể bổ sung thêm ngôn ngữ vào bảng `CATALOG` nếu cần. Mã không có trong bảng vẫn dịch được bình thường, chỉ là hiển thị tên thô và cờ mặc định 🏳️.

Lưu ý: càng nhiều ngôn ngữ đích, prompt gửi đi càng dài và phản hồi JSON càng lớn (mỗi ngôn ngữ là một field) — nên chỉ bật những ngôn ngữ thành viên thực sự dùng để tiết kiệm quota free tier.

## 6. Danh sách thành viên (đăng ký qua `!name`)

Bot có thể tổng hợp tên thành viên thành một danh sách tự cập nhật, dựa trên cú pháp thành viên tự gõ trong một kênh chỉ định:

- Admin chạy `/member-list setchannel` tại kênh muốn dùng để đăng ký (ví dụ #general) — bot đăng ngay một tin nhắn danh sách rỗng và ghim lại (nếu có quyền Manage Messages).
- Thành viên chỉ cần gõ `!Tên của họ` (không có dấu ngoặc, ví dụ: `!Nguyễn Văn A`) — bot thả react ✅ xác nhận và tự cập nhật lại tin nhắn danh sách, không cần lệnh gì thêm. Cú pháp này hoạt động ở **kênh đăng ký đã chỉ định LẪN mọi kênh trong hệ thống đồng bộ đa ngôn ngữ** (mục 7), không giới hạn phải đúng 1 kênh duy nhất.
- Gõ lại `!` với tên mới sẽ **ghi đè** tên cũ của chính người đó (không tạo dòng trùng).
- Tin nhắn dạng `!name` sẽ không bị bot dịch/đồng bộ sang kênh khác (được xử lý riêng, bỏ qua bước tự động dịch).
- Bot cũng tự đổi **biệt danh (nickname)** của người đăng ký thành đúng tên họ gõ. Để việc này hoạt động, vào **Server Settings → Roles → (vai trò của bot)** và bật quyền **"Manage Nicknames"**, đồng thời kéo vai trò của bot lên **cao hơn** vai trò của các thành viên thường trong danh sách Roles (Discord không cho phép bot đổi biệt danh của ai có vai trò ngang/cao hơn mình, và không bao giờ đổi được biệt danh của chủ server). Nếu thiếu quyền, bot vẫn ghi nhận tên vào danh sách bình thường, chỉ là không đổi được nickname (lỗi này được ghi vào log, không làm gián đoạn tính năng khác).
- Muốn bot tự ghim tin nhắn danh sách, bật thêm quyền **"Manage Messages"** cho vai trò của bot (không bắt buộc — thiếu quyền này thì danh sách vẫn cập nhật bình thường, chỉ là không được ghim).
- `/member-list reset` (admin) — xóa toàn bộ danh sách đã đăng ký để làm lại từ đầu.
- Tin nhắn danh sách được đăng và tự cập nhật ở **#general lẫn mọi kênh trong hệ thống đồng bộ đa ngôn ngữ** (mục 7) — ai ở kênh nào cũng xem được.
- `/showlist` — bất kỳ ai cũng dùng được, hiện nhanh danh sách ngay trong chat (chỉ mình người gõ thấy) mà không cần tìm tin nhắn ghim.

## 7. Kênh riêng theo ngôn ngữ (đồng bộ tin nhắn đa kênh)

Thay vì 1 kênh chung với bot reply kèm bản dịch, có thể chia mỗi ngôn ngữ ra 1 kênh riêng — thành viên chat trong kênh ngôn ngữ của họ, bot tự đồng bộ (dịch + đăng lại) tin nhắn sang các kênh còn lại, giả làm chính người gửi (webhook, đúng tên + avatar) để trải nghiệm tự nhiên như đang chat trực tiếp ở mọi kênh.

**Yêu cầu quyền trước khi dùng:** vào **Server Settings → Roles → (vai trò của bot)**, bật thêm:
- **"Manage Channels"** — để bot tự tạo kênh mới cho từng ngôn ngữ.
- **"Manage Webhooks"** — để bot tạo/gửi tin nhắn qua webhook ở mỗi kênh.

**Thiết lập (admin, 1 lần):**
- `/language-channels setup` — với mỗi ngôn ngữ đang cấu hình (`/translate-languages list`), bot tạo kênh `#chat-<mã ngôn ngữ>` (ví dụ `#chat-vi`, `#chat-ko`) nếu chưa có, riêng ngôn ngữ `en` sẽ dùng luôn kênh **#general** có sẵn thay vì tạo kênh mới.
- `/language-channels list` — xem kênh nào đang ứng với ngôn ngữ nào.
- `/language-channels reset` — xóa ánh xạ (không xóa kênh đã tạo), dừng đồng bộ.

**Cách hoạt động:** thành viên nhắn trong kênh ngôn ngữ của họ (ví dụ #chat-ja) → bot dịch sang ngôn ngữ của từng kênh còn lại → đăng bản dịch vào từng kênh đó qua webhook mang đúng tên/avatar người gửi gốc. Các kênh đã ánh xạ **không còn dùng kiểu reply-kèm-embed** của mục Cách hoạt động ở trên nữa — đây là 2 chế độ tách biệt, một tin nhắn chỉ đi theo 1 trong 2 chế độ tùy kênh nó thuộc về.

**Thành viên tự tạo kênh cho ngôn ngữ mới:** không cần đợi admin, ai cũng có thể chạy `/declare-language language:<mã hoặc tên>` (ví dụ `fr` hoặc `French`) để bot tự thêm ngôn ngữ đó và tạo kênh riêng, tự động tham gia hệ thống đồng bộ ngay. Nếu ngôn ngữ chưa có sẵn trong bảng tra cứu, bot vẫn tạo được kênh bình thường (dùng luôn tên người gõ), Gemini vẫn dịch tốt dù ngôn ngữ đó không được liệt kê sẵn.

**Đồng bộ reaction:** khi ai đó thả emoji vào 1 bản tin nhắn (ở bất kỳ kênh nào trong nhóm đã đồng bộ), bot tự thả **cùng emoji đó** vào tất cả các bản sao còn lại (tin nhắn gốc + mọi kênh khác). Chỉ áp dụng cho tin nhắn được đồng bộ trong 24 giờ gần nhất (sau đó bộ nhớ liên kết tự dọn để tránh phình to theo thời gian).

**Đồng bộ sticker:** khi ai đó gửi sticker (kèm chữ hoặc không), bot tải ảnh của sticker đó về và gửi lại dưới dạng **ảnh đính kèm** ở các kênh còn lại (giữ đúng tên/avatar người gửi). Đây là giới hạn từ phía Discord — webhook (cách bot dùng để giả làm người gửi) không được phép gửi sticker thật, chỉ có bot/tài khoản người dùng gửi trực tiếp mới làm được. Riêng sticker động cao cấp (định dạng Lottie) không chuyển được thành ảnh nên sẽ bị bỏ qua.

**Đồng bộ ảnh/GIF/video đính kèm:** file người dùng tải lên trực tiếp (ảnh, GIF, video, hay bất kỳ file nào) cũng được đính kèm y hệt sang các kênh còn lại. Riêng GIF chọn từ khung GIF có sẵn của Discord (Tenor) không phải file đính kèm — bản chất chỉ là 1 link trong nội dung tin nhắn, nên đã tự động được giữ nguyên và đồng bộ như một link bình thường (Discord tự hiện preview ở mọi kênh).

**Đồng bộ trả lời (reply):** khi ai đó dùng tính năng "Reply" của Discord để trả lời 1 tin nhắn, các kênh còn lại sẽ hiện thêm 1 dòng trích dẫn phía trên nội dung, dạng `> 💬 Tên người gửi: <đoạn trích tin nhắn được trả lời>`. Nếu tin nhắn được trả lời đó cũng từng được đồng bộ trước đó, đoạn trích sẽ lấy đúng **bản đã dịch sang ngôn ngữ của từng kênh** thay vì hiện nguyên văn ngoại ngữ gốc. Đây cũng là giới hạn từ Discord — webhook không thể tạo reply thật (liên kết nhảy đến tin nhắn gốc) như tin nhắn thường.

Lưu ý: `!name` (đăng ký danh sách thành viên) vẫn được kiểm tra trước, nên nếu #general vừa là kênh đăng ký tên vừa là kênh tiếng Anh, gõ `!Tên` vẫn hoạt động bình thường (không bị đồng bộ nhầm sang kênh khác).

## 8. Deploy lên nền tảng hosting (Railway/Render/Vibe Hosting...)

Nhiều nền tảng PaaS yêu cầu ứng dụng lắng nghe 1 cổng HTTP để "health check", kể cả với app không phải web server như bot Discord. Bot đã có sẵn [src/healthServer.js](src/healthServer.js) — tự chạy 1 HTTP server tối thiểu (trả về `200 OK` cho mọi request) trên cổng lấy từ biến môi trường `PORT` (mặc định 3000), chạy song song với việc bot đăng nhập Discord, không cần cấu hình thêm gì ngoài việc nền tảng tự set `PORT` (hầu hết tự làm việc này).

**Lưu ý khi điền biến môi trường trên các nền tảng có nút "AI tự sinh giá trị":** tuyệt đối không dùng tính năng đó cho `DISCORD_TOKEN`, `GEMINI_API_KEY`, `CLIENT_ID`, `GUILD_ID` — AI sẽ sinh ra chuỗi giả ngẫu nhiên (trông giống nhưng không phải giá trị thật), khiến bot lỗi `TokenInvalid` khi khởi động. Luôn dán đúng giá trị thật từ file `.env` cục bộ của bạn vào các ô này.

**Quan trọng — ổ đĩa tạm thời (ephemeral) khi bật auto-deploy từ GitHub:** nhiều nền tảng (kể cả Vibe Hosting) build lại container từ đầu ở mỗi lần deploy, nghĩa là bất kỳ file nào không nằm trong Git sẽ **mất sạch** sau mỗi lần push code mới. Vì vậy:
- `data/config.json` (danh sách ngôn ngữ), `data/channelLanguages.json` (ánh xạ kênh↔ngôn ngữ) và `data/memberList.json` (kênh đăng ký tên + danh sách đã đăng ký) **được commit thẳng vào Git** làm baseline, để mỗi lần deploy lại vẫn giữ đúng cấu hình hiện tại thay vì reset về mặc định/rỗng. Sau khi đổi ngôn ngữ/kênh hoặc có đăng ký tên mới, nhớ chạy lại `git add data/*.json && git commit && git push` để "chốt" lại baseline mới — nếu không, lần deploy tiếp theo sẽ quay về đúng bản đã commit gần nhất (từng gây lỗi thực tế: kênh đăng ký `!name` và danh sách bị reset về rỗng sau 1 lần deploy).
- `data/userPreferences.json` (ngôn ngữ mỗi người đã mute) **không** được commit vì thay đổi liên tục và ít quan trọng bằng — nghĩa là nó **sẽ bị xóa** mỗi khi có deploy mới. Nếu cần giữ vĩnh viễn tất cả dữ liệu người dùng (kể cả mute preferences), cân nhắc chuyển sang lưu trên 1 volume lưu trữ lâu dài (nếu nền tảng hỗ trợ) hoặc một database ngoài thay vì file JSON.

## 9. Tạo sticker server từ ảnh

`/create-sticker image:<ảnh> name:<tên> tags:<từ khoá, tuỳ chọn>` (yêu cầu quyền **Manage Server**) — bot resize ảnh gửi lên cho vừa giới hạn của Discord (PNG, tối đa 320×320px, tối đa 512KB) rồi thêm thẳng vào danh sách sticker chính thức của server. Test thực tế cho thấy việc này hoạt động ngay cả khi server chưa Boost (Level 0) — không cần nâng cấp gì thêm.

## 10. Lưu ý khi mở rộng quy mô (80+ thành viên, tiếp tục tăng)

- **Cân bằng tải khi nhiều người chat cùng lúc (vd 80 thành viên):** hệ thống kênh đa ngôn ngữ (mục 7) có 2 lớp tối ưu:
  1. Gửi bản dịch sang tất cả kênh còn lại **song song** (không tuần tự) — độ trễ không tăng theo số lượng kênh.
  2. **Gộp nhiều tin nhắn gần nhau thành 1 lần gọi Gemini** (cửa sổ 300ms, tối đa 20 tin/lần) thay vì mỗi tin nhắn 1 request riêng — khi nhiều người nhắn cùng lúc, hệ thống xử lý được nhiều tin nhắn hơn hẳn trong cùng giới hạn `GEMINI_RPM_LIMIT`, thay vì bị nghẽn hàng đợi. Các tin nhắn trong 1 lần gộp hoàn toàn độc lập, không lẫn ngữ cảnh với nhau. Nếu chat không dồn dập, độ trễ mỗi tin gần như không đổi (~1-1.5 giây); chỉ khi có nhiều tin đến sát nhau mới "gộp" và độ trễ mỗi tin tăng nhẹ (đổi lấy việc không bị rớt/nghẽn).
  Nếu vẫn vượt quá khả năng xử lý, hệ thống kênh đa ngôn ngữ **chuyển tiếp nguyên văn tin nhắn (không dịch)** thay vì làm rớt hoàn toàn — riêng chế độ reply-embed cũ (kênh không thuộc hệ thống đa ngôn ngữ) sẽ không phản hồi gì nếu bị rớt.
- Cấu hình được lưu trong `data/config.json` — nếu chạy nhiều instance bot cùng lúc (không khuyến khích), cần chuyển sang một DB thực sự (SQLite/Postgres) để tránh ghi đè lẫn nhau.
- Gói miễn phí Gemini giới hạn theo request/phút **và** request/ngày. Khi cộng đồng đông lên, có thể chạm trần request/ngày trước cả trần/phút — theo dõi lỗi "Đã đạt giới hạn tốc độ/quota" trong log (đặt `LOG_LEVEL=debug` để xem chi tiết) để biết khi nào cần nâng cấp lên gói trả phí (pay-as-you-go) của Gemini API, thường rẻ hơn đáng kể so với Cloud Translation API cho cùng khối lượng.
- Nếu muốn đổi provider dịch khác sau này (DeepL, Claude, hay Gemini bản trả phí), chỉ cần thay [src/services/geminiTranslate.js](src/services/geminiTranslate.js) — phần còn lại của bot chỉ gọi một hàm duy nhất `translateMessage(cleanText, languages, apiKey)`.
