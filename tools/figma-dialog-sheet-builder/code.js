figma.showUI(__html__, { width: 420, height: 650, themeColors: true });

const IDS = {
  page: '444:2',
  dialogSection: '444:6',
  sheetSection: '444:7',
  confirmationSection: '444:8',
  usageSection: '444:9',
  dialogSlot: '446:4',
  sheetSlot: '446:7',
  confirmationSlot: '447:4',
  usageSlot: '447:7',
  buttonSet: '37:22',
  iconButtonSet: '25:22',
  closeComponent: '20:19',
  panelCollapse: '215:2'
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
  warningBg: 'VariableID:5:30',
  warningText: 'VariableID:5:31',
  warningBorder: 'VariableID:5:32',
  overlay: 'VariableID:5:37',
  shadow: 'VariableID:5:40',
  radiusSurface: 'VariableID:433:2'
};

const STYLES = {
  h1: 'S:c942de4388e4201083e27f53b64e8aa9dc567092,',
  h2: 'S:118e82674d819fa75c7a82f28dfd03466dd6b36c,',
  h3: 'S:e047dd16b1bfa74e81c786e303db3388a92aea55,',
  body: 'S:71fbfa2bd79e0a6e72be931aec89b8ef52824359,',
  label: 'S:b00942f6c7e4559d3177570506be34e2ae17cf2f,',
  caption: 'S:ed0d93a75c94bde8603f09350cf917784ac882b5,',
  selection: 'S:c6ed58221f6b36bef954df8c9d35fedb40b85e62,',
  sheet: 'S:50a7a0195793f9aa8bb1b651706999bce869c3b1,',
  popover: 'S:825fcfca6c834f898c2f9ec8bab27a9fce3a19fd,',
  dialog: 'S:370ccca8af992bd9b218a02638bd047c73884920,',
  compactDialog: 'S:4c0b07b8e1ab959979b8c88bbdb1dc75e0b019a3,',
  drawerStart: 'S:72ad5da6921d263830a7f5d19f0e6e26606e0cb4,',
  drawerEnd: 'S:6933674c9f7558cf217b3d1c47d595832c4b59ca,'
};

const FONT_REGULAR = { family: 'Vazirmatn', style: 'Regular' };
const FONT_MEDIUM = { family: 'Vazirmatn', style: 'Medium' };
const FONT_BOLD = { family: 'Vazirmatn', style: 'Bold' };
const SYMBOL_FONT = { family: 'Material Symbols Rounded', style: 'Regular' };
const loadedFonts = new Set();
const nodeCache = new Map();
const variableCache = new Map();
const styleCache = new Map();
let symbolFontAvailable = true;

function assertNode(node, id) {
  if (!node) throw new Error(`Figma node not found: ${id}`);
  return node;
}

async function nodeById(id) {
  if (!nodeCache.has(id)) nodeCache.set(id, assertNode(await figma.getNodeByIdAsync(id), id));
  return nodeCache.get(id);
}

async function variableById(id) {
  if (!variableCache.has(id)) {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (!variable) throw new Error(`Variable not found: ${id}`);
    variableCache.set(id, variable);
  }
  return variableCache.get(id);
}

async function styleById(id) {
  if (!styleCache.has(id)) styleCache.set(id, await figma.getStyleByIdAsync(id));
  return styleCache.get(id);
}

async function loadFont(fontName) {
  const key = `${fontName.family}/${fontName.style}`;
  if (loadedFonts.has(key)) return;
  await figma.loadFontAsync(fontName);
  loadedFonts.add(key);
}

async function prepareFonts() {
  await Promise.all([loadFont(FONT_REGULAR), loadFont(FONT_MEDIUM), loadFont(FONT_BOLD)]);
  try {
    await loadFont(SYMBOL_FONT);
  } catch (_) {
    symbolFontAvailable = false;
  }
}

async function bindPaint(node, property, variableId, opacity) {
  const variable = await variableById(variableId);
  const paint = { type: 'SOLID', color: { r: 1, g: 1, b: 1 } };
  if (typeof opacity === 'number') paint.opacity = opacity;
  node[property] = [figma.variables.setBoundVariableForPaint(paint, 'color', variable)];
}

async function bindNumber(node, property, variableId, fallback) {
  node[property] = fallback;
  const variable = await variableById(variableId);
  if (typeof node.setBoundVariable === 'function') node.setBoundVariable(property, variable);
}

async function setEffectStyle(node, styleId) {
  const style = await styleById(styleId);
  if (!style) return;
  if (typeof node.setEffectStyleIdAsync === 'function') await node.setEffectStyleIdAsync(style.id);
  else node.effectStyleId = style.id;
}

async function setTextStyle(text, styleId, fallbackFont, fallbackSize) {
  const style = await styleById(styleId);
  if (style && style.type === 'TEXT' && style.fontName !== figma.mixed) {
    await loadFont(style.fontName);
    text.fontName = style.fontName;
    if (typeof text.setTextStyleIdAsync === 'function') await text.setTextStyleIdAsync(style.id);
    else text.textStyleId = style.id;
    return;
  }
  await loadFont(fallbackFont);
  text.fontName = fallbackFont;
  text.fontSize = fallbackSize;
}

async function setTheme(node, theme) {
  const variable = await variableById(VARS.textPrimary);
  const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
  if (!collection || typeof node.setExplicitVariableModeForCollection !== 'function') return;
  const needle = theme.toLowerCase();
  const mode = collection.modes.find((candidate) => candidate.name.toLowerCase() === needle)
    || collection.modes.find((candidate) => candidate.name.toLowerCase().includes(needle));
  if (mode) node.setExplicitVariableModeForCollection(collection, mode.modeId);
}

