const http = require("http");
const logger = require("./logger");

// Nhieu nen tang hosting (Railway, Render, Vibe Hosting...) yeu cau ung dung lang nghe
// 1 cong HTTP de kiem tra "health check", ke ca voi cac app khong phai web server nhu bot Discord.
// Server nay chi tra ve 200 OK cho moi request, khong lien quan gi den logic cua bot.
function startHealthServer() {
  const port = Number(process.env.PORT) || 3000;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  });

  server.listen(port, "0.0.0.0", () => {
    logger.info(`Health check server đang lắng nghe tại 0.0.0.0:${port}`);
  });

  return server;
}

module.exports = { startHealthServer };
