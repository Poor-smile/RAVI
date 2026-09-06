(() => {
  "use strict";

  const experience = document.querySelector("[data-experience]");
  const canvas = document.querySelector("#raavi-ocean");
  const logoStage = document.querySelector("[data-logo-stage]");
  const logo = document.querySelector("[data-raavi-logo]");
  const infoWindow = document.querySelector("[data-info-window]");
  const minimizeButton = document.querySelector("[data-minimize]");
  const restoreButton = document.querySelector("[data-restore]");
  const windowBar = document.querySelector(".window-bar");
  const windowBody = document.querySelector(".window-body");
  const windowDock = document.querySelector(".window-dock");
  const arena = document.querySelector("[data-feature-arena]");
  const themeSwitch = document.querySelector("[data-theme-switch]");
  const cardFan = document.querySelector("[data-card-fan]");
  const galleryCards = document.querySelectorAll("[data-gallery-card]");
  const galleryLaunch = document.querySelector("[data-gallery-launch]");
  const galleryDialog = document.querySelector("[data-gallery-dialog]");
  const galleryDialogClose = document.querySelector("[data-gallery-close]");
  const galleryPrevious = document.querySelector("[data-gallery-previous]");
  const galleryNext = document.querySelector("[data-gallery-next]");
  const galleryImage = document.querySelector("[data-gallery-image]");
  const galleryTitle = document.querySelector("[data-gallery-title]");
  const galleryCaption = document.querySelector("[data-gallery-caption]");
  const galleryDescription = document.querySelector("[data-gallery-description]");
  const galleryThumbnails = document.querySelectorAll("[data-gallery-thumbnail]");
  const downloadDialog = document.querySelector("[data-download-dialog]");
  const downloadDialogClose = document.querySelector("[data-download-close]");
  const downloadOpenButtons = document.querySelectorAll("[data-download-open]");
  const supportDialog = document.querySelector("[data-support-dialog]");
  const supportDialogClose = document.querySelector("[data-support-close]");
  const dialog = document.querySelector("[data-feature-dialog]");
  const dialogClose = document.querySelector("[data-dialog-close]");
  const dialogTag = document.querySelector("[data-feature-tag]");
  const dialogTitle = document.querySelector("[data-feature-title]");
  const dialogDescription = document.querySelector("[data-feature-description]");
  const dialogImage = document.querySelector("[data-feature-image]");

  if (
    !experience ||
    !canvas ||
    !logoStage ||
    !logo ||
    !infoWindow ||
    !minimizeButton ||
    !restoreButton ||
    !windowBar ||
    !windowBody ||
    !windowDock ||
    !arena ||
    !themeSwitch ||
    !cardFan ||
    !galleryCards.length ||
    !galleryLaunch ||
    !galleryDialog ||
    !galleryDialogClose ||
    !galleryPrevious ||
    !galleryNext ||
    !galleryImage ||
    !galleryTitle ||
    !galleryCaption ||
    !galleryDescription ||
    !galleryThumbnails.length ||
    !downloadDialog ||
    !downloadDialogClose ||
    !downloadOpenButtons.length ||
    !supportDialog ||
    !supportDialogClose ||
    !dialog ||
    !dialogClose ||
    !dialogTag ||
    !dialogTitle ||
    !dialogDescription ||
    !dialogImage
  ) {
    return;
  }

  const features = [
    {
      tag: "#هوش_مصنوعی",
      title: "راوی هوشمند",
      description: "دستیار هوشمند راوی کنار متن شما می‌ماند تا پیشنهادها را در همان فضای نوشتن بررسی کنید و کنترل نسخهٔ نهایی همیشه دست خودتان باشد.",
      image: "./assets/screens/feature-ai-review.png?v=2.4.5-20260906",
      alt: "نمای تازهٔ بازبینی هوشمند در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#اتصال_ChatGPT",
      title: "بازبینی با ChatGPT",
      description: "متن را در بافت همان سند بازبینی کنید، پیشنهادها را ببینید و فقط تغییرهایی را که می‌خواهید وارد نوشته کنید.",
      image: "./assets/screens/feature-ai-review.png?v=2.4.5-20260906",
      alt: "نمای تازهٔ پیشنهادهای هوشمند در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#اصلاح_متن",
      title: "اصلاح و بازنویسی",
      description: "غلط‌های نوشتاری، جمله‌های سنگین و ناهماهنگی‌های متن را پیدا کنید و نتیجه را پیش از اعمال نهایی بررسی کنید.",
      image: "./assets/screens/feature-ai-review.png?v=2.4.5-20260906",
      alt: "نمای تازهٔ اصلاح و بازنویسی در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#ترجمه",
      title: "ترجمه در دل سند",
      description: "بخش انتخاب‌شده را بدون خارج‌شدن از جریان نوشتن ترجمه کنید و نسخهٔ اصلی را برای مقایسه در اختیار داشته باشید.",
      image: "./assets/screens/feature-writing.png?v=2.4.5-20260906",
      alt: "نمای تازهٔ نوشتن فارسی در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#خروجی_Word_PDF",
      title: "خروجی Word و PDF",
      description: "نوشتهٔ مرتب‌شده را برای ادامهٔ کار یا اشتراک‌گذاری به قالب‌های Word و PDF ببرید؛ بدون اینکه ساختار خوانای سند را از دست بدهید.",
      image: "./assets/screens/feature-export.png?v=2.4.5-20260906",
      alt: "پنجرهٔ تازهٔ خروجی Word و PDF در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#جدول",
      title: "جدول‌های خوانا",
      description: "جدول‌های Markdown را در کنار متن فارسی بسازید و نتیجهٔ نهایی را همان لحظه در پیش‌نمایش ببینید.",
      image: "./assets/screens/feature-table.png?v=2.4.5-20260906",
      alt: "جدول قابل‌ویرایش در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#فرمول",
      title: "فرمول‌نویسی",
      description: "فرمول‌ها را در یک جریان بصری و دقیق بسازید تا محتوای علمی کنار متن فارسی، خوانا و منظم باقی بماند.",
      image: "./assets/screens/feature-formula.png?v=2.4.5-20260906",
      alt: "استودیوی تازهٔ فرمول در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#مرمید",
      title: "نمودارهای Mermaid",
      description: "نمودار Mermaid را از همان بلوک استاندارد سند بسازید، تمام‌صفحه بررسی کنید و با زوم و جابه‌جایی جزئیاتش را بخوانید.",
      image: "./assets/screens/feature-mermaid.png?v=2.4.5-20260906",
      alt: "نمودار تمیز Mermaid در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#نمودار_و_چارت",
      title: "ساختار، نمودار و چارت",
      description: "ایده‌ها و رابطه‌ها را به شکل نمودارهای قابل‌خواندن درآورید و آن‌ها را کنار متن اصلی نگه دارید.",
      image: "./assets/screens/feature-mermaid.png?v=2.4.5-20260906",
      alt: "استودیوی تازهٔ نمودار و چارت در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#هایلایت",
      title: "هایلایت و حاشیه‌نویسی",
      description: "بخش‌های مهم را برجسته کنید، روی متن یادداشت بگذارید و هنگام مطالعه مسیر فکر خود را از دست ندهید.",
      image: "./assets/screens/feature-reading-highlights.png?v=2.4.5-20260906",
      alt: "هایلایت‌های واقعی در نمای مطالعهٔ راوی ۲.۲",
    },
    {
      tag: "#نمای_مطالعه",
      title: "نمای مطالعه",
      description: "ابزارهای اضافی کنار می‌روند تا نوشته با عرض مناسب، جهت درست و تمرکز کامل برای مطالعه نمایش داده شود.",
      image: "./assets/screens/feature-reading-highlights.png?v=2.4.5-20260906",
      alt: "نمای تازهٔ مطالعه در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#کتابخانه_محلی",
      title: "کتابخانهٔ فایل‌ها",
      description: "پوشه‌های Markdown را با اجازهٔ خودتان به راوی وصل کنید، فایل‌ها را جست‌وجو و سنجاق کنید و همه‌چیز را روی دستگاه نگه دارید.",
      image: "./assets/screens/feature-library.png?v=2.4.5-20260906",
      alt: "کتابخانهٔ محلی در رابط واقعی راوی ۲.۲",
    },
    {
      tag: "#پشتیبان_ابری",
      title: "Google Drive و Proton Drive",
      description: "نسخه‌های پشتیبان را در فضای ابری انتخابی خود نگه دارید تا نوشته‌ها میان دستگاه‌ها در دسترس و قابل‌بازیابی باشند.",
      image: "./assets/screens/feature-cloud-backup.png?v=2.4.5-20260906",
      alt: "تنظیمات تازهٔ Google Drive و Proton Drive در راوی ۲.۲",
    },
    {
      tag: "#فارسی_یکپارچه",
      title: "سازگاری کامل با فارسی",
      description: "راوی جهت هر بخش را تشخیص می‌دهد تا فارسی، انگلیسی، کد، جدول و پیوندها در یک سند ترکیبی به‌هم نریزند.",
      image: "./assets/screens/feature-writing.png?v=2.4.5-20260906",
      alt: "سند ترکیبی فارسی در رابط واقعی راوی ۲.۲",
    },
  ];

  const galleryItems = [
    {
      title: "سند ذخیره‌شده · حالت روشن",
      description: "یک سند ذخیره‌شده با تیتر، فرمول پیچیده و جدول در فضای روشن راوی.",
      image: "./assets/screens/gallery-01-writing-light.png?v=2.4.5-20260906",
      alt: "نمای واقعی یک سند ذخیره‌شده در راوی با تیتر، فرمول و جدول در حالت روشن",
    },
    {
      title: "همان سند · حالت تاریک",
      description: "همان سند، با حفظ کامل ساختار و خوانایی در تم تاریک.",
      image: "./assets/screens/gallery-02-writing-dark.png?v=2.4.5-20260906",
      alt: "نمای واقعی همان سند شامل تیتر، فرمول و جدول در حالت تاریک راوی",
    },
    {
      title: "راوی هوشمند · تبدیل متن به جدول",
      description: "یک بلاک انتخاب شده و درخواست تبدیل آن به جدول در پنل راوی هوشمند آماده است.",
      image: "./assets/screens/gallery-03-ai-table.png?v=2.4.5-20260906",
      alt: "متن انتخاب‌شده و درخواست تبدیل آن به جدول در پنل هوش مصنوعی راوی",
    },
    {
      title: "گزارش مدیریتی · مطالعه و هایلایت",
      description: "گزارشی فصل‌بندی‌شده در نمای مطالعه، همراه فهرست سند و یک هایلایت واقعی.",
      image: "./assets/screens/gallery-04-reading-report.png?v=2.4.5-20260906",
      alt: "گزارش مدیریتی فصل‌بندی‌شده در نمای مطالعه راوی با متن هایلایت‌شده",
    },
    {
      title: "نمونه‌خوانی دوبرگی",
      description: "کد Markdown و نمای نوشتار به‌صورت هم‌زمان و همگام کنار هم قرار گرفته‌اند.",
      image: "./assets/screens/gallery-05-split-view.png?v=2.4.5-20260906",
      alt: "نمای دوبرگی کد Markdown و متن نهایی در راوی",
    },
    {
      title: "پشتیبان‌گیری ابری",
      description: "تنظیم مقصد و سیاست پشتیبان‌گیری برای Google Drive و Proton Drive.",
      image: "./assets/screens/gallery-06-backup-settings.png?v=2.4.5-20260906",
      alt: "صفحه تنظیمات پشتیبان‌گیری Google Drive و Proton Drive در راوی",
    },
    {
      title: "تبدیل صوت به نوشتار",
      description: "یک بلاک صوت در حال تبدیل محلی به نوشتار است و پیشرفت پردازش در پنل نمایش داده می‌شود.",
      image: "./assets/screens/gallery-07-audio-transcription.png?v=2.4.5-20260906",
      alt: "بلاک صوت و پنل تبدیل صوت به نوشتار راوی در حال پردازش",
    },
    {
      title: "مرکز فرمان راوی",
      description: "فرمان‌های پرکاربرد، نماها و ابزارهای راوی با جست‌وجوی سریع و دسترسی کامل از صفحه‌کلید.",
      image: "./assets/screens/gallery-08-command-center.png?v=2.4.5-20260906",
      alt: "مرکز فرمان راوی با فهرست فرمان‌های پرکاربرد و کادر جست‌وجو",
    },
  ];

  const bodies = [];
  let featureDeck = [];
  let isExploring = false;
  let frameId = 0;
  let lastFrameAt = 0;
  let lastPhysicsAt = 0;
  let measureLogoUntil = 0;
  let lastStyledX = Infinity;
  let lastStyledY = Infinity;
  let lastStyledDarkness = Infinity;
  let themeIsDark = false;
  let themeDarkness = 0.08;
  let clicksUntilHeart = randomSupportInterval();
  let galleryIndex = 0;
  let galleryReturnFocus = null;
  let cardFanObserver = null;
  let oceanNeedsResize = true;
  let arenaWidth = window.innerWidth;
  let arenaHeight = window.innerHeight;

  const compactViewport = window.matchMedia("(max-width: 720px)").matches;
  const limitedCpu = (navigator.hardwareConcurrency || 4) <= 4;
  const limitedMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const constrainedDevice = compactViewport || limitedCpu || limitedMemory;
  const renderScale = constrainedDevice ? 0.68 : 0.86;
  const frameInterval = 1000 / (constrainedDevice ? 30 : 36);
  const pointer = { x: 0.72, y: 0.1, targetX: 0.72, targetY: 0.1 };

  function shuffledFeatures() {
    return [...features].sort(() => Math.random() - 0.5);
  }

  function randomSupportInterval() {
    return 5 + Math.floor(Math.random() * 5);
  }

  function resetFeatureDeck() {
    featureDeck = shuffledFeatures();
  }

  function createOceanRenderer() {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      premultipliedAlpha: false,
    });

    if (!gl) {
      experience.classList.add("is-webgl-fallback");
      return null;
    }

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform vec2 u_pointer;
      uniform float u_time;
      uniform float u_darkness;
      uniform vec4 u_icon_rect;

      float roundedBox(vec2 p, vec2 b, float radius) {
        vec2 q = abs(p) - b + radius;
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
      }

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        mat2 turn = mat2(0.84, 0.54, -0.54, 0.84);
        for (int i = 0; i < 3; i++) {
          value += amplitude * noise(p);
          p = turn * p * 2.03 + 0.17;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = v_uv;
        vec2 glassUv = (uv - u_icon_rect.xy) / max(u_icon_rect.zw, vec2(0.001));
        vec2 glassP = glassUv * 2.0 - 1.0;
        float glassDistance = roundedBox(glassP, vec2(0.92), 0.39);
        float glassMask = 1.0 - smoothstep(-0.018, 0.018, glassDistance);
        float glassRim = 1.0 - smoothstep(0.0, 0.055, abs(glassDistance));
        float lens = pow(clamp(length(glassP) / 1.22, 0.0, 1.0), 2.4);
        vec2 lensDirection = glassP / max(length(glassP), 0.001);
        uv -= lensDirection * lens * glassMask * 0.028;

        float aspect = u_resolution.x / max(u_resolution.y, 1.0);
        vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
        float t = u_time * 0.17;
        vec2 current = vec2(
          fbm(p * 2.05 + vec2(t * 0.36, -t * 0.21)),
          fbm(p * 2.2 + vec2(-t * 0.24, t * 0.31) + 5.7)
        );
        vec2 fold = vec2(
          fbm(p * 3.0 + current * 2.1 + vec2(1.7, 8.2)),
          noise(p * 2.75 - current * 1.8 + vec2(7.1, 2.8))
        );
        float sea = fbm(p * 2.45 + current * 2.7 + fold * 1.15);
        float ribbon = 0.5 + 0.5 * sin(p.x * 3.2 - p.y * 2.05 + sea * 5.1 + t * 1.35);
        float crossWave = 0.5 + 0.5 * sin(p.y * 4.0 + p.x * 1.15 - fold.y * 4.7 - t * 0.92);
        float pointerDistance = distance(uv, u_pointer);
        float pointerWave = sin(pointerDistance * 31.0 - u_time * 1.8) * exp(-pointerDistance * 5.2) * 0.055;
        sea = clamp(sea + pointerWave, 0.0, 1.0);

        vec3 cyan = vec3(0.22, 0.82, 0.91);
        vec3 blue = vec3(0.16, 0.34, 0.88);
        vec3 violet = vec3(0.47, 0.23, 0.88);
        vec3 magenta = vec3(0.91, 0.24, 0.68);
        vec3 coral = vec3(1.0, 0.52, 0.47);
        vec3 color = mix(cyan, blue, smoothstep(0.12, 0.78, ribbon));
        color = mix(color, violet, smoothstep(0.37, 0.88, sea));
        color = mix(color, magenta, smoothstep(0.46, 0.92, crossWave * sea));
        color = mix(color, coral, smoothstep(0.68, 0.98, fold.x + uv.x * 0.25));

        float caustic = pow(max(0.0, sin((sea + ribbon) * 13.0 + u_time * 0.24)), 12.0);
        color += vec3(0.45, 0.74, 1.0) * caustic * 0.14;
        color += glassRim * vec3(0.64, 0.84, 1.0) * 0.22;
        float softEdge = smoothstep(0.92, 0.18, distance(uv, vec2(0.34, 0.51)));
        color = mix(color, vec3(0.94, 0.97, 1.0), mix(0.34, 0.08, softEdge));
        color += (hash(gl_FragCoord.xy + u_time * 17.0) - 0.5) * 0.018;
        color *= 0.97 + 0.05 * softEdge;

        vec3 night = mix(vec3(0.012, 0.022, 0.066), color * vec3(0.46, 0.42, 0.62), 0.78);
        night += vec3(0.04, 0.03, 0.11) * (ribbon + sea) * 0.42;
        gl_FragColor = vec4(mix(color, night, u_darkness), 1.0);
      }
    `;

    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "WebGL shader failed";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    }

    let program;
    try {
      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "WebGL link failed");
      }
    } catch {
      experience.classList.add("is-webgl-fallback");
      return null;
    }

    const locations = {
      position: gl.getAttribLocation(program, "a_position"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
      pointer: gl.getUniformLocation(program, "u_pointer"),
      time: gl.getUniformLocation(program, "u_time"),
      darkness: gl.getUniformLocation(program, "u_darkness"),
      iconRect: gl.getUniformLocation(program, "u_icon_rect"),
    };
    const buffer = gl.createBuffer();
    const iconRectUniform = new Float32Array([0.16, 0.2, 0.36, 0.56]);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1) * renderScale;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      oceanNeedsResize = false;
    }

    function measureIcon() {
      const oceanRect = canvas.getBoundingClientRect();
      const iconRect = logo.getBoundingClientRect();
      iconRectUniform[0] = (iconRect.left - oceanRect.left) / Math.max(oceanRect.width, 1);
      iconRectUniform[1] = 1 - (iconRect.bottom - oceanRect.top) / Math.max(oceanRect.height, 1);
      iconRectUniform[2] = iconRect.width / Math.max(oceanRect.width, 1);
      iconRectUniform[3] = iconRect.height / Math.max(oceanRect.height, 1);
    }

    return {
      draw(timestamp, darkness) {
        const shouldMeasureIcon = oceanNeedsResize || timestamp < measureLogoUntil;
        if (oceanNeedsResize) resize();
        if (shouldMeasureIcon) measureIcon();
        gl.useProgram(program);
        gl.uniform2f(locations.resolution, canvas.width, canvas.height);
        gl.uniform2f(locations.pointer, pointer.x * 0.5 + 0.5, 0.5 - pointer.y * 0.5);
        gl.uniform1f(locations.time, timestamp / 1000);
        gl.uniform1f(locations.darkness, darkness);
        gl.uniform4fv(locations.iconRect, iconRectUniform);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
    };
  }

  const ocean = createOceanRenderer();

  function updateArenaBounds() {
    const rect = arena.getBoundingClientRect();
    arenaWidth = rect.width;
    arenaHeight = rect.height;
    bodies.forEach((body) => {
      body.x = Math.max(10, Math.min(body.x, arenaWidth - body.width - 10));
      body.y = Math.max(10, Math.min(body.y, arenaHeight - body.height - 92));
    });
  }

  function syncCardFanSize() {
    const rect = infoWindow.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      cardFan.style.setProperty("--fan-width", `${rect.width.toFixed(2)}px`);
      cardFan.style.setProperty("--fan-height", `${rect.height.toFixed(2)}px`);
    }
  }

  function clearFeatures() {
    bodies.splice(0).forEach((body) => body.element.remove());
    resetFeatureDeck();
    clicksUntilHeart = randomSupportInterval();
  }

  function openFeature(feature) {
    dialogTag.textContent = feature.tag;
    dialogTitle.textContent = feature.title;
    dialogDescription.textContent = feature.description;
    dialogImage.src = feature.image;
    dialogImage.alt = feature.alt;
    if (!dialog.open) dialog.showModal();
  }

  function renderGallery(index) {
    galleryIndex = (index + galleryItems.length) % galleryItems.length;
    const item = galleryItems[galleryIndex];
    galleryImage.src = item.image;
    galleryImage.alt = item.alt;
    galleryTitle.textContent = item.title;
    galleryCaption.textContent = item.title;
    galleryDescription.textContent = item.description;
    galleryThumbnails.forEach((thumbnail, thumbnailIndex) => {
      thumbnail.setAttribute("aria-current", thumbnailIndex === galleryIndex ? "true" : "false");
    });
  }

  function openGallery(index, opener) {
    galleryReturnFocus = opener;
    renderGallery(index);
    if (!galleryDialog.open) galleryDialog.showModal();
  }

  function galleryCardBehindPoint(clientX, clientY) {
    return document
      .elementsFromPoint(clientX, clientY)
      .map((element) => element.closest?.("[data-gallery-card]"))
      .find(Boolean);
  }

  function spawnFeature() {
    if (!isExploring || dialog.open || supportDialog.open || downloadDialog.open || galleryDialog.open) return;

    clicksUntilHeart -= 1;
    const isSupportHeart = clicksUntilHeart <= 0;
    if (isSupportHeart) clicksUntilHeart = randomSupportInterval();
    if (!isSupportHeart && !featureDeck.length) resetFeatureDeck();
    if (bodies.length >= features.length) {
      const oldest = bodies.shift();
      oldest.element.remove();
    }

    const feature = isSupportHeart ? null : featureDeck.pop();
    const element = document.createElement("button");
    element.type = "button";
    element.className = isSupportHeart ? "feature-token support-token is-new" : "feature-token is-new";
    element.textContent = isSupportHeart ? "♥" : feature.tag;
    element.setAttribute(
      "aria-label",
      isSupportHeart ? "نمایش راه‌های حمایت از راوی" : `نمایش جزئیات ${feature.title}`,
    );
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      if (isSupportHeart) supportDialog.showModal();
      else openFeature(feature);
    });
    arena.append(element);

    const arenaRect = arena.getBoundingClientRect();
    const logoRect = logo.getBoundingClientRect();
    const tokenRect = element.getBoundingClientRect();
    const angle = Math.random() * Math.PI * 2;
    const speed = 72 + Math.random() * 74;
    const spawnRadius = Math.min(logoRect.width, logoRect.height) * 0.18;
    const centerX = logoRect.left - arenaRect.left + logoRect.width / 2;
    const centerY = logoRect.top - arenaRect.top + logoRect.height * 0.56;

    bodies.push({
      feature,
      element,
      width: tokenRect.width,
      height: tokenRect.height,
      x: centerX - tokenRect.width / 2 + Math.cos(angle) * spawnRadius,
      y: centerY - tokenRect.height / 2 + Math.sin(angle) * spawnRadius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 38,
      rotation: (Math.random() - 0.5) * 8,
      angularVelocity: (Math.random() - 0.5) * 9,
      phase: Math.random() * Math.PI * 2,
      floatRate: 0.75 + Math.random() * 0.65,
      bornAt: performance.now(),
    });

    window.setTimeout(() => element.classList.remove("is-new"), 520);
  }

  function resolveBodyCollisions() {
    for (let firstIndex = 0; firstIndex < bodies.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < bodies.length; secondIndex += 1) {
        const first = bodies[firstIndex];
        const second = bodies[secondIndex];
        const firstCenterX = first.x + first.width / 2;
        const firstCenterY = first.y + first.height / 2;
        const secondCenterX = second.x + second.width / 2;
        const secondCenterY = second.y + second.height / 2;
        const dx = secondCenterX - firstCenterX;
        const dy = secondCenterY - firstCenterY;
        const minDistance = Math.min(76, (Math.min(first.width, 150) + Math.min(second.width, 150)) * 0.34);
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= 0 || distanceSquared >= minDistance * minDistance) continue;

        const distance = Math.sqrt(distanceSquared);
        const normalX = dx / distance;
        const normalY = dy / distance;
        const overlap = (minDistance - distance) * 0.5;
        first.x -= normalX * overlap;
        first.y -= normalY * overlap;
        second.x += normalX * overlap;
        second.y += normalY * overlap;
        const relativeVelocity = (second.vx - first.vx) * normalX + (second.vy - first.vy) * normalY;
        if (relativeVelocity < 0) {
          const impulse = relativeVelocity * 0.78;
          first.vx += impulse * normalX;
          first.vy += impulse * normalY;
          second.vx -= impulse * normalX;
          second.vy -= impulse * normalY;
        }
      }
    }
  }

  function updatePhysics(timestamp, delta) {
    if (!isExploring || dialog.open || !bodies.length) return;
    const dockClearance = 94;
    const logoRect = logo.getBoundingClientRect();
    const arenaRect = arena.getBoundingClientRect();
    const logoCenterX = logoRect.left - arenaRect.left + logoRect.width / 2;
    const logoCenterY = logoRect.top - arenaRect.top + logoRect.height / 2;
    const logoRadius = Math.min(logoRect.width, logoRect.height) * 0.34;

    bodies.forEach((body) => {
      const waterX = Math.sin(timestamp * 0.0007 * body.floatRate + body.phase) * 5.5;
      const waterY = Math.cos(timestamp * 0.00058 * body.floatRate + body.phase) * 4.4;
      body.vx += waterX * delta;
      body.vy += waterY * delta;
      body.vx *= Math.pow(0.996, delta * 60);
      body.vy *= Math.pow(0.996, delta * 60);
      body.x += body.vx * delta;
      body.y += body.vy * delta;
      body.rotation += body.angularVelocity * delta;

      const minX = 10;
      const minY = 10;
      const maxX = Math.max(minX, arenaWidth - body.width - 10);
      const maxY = Math.max(minY, arenaHeight - body.height - dockClearance);
      if (body.x <= minX || body.x >= maxX) {
        body.x = Math.max(minX, Math.min(body.x, maxX));
        body.vx *= -0.9;
        body.angularVelocity *= -0.82;
      }
      if (body.y <= minY || body.y >= maxY) {
        body.y = Math.max(minY, Math.min(body.y, maxY));
        body.vy *= -0.9;
        body.angularVelocity *= -0.82;
      }

      if (timestamp - body.bornAt > 520) {
        const centerX = body.x + body.width / 2;
        const centerY = body.y + body.height / 2;
        const dx = centerX - logoCenterX;
        const dy = centerY - logoCenterY;
        const distance = Math.hypot(dx, dy) || 1;
        const tokenRadius = Math.min(70, Math.max(body.height, body.width * 0.22));
        const minLogoDistance = logoRadius + tokenRadius;
        if (distance < minLogoDistance) {
          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = minLogoDistance - distance;
          body.x += nx * overlap;
          body.y += ny * overlap;
          const impact = body.vx * nx + body.vy * ny;
          if (impact < 0) {
            body.vx -= 1.75 * impact * nx;
            body.vy -= 1.75 * impact * ny;
          }
        }
      }
    });

    resolveBodyCollisions();
    bodies.forEach((body) => {
      const bob = Math.sin(timestamp * 0.0018 * body.floatRate + body.phase) * 5;
      const sway = Math.sin(timestamp * 0.0011 + body.phase) * 2.5;
      body.element.style.transform = `translate3d(${body.x.toFixed(2)}px, ${(body.y + bob).toFixed(2)}px, 0) rotate(${(body.rotation + sway).toFixed(2)}deg)`;
    });
  }

  function setExploring(nextValue) {
    isExploring = nextValue;
    experience.classList.toggle("is-exploring", isExploring);
    infoWindow.classList.toggle("is-minimized", isExploring);
    minimizeButton.setAttribute("aria-expanded", String(!isExploring));
    logo.setAttribute(
      "aria-label",
      isExploring
        ? "برای رهاکردن یک قابلیت روی آب کلیک کنید"
        : "برای جمع‌کردن معرفی و ورود به فضای قابلیت‌های راوی کلیک کنید",
    );
    windowBar.inert = isExploring;
    windowBody.inert = isExploring;
    windowDock.inert = !isExploring;
    windowDock.setAttribute("aria-hidden", String(!isExploring));
    measureLogoUntil = performance.now() + 900;

    if (isExploring) {
      window.setTimeout(() => {
        updateArenaBounds();
        logo.focus({ preventScroll: true });
      }, 520);
    } else {
      clearFeatures();
      window.setTimeout(() => minimizeButton.focus({ preventScroll: true }), 360);
    }
  }

  function updatePointer(event) {
    const rect = experience.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
    pointer.targetX = Math.max(-1, Math.min(1, (x - 0.5) * 2));
    pointer.targetY = Math.max(-1, Math.min(1, (y - 0.5) * 2));
  }

  function draw(timestamp) {
    frameId = 0;
    if (document.hidden) return;
    const sinceLastFrame = timestamp - lastFrameAt;
    if (sinceLastFrame < frameInterval) {
      frameId = window.requestAnimationFrame(draw);
      return;
    }
    lastFrameAt = timestamp - (sinceLastFrame % frameInterval);

    pointer.x += (pointer.targetX - pointer.x) * 0.075;
    pointer.y += (pointer.targetY - pointer.y) * 0.075;
    const targetDarkness = themeIsDark ? 0.88 : 0.08;
    themeDarkness += (targetDarkness - themeDarkness) * 0.11;
    const darkness = themeDarkness;
    const styleNeedsUpdate =
      Math.abs(pointer.x - lastStyledX) > 0.0015 ||
      Math.abs(pointer.y - lastStyledY) > 0.0015 ||
      Math.abs(darkness - lastStyledDarkness) > 0.0015;

    if (styleNeedsUpdate) {
      lastStyledX = pointer.x;
      lastStyledY = pointer.y;
      lastStyledDarkness = darkness;
      const tiltX = pointer.x * -8.5;
      const tiltY = pointer.y * 7.5;
      const strength = Math.min(1, Math.hypot(pointer.x, pointer.y));
      logo.style.setProperty("--tilt-x", `${tiltX.toFixed(3)}deg`);
      logo.style.setProperty("--tilt-y", `${tiltY.toFixed(3)}deg`);
      logo.style.setProperty("--lift", `${(strength * 7).toFixed(2)}px`);
      experience.style.setProperty("--scene-darkness", darkness.toFixed(3));
      experience.style.setProperty("--light-wash-opacity", (1 - darkness * 0.74).toFixed(3));

    }

    ocean?.draw(timestamp, darkness);
    const physicsDelta = lastPhysicsAt ? Math.min(0.05, (timestamp - lastPhysicsAt) / 1000) : 0;
    lastPhysicsAt = timestamp;
    updatePhysics(timestamp, physicsDelta);
    frameId = window.requestAnimationFrame(draw);
  }

  function startDrawing() {
    if (!frameId && !document.hidden) frameId = window.requestAnimationFrame(draw);
  }

  function stopDrawing() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
  }

  resetFeatureDeck();
  windowDock.inert = true;
  updateArenaBounds();
  syncCardFanSize();
  if ("ResizeObserver" in window) {
    cardFanObserver = new ResizeObserver(syncCardFanSize);
    cardFanObserver.observe(infoWindow);
  }
  document.fonts?.ready?.then(syncCardFanSize);

  minimizeButton.addEventListener("click", () => setExploring(true));
  restoreButton.addEventListener("click", () => setExploring(false));
  logo.addEventListener("click", () => {
    if (!isExploring) {
      setExploring(true);
      return;
    }
    spawnFeature();
  });
  galleryCards.forEach((card) => {
    card.addEventListener("click", () => {
      openGallery(0, card);
    });
  });
  infoWindow.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("a, button, input, select, textarea, [role='button'], [role='switch']")) return;

    const card = galleryCardBehindPoint(event.clientX, event.clientY);
    if (!card) return;
    openGallery(0, card);
  });
  galleryLaunch.addEventListener("click", () => openGallery(0, galleryLaunch));
  galleryThumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", () => {
      renderGallery(Number(thumbnail.dataset.galleryThumbnail || 0));
    });
  });
  galleryPrevious.addEventListener("click", () => renderGallery(galleryIndex - 1));
  galleryNext.addEventListener("click", () => renderGallery(galleryIndex + 1));
  galleryDialogClose.addEventListener("click", () => galleryDialog.close());
  galleryDialog.addEventListener("click", (event) => {
    if (event.target === galleryDialog) galleryDialog.close();
  });
  galleryDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") renderGallery(galleryIndex - 1);
    if (event.key === "ArrowRight") renderGallery(galleryIndex + 1);
  });
  galleryDialog.addEventListener("close", () => {
    if (galleryReturnFocus instanceof HTMLElement) {
      galleryReturnFocus.focus({ preventScroll: true });
    }
  });
  downloadOpenButtons.forEach((button) => {
    button.addEventListener("click", () => downloadDialog.showModal());
  });
  downloadDialogClose.addEventListener("click", () => downloadDialog.close());
  downloadDialog.addEventListener("click", (event) => {
    if (event.target === downloadDialog) downloadDialog.close();
  });
  supportDialogClose.addEventListener("click", () => supportDialog.close());
  supportDialog.addEventListener("click", (event) => {
    if (event.target === supportDialog) supportDialog.close();
  });
  themeSwitch.addEventListener("click", () => {
    themeIsDark = !themeIsDark;
    themeSwitch.setAttribute("aria-checked", String(themeIsDark));
    themeSwitch.setAttribute("aria-label", themeIsDark ? "فعال‌کردن حالت روشن" : "فعال‌کردن حالت تاریک");
    themeSwitch.querySelector(".theme-switch__icon").textContent = themeIsDark ? "☾" : "☼";
    infoWindow.classList.toggle("is-dark", themeIsDark);
    experience.classList.toggle("is-night", themeIsDark);
  });
  experience.addEventListener("pointermove", updatePointer, { passive: true });
  experience.addEventListener("pointerleave", () => {
    pointer.targetX = 0.72;
    pointer.targetY = 0.1;
  }, { passive: true });

  dialogClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    dialogImage.removeAttribute("src");
    logo.focus({ preventScroll: true });
  });

  window.addEventListener("resize", () => {
    oceanNeedsResize = true;
    measureLogoUntil = performance.now() + 260;
    updateArenaBounds();
    syncCardFanSize();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopDrawing();
    else {
      lastPhysicsAt = 0;
      startDrawing();
    }
  });

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    experience.classList.add("is-webgl-fallback");
  });

  startDrawing();
})();
