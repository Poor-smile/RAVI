import { app } from "electron";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractZipArchive } from "./zip-extract.mjs";
import {
  audioMetadataLooksComplete,
  shouldPreSplitSpeech,
  splitSpeechForRetry,
} from "./tts-audio-policy.mjs";

const TTS_RELEASE = "v1";
const DEFAULT_DOWNLOAD_BASE = "https://dl2.gptt.ir/downloads/raavi/tts/v1";
const DOWNLOAD_BASE = String(
  process.env.RAAVI_TTS_DOWNLOAD_BASE_URL || DEFAULT_DOWNLOAD_BASE,
).replace(/\/+$/u, "");
const HOSTED_PYTHON = {
  version: "3.11.16-raavi1",
  fileName: "python-3.11.16-win-x64.zip",
  sizeBytes: 27_728_299,
  sha256: "c9aef36f9f9c1847436924d51bf565d3cefee89b0ddd1b9dc8053a0c34b9ec5e",
};
const TORCH_RUNTIME = {
  sharedKey: "ava",
  version: "ava-0.2.0-py311-raavi1",
  fileName: "ava-runtime-py311.zip",
  sizeBytes: 174_687_320,
  sha256: "8c4db061ca76be43c633b533814ce48ad2988db430cd32471e4824460740ae2f",
};
const GOOYA_RUNTIME = {
  version: "gooya-v1-py311-raavi2",
  fileName: "gooya-runtime-py311-raavi2.zip",
  sizeBytes: 228_963_030,
  sha256: "1c5ae38bde39885a112e23683ac5892afe52f768e3d165b233370d0e6dd48bd7",
};
const F5IPA_RUNTIME = {
  version: "f5-tts-1.1.22-py311-raavi1",
  fileName: "f5ipa-runtime-py311-raavi1.zip",
  sizeBytes: 284_255_811,
  sha256: "2b0d1df84cc4469999e46fffaf4f6cc0b9ea542c165f01e20b99745362a52b95",
};
const CACHE_LIMIT_BYTES = 250 * 1024 * 1024;
const AUDIO_CACHE_VERSION = "2";
const NARRATION_DIRECTOR_VERSION = "1";
const HELPER_SOURCE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "tts-helper.py",
);
const RUNTIME_EXTRACTOR_SOURCE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "tts-runtime-extract.py",
);