async function makeText(name, characters, styleId, colorId, options) {
  const settings = options || {};
  const text = figma.createText();
  text.name = name;
  await setTextStyle(text, styleId, settings.font || FONT_REGULAR, settings.size || 14);
  text.characters = characters;
  text.textAlignHorizontal = settings.align || 'RIGHT';
  try { text.paragraphDirection = 'RIGHT_TO_LEFT'; } catch (_) {}
  if (settings.width) {
    text.resize(settings.width, Math.max(24, settings.height || 24));
    text.textAutoResize = 'HEIGHT';
  } else {
    text.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
  if (settings.lineHeight) text.lineHeight = { unit: 'PIXELS', value: settings.lineHeight };
  await bindPaint(text, 'fills', colorId || VARS.textPrimary);
  return text;
}

async function makeIcon(name, symbol, colorId, size) {
  const unicodeFallback = {
    close: '×', warning: '!', error: '!', help: '؟', progress_activity: '◌',
    right_panel_close: '‹', drag_handle: '—', check_circle: '✓', info: 'i',
    description: '▤', history: '↶', delete: '×', refresh: '↻'
  };
  const text = figma.createText();
  text.name = name;
  if (symbolFontAvailable) {
    await loadFont(SYMBOL_FONT);
    text.fontName = SYMBOL_FONT;
    text.fontSize = size || 20;
    text.characters = symbol;
  } else {
    await loadFont(FONT_BOLD);
    text.fontName = FONT_BOLD;
    text.fontSize = size || 20;
    text.characters = unicodeFallback[symbol] || '•';
  }
  text.textAlignHorizontal = 'CENTER';
  text.textAlignVertical = 'CENTER';
  text.textAutoResize = 'NONE';
  text.resize(size || 20, size || 20);
  await bindPaint(text, 'fills', colorId || VARS.textPrimary);
  return text;
}

function autoFrame(name, direction, gap, padding) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = direction || 'VERTICAL';
  frame.itemSpacing = typeof gap === 'number' ? gap : 0;
  const inset = padding || 0;
  frame.paddingTop = inset;
  frame.paddingRight = inset;
  frame.paddingBottom = inset;
  frame.paddingLeft = inset;
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.fills = [];
  frame.strokes = [];
  return frame;
}

function componentFrame(name, width, fixedHeight) {
  const component = figma.createComponent();
  component.name = name;
  component.layoutMode = 'VERTICAL';
  component.itemSpacing = 0;
  component.paddingTop = 0;
  component.paddingRight = 0;
  component.paddingBottom = 0;
  component.paddingLeft = 0;
  component.counterAxisSizingMode = 'FIXED';
  component.primaryAxisSizingMode = fixedHeight ? 'FIXED' : 'AUTO';
  component.resize(width, fixedHeight || 100);
  component.clipsContent = true;
  component.strokes = [];
  return component;
}

async function surfaceFrame(frame, theme) {
  await setTheme(frame, theme);
  await bindPaint(frame, 'fills', VARS.surface);
  await bindNumber(frame, 'cornerRadius', VARS.radiusSurface, 14);
  frame.strokes = [];
}

async function divider(name) {
  const line = figma.createFrame();
  line.name = name || 'Divider';
  line.resize(1, 1);
  line.layoutAlign = 'STRETCH';
  await bindPaint(line, 'fills', VARS.border);
  return line;
}

function spacer(name) {
  const node = figma.createFrame();
  node.name = name || 'Spacer';
  node.resize(1, 1);
  node.fills = [];
  node.layoutGrow = 1;
  return node;
}

