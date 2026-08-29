// Tu dong commit + push cac file data/*.json len Git moi khi cau hinh thay doi, de
// khi host (nen tang ephemeral) build lai container thi khong mat du lieu.
//
// CHI chay khi bat AUTO_COMMIT_DATA=true. Tren host cong khai can them GITHUB_TOKEN
// (Personal Access Token quyen "repo" hoac fine-grained "Contents: write") de push duoc.
// Chay local khong bat bien nay -> khong lam gi, khong tao commit rac.
//
// Moi loi deu chi log WARN, khong bao gio nem ra -> khong lam sap bot.
const { exec } = require("child_process");
const path = require("path");
const logger = require("../logger");

const REPO_ROOT = path.join(__dirname, "..", "..");
const TRACKED_FILES = ["data/config.json", "data/channelLanguages.json", "data/memberList.json"];

const ENABLED = ["true", "1", "yes"].includes(String(process.env.AUTO_COMMIT_DATA || "").toLowerCase());
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const BRANCH = process.env.AUTO_COMMIT_BRANCH || "main";
const DEBOUNCE_MS = Number(process.env.AUTO_COMMIT_DEBOUNCE_MS) || 20_000;

let timer = null;
let running = false;
let queuedWhileRunning = false;

function redact(text) {
  return GITHUB_TOKEN ? String(text).split(GITHUB_TOKEN).join("***") : String(text);
}

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: REPO_ROOT, windowsHide: true, timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(redact(stderr || err.message)));
      else resolve(String(stdout).trim());
    });
  });
}

async function pushTargetArgs() {
  if (!GITHUB_TOKEN) return `origin HEAD:${BRANCH}`;
  const remote = await run("git config --get remote.origin.url");
  const m = remote.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);
  if (!m) return `origin HEAD:${BRANCH}`;
  // URL co token chi dung 1 lan cho lenh push nay, khong ghi vao git config.
  return `https://x-access-token:${GITHUB_TOKEN}@github.com/${m[1]}/${m[2]}.git HEAD:${BRANCH}`;
}

async function doBackup() {
  if (running) {
    queuedWhileRunning = true;
    return;
  }
  running = true;
  try {
    await run(`git add ${TRACKED_FILES.join(" ")}`);
    const status = await run(`git status --porcelain -- ${TRACKED_FILES.join(" ")}`);
    if (!status) return; // khong co gi thay doi

    await run(
      'git -c user.name="translate-bot" -c user.email="translate-bot@users.noreply.github.com" ' +
        'commit -m "chore(data): auto-backup config [skip deploy]"'
    );
    await run(`git push ${await pushTargetArgs()}`);
    logger.info("Đã tự động sao lưu data/*.json lên Git.");
  } catch (error) {
    logger.warn("Tự động sao lưu data/*.json thất bại (bỏ qua, không ảnh hưởng bot):", redact(error.message));
  } finally {
    running = false;
    if (queuedWhileRunning) {
      queuedWhileRunning = false;
      scheduleBackup();
    }
  }
}

// Gom nhieu thay doi lien tiep (vd nhieu nguoi dang ky !ten cung luc) thanh 1 commit.
function scheduleBackup() {
  if (!ENABLED) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(doBackup, DEBOUNCE_MS);
  if (typeof timer.unref === "function") timer.unref(); // khong giu tien trinh song chi vi timer nay
}

module.exports = { scheduleBackup, AUTO_COMMIT_ENABLED: ENABLED };