const ENGINES = {
  mana: {
    label: "مانا / Piper",
    description: "سبک و سریع؛ مناسب بیشتر رایانه‌ها",
    version: "2025-02-14",
    license: "مدل MIT · اجراگر Piper GPL-3.0",
    sample: "راوی، متن فارسی را روان و کاملاً محلی برای شما می‌خواند.",
    runtime: {
      version: "piper-1.7.0-py311-raavi1",
      fileName: "mana-runtime-py311.zip",
      sizeBytes: 62_381_031,
      sha256: "88f24ac6c4b0c2ca73813f09306761df0f2f080903a9f0a7251a0105f0f63d06",
    },
    artifacts: [
      {
        fileName: "fa_IR-mana-medium.onnx",
        sizeBytes: 63_531_379,
        sha256: "e390c0e74ba71fd97c49ba662ee0c6e1724b462ba2d4561698af4f564840f126",
      },
      {
        fileName: "fa_IR-mana-medium.onnx.json",
        sizeBytes: 7_088,
        sha256: "d102276a05436613a05e1fbad8f125abcf8f56759aaf4fd36adf216653949997",
      },
    ],
  },
  ava: {
    label: "آوا / Ava-82M",
    description: "صدای پژوهشیِ دقیق‌تر؛ سنگین‌تر و کندتر",
    version: "0.2.0",
    license: "Apache-2.0",
    sample: "این نمونه با موتور آوا و به‌صورت آفلاین در رایانهٔ شما ساخته شده است.",
    runtime: TORCH_RUNTIME,
    artifacts: [
      { fileName: "model.pth", sizeBytes: 327_191_691, sha256: "5d882cf0a340d412040fb18339e6afc5963ba0b6fbf20ca3121f06b5b824b3ac" },
      { fileName: "voice.pt", sizeBytes: 523_559, sha256: "7bde05da3a099ba393fdfcff4dd39e47afb75dfda13ff727b2d278e2514ef76f" },
      { fileName: "config.json", sizeBytes: 2_351, sha256: "5abb01e2403b072bf03d04fde160443e209d7a0dad49a423be15196b9b43c17f" },
      { fileName: "pronunciations.json", sizeBytes: 103, sha256: "0878f283f1b0340e6173fd51b7600a9bade6e22231feeef654ddc84151f7124e" },
      { fileName: "ava_tts-0.2.0-py3-none-any.whl", sizeBytes: 21_822, sha256: "eabc71ee86f1ffc78b763708523842490746c7b712f690269f519adacd73aad0" },
      { fileName: "homo-ge2pe.zip", sizeBytes: 30_695_014, sha256: "4cad644f5565208099c4614202f0c199c84b3fa37af25d99014805b8682a344f" },
    ],
  },
  mms: {
    label: "متا / MMS فارسی",
    description: "سبک‌تر از آوا؛ مناسب پژوهش و استفادهٔ غیرتجاری",
    version: "2023-09-01",
    license: "CC BY-NC 4.0 · فقط غیرتجاری",
    restriction: "فقط برای استفادهٔ شخصی، آموزشی و پژوهشیِ غیرتجاری",
    sample: "این نمونه با مدل فارسی ام ام اس متا و کاملاً آفلاین ساخته شده است.",
    runtime: TORCH_RUNTIME,
    artifacts: [
      { fileName: "model.safetensors", sizeBytes: 145_232_120, sha256: "e8c9bcaa7bea01679769e07196753833107f93f720b822ecc96f2ff899402b7c" },
      { fileName: "config.json", sizeBytes: 1_641, sha256: "d76f3cad35e24a6d10f9d65d833555b7ab8020d8fa8d30eb5d70070ef15ae315" },
      { fileName: "vocab.json", sizeBytes: 517, sha256: "3cdfbff9053c12deb64cbdd8cae1068358cd95f0f2176b86e534b66bc848f277" },
      { fileName: "tokenizer_config.json", sizeBytes: 288, sha256: "06c280af709a6e50e687e4988cc330d7dba6f224f6b0d96de19b35a6ab65367c" },
      { fileName: "special_tokens_map.json", sizeBytes: 48, sha256: "4bf177481394471ba5e05ed9c2e0255b4ec6bfecf2d8b8e55a8bb60880f5849c" },
      { fileName: "ATTRIBUTION.txt", sizeBytes: 531, sha256: "08994d9e3d2c28899b3aa2abf14234aff5a165a9761aff1b2ebecb6ea77e09ef" },
    ],
  },
  gooya: {
    label: "گویا / Gooya V1",
    description: "خوانش طبیعی‌تر فارسی با آوانویسی اختصاصی؛ کیفیت بالا و پردازش سنگین‌تر",
    version: "1.0-raavi1",
    license: "مجوز اختصاصی آوا صبای ملل · پایهٔ MOSS: Apache-2.0",
    restriction: "دارای مجوز تهیه‌شده برای استفاده و توسعه در راوی",
    sample: "این نمونه با موتور گویای فارسی و به‌صورت کاملاً آفلاین در رایانهٔ شما ساخته شده است.",
    runtime: GOOYA_RUNTIME,
    artifacts: [
      { fileName: "gooya/pytorch_model.bin", sizeBytes: 285_015_275, sha256: "9ed3888926c8ad2ba91b6028e1cfecdc077d8219ac73978b0a00516ce3e0a032" },
      { fileName: "codec/__init__.py", sizeBytes: 52, sha256: "ed0b4910a5e53b1dfc3234cfcf96e2c6890d339f9134a3dfed8481d01b3768fd" },
      { fileName: "codec/config.json", sizeBytes: 7_385, sha256: "b38892f8ba00efc18af2ad9eca999c7603f871548c2e7f99258cb1cefc70ee06" },
      { fileName: "codec/configuration_moss_audio_tokenizer.py", sizeBytes: 19_249, sha256: "b2d67dc4581e70f4b69b2d7eccefe32581d0c5192fe4d97fe1830e94a255b8aa" },
      { fileName: "codec/model-00001-of-00001.safetensors", sizeBytes: 87_922_568, sha256: "34d9880d805eecb21bde975202b1c256dbd0eb98c8680b9d3aeffd2bc6ac2f67" },
      { fileName: "codec/model.safetensors.index.json", sizeBytes: 34_346, sha256: "2bf639e2c37c8502b1d0d92bf616b8108cb9975d42f587487a103682575b1d6d" },
      { fileName: "codec/modeling_moss_audio_tokenizer.py", sizeBytes: 138_814, sha256: "b14af7c188944da5101adbd4aaa9c3617d66b83507f0efbd6eb416381a105930" },
      { fileName: "g2p/added_tokens.json", sizeBytes: 3_018, sha256: "0004781309423057d33b9edf50d2669253d4347873ea33d4e7755cb866f23883" },
      { fileName: "g2p/config.json", sizeBytes: 791, sha256: "a9ada2eff93810c2aa3bb251ba9c2edb7124f9ac4f947617aa9c18f45add2129" },
      { fileName: "g2p/generation_config.json", sizeBytes: 112, sha256: "e6bacb7faf7c3268de56b772c5b53f926545e0507686216bee531d2abc997fba" },
      { fileName: "g2p/model.safetensors", sizeBytes: 32_275_776, sha256: "2d89883abe07082cfb291203c1e5609f8974e71ca04d6c3e73bf2d32f8b715cf" },
      { fileName: "g2p/overlay.json", sizeBytes: 7_003, sha256: "9e063c2f26db4f56f6a93fef33f1f2a25423318ff7073b9954fddf4c4085412f" },
      { fileName: "g2p/special_tokens_map.json", sizeBytes: 413, sha256: "7dc2ed3d3cc896f2e2e053dc1635d8b1d0e2b50094f0ae963a4d7fda6f4ced06" },
      { fileName: "g2p/tokenizer_config.json", sizeBytes: 23_033, sha256: "7f65014e433cc8c5c57951c1645eae6d3af3fb6fd8f5b7e56ec89f2ef228bb69" },
      { fileName: "gooya/__init__.py", sizeBytes: 800, sha256: "1e297cb29e5780863a21415c8f5c61aad9aebaae807bae20a9a94492249495cb" },
      { fileName: "gooya/config.json", sizeBytes: 2_179, sha256: "a3cbc9c60ad57f8a0ffb0b953bf370d70cede7a84dd1be08f1ebea84d0429afe" },
      { fileName: "gooya/configuration_moss_tts_nano.py", sizeBytes: 5_033, sha256: "6f77da729d829e57f08872fcee10e05bb4358305cb175747650d8d05f23c1020" },
      { fileName: "gooya/gpt2_decoder.py", sizeBytes: 26_647, sha256: "cee01966c5eeeb8f84b83c7a197615b2d7fa876118992dae8a8f851688d868d7" },
      { fileName: "gooya/modeling_moss_tts_nano.py", sizeBytes: 110_984, sha256: "b68ffef1173eb39625dc9321f4ca4bfb7644dff54463e08df348e045b8cb5e04" },
      { fileName: "gooya/prompting.py", sizeBytes: 2_727, sha256: "24c1675e08071fc4b70fbc8f531c5f073234b029c55f3f6a8590891c2cb5f583" },
      { fileName: "gooya/special_tokens_map.json", sizeBytes: 552, sha256: "358c249e2fb29060c6b73157d428853b0c48710deffc8ee670ab1013880946c9" },
      { fileName: "gooya/tokenization_moss_tts_nano.py", sizeBytes: 3_558, sha256: "22872a5cf91aaefcd93b2563a7c9f01996ec4c8da8f1efd670cbe4710474a6cd" },
      { fileName: "gooya/tokenizer_config.json", sizeBytes: 1_140, sha256: "2e00db82fd2ba8020e7263a25f31bb8ec6c5cefbfe0b5e0bbd4723ae874d1be1" },
      { fileName: "gooya/tokenizer.model", sizeBytes: 470_897, sha256: "c353ee1479b536bf414c1b247f5542b6607fb8ae91320e5af1781fee200fddff" },
      { fileName: "LICENSE-NOTICE.txt", sizeBytes: 646, sha256: "886f941a51dccee098c6472fc99ac6d6ba36c38451e541ff13cfef032ae30703" },
      { fileName: "reference.wav", sizeBytes: 737_358, sha256: "a2bcde0fbd44ca21d8e32186eb346938a596d86f4ccd119f1742eb2a72ad8015" },
    ],
  },
  f5ipa: {
    label: "فارسی IPA / F5-TTS",
    description: "خوانش طبیعی و قابل‌شرطی‌سازی با آوانویسی IPA؛ بسیار سنگین و مناسب رایانه‌های قدرتمند",
    version: "245cc858-raavi1",
    license: "CC BY-NC 4.0 · فقط غیرتجاری",
    restriction: "فقط استفادهٔ شخصی، آموزشی و پژوهشیِ غیرتجاری؛ صدای مصنوعی را شفاف اعلام کنید",
    sample: "این نمونه با موتور فارسی آی پی ای اف پنج و به‌صورت کاملاً آفلاین ساخته شده است.",
    runtime: F5IPA_RUNTIME,
    artifacts: [
      { fileName: "speech/model.safetensors", sizeBytes: 1_348_439_712, sha256: "f347d5fbd70130b6cea83865c66fbe4a9322222d82a95b4fb6adf3cb270ed385" },
      { fileName: "g2p/model.safetensors", sizeBytes: 1_198_571_496, sha256: "22eb79514bdcab86cd8ad6f4736b6d4123f6a58612687bba5b2fbd30d9776bab" },
      { fileName: "vocos/pytorch_model.bin", sizeBytes: 54_365_991, sha256: "97ec976ad1fd67a33ab2682d29c0ac7df85234fae875aefcc5fb215681a91b2a" },
      { fileName: "reference.wav", sizeBytes: 93_740, sha256: "0c77a6d9f3cc2fa3c1f937061cb3cb84c6c9829851212b16aa6e67b01dd62d14" },
      { fileName: "speech/vocab.txt", sizeBytes: 13_808, sha256: "9ef49bc7cd74c9882f82e85dc1b418eefad2be0ef20c492d049f087c27e1c5e4" },
      { fileName: "speech/config.yaml", sizeBytes: 1_001, sha256: "c58f494359eec5d84640c437f17557849c36961090fd3c08aa6bf1b2a1683236" },
      { fileName: "g2p/added_tokens.json", sizeBytes: 3_018, sha256: "0004781309423057d33b9edf50d2669253d4347873ea33d4e7755cb866f23883" },
      { fileName: "g2p/config.json", sizeBytes: 848, sha256: "564bf5cbdf6ad408cfbedd740f7fce785e8461131f1e436a83caea006af54683" },
      { fileName: "g2p/generation_config.json", sizeBytes: 142, sha256: "fb784d0393e853fe24a265e667bf163bc19e546ad9105fc1c7331b809b63f08e" },
      { fileName: "g2p/tokenizer_config.json", sizeBytes: 25_634, sha256: "283cab1b219fde7261bfd4d370330c057b9bf4eb4313e2a9148c79d7323f7173" },
      { fileName: "vocos/config.yaml", sizeBytes: 461, sha256: "da9033922f969a47f0c160010226919e59f27761fd5066f3828d46de6650b0fc" },
      { fileName: "NOTICE.md", sizeBytes: 463, sha256: "3cbe6d63233c7d421d0e89272482b058e5dbbd19324a9a7c6c3788393065d90a" },
      { fileName: "ATTRIBUTION.txt", sizeBytes: 1_134, sha256: "5f3d880030cad230d07e5a65c7718b9eec211b784f3e2901f600002cf0420d9f" },
    ],
  },
};

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  return new Promise((resolve, reject) => {
    const source = createReadStream(filePath);
    source.on("data", (chunk) => hash.update(chunk));
    source.once("error", reject);
    source.once("end", () => resolve(hash.digest("hex")));
  });
}

