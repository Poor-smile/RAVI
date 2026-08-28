(async () => {
  const PAGE_NAMES = {
    foundation: '11.4 Foundations / Software Update Distribution',
    components: '52.5 Components / Software Update',
    screens: '73.5 Screens / Software Update',
    flow: '84 Flows / Software Update'
  };

  const IDS = {
    buttonAccent: '35:27',
    buttonNeutral: '33:2'
  };

  const VARS = {
    textPrimary: 'VariableID:5:2',
    textStrong: 'VariableID:5:3',
    textSecondary: 'VariableID:5:4',
    textTertiary: 'VariableID:5:5',
    canvas: 'VariableID:5:9',
    surface: 'VariableID:5:10',
    subtle: 'VariableID:5:11',
    disabled: 'VariableID:5:12',
    raised: 'VariableID:5:13',
    accent: 'VariableID:5:19',
    accentHover: 'VariableID:5:20',
    accentSubtle: 'VariableID:5:21',
    accentOn: 'VariableID:5:22',
    border: 'VariableID:5:23',
    borderStrong: 'VariableID:5:24',
    focus: 'VariableID:5:25',
    error: 'VariableID:5:26',
    errorSubtle: 'VariableID:5:27',
    success: 'VariableID:5:28',
    successSubtle: 'VariableID:5:29',
    warningBg: 'VariableID:5:30',
    warningText: 'VariableID:5:31',
    warningBorder: 'VariableID:5:32',
    shadow: 'VariableID:5:40',
    radiusSurface: 'VariableID:433:2'
  };

  const STYLES = {
    h1: 'S:c942de4388e4201083e27f53b64e8aa9dc567092,',
    h2: 'S:118e82674d819fa75c7a82f28dfd03466dd6b36c,',
    h3: 'S:e047dd16b1bfa74e81c786e303db3388a92aea55,',
    body: 'S:71fbfa2bd79e0a6e72be931aec89b8ef52824359,',
    label: 'S:b00942f6c7e4559d3177570506be34e2ae17cf2f,',
    caption: 'S:ed0d93a75c94bde8603f09350cf917784ac882b5,'
  };

  const FONT_REGULAR = { family: 'Vazirmatn', style: 'Regular' };
  const FONT_MEDIUM = { family: 'Vazirmatn', style: 'Medium' };
  const FONT_BOLD = { family: 'Vazirmatn', style: 'Bold' };
  const MONO = { family: 'Cascadia Code', style: 'Regular' };
  const SYMBOL = { family: 'Material Symbols Rounded', style: 'Regular' };
  const loadedFonts = new Set();
  const variableCache = new Map();
  const styleCache = new Map();
  let symbolsAvailable = true;

  async function loadFont(font) {
    const key = `${font.family}/${font.style}`;
    if (loadedFonts.has(key)) return;
    await figma.loadFontAsync(font);
    loadedFonts.add(key);
  }

  async function prepareFonts() {
    await Promise.all([
      loadFont(FONT_REGULAR),
      loadFont(FONT_MEDIUM),
      loadFont(FONT_BOLD),
      loadFont(MONO)
    ]);
    try { await loadFont(SYMBOL); } catch (_) { symbolsAvailable = false; }
  }

  async function variableById(id) {
    if (!variableCache.has(id)) variableCache.set(id, await figma.variables.getVariableByIdAsync(id));
    return variableCache.get(id);
  }

  async function styleById(id) {
    if (!styleCache.has(id)) styleCache.set(id, await figma.getStyleByIdAsync(id));
    return styleCache.get(id);
  }

  async function bindPaint(node, property, variableId, opacity) {
    const variable = await variableById(variableId);
    const paint = { type: 'SOLID', color: { r: 1, g: 1, b: 1 } };
    if (typeof opacity === 'number') paint.opacity = opacity;
    node[property] = variable
      ? [figma.variables.setBoundVariableForPaint(paint, 'color', variable)]
      : [paint];
  }

  async function bindNumber(node, property, variableId, fallback) {
    node[property] = fallback;
    const variable = await variableById(variableId);
    if (variable && typeof node.setBoundVariable === 'function') {
      try { node.setBoundVariable(property, variable); } catch (_) {}
    }
  }

  async function applyTextStyle(text, styleId, fallbackFont, fallbackSize) {
    const style = await styleById(styleId);
    if (style && style.type === 'TEXT' && style.fontName !== figma.mixed) {
      await loadFont(style.fontName);
      text.fontName = style.fontName;
      if (typeof text.setTextStyleIdAsync === 'function') await text.setTextStyleIdAsync(style.id);
      else text.textStyleId = style.id;
    } else {
      await loadFont(fallbackFont);
      text.fontName = fallbackFont;
      text.fontSize = fallbackSize;
    }
  }

  function frame(name, direction, width, height, gap, padding) {
    const node = figma.createFrame();
    node.name = name;
    node.layoutMode = direction || 'VERTICAL';
    node.itemSpacing = gap || 0;
    const inset = padding || 0;
    node.paddingTop = inset;
    node.paddingRight = inset;
    node.paddingBottom = inset;
    node.paddingLeft = inset;
    node.resize(width || 100, height || 100);
    if ((direction || 'VERTICAL') === 'HORIZONTAL') {
      node.primaryAxisSizingMode = width ? 'FIXED' : 'AUTO';
      node.counterAxisSizingMode = height ? 'FIXED' : 'AUTO';
    } else {
      node.primaryAxisSizingMode = height ? 'FIXED' : 'AUTO';
      node.counterAxisSizingMode = width ? 'FIXED' : 'AUTO';
    }
    node.fills = [];
    node.strokes = [];
    return node;
  }

  async function text(name, value, styleId, colorId, options) {
    const opts = options || {};
    const node = figma.createText();
    node.name = name;
    await applyTextStyle(node, styleId || STYLES.body, opts.font || FONT_REGULAR, opts.size || 14);
    node.characters = value;
    node.textAlignHorizontal = opts.align || 'RIGHT';
    try { node.paragraphDirection = 'RIGHT_TO_LEFT'; } catch (_) {}
    if (opts.width) {
      node.resize(opts.width, Math.max(24, opts.height || 24));
      node.textAutoResize = 'HEIGHT';
    } else {
      node.textAutoResize = 'WIDTH_AND_HEIGHT';
    }
    if (opts.lineHeight) node.lineHeight = { unit: 'PIXELS', value: opts.lineHeight };
    await bindPaint(node, 'fills', colorId || VARS.textPrimary);
    return node;
  }

  async function icon(name, symbol, colorId, size) {
    const node = figma.createText();
    node.name = name;
    if (symbolsAvailable) {
      node.fontName = SYMBOL;
      node.fontSize = size || 20;
      node.characters = symbol;
    } else {
      node.fontName = FONT_BOLD;
      node.fontSize = size || 20;
      node.characters = { check_circle: '✓', error: '!', download: '↓', restart_alt: '↻', system_update_alt: '⇩', dns: '▤', shield: '◆', route: '→', cloud: '☁', description: '▤' }[symbol] || '•';
    }
    node.textAlignHorizontal = 'CENTER';
    node.textAlignVertical = 'CENTER';
    node.textAutoResize = 'NONE';
    node.resize(size || 20, size || 20);
    await bindPaint(node, 'fills', colorId || VARS.textPrimary);
    return node;
  }

  async function surface(node, fillVar, strokeVar, radius) {
    await bindPaint(node, 'fills', fillVar || VARS.surface);
    if (strokeVar) {
      await bindPaint(node, 'strokes', strokeVar);
      node.strokeWeight = 1;
    }
    if (radius === 'token') await bindNumber(node, 'cornerRadius', VARS.radiusSurface, 14);
    else node.cornerRadius = typeof radius === 'number' ? radius : 14;
    return node;
  }

  async function chip(value, tone) {
    const node = frame(`Chip / ${value}`, 'HORIZONTAL', 0, 0, 6, 8);
    node.paddingTop = 5;
    node.paddingBottom = 5;
    node.counterAxisSizingMode = 'AUTO';
    node.primaryAxisSizingMode = 'AUTO';
    await surface(node, tone === 'accent' ? VARS.accentSubtle : VARS.subtle, null, 999);
    node.appendChild(await text('Label', value, STYLES.caption, tone === 'accent' ? VARS.accent : VARS.textSecondary));
    return node;
  }

  async function divider(width) {
    const line = figma.createFrame();
    line.name = 'Divider';
    line.resize(width, 1);
    await bindPaint(line, 'fills', VARS.border);
    return line;
  }

  async function iconTile(symbol, tone) {
    const tile = frame(`Icon / ${symbol}`, 'HORIZONTAL', 40, 40, 0, 10);
    tile.primaryAxisAlignItems = 'CENTER';
    tile.counterAxisAlignItems = 'CENTER';
    await surface(tile, tone === 'error' ? VARS.errorSubtle : tone === 'success' ? VARS.successSubtle : VARS.accentSubtle, null, 12);
    tile.appendChild(await icon('Icon', symbol, tone === 'error' ? VARS.error : tone === 'success' ? VARS.success : VARS.accent, 22));
    return tile;
  }

  async function button(label, tone) {
    const target = await figma.getNodeByIdAsync(tone === 'accent' ? IDS.buttonAccent : IDS.buttonNeutral);
    if (target && target.type === 'COMPONENT') {
      const instance = target.createInstance();
      instance.name = `Button / ${label}`;
      const props = instance.componentProperties || {};
      const labelKey = Object.keys(props).find((key) => key === 'Label' || key.startsWith('Label#'));
      const showIconKey = Object.keys(props).find((key) => key === 'Show Icon' || key.startsWith('Show Icon#'));
      const next = {};
      if (labelKey) next[labelKey] = label;
      if (showIconKey) next[showIconKey] = false;
      try { instance.setProperties(next); } catch (_) {}
      return instance;
    }
    const fallback = frame(`Button / ${label}`, 'HORIZONTAL', 0, 40, 0, 14);
    fallback.counterAxisSizingMode = 'AUTO';
    fallback.primaryAxisSizingMode = 'FIXED';
    fallback.primaryAxisAlignItems = 'CENTER';
    fallback.counterAxisAlignItems = 'CENTER';
    await surface(fallback, tone === 'accent' ? VARS.accent : VARS.subtle, tone === 'accent' ? null : VARS.border, 10);
    fallback.appendChild(await text('Label', label, STYLES.label, tone === 'accent' ? VARS.accentOn : VARS.textPrimary));
    return fallback;
  }

  async function sectionHeader(eyebrow, titleValue, description) {
    const wrap = frame('Section header', 'VERTICAL', 1296, 0, 10, 0);
    wrap.appendChild(await text('Eyebrow', eyebrow, STYLES.label, VARS.accent, { width: 1296 }));
    wrap.appendChild(await text('Title', titleValue, STYLES.h2, VARS.textStrong, { width: 1296, lineHeight: 46 }));
    wrap.appendChild(await text('Description', description, STYLES.body, VARS.textSecondary, { width: 1000, lineHeight: 28 }));
    return wrap;
  }

  async function docPageRoot(page, name, subtitle, width) {
    const root = frame(name, 'VERTICAL', width || 1440, 0, 48, 72);
    root.x = 0;
    root.y = 0;
    root.counterAxisSizingMode = 'FIXED';
    await bindPaint(root, 'fills', VARS.canvas);
    root.appendChild(await text('Page number', name.split(' ')[0], STYLES.label, VARS.accent, { width: (width || 1440) - 144 }));
    root.appendChild(await text('Page title', name.substring(name.indexOf(' ') + 1), STYLES.h1, VARS.textStrong, { width: (width || 1440) - 144, lineHeight: 56 }));
    root.appendChild(await text('Page subtitle', subtitle, STYLES.body, VARS.textSecondary, { width: Math.min(1100, (width || 1440) - 144), lineHeight: 30 }));
    page.appendChild(root);
    return root;
  }

  async function infoCard(titleValue, body, symbol, width, tone) {
    const card = frame(`Card / ${titleValue}`, 'VERTICAL', width, 0, 16, 22);
    await surface(card, tone === 'accent' ? VARS.accentSubtle : VARS.surface, tone === 'accent' ? VARS.focus : VARS.border, 'token');
    const head = frame('Header', 'HORIZONTAL', width - 44, 0, 12, 0);
    head.primaryAxisAlignItems = 'SPACE_BETWEEN';
    head.appendChild(await iconTile(symbol, tone));
    head.appendChild(await text('Title', titleValue, STYLES.h3, VARS.textStrong, { width: width - 112 }));
    card.appendChild(head);
    card.appendChild(await text('Body', body, STYLES.body, VARS.textSecondary, { width: width - 44, lineHeight: 27 }));
    return card;
  }

  async function codeBlock(value, width) {
    const block = frame('Code block', 'VERTICAL', width, 0, 10, 18);
    await surface(block, VARS.subtle, VARS.border, 12);
    const code = await text('Code', value, null, VARS.textPrimary, { width: width - 36, font: MONO, size: 13, align: 'LEFT', lineHeight: 24 });
    try { code.paragraphDirection = 'LEFT_TO_RIGHT'; } catch (_) {}
    block.appendChild(code);
    return block;
  }

  async function getPage(name) {
    await figma.loadAllPagesAsync();
    let page = figma.root.children.find((child) => child.type === 'PAGE' && child.name === name);
    if (!page) {
      page = figma.createPage();
      page.name = name;
    }
    await figma.setCurrentPageAsync(page);
    for (const child of [...page.children]) child.remove();
    return page;
  }

  async function buildFoundation() {
    const page = await getPage(PAGE_NAMES.foundation);
    const root = await docPageRoot(page, PAGE_NAMES.foundation, 'قرارداد میزبانی، انتشار و تغییر مسیر دانلود به‌روزرسانی راوی — فقط هاست، بدون وابستگی به GitHub', 1440);
    const tags = frame('Scope tags', 'HORIZONTAL', 1296, 0, 10, 0);
    tags.appendChild(await chip('فقط هاست', 'accent'));
    tags.appendChild(await chip('چند آینهٔ دانلود'));
    tags.appendChild(await chip('انتشار اتمیک'));
    tags.appendChild(await chip('امضای دیجیتال و SHA-512'));
    root.appendChild(tags);

    root.appendChild(await sectionHeader('01 / Contract', 'قرارداد توزیع', 'برنامه فقط یک آدرس پایدار را می‌شناسد. تمام مسیرهای حجیم و آینه‌های جایگزین از مانیفست سبک خوانده می‌شوند؛ بنابراین تغییر هاست نیازمند انتشار نسخهٔ جدید برنامه نیست.'));
    const contract = frame('Distribution contract', 'HORIZONTAL', 1296, 0, 20, 0);
    contract.appendChild(await infoCard('Bootstrap ثابت', 'تنها آدرس ثابت داخل برنامه:\nhttps://ravi.poorsmile.ir/updates/windows/x64/stable/channel.json', 'language', 309, 'accent'));
    contract.appendChild(await infoCard('Manifest سبک', 'نسخه، توضیحات، اندازه، SHA-512، امضا و فهرست آینه‌ها را نگه می‌دارد.', 'description', 309));
    contract.appendChild(await infoCard('Mirrorهای قابل تعویض', 'فایل نصب از اولین میزبان سالم دریافت می‌شود؛ خرابی هر میزبان به‌طور خودکار به آینهٔ بعدی می‌رود.', 'route', 309));
    contract.appendChild(await infoCard('اعتماد و صحت', 'قبل از نصب، امضای نسخه و SHA-512 بررسی می‌شود. FTP فقط ابزار انتشار است و هیچ‌گاه وارد کلاینت نمی‌شود.', 'verified_user', 309));
    root.appendChild(contract);

    root.appendChild(await sectionHeader('02 / Placement', 'محل نگهداری فایل‌ها', 'کنترل‌پلین سبک روی دامنهٔ اصلی؛ دیتاپلین حجیم روی هاست دانلود. کلید امضا و مشخصات FTP فقط روی سیستم انتشار باقی می‌مانند.'));
    const placement = frame('File placement', 'HORIZONTAL', 1296, 0, 20, 0);
    placement.appendChild(await infoCard('ravi.poorsmile.ir / سبک', '• channel.json\n• latest.yml\n• release-notes.json\n• public-key.json\n• redirect/aliasهای پایدار', 'dns', 412, 'accent'));
    placement.appendChild(await infoCard('Download hostها / حجیم', '• Raavi-Setup-x64.exe\n• Raavi-Setup-x64.exe.blockmap\n• Raavi-Portable-x64.zip\n• مسیر یکسان روی تمام آینه‌ها', 'cloud_download', 412));
    placement.appendChild(await infoCard('سیستم انتشار / محرمانه', '• آرشیو کامل نسخه‌ها\n• کلید خصوصی امضا\n• مشخصات FTP و Secretها\n• گزارش صحت و آپلود', 'lock', 412));
    root.appendChild(placement);

    root.appendChild(await sectionHeader('03 / Manifest', 'قرارداد مانیفست نسخه', 'کلاینت ترتیب آینه‌ها را دقیقاً از همین فایل می‌خواند. دامنه‌ها در کد برنامه hard-code نمی‌شوند.'));
    root.appendChild(await codeBlock(`{
  "schema": 1,
  "channel": "stable",
  "version": "2.2.0",
  "publishedAt": "2026-08-30T18:00:00Z",
  "notesUrl": "https://ravi.poorsmile.ir/updates/releases/2.2.0.json",
  "artifact": {
    "path": "/raavi/stable/2.2.0/Raavi-Setup-x64.exe",
    "size": 102760448,
    "sha512": "<sha512>",
    "signature": "<ed25519-signature>"
  },
  "mirrors": [
    { "id": "primary", "baseUrl": "https://download-1.example" },
    { "id": "secondary", "baseUrl": "https://download-2.example" }
  ]
}`, 1296));

    root.appendChild(await sectionHeader('04 / Runtime', 'قواعد تجربهٔ کاربر و Runtime', 'بررسی در پس‌زمینه، پیشنهاد غیرمسدودکننده، ادامهٔ کار حین دانلود و بازگشت خودکار از میزبان خراب.'));
    const runtime = frame('Runtime rules', 'HORIZONTAL', 1296, 0, 20, 0);
    runtime.appendChild(await infoCard('بررسی بی‌صدا', 'در شروع برنامه و سپس هر ۲۴ ساعت؛ اگر نسخه‌ای نیست هیچ پیام یا تغییر تمرکز نشان داده نمی‌شود.', 'schedule', 309));
    runtime.appendChild(await infoCard('پیشنهاد غیرمسدودکننده', 'نسخهٔ جدید در تنظیمات و یک Banner کوتاه اعلام می‌شود. کاربر می‌تواند دانلود را عقب بیندازد.', 'notifications', 309));
    runtime.appendChild(await infoCard('Fallback خودکار', 'Timeout کوتاه و معقول؛ ادامه از آینهٔ بعدی بدون پرسش از کاربر و بدون افشای نام میزبان.', 'swap_horiz', 309));
    runtime.appendChild(await infoCard('نصب امن', 'دانلود موقت، بررسی اندازه و SHA-512 و امضا، سپس نصب با تأیید صریح کاربر.', 'shield', 309));
    root.appendChild(runtime);

    root.appendChild(await sectionHeader('05 / Floating surface', 'بنر شناور به‌روزرسانی', 'علاوه بر کارت تنظیمات، وضعیت‌های مهم به‌صورت بنر شناور پایینِ سمت راست دیده می‌شوند؛ بدون مسدودکردن کار کاربر.'));
    const floatingRules = frame('Floating banner rules', 'HORIZONTAL', 1296, 0, 20, 0);
    floatingRules.appendChild(await infoCard('جای‌گذاری', 'Desktop: فاصلهٔ ۳۲ پیکسل از راست و پایین. پنجرهٔ فشرده: ۱۶ پیکسل. عرض پیشنهادی ۳۶۰ تا ۳۸۰ پیکسل.', 'bottom_right_click', 412, 'accent'));
    floatingRules.appendChild(await infoCard('اولویت و تعداد', 'در هر لحظه فقط یک بنر Update نمایش داده می‌شود. Ready بر Downloading و Downloading بر Available اولویت دارد.', 'filter_1', 412));
    floatingRules.appendChild(await infoCard('رفتار', 'قابل بستن، غیرمسدودکننده و همگام با کارت تنظیمات. بستن بنر دانلود را متوقف نمی‌کند.', 'close', 412));
    root.appendChild(floatingRules);

    root.appendChild(await sectionHeader('06 / Release', 'ترتیب انتشار و نگهداری نسخه‌ها', 'مانیفست همیشه آخر منتشر می‌شود تا هیچ کاربری به فایل نیمه‌بارگذاری‌شده هدایت نشود.'));
    const release = frame('Release order', 'HORIZONTAL', 1296, 0, 16, 0);
    const steps = [
      ['۱', 'Build و Sign', 'خروجی نسخه روی سیستم انتشار ساخته و امضا می‌شود.'],
      ['۲', 'Upload حجیم', 'فایل‌ها روی تمام آینه‌های دانلود بارگذاری می‌شوند.'],
      ['۳', 'Verify', 'اندازه، SHA-512 و امکان دانلود هر آینه بررسی می‌شود.'],
      ['۴', 'Publish سبک', 'مانیفست سبک به‌شکل اتمیک و در آخر روی ravi.poorsmile.ir جایگزین می‌شود.'],
      ['۵', 'Retention', 'نسخهٔ فعلی + سه نسخهٔ پایدار قبلی روی هاست؛ متادیتای سبک بدون محدودیت نگهداری شود.']
    ];
    const releaseItems = [];
    for (const [number, titleValue, body] of steps) {
      const item = frame(`Step ${number}`, 'VERTICAL', 246, 0, 12, 18);
      await surface(item, VARS.surface, VARS.border, 14);
      item.appendChild(await chip(number, 'accent'));
      item.appendChild(await text('Title', titleValue, STYLES.h3, VARS.textStrong, { width: 210 }));
      item.appendChild(await text('Body', body, STYLES.caption, VARS.textSecondary, { width: 210, lineHeight: 23 }));
      releaseItems.push(item);
    }
    for (const item of releaseItems.reverse()) release.appendChild(item);
    root.appendChild(release);

    const safety = frame('Security note', 'HORIZONTAL', 1296, 0, 16, 22);
    await surface(safety, VARS.warningBg, VARS.warningBorder, 14);
    safety.appendChild(await icon('Security icon', 'security', VARS.warningText, 24));
    safety.appendChild(await text('Security text', 'هیچ نام کاربری، رمز عبور، آدرس FTP خصوصی یا کلید امضا در فایل فیگما، مانیفست عمومی یا برنامه ذخیره نمی‌شود. این موارد فقط Secret محیط انتشار هستند.', STYLES.body, VARS.warningText, { width: 1210, lineHeight: 28 }));
    root.appendChild(safety);
    root.setPluginData('raavi-update-builder', 'foundation-v1');
    return root;
  }

  const STATE_CONFIG = {
    'Up to date': { title: 'راوی به‌روز است', body: 'نسخهٔ ۲.۱.۱۳ نصب شده و نسخهٔ جدیدتری پیدا نشد.', meta: 'آخرین بررسی: همین حالا', icon: 'check_circle', tone: 'success', primary: 'بررسی دوباره', secondary: null },
    Available: { title: 'نسخهٔ ۲.۲.۰ آمادهٔ دریافت است', body: 'بهبودهای پایداری، راه‌اندازی سریع‌تر و اصلاح تجربهٔ First Run.', meta: '۹۸ مگابایت · کانال پایدار', icon: 'system_update_alt', tone: 'accent', primary: 'دانلود به‌روزرسانی', secondary: 'تغییرات نسخه' },
    Downloading: { title: 'در حال دریافت نسخهٔ ۲.۲.۰', body: 'می‌توانید هنگام دانلود به کارتان ادامه دهید. در صورت قطع میزبان، آینهٔ بعدی خودکار امتحان می‌شود.', meta: '۳۸٪ · ۳۷ از ۹۸ مگابایت', icon: 'download', tone: 'accent', primary: 'مکث', secondary: 'لغو دانلود' },
    Ready: { title: 'نسخه آمادهٔ نصب است', body: 'دانلود و اعتبارسنجی کامل شد. برنامه برای نصب و راه‌اندازی مجدد آماده است.', meta: 'نسخهٔ ۲.۲.۰ · تأییدشده', icon: 'restart_alt', tone: 'success', primary: 'نصب و راه‌اندازی مجدد', secondary: 'بعداً' },
    Error: { title: 'دریافت نسخه کامل نشد', body: 'در حال حاضر هیچ‌کدام از مسیرهای دانلود در دسترس نیست. اطلاعات شما محفوظ است و برنامه بدون مشکل ادامه می‌دهد.', meta: 'اتصال یا میزبان دانلود را بررسی کنید', icon: 'error', tone: 'error', primary: 'تلاش دوباره', secondary: 'دانلود مستقیم' }
  };

  async function progressBar(width, value) {
    const track = frame('Progress', 'HORIZONTAL', width, 6, 0, 0);
    track.clipsContent = true;
    await surface(track, VARS.subtle, null, 999);
    const fill = figma.createFrame();
    fill.name = 'Progress value 38%';
    fill.resize(Math.max(12, width * value), 6);
    fill.cornerRadius = 999;
    await bindPaint(fill, 'fills', VARS.accent);
    track.appendChild(fill);
    return track;
  }

  async function createStatusVariant(state, width) {
    const config = STATE_CONFIG[state];
    const component = figma.createComponent();
    component.name = `State=${state}`;
    component.layoutMode = 'VERTICAL';
    component.itemSpacing = 18;
    component.paddingTop = 24;
    component.paddingRight = 24;
    component.paddingBottom = 24;
    component.paddingLeft = 24;
    component.resize(width, 100);
    component.counterAxisSizingMode = 'FIXED';
    component.primaryAxisSizingMode = 'AUTO';
    await surface(component, VARS.surface, config.tone === 'error' ? VARS.error : config.tone === 'success' ? VARS.success : VARS.border, 'token');

    const head = frame('Header', 'HORIZONTAL', width - 48, 0, 16, 0);
    head.primaryAxisAlignItems = 'SPACE_BETWEEN';
    head.appendChild(await iconTile(config.icon, config.tone));
    const copy = frame('Copy', 'VERTICAL', width - 120, 0, 6, 0);
    copy.appendChild(await text('Title', config.title, STYLES.h3, VARS.textStrong, { width: width - 120 }));
    copy.appendChild(await text('Body', config.body, STYLES.body, VARS.textSecondary, { width: width - 120, lineHeight: 26 }));
    head.appendChild(copy);
    component.appendChild(head);

    if (state === 'Downloading') component.appendChild(await progressBar(width - 48, 0.38));
    component.appendChild(await text('Meta', config.meta, STYLES.caption, config.tone === 'error' ? VARS.error : VARS.textTertiary, { width: width - 48 }));
    component.appendChild(await divider(width - 48));
    const actions = frame('Actions', 'HORIZONTAL', width - 48, 0, 12, 0);
    if (config.primary) actions.appendChild(await button(config.primary, 'accent'));
    if (config.secondary) actions.appendChild(await button(config.secondary, 'neutral'));
    component.appendChild(actions);
    return component;
  }

  async function createFloatingVariant(state) {
    const configs = {
      Available: {
        title: 'نسخهٔ جدید آماده است',
        body: 'راوی ۲.۲.۰ برای دریافت آماده است.',
        meta: '۹۸ مگابایت',
        icon: 'system_update_alt',
        tone: 'accent',
        action: 'دانلود'
      },
      Downloading: {
        title: 'در حال دریافت به‌روزرسانی',
        body: 'می‌توانید هم‌زمان به کارتان ادامه دهید.',
        meta: '۳۸٪ · ۳۷ از ۹۸ مگابایت',
        icon: 'download',
        tone: 'accent',
        action: null
      },
      Ready: {
        title: 'نسخه آمادهٔ نصب است',
        body: 'دانلود و اعتبارسنجی با موفقیت کامل شد.',
        meta: 'نسخهٔ ۲.۲.۰',
        icon: 'restart_alt',
        tone: 'success',
        action: 'نصب و راه‌اندازی مجدد'
      },
      Error: {
        title: 'دانلود کامل نشد',
        body: 'در حال حاضر مسیر دانلود در دسترس نیست.',
        meta: 'اطلاعات شما محفوظ است',
        icon: 'error',
        tone: 'error',
        action: 'تلاش دوباره'
      }
    };
    const config = configs[state];
    const component = figma.createComponent();
    component.name = `State=${state}`;
    component.layoutMode = 'VERTICAL';
    component.itemSpacing = 14;
    component.paddingTop = 18;
    component.paddingRight = 18;
    component.paddingBottom = 18;
    component.paddingLeft = 18;
    component.resize(380, 160);
    component.counterAxisSizingMode = 'FIXED';
    component.primaryAxisSizingMode = 'AUTO';
    await surface(component, VARS.raised, config.tone === 'error' ? VARS.error : config.tone === 'success' ? VARS.success : VARS.borderStrong, 16);
    component.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.18 }, offset: { x: 0, y: 10 }, radius: 28, spread: -6, visible: true, blendMode: 'NORMAL' }];

    const header = frame('Header', 'HORIZONTAL', 344, 0, 12, 0);
    header.primaryAxisAlignItems = 'SPACE_BETWEEN';
    header.counterAxisAlignItems = 'CENTER';
    const close = frame('Close', 'HORIZONTAL', 32, 32, 0, 6);
    close.primaryAxisAlignItems = 'CENTER';
    close.counterAxisAlignItems = 'CENTER';
    await surface(close, VARS.subtle, null, 9);
    close.appendChild(await icon('Icon', 'close', VARS.textSecondary, 18));
    header.appendChild(close);
    const message = frame('Message', 'HORIZONTAL', 294, 0, 12, 0);
    message.primaryAxisAlignItems = 'MAX';
    message.counterAxisAlignItems = 'MIN';
    message.appendChild(await iconTile(config.icon, config.tone));
    const copy = frame('Copy', 'VERTICAL', 238, 0, 4, 0);
    copy.appendChild(await text('Title', config.title, STYLES.label, VARS.textStrong, { width: 238 }));
    copy.appendChild(await text('Body', config.body, STYLES.caption, VARS.textSecondary, { width: 238, lineHeight: 21 }));
    message.appendChild(copy);
    header.appendChild(message);
    component.appendChild(header);

    if (state === 'Downloading') component.appendChild(await progressBar(344, 0.38));
    const footer = frame('Footer', 'HORIZONTAL', 344, 0, 12, 0);
    footer.primaryAxisAlignItems = 'SPACE_BETWEEN';
    footer.counterAxisAlignItems = 'CENTER';
    if (config.action) footer.appendChild(await button(config.action, state === 'Error' ? 'neutral' : 'accent'));
    else footer.appendChild(await chip('در حال دانلود', 'accent'));
    footer.appendChild(await text('Meta', config.meta, STYLES.caption, config.tone === 'error' ? VARS.error : VARS.textTertiary));
    component.appendChild(footer);
    return component;
  }

  async function buildComponents() {
    const page = await getPage(PAGE_NAMES.components);
    const root = await docPageRoot(page, PAGE_NAMES.components, 'کامپوننت‌های وضعیت، اکشن و بازخورد به‌روزرسانی؛ همه بر پایهٔ توکن‌ها و Buttonهای سیستم طراحی راوی.', 1760);
    root.appendChild(await sectionHeader('01 / Status Card', 'Update / Status Card', 'کامپوننت اصلی بخش «تنظیمات › عمومی». نام میزبان یا جزئیات زیرساخت را به کاربر نشان نمی‌دهد.'));
    const stage = frame('Status card variants stage', 'HORIZONTAL', 1616, 0, 32, 32);
    await surface(stage, VARS.subtle, null, 18);
    stage.layoutWrap = 'WRAP';
    const variants = [];
    for (const state of Object.keys(STATE_CONFIG)) {
      const variant = await createStatusVariant(state, 720);
      variants.push(variant);
      stage.appendChild(variant);
    }
    const set = figma.combineAsVariants(variants, stage);
    set.name = 'Update/Status Card';
    set.description = 'Software update status card. States: up to date, available, downloading, ready and error. Infrastructure names are intentionally hidden.';
    set.setPluginData('raavi-update-builder', 'status-card-v1');
    set.layoutMode = 'HORIZONTAL';
    set.layoutWrap = 'WRAP';
    set.itemSpacing = 28;
    set.counterAxisSpacing = 28;
    set.paddingTop = 28;
    set.paddingRight = 28;
    set.paddingBottom = 28;
    set.paddingLeft = 28;
    set.resize(1552, Math.max(set.height, 480));
    set.primaryAxisSizingMode = 'FIXED';
    set.counterAxisSizingMode = 'AUTO';
    await bindPaint(set, 'fills', VARS.subtle);
    set.strokes = [];
    root.appendChild(stage);

    root.appendChild(await sectionHeader('02 / Prompt', 'Update / Prompt Banner', 'اعلان کوتاه و غیرمسدودکننده؛ برای معرفی نسخهٔ تازه یا اعلام آمادگی نصب.'));
    const bannerSetStage = frame('Banner variants stage', 'HORIZONTAL', 1616, 0, 24, 32);
    await surface(bannerSetStage, VARS.subtle, null, 18);
    const bannerVariants = [];
    const bannerStates = [
      ['Available', 'نسخهٔ ۲.۲.۰ برای دانلود آماده است', 'دانلود', 'system_update_alt'],
      ['Downloading', 'به‌روزرسانی در پس‌زمینه دریافت می‌شود', 'نمایش پیشرفت', 'download'],
      ['Ready', 'نسخه آمادهٔ نصب است', 'نصب و راه‌اندازی مجدد', 'restart_alt']
    ];
    for (const [state, label, action, glyph] of bannerStates) {
      const component = figma.createComponent();
      component.name = `State=${state}`;
      component.layoutMode = 'HORIZONTAL';
      component.itemSpacing = 14;
      component.paddingTop = 14;
      component.paddingRight = 16;
      component.paddingBottom = 14;
      component.paddingLeft = 16;
      component.primaryAxisAlignItems = 'SPACE_BETWEEN';
      component.counterAxisAlignItems = 'CENTER';
      component.counterAxisSizingMode = 'FIXED';
      component.primaryAxisSizingMode = 'AUTO';
      component.resize(720, 64);
      await surface(component, state === 'Ready' ? VARS.successSubtle : VARS.accentSubtle, state === 'Ready' ? VARS.success : VARS.focus, 14);
      component.appendChild(await button(action, 'neutral'));
      const message = frame('Message', 'HORIZONTAL', 480, 0, 10, 0);
      message.primaryAxisAlignItems = 'MAX';
      message.counterAxisAlignItems = 'CENTER';
      message.appendChild(await icon('Icon', glyph, state === 'Ready' ? VARS.success : VARS.accent, 22));
      message.appendChild(await text('Label', label, STYLES.label, VARS.textStrong, { width: 430 }));
      component.appendChild(message);
      bannerVariants.push(component);
      bannerSetStage.appendChild(component);
    }
    const bannerSet = figma.combineAsVariants(bannerVariants, bannerSetStage);
    bannerSet.name = 'Update/Prompt Banner';
    bannerSet.description = 'Non-blocking software update prompt.';
    bannerSet.setPluginData('raavi-update-builder', 'prompt-banner-v1');
    bannerSet.layoutMode = 'VERTICAL';
    bannerSet.itemSpacing = 24;
    bannerSet.paddingTop = 28;
    bannerSet.paddingRight = 28;
    bannerSet.paddingBottom = 28;
    bannerSet.paddingLeft = 28;
    await bindPaint(bannerSet, 'fills', VARS.subtle);
    bannerSet.strokes = [];
    root.appendChild(bannerSetStage);

    root.appendChild(await sectionHeader('03 / Floating Banner', 'Update / Floating Banner', 'بنر غیرمسدودکنندهٔ پایینِ سمت راست برای وضعیت‌های مهم خارج از تنظیمات.'));
    const floatingStage = frame('Floating banner variants stage', 'HORIZONTAL', 1616, 0, 24, 32);
    floatingStage.layoutWrap = 'WRAP';
    floatingStage.counterAxisSpacing = 24;
    await surface(floatingStage, VARS.subtle, null, 18);
    const floatingVariants = [];
    for (const state of ['Available', 'Downloading', 'Ready', 'Error']) {
      const variant = await createFloatingVariant(state);
      floatingVariants.push(variant);
      floatingStage.appendChild(variant);
    }
    const floatingSet = figma.combineAsVariants(floatingVariants, floatingStage);
    floatingSet.name = 'Update/Floating Banner';
    floatingSet.description = 'Non-blocking update banner anchored to the bottom-right safe area. States: available, downloading, ready and error.';
    floatingSet.setPluginData('raavi-update-builder', 'floating-banner-v1');
    floatingSet.layoutMode = 'HORIZONTAL';
    floatingSet.layoutWrap = 'WRAP';
    floatingSet.itemSpacing = 24;
    floatingSet.counterAxisSpacing = 24;
    floatingSet.paddingTop = 24;
    floatingSet.paddingRight = 24;
    floatingSet.paddingBottom = 24;
    floatingSet.paddingLeft = 24;
    floatingSet.resize(1560, Math.max(floatingSet.height, 420));
    floatingSet.primaryAxisSizingMode = 'FIXED';
    floatingSet.counterAxisSizingMode = 'AUTO';
    await bindPaint(floatingSet, 'fills', VARS.subtle);
    floatingSet.strokes = [];
    root.appendChild(floatingStage);

    root.appendChild(await sectionHeader('04 / Usage', 'قواعد استفاده', 'حالت‌ها از دادهٔ واقعی آپدیتر تغذیه می‌شوند؛ درصد ساختگی، نام میزبان و خطای فنی خام در UI نمایش داده نمی‌شود.'));
    const rules = frame('Component usage rules', 'HORIZONTAL', 1616, 0, 20, 0);
    rules.appendChild(await infoCard('State-driven', 'یک State یکتا در هر لحظه؛ گذارها با دادهٔ Runtime و بدون تداخل اکشن‌ها.', 'toggle_on', 512));
    rules.appendChild(await infoCard('Non-blocking', 'بررسی و دانلود مسیر کار را نمی‌بندند؛ نصب فقط با انتخاب صریح کاربر آغاز می‌شود.', 'do_not_disturb_on', 512));
    rules.appendChild(await infoCard('Accessible', 'وضعیت فقط با رنگ منتقل نمی‌شود؛ آیکن، عنوان و متن نیز معنا را تکرار می‌کنند.', 'accessibility_new', 512));
    root.appendChild(rules);
    root.setPluginData('raavi-update-builder', 'components-v1');
    return { root, statusSet: set, bannerSet, floatingSet };
  }

  async function navItem(label, selected) {
    const item = frame(`Nav / ${label}`, 'HORIZONTAL', 236, 44, 10, 12);
    item.primaryAxisAlignItems = 'MAX';
    item.counterAxisAlignItems = 'CENTER';
    await surface(item, selected ? VARS.accentSubtle : VARS.surface, null, 10);
    item.appendChild(await icon('Icon', selected ? 'home_storage' : 'tune', selected ? VARS.accent : VARS.textSecondary, 20));
    item.appendChild(await text('Label', label, STYLES.label, selected ? VARS.accent : VARS.textPrimary, { width: 178 }));
    return item;
  }

  async function settingsRow(titleValue, body, actionLabel) {
    const row = frame(`Setting / ${titleValue}`, 'HORIZONTAL', 880, 64, 16, 0);
    row.primaryAxisAlignItems = 'SPACE_BETWEEN';
    row.counterAxisAlignItems = 'CENTER';
    row.appendChild(await button(actionLabel, 'neutral'));
    const copy = frame('Copy', 'VERTICAL', 650, 0, 4, 0);
    copy.appendChild(await text('Title', titleValue, STYLES.label, VARS.textStrong, { width: 650 }));
    copy.appendChild(await text('Body', body, STYLES.caption, VARS.textSecondary, { width: 650 }));
    row.appendChild(copy);
    return row;
  }

  async function settingsScreen(state, statusSet, bannerSet, floatingSet) {
    const screen = frame(`Screen / ${state}`, 'VERTICAL', 1440, 1024, 0, 0);
    screen.clipsContent = true;
    await bindPaint(screen, 'fills', VARS.canvas);

    const topbar = frame('Top bar', 'HORIZONTAL', 1440, 72, 20, 28);
    topbar.primaryAxisAlignItems = 'SPACE_BETWEEN';
    topbar.counterAxisAlignItems = 'CENTER';
    await bindPaint(topbar, 'fills', VARS.surface);
    topbar.appendChild(await text('Back', 'بازگشت به سند', STYLES.label, VARS.textStrong));
    topbar.appendChild(await text('Title', 'تنظیمات', STYLES.h3, VARS.textStrong));
    screen.appendChild(topbar);

    const body = frame('Settings body', 'HORIZONTAL', 1440, 952, 32, 56);
    body.primaryAxisAlignItems = 'CENTER';
    const sidebar = frame('Sidebar', 'VERTICAL', 260, 840, 8, 12);
    await surface(sidebar, VARS.surface, VARS.border, 16);
    sidebar.appendChild(await text('Section label', 'دسته‌ها', STYLES.caption, VARS.textTertiary, { width: 236 }));
    sidebar.appendChild(await navItem('عمومی', true));
    for (const label of ['ظاهر', 'هوش مصنوعی و گفتار', 'مطالعه', 'ویرایش', 'فایل‌ها و کتابخانه', 'حریم خصوصی و داده‌ها', 'میانبرها']) sidebar.appendChild(await navItem(label, false));

    const main = frame('Main content', 'VERTICAL', 960, 840, 22, 0);
    main.appendChild(await text('Heading', 'عمومی', STYLES.h2, VARS.textStrong, { width: 960 }));
    main.appendChild(await text('Subtitle', 'رفتار پایه، خوش‌آمدگویی و به‌روزرسانی نرم‌افزار', STYLES.body, VARS.textSecondary, { width: 960 }));
    main.appendChild(await settingsRow('نمایش دوبارهٔ خوش‌آمدگویی', 'راه‌اندازی اولیهٔ راوی را دوباره اجرا می‌کند.', 'اجرای دوباره'));
    main.appendChild(await divider(960));
    main.appendChild(await text('Update section title', 'به‌روزرسانی راوی', STYLES.h3, VARS.textStrong, { width: 960 }));

    if (state === 'Available' && bannerSet) {
      const bannerComponent = bannerSet.children.find((child) => child.type === 'COMPONENT' && child.name.includes('Available'));
      if (bannerComponent) {
        const banner = bannerComponent.createInstance();
        banner.name = 'Update prompt / Available';
        banner.resize(880, banner.height);
        main.appendChild(banner);
      }
    }
    const component = statusSet.children.find((child) => child.type === 'COMPONENT' && child.name.includes(state));
    if (component) {
      const instance = component.createInstance();
      instance.name = `Update status / ${state}`;
      instance.resize(880, instance.height);
      main.appendChild(instance);
    }
    main.appendChild(await text('Privacy note', 'بررسی نسخه فقط شماره نسخه و کانال انتشار را دریافت می‌کند. هیچ فایل سند یا اطلاعات شخصی ارسال نمی‌شود.', STYLES.caption, VARS.textTertiary, { width: 880, lineHeight: 22 }));
    body.appendChild(main);
    body.appendChild(sidebar);
    screen.appendChild(body);
    if (state !== 'Up to date' && floatingSet) {
      const floatingComponent = floatingSet.children.find((child) => child.type === 'COMPONENT' && child.name.includes(state));
      if (floatingComponent) {
        const floating = floatingComponent.createInstance();
        floating.name = `Floating update banner / ${state}`;
        screen.appendChild(floating);
        try { floating.layoutPositioning = 'ABSOLUTE'; } catch (_) {}
        floating.x = 1440 - floating.width - 32;
        floating.y = 1024 - floating.height - 32;
      }
    }
    return screen;
  }

  async function buildScreens(statusSet, bannerSet, floatingSet) {
    const page = await getPage(PAGE_NAMES.screens);
    const root = await docPageRoot(page, PAGE_NAMES.screens, 'پنج وضعیت کلیدی به‌روزرسانی در تنظیمات عمومی؛ فشرده، RTL و غیرمسدودکننده.', 3180);
    const legend = frame('Legend', 'HORIZONTAL', 3036, 0, 10, 0);
    legend.appendChild(await chip('Settings / General', 'accent'));
    legend.appendChild(await chip('RTL'));
    legend.appendChild(await chip('1440 × 1024'));
    legend.appendChild(await chip('No infrastructure leakage'));
    root.appendChild(legend);

    const grid = frame('Screen grid', 'HORIZONTAL', 3036, 0, 48, 0);
    grid.layoutWrap = 'WRAP';
    grid.counterAxisSpacing = 48;
    const states = ['Up to date', 'Available', 'Downloading', 'Ready', 'Error'];
    for (let index = 0; index < states.length; index += 1) {
      const column = frame(`Screen specimen ${index + 1}`, 'VERTICAL', 1440, 0, 14, 0);
      column.appendChild(await text('Screen label', `0${index + 1} / ${states[index]}`, STYLES.label, VARS.accent, { width: 1440 }));
      column.appendChild(await settingsScreen(states[index], statusSet, bannerSet, floatingSet));
      grid.appendChild(column);
    }
    root.appendChild(grid);
    root.setPluginData('raavi-update-builder', 'screens-v1');
    return root;
  }

  async function flowNode(titleValue, body, symbol, width, tone) {
    const node = frame(`Flow node / ${titleValue}`, 'VERTICAL', width, 0, 12, 18);
    await surface(node, tone === 'accent' ? VARS.accentSubtle : tone === 'error' ? VARS.errorSubtle : tone === 'success' ? VARS.successSubtle : VARS.surface, tone === 'accent' ? VARS.focus : tone === 'error' ? VARS.error : tone === 'success' ? VARS.success : VARS.border, 14);
    node.appendChild(await iconTile(symbol, tone));
    node.appendChild(await text('Title', titleValue, STYLES.h3, VARS.textStrong, { width: width - 36 }));
    node.appendChild(await text('Body', body, STYLES.caption, VARS.textSecondary, { width: width - 36, lineHeight: 23 }));
    return node;
  }

  async function arrow(label) {
    const wrap = frame(`Connector / ${label}`, 'VERTICAL', 74, 0, 6, 0);
    wrap.counterAxisAlignItems = 'CENTER';
    wrap.appendChild(await icon('Arrow', 'arrow_back', VARS.accent, 26));
    wrap.appendChild(await text('Label', label, STYLES.caption, VARS.textTertiary, { width: 74, align: 'CENTER' }));
    return wrap;
  }

  async function buildFlow() {
    const page = await getPage(PAGE_NAMES.flow);
    const root = await docPageRoot(page, PAGE_NAMES.flow, 'جریان تجربهٔ کاربر و جریان انتشار میزبان؛ جداسازی کنترل‌پلین سبک از فایل‌های حجیم.', 2360);
    root.appendChild(await sectionHeader('01 / User', 'Flow کاربر — بررسی تا نصب', 'اگر نسخه‌ای وجود نداشته باشد مسیر بی‌صدا تمام می‌شود. در خطای میزبان، کلاینت بدون وقفه آینهٔ بعدی را امتحان می‌کند.'));
    const userBoard = frame('User update flow', 'HORIZONTAL', 2216, 0, 12, 28);
    await surface(userBoard, VARS.subtle, null, 18);
    const userSteps = [
      ['بررسی پس‌زمینه', 'در شروع و هر ۲۴ ساعت', 'manage_search', 'neutral'],
      ['نسخه پیدا شد؟', 'اگر خیر: پایان بی‌صدا', 'fork_right', 'accent'],
      ['پیشنهاد دانلود', 'بنر شناور پایین راست + کارت تنظیمات', 'system_update_alt', 'neutral'],
      ['انتخاب آینه', 'به ترتیب Manifest؛ بدون نمایش نام میزبان', 'route', 'neutral'],
      ['دانلود و Verify', 'Size + SHA-512 + Signature', 'verified', 'accent'],
      ['آمادهٔ نصب', 'تأیید صریح کاربر', 'restart_alt', 'success']
    ];
    const userChildren = [];
    for (let index = 0; index < userSteps.length; index += 1) {
      const [titleValue, body, glyph, tone] = userSteps[index];
      userChildren.push(await flowNode(titleValue, body, glyph, 306, tone));
      if (index < userSteps.length - 1) userChildren.push(await arrow(index === 1 ? 'بله' : 'بعدی'));
    }
    for (const child of userChildren.reverse()) userBoard.appendChild(child);
    root.appendChild(userBoard);

    const fallback = frame('Fallback branch', 'HORIZONTAL', 2216, 0, 16, 22);
    await surface(fallback, VARS.errorSubtle, VARS.error, 16);
    fallback.appendChild(await icon('Error icon', 'sync_problem', VARS.error, 24));
    fallback.appendChild(await text('Fallback text', 'Mirror 1 ناموفق → ادامه از Mirror 2 با Range Request → اگر همه ناموفق بودند: «تلاش دوباره» و «دانلود مستقیم». برنامه و اسناد همچنان قابل استفاده می‌مانند.', STYLES.body, VARS.textStrong, { width: 2110, lineHeight: 28 }));
    root.appendChild(fallback);

    root.appendChild(await sectionHeader('02 / Release', 'Flow انتشار — سیستم شما تا کاربر', 'نسخه‌ها روی سیستم خودتان ساخته می‌شوند. فایل حجیم ابتدا روی هاست‌ها کامل می‌شود و مانیفست سبک همیشه آخر منتشر می‌شود.'));
    const releaseBoard = frame('Hosting release flow', 'HORIZONTAL', 2216, 0, 12, 28);
    await surface(releaseBoard, VARS.subtle, null, 18);
    const releaseSteps = [
      ['Build محلی', 'نسخه، blockmap و portable', 'build', 'neutral'],
      ['Sign', 'امضای Installer و Manifest', 'ink_pen', 'accent'],
      ['Upload Mirror A/B', 'فایل‌های حجیم با مسیر یکسان', 'cloud_upload', 'neutral'],
      ['Health Check', 'دانلود آزمایشی + SHA-512', 'fact_check', 'neutral'],
      ['Publish Manifest', 'جایگزینی اتمیک روی ravi.poorsmile.ir', 'publish', 'accent'],
      ['Client Discovery', 'کلاینت نسخهٔ تازه را می‌بیند', 'devices', 'success']
    ];
    const releaseChildren = [];
    for (let index = 0; index < releaseSteps.length; index += 1) {
      const [titleValue, body, glyph, tone] = releaseSteps[index];
      releaseChildren.push(await flowNode(titleValue, body, glyph, 306, tone));
      if (index < releaseSteps.length - 1) releaseChildren.push(await arrow('بعدی'));
    }
    for (const child of releaseChildren.reverse()) releaseBoard.appendChild(child);
    root.appendChild(releaseBoard);

    const notes = frame('Operational notes', 'HORIZONTAL', 2216, 0, 20, 0);
    notes.appendChild(await infoCard('تغییر سادهٔ هاست', 'فقط baseUrlهای آرایهٔ mirrors یا DNS alias تغییر می‌کند؛ مسیر artifact ثابت می‌ماند و انتشار برنامه لازم نیست.', 'swap_horiz', 706, 'accent'));
    notes.appendChild(await infoCard('نگهداری', 'نسخهٔ جاری و سه نسخهٔ پایدار قبلی روی هاست دانلود؛ نسخه‌های قدیمی‌تر در آرشیو محلی. متادیتا روی دامنهٔ اصلی باقی می‌ماند.', 'inventory_2', 706));
    notes.appendChild(await infoCard('Rollback', 'در صورت مشکل نسخه، Manifest به آخرین نسخهٔ سالم برمی‌گردد. چون نسخه‌های قبلی روی هاست هستند، Rollback فوری است.', 'settings_backup_restore', 706));
    root.appendChild(notes);
    root.setPluginData('raavi-update-builder', 'flow-v1');
    return root;
  }

  try {
    await prepareFonts();
    await buildFoundation();
    const { statusSet, bannerSet, floatingSet } = await buildComponents();
    const screensRoot = await buildScreens(statusSet, bannerSet, floatingSet);
    await buildFlow();
    const screensPage = figma.root.children.find((child) => child.type === 'PAGE' && child.name === PAGE_NAMES.screens);
    if (screensPage) await figma.setCurrentPageAsync(screensPage);
    figma.currentPage.selection = [screensRoot];
    figma.viewport.scrollAndZoomIntoView([screensRoot]);
    figma.closePlugin('Software Update: Foundation, Components, Screens و Flow ساخته شد.');
  } catch (error) {
    console.error(error);
    const message = error && error.stack ? error.stack : (error && error.message ? error.message : String(error));
    try {
      const marker = figma.createText();
      marker.name = 'BUILDER ERROR — DELETE AFTER FIX';
      marker.fontName = FONT_REGULAR;
      marker.fontSize = 18;
      marker.characters = `Software Update Builder failed:\n${message}`;
      marker.textAutoResize = 'HEIGHT';
      marker.resize(1200, 120);
      marker.x = 0;
      marker.y = -220;
      marker.fills = [{ type: 'SOLID', color: { r: 0.75, g: 0.05, b: 0.05 } }];
      figma.currentPage.appendChild(marker);
      figma.currentPage.selection = [marker];
      figma.viewport.scrollAndZoomIntoView([marker]);
    } catch (_) {}
    figma.notify(`Update builder failed: ${error && error.message ? error.message : error}`, { error: true, timeout: 15000 });
    figma.closePlugin();
  }
})();