function parseVariant(name) {
  const result = {};
  String(name).split(',').forEach((part) => {
    const index = part.indexOf('=');
    if (index > -1) result[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  });
  return result;
}

function matchesVariant(node, desired) {
  const props = parseVariant(node.name);
  return Object.keys(desired).every((key) => String(props[key]).toLowerCase() === String(desired[key]).toLowerCase());
}

async function variantComponent(setId, desired) {
  const set = await nodeById(setId);
  if (set.type !== 'COMPONENT_SET') throw new Error(`Expected component set: ${setId}`);
  return set.children.find((child) => child.type === 'COMPONENT' && matchesVariant(child, desired))
    || set.defaultVariant;
}

function propertyKey(instance, label) {
  return Object.keys(instance.componentProperties || {}).find((key) => key === label || key.startsWith(`${label}#`));
}

async function forceButtonContent(instance, label, showIcon) {
  const labelKey = propertyKey(instance, 'Label');
  const showIconKey = propertyKey(instance, 'Show Icon');
  let labelApplied = false;
  let iconVisibilityApplied = false;
  if (labelKey) {
    try {
      instance.setProperties({ [labelKey]: label });
      labelApplied = true;
    } catch (_) {}
  }
  if (showIconKey) {
    try {
      instance.setProperties({ [showIconKey]: Boolean(showIcon) });
      iconVisibilityApplied = true;
    } catch (_) {}
  }
  if (!labelApplied) {
    const labelLayer = instance.findOne((node) => node.type === 'TEXT' && node.name === 'Label');
    if (labelLayer) {
      await loadFont(labelLayer.fontName === figma.mixed ? FONT_MEDIUM : labelLayer.fontName);
      labelLayer.characters = label;
    }
  }
  if (!iconVisibilityApplied) {
    const iconLayer = instance.findOne((node) => node.name === 'Icon');
    if (iconLayer) iconLayer.visible = Boolean(showIcon);
  }
  return { labelApplied, iconVisibilityApplied };
}

async function buttonInstance(size, tone, state, label) {
  const component = await variantComponent(IDS.buttonSet, { Size: size, Tone: tone, State: state });
  if (!component) throw new Error(`Button variant not found: ${size}/${tone}/${state}`);
  const instance = component.createInstance();
  instance.name = `Button / ${label}`;
  await forceButtonContent(instance, label, false);
  return instance;
}

async function iconButton(symbol, name) {
  try {
    const component = await variantComponent(IDS.iconButtonSet, { Size: 'Desktop', Tone: 'Neutral', State: 'Default' });
    const instance = component.createInstance();
    instance.name = name || `Icon Button / ${symbol}`;
    const iconKey = propertyKey(instance, 'Icon');
    if (iconKey) instance.setProperties({ [iconKey]: symbol });
    return instance;
  } catch (_) {
    const control = autoFrame(name || `Icon Button / ${symbol}`, 'HORIZONTAL', 0, 8);
    control.primaryAxisSizingMode = 'FIXED';
    control.counterAxisSizingMode = 'FIXED';
    control.resize(36, 36);
    control.cornerRadius = 6;
    await bindPaint(control, 'fills', VARS.subtle);
    control.appendChild(await makeIcon('Icon', symbol, VARS.textPrimary, 20));
    return control;
  }
}

async function addComponentProperties(set, specs) {
  if (typeof set.addComponentProperty !== 'function') return {};
  const result = {};
  for (const spec of specs) {
    let propertyId;
    try {
      propertyId = set.addComponentProperty(spec.name, spec.type, spec.defaultValue);
    } catch (_) {
      const existing = Object.entries(set.componentPropertyDefinitions || {})
        .find(([name]) => name === spec.name || name.startsWith(`${spec.name}#`));
      propertyId = existing && existing[0];
    }
    if (!propertyId) continue;
    result[spec.name] = propertyId;
    for (const component of set.children) {
      if (component.type !== 'COMPONENT') continue;
      const layer = component.findOne((node) => node.name === spec.layerName);
      if (!layer) continue;
      const refs = Object.assign({}, layer.componentPropertyReferences || {});
      refs[spec.field] = propertyId;
      try { layer.componentPropertyReferences = refs; } catch (_) {}
    }
  }
  return result;
}

function arrangeGrid(set, rowFor, columnFor, gapX, gapY, padding) {
  set.layoutMode = 'NONE';
  const components = set.children.filter((child) => child.type === 'COMPONENT');
  const rows = Math.max(...components.map(rowFor)) + 1;
  const columns = Math.max(...components.map(columnFor)) + 1;
  const rowHeights = Array(rows).fill(0);
  const columnWidths = Array(columns).fill(0);
  components.forEach((component) => {
    const row = rowFor(component);
    const column = columnFor(component);
    rowHeights[row] = Math.max(rowHeights[row], component.height);
    columnWidths[column] = Math.max(columnWidths[column], component.width);
  });
  const rowY = [];
  const columnX = [];
  let cursor = padding;
  columnWidths.forEach((width, index) => {
    columnX[index] = cursor;
    cursor += width + gapX;
  });
  const totalWidth = cursor - gapX + padding;
  cursor = padding;
  rowHeights.forEach((height, index) => {
    rowY[index] = cursor;
    cursor += height + gapY;
  });
  const totalHeight = cursor - gapY + padding;
  set.resizeWithoutConstraints(totalWidth, totalHeight);
  components.forEach((component) => {
    component.x = columnX[columnFor(component)];
    component.y = rowY[rowFor(component)];
  });
  return { rows, columns, width: totalWidth, height: totalHeight };
}

function fitSlot(slot, set, minimumHeight) {
  const height = Math.max(minimumHeight || 0, set.height + 48);
  slot.resize(slot.width, height);
}

async function fitDocumentationSection(sectionId, slotId, padding) {
  const section = await nodeById(sectionId);
  const slot = await nodeById(slotId);
  const requiredHeight = Math.ceil(slot.y + slot.height + (padding || 48));
  const before = section.height;
  if (section.height < requiredHeight) section.resizeWithoutConstraints(section.width, requiredHeight);
  return { sectionId: section.id, slotId: slot.id, before, after: section.height, requiredHeight };
}

async function existingSet(slotId, name) {
  const slot = await nodeById(slotId);
  const set = slot.findOne((node) => node.type === 'COMPONENT_SET' && node.name === name);
  return { slot, set };
}

async function buildDangerButtons() {
  await prepareFonts();
  const set = await nodeById(IDS.buttonSet);
  if (set.type !== 'COMPONENT_SET') throw new Error('Canonical Button set is missing.');
  const already = set.children.filter((child) => child.type === 'COMPONENT' && parseVariant(child.name).Tone === 'Danger');
  if (already.length === 10) {
    return { stage: 'danger-buttons', status: 'existing', setId: set.id, variantIds: already.map((node) => node.id), count: already.length };
  }

  const created = [];
  const accentVariants = set.children.filter((child) => child.type === 'COMPONENT' && parseVariant(child.name).Tone === 'Accent');
  for (const source of accentVariants) {
    const props = parseVariant(source.name);
    if (set.children.some((child) => child.type === 'COMPONENT' && matchesVariant(child, { Size: props.Size, Tone: 'Danger', State: props.State }))) continue;
    const clone = source.clone();
    clone.name = source.name.replace('Tone=Accent', 'Tone=Danger');
    clone.description = 'Danger action. Focus is reserved for the safe action in destructive confirmations.';
    set.appendChild(clone);

    if (props.State !== 'Disabled') {
      const filled = props.State === 'Hover' || props.State === 'Pressed';
      await bindPaint(clone, 'fills', filled ? VARS.error : VARS.errorSubtle);
      clone.strokesIncludedInLayout = true;
      clone.strokeWeight = 1;
      await bindPaint(clone, 'strokes', VARS.error);
      const textLayers = clone.findAll((node) => node.type === 'TEXT');
      for (const text of textLayers) await bindPaint(text, 'fills', filled ? VARS.accentOn : VARS.error);
      if (props.State === 'Focus') await setEffectStyle(clone, STYLES.selection);
      if (props.State === 'Pressed') clone.opacity = 0.88;
    }
    created.push(clone);
  }

  const stateIndex = { Default: 0, Hover: 1, Pressed: 2, Focus: 3, Disabled: 4 };
  const rowIndex = {
    'Desktop/Neutral': 0, 'Desktop/Accent': 1, 'Desktop/Danger': 2,
    'Touch/Neutral': 3, 'Touch/Accent': 4, 'Touch/Danger': 5
  };
  const layout = arrangeGrid(
    set,
    (node) => rowIndex[`${parseVariant(node.name).Size}/${parseVariant(node.name).Tone}`] || 0,
    (node) => stateIndex[parseVariant(node.name).State] || 0,
    24,
    24,
    24
  );
  set.description = 'Canonical Button family. Tone Danger uses semantic error tokens; neutral surfaces remain borderless except interaction states.';

  return {
    stage: 'danger-buttons', status: 'created', setId: set.id,
    variantIds: created.map((node) => node.id), count: created.length, layout
  };
}

async function dialogHeader(width, title) {
  const header = autoFrame('Header', 'HORIZONTAL', 12, 18);
  header.primaryAxisSizingMode = 'FIXED';
  header.counterAxisSizingMode = 'FIXED';
  header.resize(width, 64);
  header.appendChild(await iconButton('close', 'Close'));
  const titleText = await makeText('Title', title, STYLES.h3, VARS.textStrong, { width: width - 96, size: 20 });
  titleText.layoutGrow = 1;
  header.appendChild(titleText);
  return header;
}

async function dialogBody(width, overflow) {
  const body = autoFrame('Body', 'VERTICAL', 12, 24);
  body.layoutAlign = 'STRETCH';
  body.counterAxisSizingMode = 'FIXED';
  body.resize(width, overflow === 'Scrollable' ? 300 : 100);
  body.primaryAxisSizingMode = overflow === 'Scrollable' ? 'FIXED' : 'AUTO';
  body.clipsContent = overflow === 'Scrollable';
  if (overflow === 'Scrollable') body.overflowDirection = 'VERTICAL';
  const paragraphs = overflow === 'Scrollable'
    ? [
      'این نمونه برای محتوای طولانی طراحی شده است؛ سربرگ و عملیات در جای خود می‌مانند.',
      'حرکت تمرکز با Tab و Shift+Tab داخل همین سطح محصور می‌شود.',
      'Escape یا Back فقط بالاترین لایه را می‌بندد و تمرکز را به فراخوان بازمی‌گرداند.',
      'در زمان انجام عملیات، بستن با پس‌زمینه یا Escape غیرفعال است.',
      'بدنه مستقل پیمایش می‌شود تا جای عملیات پایدار بماند.',
      'عرض سند و محتوای اصلی با بازشدن Dialog تغییر نمی‌کند.',
      'این رفتار در تم روشن و تیره یکسان است.'
    ]
    : [
      'برای تکمیل این عملیات، اطلاعات زیر را بررسی کنید.',
      'پس از تأیید، نتیجه به‌صورت محلی در سند اعمال می‌شود.'
    ];
  paragraphs.forEach(async () => {});
  for (let index = 0; index < paragraphs.length; index += 1) {
    const text = await makeText(index === 0 ? 'Body' : `Body line ${index + 1}`, paragraphs[index], STYLES.body, index === 0 ? VARS.textPrimary : VARS.textSecondary, { width: width - 48, size: 15 });
    body.appendChild(text);
  }
  return body;
}

async function actionFooter(width, primaryLabel, secondaryLabel, primaryTone, busy) {
  const footer = autoFrame('Footer', 'HORIZONTAL', 8, 14);
  footer.primaryAxisSizingMode = 'FIXED';
  footer.counterAxisSizingMode = 'FIXED';
  footer.resize(width, 64);
  footer.appendChild(await buttonInstance('Desktop', primaryTone || 'Accent', busy ? 'Disabled' : 'Default', primaryLabel));
  footer.appendChild(await buttonInstance('Desktop', 'Neutral', busy ? 'Disabled' : 'Default', secondaryLabel));
  footer.appendChild(spacer('Action spacer'));
  return footer;
}

async function createDialogVariant(theme, size, overflow) {
  const width = size === 'Compact' ? 420 : 560;
  const component = componentFrame(`Theme=${theme}, Size=${size}, Overflow=${overflow}`, width, 0);
  component.setPluginData('raavi-builder-part', 'dialog-variant-v1');
  component.primaryAxisSizingMode = 'AUTO';
  component.description = `${size} ${overflow.toLowerCase()} modal dialog. Top-layer focus is trapped and restored on close.`;
  await surfaceFrame(component, theme);
  await setEffectStyle(component, size === 'Compact' ? STYLES.compactDialog : STYLES.dialog);
  component.appendChild(await dialogHeader(width, size === 'Compact' ? 'تنظیمات سند' : 'ایجاد سند جدید'));
  component.appendChild(await divider('Header divider'));
  component.appendChild(await dialogBody(width, overflow));
  component.appendChild(await divider('Footer divider'));
  component.appendChild(await actionFooter(width, 'تأیید', 'انصراف', 'Accent', false));
  return component;
}

async function buildDialogs() {
  await prepareFonts();
  const { slot, set: found } = await existingSet(IDS.dialogSlot, 'Dialog');
  if (found) return { stage: 'dialogs', status: 'existing', setId: found.id, variantIds: found.children.map((node) => node.id), count: found.children.length };
  const knownPartial = await figma.getNodeByIdAsync('448:5755');
  if (knownPartial && knownPartial.type === 'COMPONENT' && knownPartial.parent && knownPartial.parent.type === 'PAGE' && knownPartial.name === 'Theme=Light, Size=Compact, Overflow=Static') knownPartial.remove();
  const variants = [];
  for (const theme of ['Light', 'Dark']) {
    for (const size of ['Compact', 'Standard']) {
      for (const overflow of ['Static', 'Scrollable']) {
        const variant = await createDialogVariant(theme, size, overflow);
        variant.x = 4000 + variants.length * 620;
        variant.y = 4000;
        variants.push(variant);
      }
    }
  }
  const set = figma.combineAsVariants(variants, slot);
  set.name = 'Dialog';
  set.description = 'Generic protected modal dialog. Header and footer remain stable; only Body scrolls. Close is physically left in RTL.';
  set.setPluginData('raavi-builder', 'dialog-v1');
  const layout = arrangeGrid(
    set,
    (node) => ({ 'Light/Compact': 0, 'Light/Standard': 1, 'Dark/Compact': 2, 'Dark/Standard': 3 })[`${parseVariant(node.name).Theme}/${parseVariant(node.name).Size}`],
    (node) => ({ Static: 0, Scrollable: 1 })[parseVariant(node.name).Overflow],
    36,
    36,
    24
  );
  const properties = await addComponentProperties(set, [
    { name: 'Title', type: 'TEXT', defaultValue: 'عنوان Dialog', layerName: 'Title', field: 'characters' },
    { name: 'Body', type: 'TEXT', defaultValue: 'متن توضیح Dialog', layerName: 'Body', field: 'characters' },
    { name: 'Show Close', type: 'BOOLEAN', defaultValue: true, layerName: 'Close', field: 'visible' },
    { name: 'Show Footer', type: 'BOOLEAN', defaultValue: true, layerName: 'Footer', field: 'visible' }
  ]);
  fitSlot(slot, set, 2600);
  return { stage: 'dialogs', status: 'created', setId: set.id, variantIds: variants.map((node) => node.id), count: variants.length, properties, layout };
}

async function sheetHeader(width, title, placement, modality) {
  const header = autoFrame('Header', 'HORIZONTAL', 12, 18);
  header.primaryAxisSizingMode = 'FIXED';
  header.counterAxisSizingMode = 'FIXED';
  header.resize(width, placement === 'Bottom' ? 72 : 64);
  if (placement === 'Bottom') {
    const handleWrap = autoFrame('Drag handle area', 'HORIZONTAL', 0, 0);
    handleWrap.primaryAxisSizingMode = 'FIXED';
    handleWrap.counterAxisSizingMode = 'FIXED';
    handleWrap.resize(36, 36);
    const handle = figma.createFrame();
    handle.name = 'Drag handle';
    handle.resize(24, 4);
    handle.cornerRadius = 2;
    await bindPaint(handle, 'fills', VARS.textTertiary);
    handleWrap.appendChild(handle);
    header.appendChild(handleWrap);
  } else if (modality === 'Standard') {
    try {
      const collapse = await nodeById(IDS.panelCollapse);
      if (collapse.type === 'COMPONENT') header.appendChild(collapse.createInstance());
      else header.appendChild(await iconButton('right_panel_close', 'Collapse panel'));
    } catch (_) {
      header.appendChild(await iconButton('right_panel_close', 'Collapse panel'));
    }
  } else {
    header.appendChild(await iconButton('close', 'Close'));
  }
  const titleText = await makeText('Title', title, STYLES.h3, VARS.textStrong, { width: width - 96, size: 20 });
  titleText.layoutGrow = 1;
  header.appendChild(titleText);
  return header;
}

async function sheetBody(width, placement) {
  const body = autoFrame('Body', 'VERTICAL', 0, 24);
  body.layoutAlign = 'STRETCH';
  body.layoutGrow = 1;
  body.counterAxisSizingMode = 'FIXED';
  body.primaryAxisSizingMode = 'FIXED';
  body.resize(width, placement === 'Side' ? 520 : 220);
  body.clipsContent = true;
  body.overflowDirection = 'VERTICAL';
  const rows = placement === 'Side'
    ? ['جزئیات سند', 'تنظیمات نمایش', 'دسترسی و نگه‌داری']
    : ['عملیات مرتبط با بلوک فعال', 'تنظیمات سریع'];
  for (let i = 0; i < rows.length; i += 1) {
    const row = autoFrame(`Row ${i + 1}`, 'VERTICAL', 4, 14);
    row.layoutAlign = 'STRETCH';
    row.appendChild(await makeText(i === 0 ? 'Body' : `Row title ${i + 1}`, rows[i], STYLES.label, VARS.textPrimary, { width: width - 76, size: 14 }));
    row.appendChild(await makeText(`Row description ${i + 1}`, 'تنظیمات این بخش بدون خروج از زمینهٔ فعلی در دسترس است.', STYLES.caption, VARS.textSecondary, { width: width - 76, size: 12 }));
    body.appendChild(row);
    if (i < rows.length - 1) body.appendChild(await divider('Row divider'));
  }
  return body;
}

async function createSheetVariant(theme, placement, modality) {
  const side = placement === 'Side';
  const width = side ? 360 : 390;
  const height = side ? 720 : 420;
  const component = componentFrame(`Theme=${theme}, Placement=${placement}, Modality=${modality}`, width, height);
  component.description = `${placement} ${modality.toLowerCase()} sheet. Side placement attaches to the physical right edge; compact layouts use Bottom.`;
  await setTheme(component, theme);
  await bindPaint(component, 'fills', VARS.surface);
  component.strokes = [];
  if (side) {
    component.topLeftRadius = 14;
    component.bottomLeftRadius = 14;
    component.topRightRadius = 0;
    component.bottomRightRadius = 0;
    if (modality === 'Modal') await setEffectStyle(component, STYLES.drawerStart);
  } else {
    component.topLeftRadius = 14;
    component.topRightRadius = 14;
    component.bottomLeftRadius = 0;
    component.bottomRightRadius = 0;
    if (modality === 'Modal') await setEffectStyle(component, STYLES.sheet);
  }
  component.appendChild(await sheetHeader(width, side ? 'جزئیات سند' : 'تنظیمات بلوک', placement, modality));
  component.appendChild(await divider('Header divider'));
  component.appendChild(await sheetBody(width, placement));
  component.appendChild(await divider('Footer divider'));
  component.appendChild(await actionFooter(width, 'اعمال', 'بازنشانی', 'Accent', false));
  return component;
}

async function buildSheets() {
  await prepareFonts();
  const { slot, set: found } = await existingSet(IDS.sheetSlot, 'Sheet');
  if (found) return { stage: 'sheets', status: 'existing', setId: found.id, variantIds: found.children.map((node) => node.id), count: found.children.length };
  const variants = [];
  for (const theme of ['Light', 'Dark']) {
    for (const placement of ['Side', 'Bottom']) {
      for (const modality of ['Standard', 'Modal']) {
        const variant = await createSheetVariant(theme, placement, modality);
        variant.x = 4000 + variants.length * 440;
        variant.y = 7000;
        variants.push(variant);
      }
    }
  }
  const set = figma.combineAsVariants(variants, slot);
  set.name = 'Sheet';
  set.description = 'General Sheet family. Side is anchored to the physical right edge; Bottom is used for compact layouts. Modal variants own the scrim and focus containment.';
  set.setPluginData('raavi-builder', 'sheet-v1');
  const layout = arrangeGrid(
    set,
    (node) => ({ 'Light/Side': 0, 'Light/Bottom': 1, 'Dark/Side': 2, 'Dark/Bottom': 3 })[`${parseVariant(node.name).Theme}/${parseVariant(node.name).Placement}`],
    (node) => ({ Standard: 0, Modal: 1 })[parseVariant(node.name).Modality],
    48,
    48,
    24
  );
  const properties = await addComponentProperties(set, [
    { name: 'Title', type: 'TEXT', defaultValue: 'عنوان Sheet', layerName: 'Title', field: 'characters' },
    { name: 'Body', type: 'TEXT', defaultValue: 'محتوای Sheet', layerName: 'Body', field: 'characters' },
    { name: 'Show Footer', type: 'BOOLEAN', defaultValue: true, layerName: 'Footer', field: 'visible' }
  ]);
  fitSlot(slot, set, 3200);
  return { stage: 'sheets', status: 'created', setId: set.id, variantIds: variants.map((node) => node.id), count: variants.length, properties, layout };
}

async function statusIcon(tone, state) {
  const wrap = autoFrame('Status', 'HORIZONTAL', 0, 10);
  wrap.primaryAxisSizingMode = 'FIXED';
  wrap.counterAxisSizingMode = 'FIXED';
  wrap.resize(44, 44);
  wrap.cornerRadius = 12;
  const danger = tone === 'Danger';
  await bindPaint(wrap, 'fills', danger ? VARS.errorSubtle : VARS.accentSubtle);
  const symbol = state === 'Busy' ? 'progress_activity' : state === 'Error' ? 'error' : danger ? 'warning' : 'help';
  wrap.appendChild(await makeIcon('Status icon', symbol, danger || state === 'Error' ? VARS.error : VARS.accent, 24));
  return wrap;
}

async function confirmationBody(width, tone, state) {
  const body = autoFrame('Body area', 'VERTICAL', 14, 24);
  body.layoutAlign = 'STRETCH';
  const danger = tone === 'Danger';
  const title = state === 'Busy' ? 'در حال انجام عملیات…' : danger ? 'سند حذف شود؟' : 'تغییرات اعمال شوند؟';
  const description = state === 'Busy'
    ? 'تا پایان عملیات، بستن این پنجره یا تغییر زمینه ممکن نیست.'
    : danger
      ? 'سند از کتابخانهٔ محلی حذف می‌شود و از سطل بازیافت قابل بازیابی است.'
      : 'این تغییر فقط روی فایل محلی فعلی اعمال می‌شود.';
  body.appendChild(await statusIcon(tone, state));
  body.appendChild(await makeText('Title', title, STYLES.h3, VARS.textStrong, { width: width - 48, size: 20 }));
  body.appendChild(await makeText('Body', description, STYLES.body, VARS.textSecondary, { width: width - 48, size: 15 }));
  if (state === 'Error') {
    const error = autoFrame('Inline error', 'HORIZONTAL', 8, 12);
    error.layoutAlign = 'STRETCH';
    error.cornerRadius = 8;
    await bindPaint(error, 'fills', VARS.errorSubtle);
    error.appendChild(await makeIcon('Error icon', 'error', VARS.error, 18));
    const message = await makeText('Error message', 'عملیات کامل نشد. دوباره تلاش کنید.', STYLES.caption, VARS.error, { width: width - 106, size: 12 });
    message.layoutGrow = 1;
    error.appendChild(message);
    body.appendChild(error);
  }
  return body;
}

async function confirmationFooter(width, tone, state) {
  const footer = autoFrame('Footer', 'HORIZONTAL', 8, 14);
  footer.primaryAxisSizingMode = 'FIXED';
  footer.counterAxisSizingMode = 'FIXED';
  footer.resize(width, 68);
  const busy = state === 'Busy';
  const safeState = busy ? 'Disabled' : 'Focus';
  const primaryState = busy ? 'Disabled' : 'Default';
  footer.appendChild(await buttonInstance('Desktop', 'Neutral', safeState, state === 'Error' ? 'بستن' : 'انصراف'));
  footer.appendChild(await buttonInstance('Desktop', tone === 'Danger' ? 'Danger' : 'Accent', primaryState, state === 'Error' ? 'تلاش دوباره' : tone === 'Danger' ? 'حذف سند' : 'تأیید'));
  footer.appendChild(spacer('Action spacer'));
  return footer;
}

async function createConfirmationVariant(theme, tone, state) {
  const width = 440;
  const component = componentFrame(`Theme=${theme}, Tone=${tone}, State=${state}`, width, 0);
  component.primaryAxisSizingMode = 'AUTO';
  component.description = `${tone} confirmation in ${state} state. The safe action receives initial focus; destructive actions never do.`;
  await surfaceFrame(component, theme);
  await setEffectStyle(component, STYLES.compactDialog);
  component.appendChild(await confirmationBody(width, tone, state));
  component.appendChild(await divider('Footer divider'));
  component.appendChild(await confirmationFooter(width, tone, state));
  return component;
}

async function buildConfirmations() {
  await prepareFonts();
  await buildDangerButtons();
  const { slot, set: found } = await existingSet(IDS.confirmationSlot, 'Confirmation');
  if (found) return { stage: 'confirmations', status: 'existing', setId: found.id, variantIds: found.children.map((node) => node.id), count: found.children.length };
  const variants = [];
  for (const theme of ['Light', 'Dark']) {
    for (const state of ['Ready', 'Busy', 'Error']) {
      for (const tone of ['Neutral', 'Danger']) {
        const variant = await createConfirmationVariant(theme, tone, state);
        variant.x = 4000 + variants.length * 470;
        variant.y = 11000;
        variants.push(variant);
      }
    }
  }
  const set = figma.combineAsVariants(variants, slot);
  set.name = 'Confirmation';
  set.description = 'Confirmation family for reversible and destructive operations. No close icon; explicit actions only. Busy is non-dismissible.';
  set.setPluginData('raavi-builder', 'confirmation-v1');
  const layout = arrangeGrid(
    set,
    (node) => ({ 'Light/Ready': 0, 'Light/Busy': 1, 'Light/Error': 2, 'Dark/Ready': 3, 'Dark/Busy': 4, 'Dark/Error': 5 })[`${parseVariant(node.name).Theme}/${parseVariant(node.name).State}`],
    (node) => ({ Neutral: 0, Danger: 1 })[parseVariant(node.name).Tone],
    40,
    40,
    24
  );
  const properties = await addComponentProperties(set, [
    { name: 'Title', type: 'TEXT', defaultValue: 'عنوان تأیید', layerName: 'Title', field: 'characters' },
    { name: 'Body', type: 'TEXT', defaultValue: 'توضیح عملیات', layerName: 'Body', field: 'characters' }
  ]);
  fitSlot(slot, set, 2600);
  return { stage: 'confirmations', status: 'created', setId: set.id, variantIds: variants.map((node) => node.id), count: variants.length, properties, layout };
}

async function findLocalSet(slotId, name) {
  const slot = await nodeById(slotId);
  const set = slot.findOne((node) => node.type === 'COMPONENT_SET' && node.name === name);
  if (!set) throw new Error(`${name} must be built first.`);
  return set;
}

async function repairConfirmationContent(confirmationSet, usageSlot) {
  let repairedButtons = 0;
  for (const component of confirmationSet.children) {
    if (component.type !== 'COMPONENT') continue;
    const props = parseVariant(component.name);
    const safeLabel = props.State === 'Error' ? 'بستن' : 'انصراف';
    const primaryLabel = props.State === 'Error'
      ? 'تلاش دوباره'
      : props.Tone === 'Danger'
        ? 'حذف سند'
        : 'تأیید';
    const buttons = component.findAll((node) => node.type === 'INSTANCE' && node.name.startsWith('Button /'));
    const safe = buttons.find((node) => node.name === `Button / ${safeLabel}`) || buttons[0];
    const primary = buttons.find((node) => node.name === `Button / ${primaryLabel}`) || buttons[1];
    if (safe) {
      safe.name = `Button / ${safeLabel}`;
      await forceButtonContent(safe, safeLabel, false);
      repairedButtons += 1;
    }
    if (primary) {
      primary.name = `Button / ${primaryLabel}`;
      await forceButtonContent(primary, primaryLabel, false);
      repairedButtons += 1;
    }
  }

  let usageSemanticsApplied = false;
  const usage = usageSlot.findOne((node) => node.name === 'Usage examples');
  const dangerScene = usage && usage.findOne((node) => node.name === 'Example 3 / Danger Confirmation / Light');
  const dangerConfirmation = dangerScene && dangerScene.findOne((node) => node.type === 'INSTANCE');
  if (dangerConfirmation) {
    const titleKey = propertyKey(dangerConfirmation, 'Title');
    const bodyKey = propertyKey(dangerConfirmation, 'Body');
    const properties = {};
    if (titleKey) properties[titleKey] = 'سند حذف شود؟';
    if (bodyKey) properties[bodyKey] = 'سند از کتابخانهٔ محلی حذف می‌شود و از سطل بازیافت قابل بازیابی است.';
    if (Object.keys(properties).length) {
      try {
        dangerConfirmation.setProperties(properties);
        usageSemanticsApplied = true;
      } catch (_) {}
    }
  }
  return { repairedButtons, usageSemanticsApplied };
}

function localVariant(set, desired) {
  return set.children.find((child) => child.type === 'COMPONENT' && matchesVariant(child, desired));
}

async function sceneShell(name, theme, width, height) {
  const scene = figma.createFrame();
  scene.name = name;
  scene.resize(width, height);
  scene.layoutMode = 'NONE';
  scene.clipsContent = true;
  scene.cornerRadius = 14;
  scene.strokes = [];
  await setTheme(scene, theme);
  await bindPaint(scene, 'fills', VARS.canvas);

  const titlebar = figma.createFrame();
  titlebar.name = 'App title bar';
  titlebar.resize(width, 36);
  titlebar.x = 0;
  titlebar.y = 0;
  await bindPaint(titlebar, 'fills', VARS.raised);
  scene.appendChild(titlebar);

  const rail = figma.createFrame();
  rail.name = 'Navigation rail / physical right';
  rail.resize(64, height - 36);
  rail.x = width - 64;
  rail.y = 36;
  await bindPaint(rail, 'fills', VARS.subtle);
  scene.appendChild(rail);

  const document = figma.createFrame();
  document.name = 'Centered document';
  document.resize(620, height - 108);
  document.x = Math.round((width - 64 - 620) / 2);
  document.y = 72;
  document.cornerRadius = 14;
  await bindPaint(document, 'fills', VARS.surface);
  scene.appendChild(document);
  const heading = await makeText('Document heading', 'سند نمونهٔ راوی', STYLES.h2, VARS.textStrong, { width: 520, size: 28 });
  heading.x = document.x + 50;
  heading.y = document.y + 44;
  scene.appendChild(heading);
  const copy = await makeText('Document copy', 'محتوا در پس‌زمینه ثابت می‌ماند و تمرکز به لایهٔ فعال منتقل می‌شود.', STYLES.body, VARS.textSecondary, { width: 520, size: 15 });
  copy.x = document.x + 50;
  copy.y = document.y + 108;
  scene.appendChild(copy);
  return scene;
}

async function scrim(width, height) {
  const overlay = figma.createFrame();
  overlay.name = 'Scrim';
  overlay.resize(width, height);
  overlay.x = 0;
  overlay.y = 0;
  await bindPaint(overlay, 'fills', VARS.overlay);
  return overlay;
}

async function buildUsage() {
  await prepareFonts();
  await buildDialogs();
  await buildSheets();
  await buildConfirmations();
  const slot = await nodeById(IDS.usageSlot);
  const existing = slot.findOne((node) => node.name === 'Usage examples');
  if (existing) return { stage: 'usage', status: 'existing', frameId: existing.id, childIds: existing.children.map((node) => node.id) };
  const dialogSet = await findLocalSet(IDS.dialogSlot, 'Dialog');
  const sheetSet = await findLocalSet(IDS.sheetSlot, 'Sheet');
  const confirmationSet = await findLocalSet(IDS.confirmationSlot, 'Confirmation');

  const usage = autoFrame('Usage examples', 'VERTICAL', 28, 0);
  usage.layoutAlign = 'STRETCH';
  usage.setPluginData('raavi-builder', 'usage-v1');

  const scene1 = await sceneShell('Example 1 / Dialog / Light', 'Light', 1180, 680);
  scene1.appendChild(await scrim(1180, 680));
  const dialog = localVariant(dialogSet, { Theme: 'Light', Size: 'Standard', Overflow: 'Scrollable' }).createInstance();
  dialog.x = Math.round((1180 - dialog.width) / 2);
  dialog.y = Math.round((680 - dialog.height) / 2);
  scene1.appendChild(dialog);
  usage.appendChild(scene1);

  const scene2 = await sceneShell('Example 2 / Side Sheet / Dark', 'Dark', 1180, 680);
  scene2.appendChild(await scrim(1180, 680));
  const side = localVariant(sheetSet, { Theme: 'Dark', Placement: 'Side', Modality: 'Modal' }).createInstance();
  side.x = 1180 - side.width;
  side.y = 0;
  side.resize(side.width, 680);
  scene2.appendChild(side);
  usage.appendChild(scene2);

  const scene3 = await sceneShell('Example 3 / Danger Confirmation / Light', 'Light', 1180, 620);
  scene3.appendChild(await scrim(1180, 620));
  const confirmation = localVariant(confirmationSet, { Theme: 'Light', Tone: 'Danger', State: 'Ready' }).createInstance();
  confirmation.x = Math.round((1180 - confirmation.width) / 2);
  confirmation.y = Math.round((620 - confirmation.height) / 2);
  scene3.appendChild(confirmation);
  usage.appendChild(scene3);

  const qa = autoFrame('QA contract', 'VERTICAL', 10, 24);
  qa.layoutAlign = 'STRETCH';
  qa.cornerRadius = 14;
  await bindPaint(qa, 'fills', VARS.surface);
  qa.appendChild(await makeText('QA title', 'قرارداد رفتار و دسترس‌پذیری', STYLES.h3, VARS.textStrong, { width: 1120, size: 20 }));
  const checks = [
    'Focus trap: حرکت Tab داخل بالاترین لایه محصور و پس از بستن به فراخوان بازگردانده می‌شود.',
    'Escape / Back: فقط بالاترین لایه را می‌بندد؛ در حالت Busy هیچ مسیر بستن فعال نیست.',
    'Destructive safety: تمرکز اولیه همیشه روی اقدام امن است و هرگز روی حذف قرار نمی‌گیرد.',
    'Placement: Sheet کناری به لبهٔ فیزیکی راست متصل است؛ در عرض فشرده از Bottom Sheet استفاده می‌شود.',
    'Targets: کنترل‌های Desktop حداقل ۳۶ و Touch حداقل ۴۴ پیکسل هستند.',
    'Themes: تمام خانواده‌ها Light و Dark دارند و سطوح Neutral بدون border تزئینی‌اند.',
    'Semantics: Dialog نقش dialog و Confirmation مخرب نقش alertdialog دارد؛ عنوان و توضیح نام‌گذاری می‌شوند.',
    'Local-only: عملیات فایل و نسخه‌ها فقط روی دادهٔ محلی انجام می‌شوند و باعث جابه‌جایی سند نمی‌شوند.'
  ];
  for (let i = 0; i < checks.length; i += 1) qa.appendChild(await makeText(`Rule ${i + 1}`, `${i + 1}. ${checks[i]}`, STYLES.body, VARS.textSecondary, { width: 1120, size: 14 }));
  usage.appendChild(qa);
  slot.appendChild(usage);
  slot.resize(slot.width, usage.height + 48);
  return { stage: 'usage', status: 'created', frameId: usage.id, childIds: usage.children.map((node) => node.id), count: usage.children.length };
}

async function auditAndExport() {
  const dialogSet = await findLocalSet(IDS.dialogSlot, 'Dialog');
  const sheetSet = await findLocalSet(IDS.sheetSlot, 'Sheet');
  const confirmationSet = await findLocalSet(IDS.confirmationSlot, 'Confirmation');
  const buttonSet = await nodeById(IDS.buttonSet);
  const usageSlot = await nodeById(IDS.usageSlot);
  const semanticRepair = await repairConfirmationContent(confirmationSet, usageSlot);
  const documentationBounds = {
    dialog: await fitDocumentationSection(IDS.dialogSection, IDS.dialogSlot),
    sheet: await fitDocumentationSection(IDS.sheetSection, IDS.sheetSlot),
    confirmation: await fitDocumentationSection(IDS.confirmationSection, IDS.confirmationSlot),
    usage: await fitDocumentationSection(IDS.usageSection, IDS.usageSlot)
  };
  const dangerButtons = buttonSet.children.filter((node) => node.type === 'COMPONENT' && parseVariant(node.name).Tone === 'Danger');
  const checks = {
    dialogVariants: dialogSet.children.filter((node) => node.type === 'COMPONENT').length,
    sheetVariants: sheetSet.children.filter((node) => node.type === 'COMPONENT').length,
    confirmationVariants: confirmationSet.children.filter((node) => node.type === 'COMPONENT').length,
    dangerButtonVariants: dangerButtons.length,
    sideSheetsPhysicalRight: sheetSet.children.filter((node) => node.type === 'COMPONENT' && parseVariant(node.name).Placement === 'Side').every((node) => node.topRightRadius === 0 && node.bottomRightRadius === 0 && node.topLeftRadius > 0),
    neutralSurfaceBorderless: [...dialogSet.children, ...sheetSet.children, ...confirmationSet.children].filter((node) => node.type === 'COMPONENT').every((node) => !node.strokes || node.strokes.length === 0),
    usageExists: Boolean(usageSlot.findOne((node) => node.name === 'Usage examples')),
    documentationBoundsComplete: Object.values(documentationBounds).every((item) => item.after >= item.requiredHeight),
    confirmationButtonContentRepaired: semanticRepair.repairedButtons === 24,
    usageDangerSemanticsApplied: semanticRepair.usageSemanticsApplied
  };
  checks.pass = checks.dialogVariants === 8 && checks.sheetVariants === 8 && checks.confirmationVariants === 12
    && checks.dangerButtonVariants === 10 && checks.sideSheetsPhysicalRight && checks.neutralSurfaceBorderless
    && checks.usageExists && checks.documentationBoundsComplete
    && checks.confirmationButtonContentRepaired && checks.usageDangerSemanticsApplied;

  const exports = [
    ['raavi-dialogs-p3.png', await nodeById(IDS.dialogSection)],
    ['raavi-sheets-p3.png', await nodeById(IDS.sheetSection)],
    ['raavi-confirmations-p3.png', await nodeById(IDS.confirmationSection)],
    ['raavi-dialog-sheet-usage-p3.png', await nodeById(IDS.usageSection)]
  ];
  for (const [filename, node] of exports) {
    const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: 1600 } });
    figma.ui.postMessage({ type: 'export', filename, bytes: Array.from(bytes) });
  }
  figma.currentPage.selection = [dialogSet, sheetSet, confirmationSet];
  figma.viewport.scrollAndZoomIntoView([dialogSet, sheetSet, confirmationSet]);
  return {
    stage: 'audit',
    status: checks.pass ? 'passed' : 'failed',
    checks,
    semanticRepair,
    documentationBounds,
    setIds: { dialog: dialogSet.id, sheet: sheetSet.id, confirmation: confirmationSet.id },
    exportNames: exports.map(([name]) => name)
  };
}