async function downloadTo(url, destination, { signal, totalHint, onProgress }) {
  await mkdir(path.dirname(destination), { recursive: true });
  const partial = `${destination}.part`;
  let offset = 0;
  try { offset = (await stat(partial)).size; } catch { offset = 0; }
  const response = await fetch(url, {
    headers: offset ? { Range: `bytes=${offset}-` } : {},
    redirect: "follow",
    signal,
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`دانلود بستهٔ شنیدن با پاسخ ${response.status} متوقف شد.`);
  }
  if (offset && response.status === 200) {
    await rm(partial, { force: true });
    offset = 0;
  }
  const length = Number(response.headers.get("content-length") || 0);
  const total = Math.max(totalHint || 0, offset + length);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("جریان دانلود موتور شنیدن در دسترس نیست.");
  const target = createWriteStream(partial, { flags: offset ? "a" : "w" });
  let downloaded = offset;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!target.write(Buffer.from(value))) {
        await new Promise((resolve) => target.once("drain", resolve));
      }
      downloaded += value.byteLength;
      onProgress?.(downloaded, total);
    }
  } finally {
    await new Promise((resolve) => target.end(resolve));
  }
  await rename(partial, destination);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || stdout.trim() || `فرایند محلی با کد ${code} متوقف شد.`));
    });
  });
}

function friendlyInstallError(cause) {
  const raw = cause instanceof Error ? cause.message : String(cause || "");
  const value = raw.toLocaleLowerCase("en-US");
  if (/enospc|no space|disk full/u.test(value)) {
    return "فضای خالی برای نصب موتور کافی نیست. کمی فضا آزاد کنید و «تلاش دوباره» را بزنید.";
  }
  if (/eacces|eperm|permission|access is denied/u.test(value)) {
    return "راوی اجازهٔ نوشتن فایل‌های موتور را ندارد. برنامه را ببندید، دوباره اجرا کنید و نصب را از نو ادامه دهید.";
  }
  if (/checksum|hash|crc|corrupt|invalid archive|bad zip/u.test(value)) {
    return "یکی از فایل‌های دریافت‌شده ناقص بود و کنار گذاشته شد. اتصال اینترنت را بررسی کنید و «تلاش دوباره» را بزنید.";
  }
  if (/sentencepiece|tokenizer|no such file|package is incomplete/u.test(value)) {
    return "یکی از فایل‌های محلی موتور در دسترس نیست. راوی را به نسخهٔ تازه به‌روزرسانی کنید و «تلاش دوباره» را بزنید.";
  }
  if (/\b404\b|not found/u.test(value)) {
    return "فایل این موتور روی سرور پیدا نشد. ابتدا راوی را به آخرین نسخه به‌روزرسانی کنید و دوباره تلاش کنید.";
  }
  if (/\b403\b|\b429\b|forbidden|rate limit/u.test(value)) {
    return "سرور دانلود موقتاً درخواست را نپذیرفت. چند دقیقه بعد «تلاش دوباره» را بزنید.";
  }
  if (/fetch failed|network|econn|etime|socket|dns|certificate|tls/u.test(value)) {
    return "ارتباط با سرور دانلود برقرار نشد. اینترنت یا فیلترشکن را بررسی کنید و سپس «تلاش دوباره» را بزنید.";
  }
  return "راه‌اندازی موتور کامل نشد. راوی را یک بار ببندید و باز کنید؛ سپس «تلاش دوباره» را بزنید.";
}

function engineDownloadBytes(engine) {
  return HOSTED_PYTHON.sizeBytes +
    ENGINES[engine].runtime.sizeBytes +
    ENGINES[engine].artifacts.reduce((sum, artifact) => sum + artifact.sizeBytes, 0);
}

function engineSizeBreakdown(engine) {
  const [primary, ...supporting] = ENGINES[engine].artifacts;
  return {
    primaryModelBytes: primary?.sizeBytes || 0,
    supportFilesBytes: supporting.reduce((sum, artifact) => sum + artifact.sizeBytes, 0),
    runtimeBytes: ENGINES[engine].runtime.sizeBytes,
    sharedPythonBytes: HOSTED_PYTHON.sizeBytes,
  };
}