async function runStage(stage) {
  const page = await nodeById(IDS.page);
  if (page.type !== 'PAGE') throw new Error('Target component page is missing.');
  await figma.setCurrentPageAsync(page);
  if (stage === 'danger-buttons') return buildDangerButtons();
  if (stage === 'dialogs') return buildDialogs();
  if (stage === 'sheets') return buildSheets();
  if (stage === 'confirmations') return buildConfirmations();
  if (stage === 'usage') return buildUsage();
  if (stage === 'audit') return auditAndExport();
  if (stage === 'all') {
    const results = [];
    results.push(await buildDangerButtons());
    results.push(await buildDialogs());
    results.push(await buildSheets());
    results.push(await buildConfirmations());
    results.push(await buildUsage());
    results.push(await auditAndExport());
    return { stage: 'all', status: 'complete', results };
  }
  throw new Error(`Unknown stage: ${stage}`);
}

figma.ui.onmessage = async (message) => {
  if (message.type === 'close') {
    figma.closePlugin();
    return;
  }
  if (message.type !== 'run') return;
  try {
    const result = await runStage(message.stage);
    figma.ui.postMessage({ type: 'result', stage: message.stage, result });
    figma.notify(`${message.stage}: completed`, { timeout: 1800 });
  } catch (error) {
    const payload = {
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : null
    };
    figma.ui.postMessage({ type: 'error', stage: message.stage, error: payload });
    figma.notify(`${message.stage}: ${payload.message}`, { error: true, timeout: 5000 });
  }
};