export function createTtsLocalController({ emit, prepareSmartNarration }) {
  const dataRoot = path.join(app.getPath("userData"), "tts-local");
  const engineRoot = path.join(dataRoot, "engines");
  const runtimeRoot = path.join(dataRoot, "runtimes");
  const sharedRuntimeRoot = path.join(runtimeRoot, `python-${HOSTED_PYTHON.version}`);
  const cacheRoot = path.join(dataRoot, "cache");
  const narrationCacheRoot = path.join(dataRoot, "narration-cache");
  const downloadRoot = path.join(dataRoot, "downloads");
  const statePath = path.join(dataRoot, "state.json");
  const helperPath = path.join(dataRoot, "runtime", "tts-helper.py");
  const runtimeExtractorPath = path.join(dataRoot, "runtime", "tts-runtime-extract.py");
  const protocolTokens = new Map();
  const pending = new Map();
  const verificationCache = new Map();
  let loaded = false;
  let storedState = { activeEngine: null };
  let installController = null;
  let installEngine = null;
  let installComponent = null;
  let installState = "idle";
  let installProgress = { progress: 0, downloadedBytes: 0, totalBytes: 0, error: "" };
  let lastNoticeAt = 0;
  let worker = null;
  let workerEngine = null;
  let workerBuffer = "";
  let workerReady = null;

  function modelPath(engine) { return path.join(engineRoot, engine, "model"); }
  function runtimePath(engine) {
    return path.join(runtimeRoot, ENGINES[engine].runtime.sharedKey || engine);
  }
  function sitePackagesPath(engine) { return path.join(runtimePath(engine), "site-packages"); }
  function pythonPath() { return path.join(sharedRuntimeRoot, "python.exe"); }
  function sharedRuntimeMarkerPath() { return path.join(sharedRuntimeRoot, "runtime.json"); }
  function runtimeMarkerPath(engine) { return path.join(runtimePath(engine), "runtime.json"); }
  function markerPath(engine) { return path.join(engineRoot, engine, "installed.json"); }

  async function sharedRuntimeReady() {
    try {
      const marker = JSON.parse(await readFile(sharedRuntimeMarkerPath(), "utf8"));
      return marker.version === HOSTED_PYTHON.version &&
        marker.sha256 === HOSTED_PYTHON.sha256 &&
        await exists(pythonPath());
    } catch { return false; }
  }

  async function engineRuntimeReady(engine) {
    try {
      const marker = JSON.parse(await readFile(runtimeMarkerPath(engine), "utf8"));
      return marker.version === ENGINES[engine].runtime.version &&
        marker.sha256 === ENGINES[engine].runtime.sha256 &&
        await exists(sitePackagesPath(engine));
    } catch { return false; }
  }

  async function requiredDownloadBytes(engine) {
    let total = 0;
    if (!(await sharedRuntimeReady())) total += HOSTED_PYTHON.sizeBytes;
    if (!(await engineRuntimeReady(engine))) total += ENGINES[engine].runtime.sizeBytes;
    for (const artifact of ENGINES[engine].artifacts) {
      try {
        const info = await stat(path.join(modelPath(engine), artifact.fileName));
        if (!info.isFile() || info.size !== artifact.sizeBytes) total += artifact.sizeBytes;
      } catch {
        total += artifact.sizeBytes;
      }
    }
    return total;
  }

  async function createInstallPlan(engine) {
    const sharedRuntime = await sharedRuntimeReady();
    const engineRuntime = await engineRuntimeReady(engine);
    const reusableArtifacts = new Map();
    let totalBytes = (sharedRuntime ? 0 : HOSTED_PYTHON.sizeBytes) +
      (engineRuntime ? 0 : ENGINES[engine].runtime.sizeBytes);
    for (const artifact of ENGINES[engine].artifacts) {
      const destination = path.join(modelPath(engine), artifact.fileName);
      const reusable = (await exists(destination)) && (await hashFile(destination)) === artifact.sha256;
      reusableArtifacts.set(artifact.fileName, reusable);
      if (!reusable) totalBytes += artifact.sizeBytes;
    }
    return { sharedRuntime, engineRuntime, reusableArtifacts, totalBytes };
  }

  async function load() {
    if (loaded) return;
    loaded = true;
    await mkdir(dataRoot, { recursive: true });
    try { storedState = JSON.parse(await readFile(statePath, "utf8")); } catch { storedState = { activeEngine: null }; }
  }

  async function persistState() {
    await mkdir(dataRoot, { recursive: true });
    await writeFile(statePath, JSON.stringify(storedState, null, 2), "utf8");
  }

  async function verifyEngine(engine) {
    const definition = ENGINES[engine];
    let marker;
    try { marker = JSON.parse(await readFile(markerPath(engine), "utf8")); }
    catch { return "not-installed"; }
    if (marker.release !== TTS_RELEASE || marker.version !== definition.version) return "outdated";
    let runtimeMarker;
    let sharedRuntimeMarker;
    try {
      runtimeMarker = JSON.parse(await readFile(runtimeMarkerPath(engine), "utf8"));
      sharedRuntimeMarker = JSON.parse(await readFile(sharedRuntimeMarkerPath(), "utf8"));
    } catch {
      return "invalid";
    }
    if (
      !(await exists(pythonPath())) ||
      !(await exists(sitePackagesPath(engine))) ||
      runtimeMarker.version !== definition.runtime.version ||
      runtimeMarker.sha256 !== definition.runtime.sha256 ||
      sharedRuntimeMarker.version !== HOSTED_PYTHON.version ||
      sharedRuntimeMarker.sha256 !== HOSTED_PYTHON.sha256
    ) return "invalid";

    const artifactStats = [];
    for (const artifact of definition.artifacts) {
      try {
        const info = await stat(path.join(modelPath(engine), artifact.fileName));
        if (!info.isFile() || info.size !== artifact.sizeBytes) return "invalid";
        artifactStats.push(`${artifact.fileName}:${info.size}:${info.mtimeMs}`);
      } catch {
        return "invalid";
      }
    }
    const signature = `${marker.release}:${marker.version}:${runtimeMarker.version}:${sharedRuntimeMarker.version}:${artifactStats.join("|")}`;
    if (verificationCache.get(engine) === signature) return "verified";
    for (const artifact of definition.artifacts) {
      if ((await hashFile(path.join(modelPath(engine), artifact.fileName))) !== artifact.sha256) return "invalid";
    }
    verificationCache.set(engine, signature);
    return "verified";
  }

  async function engineInstalled(engine) {
    return (await verifyEngine(engine)) === "verified";
  }

  async function publicState() {
    await load();
    const engines = [];
    for (const [id, definition] of Object.entries(ENGINES)) {
      const verification = await verifyEngine(id);
      engines.push({
        id,
        label: definition.label,
        description: definition.description,
        downloadBytes: engineDownloadBytes(id),
        requiredDownloadBytes: verification === "verified" ? 0 : await requiredDownloadBytes(id),
        sizeBreakdown: engineSizeBreakdown(id),
        installed: verification === "verified",
        selected: storedState.activeEngine === id,
        version: definition.version,
        license: definition.license,
        restriction: definition.restriction,
        verification,
        checksum: definition.artifacts[0]?.sha256 || "",
      });
    }
    let activeEngine = engines.some((engine) => engine.id === storedState.activeEngine && engine.installed)
      ? storedState.activeEngine
      : engines.find((engine) => engine.installed)?.id ?? null;
    if (storedState.activeEngine !== activeEngine) {
      storedState.activeEngine = activeEngine;
      await persistState();
    }
    return {
      supported: process.platform === "win32" && process.arch === "x64",
      activeEngine,
      installState,
      installEngine,
      installComponent,
      ...installProgress,
      engines: engines.map((engine) => ({ ...engine, selected: engine.id === activeEngine })),
    };
  }

  async function notify() { emit({ type: "model", state: await publicState() }); }

  async function stage(component, state = "installing") {
    installComponent = component;
    installState = state;
    await notify();
  }

  function report(downloadedBytes, totalBytes) {
    installProgress = {
      ...installProgress,
      downloadedBytes,
      totalBytes,
      progress: totalBytes ? Math.min(1, downloadedBytes / totalBytes) : 0,
    };
    const now = Date.now();
    if (downloadedBytes >= totalBytes || now - lastNoticeAt >= 150) {
      lastNoticeAt = now;
      void notify();
    }
  }

  function runtimeEnvironment(engine) {
    return {
      ...process.env,
      AVA_CACHE_DIR: path.join(cacheRoot, "ava-runtime"),
      HF_HOME: path.join(cacheRoot, "huggingface"),
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
      PYTHONNOUSERSITE: "1",
      PYTHONPATH: sitePackagesPath(engine),
      PYTHONUTF8: "1",
      RAAVI_TTS_ENGINE: engine,
    };
  }

  async function prepareHostedArchive(definition, completedBytes, totalBytes) {
    const archive = path.join(downloadRoot, definition.fileName);
    if (!(await exists(archive)) || (await hashFile(archive)) !== definition.sha256) {
      await rm(archive, { force: true });
      await stage("runtime", "downloading");
      await downloadTo(`${DOWNLOAD_BASE}/runtime/${definition.fileName}`, archive, {
        signal: installController.signal,
        totalHint: definition.sizeBytes,
        onProgress(downloaded) { report(completedBytes + downloaded, totalBytes); },
      });
    }
    await stage("runtime", "verifying");
    if ((await hashFile(archive)) !== definition.sha256) {
      await rm(archive, { force: true });
      throw new Error(`Checksum بستهٔ محلی ${definition.fileName} معتبر نیست؛ فایل حذف شد.`);
    }
    return archive;
  }

  async function ensureRuntime(engine, plan, completedBytes, totalBytes) {
    const definition = ENGINES[engine];
    if (!plan.sharedRuntime) {
      const archive = await prepareHostedArchive(HOSTED_PYTHON, completedBytes, totalBytes);
      await stage("runtime", "installing");
      await rm(sharedRuntimeRoot, { recursive: true, force: true });
      await mkdir(sharedRuntimeRoot, { recursive: true });
      await extractZipArchive(archive, sharedRuntimeRoot);
      if (!(await exists(pythonPath()))) throw new Error("Python محلی از بستهٔ راوی استخراج نشد.");
      await writeFile(sharedRuntimeMarkerPath(), JSON.stringify({
        version: HOSTED_PYTHON.version,
        sha256: HOSTED_PYTHON.sha256,
      }), "utf8");
      await rm(archive, { force: true });
      completedBytes += HOSTED_PYTHON.sizeBytes;
      report(completedBytes, totalBytes);
    }

    if (!plan.engineRuntime) {
      const archive = await prepareHostedArchive(definition.runtime, completedBytes, totalBytes);
      await stage("runtime", "installing");
      await rm(sitePackagesPath(engine), { recursive: true, force: true });
      await mkdir(sitePackagesPath(engine), { recursive: true });
      await prepareRuntimeScripts();
      await runCommand(pythonPath(), [
        runtimeExtractorPath,
        archive,
        sitePackagesPath(engine),
      ], { env: { ...process.env, PYTHONUTF8: "1" } });
      await writeFile(runtimeMarkerPath(engine), JSON.stringify({
        version: definition.runtime.version,
        sha256: definition.runtime.sha256,
        python: HOSTED_PYTHON.version,
      }), "utf8");
      await rm(archive, { force: true });
      completedBytes += definition.runtime.sizeBytes;
      report(completedBytes, totalBytes);
    }
    return completedBytes;
  }

  async function installArtifacts(engine, plan, totalBytes) {
    const definition = ENGINES[engine];
    let completedBytes = 0;
    await mkdir(modelPath(engine), { recursive: true });
    for (const artifact of definition.artifacts) {
      const destination = path.join(modelPath(engine), artifact.fileName);
      const reusable = plan.reusableArtifacts.get(artifact.fileName) === true;
      if (!reusable) {
        await rm(destination, { force: true });
        await stage(artifact.fileName === "voice.pt" ? "voice" : "model", "downloading");
        await downloadTo(`${DOWNLOAD_BASE}/${engine}/${artifact.fileName}`, destination, {
          signal: installController.signal,
          totalHint: artifact.sizeBytes,
          onProgress(downloaded) { report(completedBytes + downloaded, totalBytes); },
        });
        await stage(artifact.fileName === "voice.pt" ? "voice" : "model", "verifying");
        if ((await hashFile(destination)) !== artifact.sha256) {
          await rm(destination, { force: true });
          throw new Error(`Checksum فایل ${artifact.fileName} معتبر نیست؛ فایل حذف شد.`);
        }
        completedBytes += artifact.sizeBytes;
        report(completedBytes, totalBytes);
      }
    }
    return completedBytes;
  }

  async function prepareRuntimeScripts() {
    await mkdir(path.dirname(helperPath), { recursive: true });
    await copyFile(HELPER_SOURCE, helperPath);
    await copyFile(RUNTIME_EXTRACTOR_SOURCE, runtimeExtractorPath);
  }

  async function warmEngine(engine) {
    await stage("runtime", "warming");
    await prepareRuntimeScripts();
    if (engine === "ava") {
      const revision = "9587f1e7966e41eaa0c514453cff7fb89db3473e";
      const extracted = path.join(cacheRoot, "ava", "homo-ge2pe", revision);
      await rm(extracted, { recursive: true, force: true });
      await mkdir(extracted, { recursive: true });
      await extractZipArchive(path.join(modelPath(engine), "homo-ge2pe.zip"), extracted);
      await writeFile(path.join(extracted, ".complete"), ".\n", "utf8");
    }
    await runCommand(pythonPath(), [
      helperPath,
      "--engine", engine,
      "--model-root", modelPath(engine),
      "--cache-root", path.join(cacheRoot, engine),
      "--warmup",
    ], { env: runtimeEnvironment(engine) });
  }

  async function runInstall(engine) {
    verificationCache.delete(engine);
    const controller = new AbortController();
    installController = controller;
    let plan = null;
    installProgress = { progress: 0, downloadedBytes: 0, totalBytes: 0, error: "" };
    try {
      plan = await createInstallPlan(engine);
      installProgress.totalBytes = plan.totalBytes;
      const modelBytes = await installArtifacts(engine, plan, plan.totalBytes);
      await ensureRuntime(engine, plan, modelBytes, plan.totalBytes);
      await warmEngine(engine);
      await writeFile(markerPath(engine), JSON.stringify({
        release: TTS_RELEASE,
        version: ENGINES[engine].version,
        verifiedAt: new Date().toISOString(),
        artifacts: ENGINES[engine].artifacts.map(({ fileName, sizeBytes, sha256 }) => ({ fileName, sizeBytes, sha256 })),
      }, null, 2), "utf8");
      storedState.activeEngine = engine;
      await persistState();
      installState = "idle";
      installEngine = null;
      installComponent = null;
      installProgress = {
        progress: 1,
        downloadedBytes: plan?.totalBytes || 0,
        totalBytes: plan?.totalBytes || 0,
        error: "",
      };
      await notify();
    } catch (cause) {
      // Release the lock before publishing an actionable retry state. Otherwise
      // the renderer can show «تلاش دوباره» for one event-loop turn while the
      // previous controller is still present and reject that very retry.
      if (installController === controller) installController = null;
      if (cause?.name === "AbortError") {
        installState = "paused";
      } else {
        installState = "error";
        installProgress.error = friendlyInstallError(cause);
      }
      await notify();
    } finally {
      if (installController === controller) installController = null;
    }
  }

  async function install(_event, engine) {
    await load();
    if (!ENGINES[engine]) throw new Error("موتور شنیدن ناشناخته است.");
    if (process.platform !== "win32" || process.arch !== "x64") {
      throw new Error("نصب خودکار موتور شنیدن فعلاً برای Windows 64-bit آماده است.");
    }
    if (installController) throw new Error("دانلود موتور دیگری در حال انجام است.");
    if (await engineInstalled(engine)) return select(null, engine);
    installEngine = engine;
    void runInstall(engine);
    return publicState();
  }

  async function pause() {
    installController?.abort();
    installState = "paused";
    await notify();
    return publicState();
  }

  async function resume() {
    if (!installEngine) throw new Error("دانلود متوقف‌شده‌ای وجود ندارد.");
    if (installController) throw new Error("دانلود موتور در حال انجام است.");
    void runInstall(installEngine);
    return publicState();
  }

  function stopWorker(message = "ساخت صدای جاری متوقف شد.") {
    worker?.kill();
    worker = null;
    workerEngine = null;
    workerBuffer = "";
    for (const { reject } of pending.values()) reject(new Error(message));
    pending.clear();
  }

  async function select(_event, engine) {
    await load();
    if (!ENGINES[engine] || !(await engineInstalled(engine))) {
      throw new Error("این موتور هنوز کامل نصب نشده است.");
    }
    if (workerEngine !== engine) stopWorker("موتور شنیدن تغییر کرد.");
    storedState.activeEngine = engine;
    await persistState();
    await notify();
    return publicState();
  }

  async function remove(_event, engine) {
    await load();
    if (!ENGINES[engine]) throw new Error("موتور شنیدن ناشناخته است.");
    if (workerEngine === engine) stopWorker();
    verificationCache.delete(engine);
    await rm(path.join(engineRoot, engine), { recursive: true, force: true });
    let sharedRuntimeInUse = false;
    for (const otherEngine of Object.keys(ENGINES)) {
      if (
        otherEngine !== engine &&
        runtimePath(otherEngine) === runtimePath(engine) &&
        await exists(markerPath(otherEngine))
      ) {
        sharedRuntimeInUse = true;
        break;
      }
    }
    if (!sharedRuntimeInUse) {
      await rm(runtimePath(engine), { recursive: true, force: true });
    }
    if (storedState.activeEngine === engine) storedState.activeEngine = null;
    await persistState();
    await notify();
    return publicState();
  }

  function handleWorkerLine(line) {
    let payload;
    try { payload = JSON.parse(line); } catch { return; }
    if (payload.type === "ready") {
      workerReady?.resolve();
      workerReady = null;
      return;
    }
    if (payload.type !== "result") return;
    const request = pending.get(payload.id);
    if (!request) return;
    pending.delete(payload.id);
    if (payload.ok) request.resolve(payload);
    else request.reject(new Error(payload.error || "موتور نتوانست جمله را بخواند."));
  }

  async function ensureWorker(engine) {
    if (worker && workerEngine === engine) return;
    stopWorker();
    await prepareRuntimeScripts();
    let readyResolve;
    let readyReject;
    const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    workerReady = { resolve: readyResolve, reject: readyReject };
    workerEngine = engine;
    worker = spawn(pythonPath(), [
      helperPath,
      "--engine", engine,
      "--model-root", modelPath(engine),
      "--cache-root", path.join(cacheRoot, engine),
    ], { windowsHide: true, env: runtimeEnvironment(engine) });
    worker.stdout.setEncoding("utf8");
    worker.stdout.on("data", (chunk) => {
      workerBuffer += chunk;
      const lines = workerBuffer.split(/\r?\n/u);
      workerBuffer = lines.pop() || "";
      for (const line of lines) handleWorkerLine(line);
    });
    let workerError = "";
    worker.stderr.on("data", (chunk) => { workerError = `${workerError}${chunk}`.slice(-6000); });
    worker.once("error", (error) => {
      workerReady?.reject(error);
      workerReady = null;
      stopWorker(error.message);
    });
    worker.once("close", (code) => {
      const message = workerError.trim() || `موتور شنیدن با کد ${code} متوقف شد.`;
      workerReady?.reject(new Error(message));
      workerReady = null;
      stopWorker(message);
    });
    await ready;
  }

  async function requestWorker(engine, payload) {
    await ensureWorker(engine);
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.stdin.write(`${JSON.stringify({ id, ...payload })}\n`, "utf8", (error) => {
        if (!error) return;
        pending.delete(id);
        reject(error);
      });
    });
  }

  async function renderSpeech(engine, text, speed, output, pauseAfterMs = 0, depth = 0) {
    const forceSplit = shouldPreSplitSpeech(engine, text);
    const directOutput = `${output}.${randomUUID()}.wav`;
    let metadata = null;
    if (!forceSplit) {
      try {
        metadata = await requestWorker(engine, {
          operation: "synthesize",
          text,
          speed,
          pauseMs: pauseAfterMs,
          output: directOutput,
        });
        if (audioMetadataLooksComplete(text, speed, metadata)) {
          await rename(directOutput, output);
          return { ...metadata, recovered: depth > 0, segmentCount: 1 };
        }
      } finally {
        if (await exists(directOutput)) await rm(directOutput, { force: true });
      }
    }

    const pieces = splitSpeechForRetry(text);
    if (depth >= 3 || pieces.length < 2) {
      throw new Error("TTS_AUDIO_INCOMPLETE");
    }
    const partFiles = [];
    const partMetadata = [];
    try {
      for (const piece of pieces) {
        const partFile = `${output}.${randomUUID()}.part.wav`;
        partFiles.push(partFile);
        partMetadata.push(await renderSpeech(engine, piece, speed, partFile, 0, depth + 1));
      }
      const mergedOutput = `${output}.${randomUUID()}.merged.wav`;
      try {
        metadata = await requestWorker(engine, {
          operation: "concat",
          inputs: partFiles,
          interPauseMs: 85,
          pauseMs: pauseAfterMs,
          output: mergedOutput,
        });
        await rename(mergedOutput, output);
      } finally {
        if (await exists(mergedOutput)) await rm(mergedOutput, { force: true });
      }
    } finally {
      await Promise.all(partFiles.map((filePath) => rm(filePath, { force: true })));
    }
    return {
      ...metadata,
      recovered: true,
      segmentCount: partMetadata.reduce((sum, item) => sum + Number(item.segmentCount || 1), 0),
    };
  }

  async function pruneCache() {
    await mkdir(cacheRoot, { recursive: true });
    const entries = [];
    for (const name of await readdir(cacheRoot)) {
      if (!name.endsWith(".wav")) continue;
      const filePath = path.join(cacheRoot, name);
      const info = await stat(filePath);
      entries.push({ filePath, size: info.size, modified: info.mtimeMs });
    }
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of entries.sort((a, b) => a.modified - b.modified)) {
      if (total <= CACHE_LIMIT_BYTES) break;
      await rm(entry.filePath, { force: true });
      await rm(`${entry.filePath}.json`, { force: true });
      total -= entry.size;
    }
  }

  async function readCachedAudio(output, text, speed) {
    try {
      const [info, metadata] = await Promise.all([
        stat(output),
        readFile(`${output}.json`, "utf8").then(JSON.parse),
      ]);
      if (
        !info.isFile() ||
        info.size < 1_000 ||
        metadata?.cacheVersion !== AUDIO_CACHE_VERSION ||
        !audioMetadataLooksComplete(text, speed, metadata)
      ) return null;
      return metadata;
    } catch {
      return null;
    }
  }

  function validateNarrationResult(input, candidate) {
    if (!Array.isArray(candidate?.segments) || candidate.segments.length !== input.length) return null;
    const segments = candidate.segments.map((segment, index) => {
      const expected = input[index];
      if (
        segment?.id !== expected.id ||
        segment?.sourceText !== expected.sourceText ||
        typeof segment?.spokenText !== "string" ||
        !segment.spokenText.trim() ||
        segment.spokenText.length > 700
      ) return null;
      return {
        id: expected.id,
        sourceText: expected.sourceText,
        spokenText: segment.spokenText.replace(/\s+/gu, " ").trim(),
        pauseAfterMs: Math.max(0, Math.min(900, Number(segment.pauseAfterMs) || 0)),
      };
    });
    return segments.every(Boolean) ? segments : null;
  }

  async function prepareNarration(_event, payload) {
    const rawSegments = Array.isArray(payload?.segments) ? payload.segments : [];
    if (!rawSegments.length || rawSegments.length > 2000) throw new Error("NARRATION_INPUT_INVALID");
    const segments = rawSegments.map((segment) => ({
      id: String(segment?.id ?? "").trim().slice(0, 120),
      sourceText: String(segment?.sourceText ?? "").replace(/\s+/gu, " ").trim().slice(0, 700),
    }));
    if (segments.some((segment) => !segment.id || !segment.sourceText)) {
      throw new Error("NARRATION_INPUT_INVALID");
    }
    const model = String(payload?.model ?? "").trim().slice(0, 120);
    const serialized = JSON.stringify({ version: NARRATION_DIRECTOR_VERSION, model, segments });
    if (serialized.length > 480_000) throw new Error("NARRATION_INPUT_TOO_LARGE");
    const cacheKey = createHash("sha256").update(serialized).digest("hex");
    const cachePath = path.join(narrationCacheRoot, `${cacheKey}.json`);
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8"));
      const validated = validateNarrationResult(segments, cached);
      if (validated) return { mode: "smart", cached: true, segments: validated };
    } catch {
      // A cache miss or stale entry falls through to the connected Codex path.
    }
    if (typeof prepareSmartNarration !== "function") throw new Error("CODEX_CLI_MISSING");
    const prepared = await prepareSmartNarration({ model, segments });
    const validated = validateNarrationResult(segments, prepared);
    if (!validated) throw new Error("NARRATION_RESPONSE_INVALID");
    await mkdir(narrationCacheRoot, { recursive: true });
    await writeFile(cachePath, JSON.stringify({ segments: validated }), "utf8");
    return { mode: "smart", cached: false, segments: validated };
  }

  async function synthesize(_event, payload) {
    await load();
    const engine = payload?.engine || storedState.activeEngine;
    const text = String(payload?.text || "").replace(/\s+/gu, " ").trim();
    const speed = Math.max(0.5, Math.min(2, Number(payload?.speed) || 1));
    const nativeSpeed = engine === "gooya" || engine === "f5ipa" ? 1 : speed;
    const pauseAfterMs = Math.max(0, Math.min(900, Number(payload?.pauseAfterMs) || 0));
    if (!ENGINES[engine] || !(await engineInstalled(engine))) throw new Error("موتور شنیدن نصب و انتخاب نشده است.");
    if (!text || text.length > 900) throw new Error("جملهٔ قابل خواندن معتبر نیست.");
    await mkdir(cacheRoot, { recursive: true });
    const cacheKey = createHash("sha256")
      .update(`${AUDIO_CACHE_VERSION}:${engine}:${ENGINES[engine].version}:${nativeSpeed}:${pauseAfterMs}:${text}`)
      .digest("hex");
    const output = path.join(cacheRoot, `${cacheKey}.wav`);
    let metadata = await readCachedAudio(output, text, nativeSpeed);
    let cached = Boolean(metadata);
    if (!cached) {
      await rm(output, { force: true });
      await rm(`${output}.json`, { force: true });
      metadata = await renderSpeech(engine, text, nativeSpeed, output, pauseAfterMs);
      await writeFile(`${output}.json`, JSON.stringify({
        ...metadata,
        cacheVersion: AUDIO_CACHE_VERSION,
      }), "utf8");
      cached = false;
      void pruneCache();
    }
    const token = randomUUID();
    protocolTokens.set(token, output);
    while (protocolTokens.size > 512) {
      protocolTokens.delete(protocolTokens.keys().next().value);
    }
    return {
      engine,
      source: `raavi-audio://tts/${token}`,
      cached,
      durationMs: Number(metadata?.durationMs || 0),
      recovered: metadata?.recovered === true,
      segmentCount: Math.max(1, Number(metadata?.segmentCount || 1)),
      nativeSpeed,
    };
  }

  async function preview(_event, engine) {
    if (!ENGINES[engine]) throw new Error("موتور شنیدن ناشناخته است.");
    return synthesize(null, { engine, text: ENGINES[engine].sample, speed: 1 });
  }

  function cancel() {
    stopWorker();
    return { cancelled: true };
  }

  function resolveProtocol(urlValue) {
    const url = new URL(urlValue);
    if (url.hostname !== "tts") return "";
    const token = url.pathname.split("/").filter(Boolean).at(-1) || "";
    return protocolTokens.get(token) || "";
  }

  return {
    getState: publicState,
    install,
    pause,
    resume,
    select,
    remove,
    preview,
    prepareNarration,
    synthesize,
    cancel,
    resolveProtocol,
    dispose() {
      installController?.abort();
      stopWorker();
      protocolTokens.clear();
    },
  };
}
