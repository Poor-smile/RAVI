figma.showUI(__html__, { width: 440, height: 690, themeColors: true });

const PAGE_NAME = '35 Components / Split View';
const ROOT_NAME = 'Split View / Documentation';

const IDS = {
  iconButtonSet: '25:22',
  icons: {
    reading: '18:34',
    writing: '18:39',
    search: '18:29',
    split: '306:3',
    panelCollapse: '215:2',
    link: '20:29',
    bold: '20:39',
    italic: '20:34',
    more: '194:32'
  }
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
  editor: 'VariableID:5:14',
  accent: 'VariableID:5:19',
  accentHover: 'VariableID:5:20',
  accentSubtle: 'VariableID:5:21',
  accentOn: 'VariableID:5:22',
  border: 'VariableID:5:23',
  borderStrong: 'VariableID:5:24',
  focus: 'VariableID:5:25',
  radiusControl: 'VariableID:6:8',
  radiusAction: 'VariableID:6:10',
  radiusSurface: 'VariableID:433:2',
  radiusPill: 'VariableID:6:11',
  targetDesktop: 'VariableID:6:12',
  iconMd: 'VariableID:6:15',
  hairline: 'VariableID:6:17'
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

const loadedFonts = new Set();
const nodeCache = new Map();
const variableCache = new Map();
const styleCache = new Map();

function assertNode(node, id) {
  if (!node) throw new Error('Figma node not found: ' + id);
  return node;
}

async function nodeById(id) {
  if (!nodeCache.has(id)) {
    nodeCache.set(id, assertNode(await figma.getNodeByIdAsync(id), id));
  }
  return nodeCache.get(id);
}

async function variableById(id) {
  if (!variableCache.has(id)) {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (!variable) throw new Error('Variable not found: ' + id);
    variableCache.set(id, variable);
  }
  return variableCache.get(id);
}

async function styleById(id) {
  if (!styleCache.has(id)) {
    styleCache.set(id, await figma.getStyleByIdAsync(id));
  }
  return styleCache.get(id);
}

async function loadFont(fontName) {
  const key = fontName.family + '/' + fontName.style;
  if (loadedFonts.has(key)) return;
  await figma.loadFontAsync(fontName);
  loadedFonts.add(key);
}

async function prepareFonts() {
  await Promise.all([
    loadFont(FONT_REGULAR),
    loadFont(FONT_MEDIUM),
    loadFont(FONT_BOLD)
  ]);
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
  if (typeof node.setBoundVariable === 'function') {
    try { node.setBoundVariable(property, variable); } catch (_) {}
  }
}

async function setTextStyle(text, styleId, fallbackFont, fallbackSize) {
  const style = await styleById(styleId);
  if (style && style.type === 'TEXT' && style.fontName !== figma.mixed) {
    await loadFont(style.fontName);
    text.fontName = style.fontName;
    if (typeof text.setTextStyleIdAsync === 'function') {
      await text.setTextStyleIdAsync(style.id);
    } else {
      text.textStyleId = style.id;
    }
    return;
  }
  await loadFont(fallbackFont);
  text.fontName = fallbackFont;
  text.fontSize = fallbackSize;
}

async function setTheme(node, theme) {
  const variable = await variableById(VARS.textPrimary);
  const collection = await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  );
  if (!collection || typeof node.setExplicitVariableModeForCollection !== 'function') return;
  const needle = String(theme).toLowerCase();
  const mode = collection.modes.find(function (candidate) {
    return candidate.name.toLowerCase() === needle;
  }) || collection.modes.find(function (candidate) {
    return candidate.name.toLowerCase().indexOf(needle) > -1;
  });
  if (mode) node.setExplicitVariableModeForCollection(collection, mode.modeId);
}

async function makeText(name, characters, styleId, colorId, options) {
  const settings = options || {};
  const text = figma.createText();
  text.name = name;
  await setTextStyle(
    text,
    styleId,
    settings.font || FONT_REGULAR,
    settings.size || 14
  );
  text.characters = characters;
  text.textAlignHorizontal = settings.align || 'RIGHT';
  text.textAlignVertical = settings.verticalAlign || 'CENTER';
  try { text.paragraphDirection = 'RIGHT_TO_LEFT'; } catch (_) {}
  if (settings.width) {
    text.resize(settings.width, Math.max(20, settings.height || 24));
    text.textAutoResize = settings.fixedHeight ? 'NONE' : 'HEIGHT';
  } else {
    text.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
  if (settings.lineHeight) {
    text.lineHeight = { unit: 'PIXELS', value: settings.lineHeight };
  }
  if (typeof settings.opacity === 'number') text.opacity = settings.opacity;
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
  // Documentation and layout wrappers must never silently crop their children.
  // Components that intentionally mask content opt back into clipping locally.
  frame.clipsContent = false;
  return frame;
}

function fixedFrame(name, width, height, direction) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = direction || 'NONE';
  frame.resize(width, height);
  frame.fills = [];
  frame.strokes = [];
  if (frame.layoutMode !== 'NONE') {
    frame.primaryAxisSizingMode = 'FIXED';
    frame.counterAxisSizingMode = 'FIXED';
  }
  return frame;
}

function componentFrame(name, width, height, direction) {
  const component = figma.createComponent();
  component.name = name;
  component.layoutMode = direction || 'NONE';
  component.resize(width, height);
  component.fills = [];
  component.strokes = [];
  component.clipsContent = false;
  if (component.layoutMode !== 'NONE') {
    component.primaryAxisSizingMode = 'FIXED';
    component.counterAxisSizingMode = 'FIXED';
  }
  return component;
}

function fitVerticalFrame(frame) {
  if (!frame || frame.layoutMode !== 'VERTICAL') return frame;
  const children = frame.children.filter(function (child) { return child.visible !== false; });
  const contentHeight = children.reduce(function (sum, child) {
    return sum + child.height;
  }, 0);
  const gaps = Math.max(0, children.length - 1) * frame.itemSpacing;
  const requiredHeight = Math.ceil(
    frame.paddingTop + contentHeight + gaps + frame.paddingBottom
  );
  frame.primaryAxisSizingMode = 'FIXED';
  frame.resizeWithoutConstraints(frame.width, Math.max(1, requiredHeight));
  return frame;
}

function fitSingleRowFrame(frame) {
  if (!frame || frame.layoutMode !== 'HORIZONTAL') return frame;
  const children = frame.children.filter(function (child) { return child.visible !== false; });
  const tallest = children.reduce(function (height, child) {
    return Math.max(height, child.height);
  }, 0);
  frame.counterAxisSizingMode = 'FIXED';
  frame.resizeWithoutConstraints(
    frame.width,
    Math.ceil(frame.paddingTop + tallest + frame.paddingBottom)
  );
  return frame;
}

function spacer(name) {
  const frame = figma.createFrame();
  frame.name = name || 'Spacer';
  frame.resize(1, 1);
  frame.fills = [];
  frame.strokes = [];
  frame.layoutGrow = 1;
  return frame;
}

function parseVariant(name) {
  const result = {};
  String(name).split(',').forEach(function (part) {
    const index = part.indexOf('=');
    if (index > -1) {
      result[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    }
  });
  return result;
}

function matchesVariant(node, desired) {
  const props = parseVariant(node.name);
  return Object.keys(desired).every(function (key) {
    return String(props[key]).toLowerCase() === String(desired[key]).toLowerCase();
  });
}

async function variantComponent(setId, desired) {
  const set = await nodeById(setId);
  if (set.type !== 'COMPONENT_SET') {
    throw new Error('Expected component set: ' + setId);
  }
  return set.children.find(function (child) {
    return child.type === 'COMPONENT' && matchesVariant(child, desired);
  }) || set.defaultVariant;
}

function propertyKey(instance, label) {
  return Object.keys(instance.componentProperties || {}).find(function (key) {
    return key === label || key.indexOf(label + '#') === 0;
  });
}

async function makeCanonicalIcon(iconId, name, rotation) {
  const component = await nodeById(iconId);
  if (component.type !== 'COMPONENT') {
    throw new Error('Expected icon component: ' + iconId);
  }
  const instance = component.createInstance();
  instance.name = name || component.name;
  if (typeof rotation === 'number' && Math.abs(rotation % 360) === 180) {
    // Mirror inside a stable wrapper. A raw 180° rotation changes the node's
    // auto-layout bounds and clips the opposite-direction panel glyph.
    const wrapper = fixedFrame(name || component.name, instance.width, instance.height, 'NONE');
    wrapper.clipsContent = false;
    instance.name = 'Material Symbol';
    wrapper.appendChild(instance);
    instance.relativeTransform = [
      [-1, 0, instance.width],
      [0, 1, 0]
    ];
    return wrapper;
  }
  return instance;
}

async function makeIconButton(iconId, name, state, rotation) {
  if (typeof rotation === 'number' && Math.abs(rotation % 360) === 180) {
    const directional = fixedFrame(name, 36, 36, 'NONE');
    await bindNumber(directional, 'cornerRadius', VARS.radiusAction, 10);
    if (state === 'Hover') await bindPaint(directional, 'fills', VARS.subtle);
    directional.strokes = [];
    const mirroredIcon = await makeCanonicalIcon(iconId, 'Icon', 180);
    mirroredIcon.x = (36 - mirroredIcon.width) / 2;
    mirroredIcon.y = (36 - mirroredIcon.height) / 2;
    directional.appendChild(mirroredIcon);
    return directional;
  }
  try {
    const variant = await variantComponent(IDS.iconButtonSet, {
      Size: 'Desktop',
      Tone: 'Neutral',
      State: state || 'Default'
    });
    const instance = variant.createInstance();
    instance.name = name;
    const iconComponent = await nodeById(iconId);
    const iconKey = propertyKey(instance, 'Icon');
    let nestedIcon = null;
    if (iconKey && iconComponent.type === 'COMPONENT') {
      instance.setProperties({ [iconKey]: iconComponent.key });
      nestedIcon = instance.findOne(function (node) {
        return node.type === 'INSTANCE';
      });
    } else {
      nestedIcon = instance.findOne(function (node) {
        return node.type === 'INSTANCE';
      });
      if (nestedIcon && iconComponent.type === 'COMPONENT') {
        nestedIcon.swapComponent(iconComponent);
      }
    }
    return instance;
  } catch (_) {
    const control = fixedFrame(name, 36, 36, 'NONE');
    await bindNumber(control, 'cornerRadius', VARS.radiusAction, 10);
    control.strokes = [];
    const icon = await makeCanonicalIcon(iconId, 'Icon', rotation || 0);
    icon.x = (36 - icon.width) / 2;
    icon.y = (36 - icon.height) / 2;
    control.appendChild(icon);
    return control;
  }
}

async function makePill(label, tone) {
  const pill = autoFrame('Spec / ' + label, 'HORIZONTAL', 6, 0);
  pill.paddingTop = 6;
  pill.paddingBottom = 6;
  pill.paddingLeft = 10;
  pill.paddingRight = 10;
  pill.primaryAxisAlignItems = 'CENTER';
  pill.counterAxisAlignItems = 'CENTER';
  await bindNumber(pill, 'cornerRadius', VARS.radiusPill, 999);
  await bindPaint(
    pill,
    'fills',
    tone === 'accent' ? VARS.accentSubtle : VARS.subtle
  );
  pill.strokes = [];
  pill.appendChild(await makeText(
    'Label',
    label,
    STYLES.caption,
    tone === 'accent' ? VARS.accentHover : VARS.textSecondary,
    { size: 12 }
  ));
  return pill;
}

async function makeSection(name, title, description) {
  const section = autoFrame(name, 'VERTICAL', 20, 32);
  section.counterAxisSizingMode = 'FIXED';
  section.resize(1552, 100);
  section.layoutAlign = 'STRETCH';
  await bindPaint(section, 'fills', VARS.surface);
  await bindNumber(section, 'cornerRadius', VARS.radiusSurface, 14);
  section.strokes = [];

  const copy = autoFrame(name + ' / Copy', 'VERTICAL', 8, 0);
  copy.layoutAlign = 'STRETCH';
  const heading = await makeText(
    'Heading',
    title,
    STYLES.h2,
    VARS.textStrong,
    { width: 1488, size: 28, lineHeight: 42 }
  );
  copy.appendChild(heading);
  const body = await makeText(
    'Description',
    description,
    STYLES.body,
    VARS.textSecondary,
    { width: 1220, size: 16, lineHeight: 30 }
  );
  copy.appendChild(body);
  section.appendChild(copy);
  return section;
}

async function makeIntro() {
  const intro = autoFrame('Split View / Intro', 'VERTICAL', 18, 40);
  intro.counterAxisSizingMode = 'FIXED';
  intro.resize(1552, 100);
  intro.layoutAlign = 'STRETCH';
  await bindPaint(intro, 'fills', VARS.surface);
  await bindNumber(intro, 'cornerRadius', VARS.radiusSurface, 14);
  intro.strokes = [];

  const kicker = await makeText(
    'Kicker',
    'اجزای میز دوبرگی',
    STYLES.label,
    VARS.accentHover,
    { size: 14 }
  );
  intro.appendChild(kicker);
  intro.appendChild(await makeText(
    'Title',
    'Pane Header، Divider و Registration Spine',
    STYLES.h1,
    VARS.textStrong,
    { width: 1468, size: 40, lineHeight: 58 }
  ));
  intro.appendChild(await makeText(
    'Summary',
    'سه مسئولیت مستقل: هویت و عمل‌های هر برگ، تغییر نسبت دو برگ، و ثبت پیوند معنایی و اسکرول میان دو نمایش یک سند. ظاهر فقط از Foundation راوی می‌آید و سطوح خنثی border تزئینی ندارند.',
    STYLES.body,
    VARS.textSecondary,
    { width: 1300, size: 17, lineHeight: 32 }
  ));

  const pills = autoFrame('Foundation Contract', 'HORIZONTAL', 8, 0);
  pills.layoutWrap = 'WRAP';
  pills.appendChild(await makePill('Vazirmatn', 'neutral'));
  pills.appendChild(await makePill('Material Symbols Rounded', 'neutral'));
  pills.appendChild(await makePill('Light / Dark', 'neutral'));
  pills.appendChild(await makePill('radius/surface = 14', 'neutral'));
  pills.appendChild(await makePill('Neutral = بدون border', 'accent'));
  pills.appendChild(await makePill('Windows physical right', 'neutral'));
  intro.appendChild(pills);
  return intro;
}

async function ensurePage() {
  let page = figma.root.children.find(function (candidate) {
    return candidate.type === 'PAGE' && candidate.name === PAGE_NAME;
  });
  if (!page) {
    page = figma.createPage();
    page.name = PAGE_NAME;
    const anchor = figma.root.children.findIndex(function (candidate) {
      return candidate.type === 'PAGE' && candidate.name === '34 Components / Dialog & Sheet';
    });
    if (anchor > -1) figma.root.insertChild(anchor + 1, page);
  }
  await figma.setCurrentPageAsync(page);
  return page;
}

async function clearOwnedRoot(page) {
  const existing = page.children.filter(function (node) {
    return node.name === ROOT_NAME;
  });
  existing.forEach(function (node) { node.remove(); });
}

async function makeRoot(page) {
  const root = autoFrame(ROOT_NAME, 'VERTICAL', 32, 64);
  root.counterAxisSizingMode = 'FIXED';
  root.resize(1680, 100);
  root.x = 0;
  root.y = 0;
  await bindPaint(root, 'fills', VARS.canvas);
  root.strokes = [];
  page.appendChild(root);
  root.appendChild(await makeIntro());
  return root;
}

async function paneHeaderVariant(theme, pane, state) {
  const component = componentFrame(
    'Theme=' + theme + ', Pane=' + pane + ', State=' + state,
    560,
    56,
    'NONE'
  );
  await setTheme(component, theme);

  const container = fixedFrame('Container', 560, 56, 'HORIZONTAL');
  container.x = 0;
  container.y = 0;
  container.itemSpacing = 8;
  container.paddingTop = 10;
  container.paddingBottom = 10;
  container.paddingLeft = 12;
  container.paddingRight = 12;
  container.primaryAxisAlignItems = 'MIN';
  container.counterAxisAlignItems = 'CENTER';
  container.topLeftRadius = 14;
  container.topRightRadius = 14;
  container.bottomLeftRadius = 0;
  container.bottomRightRadius = 0;
  container.clipsContent = true;
  await bindPaint(container, 'fills', VARS.surface);
  container.strokes = [];
  component.appendChild(container);

  const paneIsEditor = pane === 'Editor';
  const collapseRotation = paneIsEditor ? 0 : 180;
  container.appendChild(await makeIconButton(
    IDS.icons.panelCollapse,
    'Collapse Pane',
    state === 'Active' ? 'Hover' : 'Default',
    collapseRotation
  ));
  container.appendChild(spacer('Flexible Space'));

  const titleCluster = autoFrame('Title Cluster', 'HORIZONTAL', 8, 0);
  titleCluster.counterAxisAlignItems = 'CENTER';
  titleCluster.primaryAxisAlignItems = 'MAX';

  const folio = autoFrame('Folio', 'HORIZONTAL', 0, 0);
  folio.paddingTop = 5;
  folio.paddingBottom = 5;
  folio.paddingLeft = 8;
  folio.paddingRight = 8;
  folio.counterAxisAlignItems = 'CENTER';
  folio.primaryAxisAlignItems = 'CENTER';
  await bindNumber(folio, 'cornerRadius', VARS.radiusPill, 999);
  await bindPaint(folio, 'fills', state === 'Active' ? VARS.accentSubtle : VARS.subtle);
  folio.strokes = [];
  const folioText = await makeText(
    'Folio Label',
    paneIsEditor ? 'برگ ۱' : 'برگ ۲',
    STYLES.caption,
    state === 'Active' ? VARS.accentHover : VARS.textSecondary,
    { size: 12 }
  );
  folio.appendChild(folioText);
  titleCluster.appendChild(folio);

  const titleText = await makeText(
    'Title',
    paneIsEditor ? 'ویرایش' : 'پیش‌نمایش',
    STYLES.label,
    VARS.textStrong,
    { size: 14, font: FONT_BOLD }
  );
  titleCluster.appendChild(titleText);

  const iconWell = fixedFrame('Pane Icon Well', 36, 36, 'NONE');
  await bindNumber(iconWell, 'cornerRadius', VARS.radiusAction, 10);
  await bindPaint(iconWell, 'fills', state === 'Active' ? VARS.accentSubtle : VARS.subtle);
  iconWell.strokes = [];
  const paneIcon = await makeCanonicalIcon(
    paneIsEditor ? IDS.icons.writing : IDS.icons.reading,
    'Pane Icon',
    0
  );
  paneIcon.x = (36 - paneIcon.width) / 2;
  paneIcon.y = (36 - paneIcon.height) / 2;
  iconWell.appendChild(paneIcon);
  titleCluster.appendChild(iconWell);

  container.appendChild(titleCluster);

  if (state === 'Active') {
    const activeMark = fixedFrame('Active Mark', 520, 3, 'NONE');
    activeMark.x = 20;
    activeMark.y = 53;
    activeMark.cornerRadius = 1.5;
    await bindPaint(activeMark, 'fills', VARS.accent);
    activeMark.strokes = [];
    component.appendChild(activeMark);
  }

  return component;
}

async function makeComponentSet(components, parent, name, width, padding, gap, columns) {
  components.forEach(function (component) { parent.appendChild(component); });
  const set = figma.combineAsVariants(components, parent);
  set.name = name;
  // A deterministic grid avoids Figma's component-set minimum-height behaviour,
  // which can leave valid variants outside an apparently hugging set.
  set.layoutMode = 'NONE';
  const countPerRow = Math.max(1, Math.min(columns || components.length, components.length));
  const componentWidth = Math.max.apply(null, components.map(function (item) { return item.width; }));
  const componentHeight = Math.max.apply(null, components.map(function (item) { return item.height; }));
  const rows = Math.ceil(components.length / countPerRow);
  const requiredWidth = Math.max(
    width,
    padding * 2 + countPerRow * componentWidth + Math.max(0, countPerRow - 1) * gap
  );
  const requiredHeight = padding * 2 + rows * componentHeight + Math.max(0, rows - 1) * gap;
  set.resizeWithoutConstraints(requiredWidth, requiredHeight);
  components.forEach(function (component, index) {
    const row = Math.floor(index / countPerRow);
    const column = index % countPerRow;
    component.x = padding + column * (componentWidth + gap);
    component.y = padding + row * (componentHeight + gap);
  });
  set.clipsContent = false;
  await bindPaint(set, 'fills', VARS.subtle);
  await bindNumber(set, 'cornerRadius', VARS.radiusSurface, 14);
  set.strokes = [];
  return set;
}

async function buildPaneHeaders(root) {
  const section = await makeSection(
    'Pane Header / Section',
    'Pane Header',
    'هدر هر برگ فقط در یک ردیف، با عنوان محلی، شمارهٔ برگ و کنترل جمع‌کردن همان برگ. Active محل کار فعلی را با خط ثبت و سطح آبی کم‌رنگ نشان می‌دهد؛ Default کاملاً borderless است.'
  );
  root.appendChild(section);

  const specs = autoFrame('Pane Header / Specs', 'HORIZONTAL', 8, 0);
  specs.layoutWrap = 'WRAP';
  specs.appendChild(await makePill('۵۶px ارتفاع', 'neutral'));
  specs.appendChild(await makePill('۵۶۰px نمونه', 'neutral'));
  specs.appendChild(await makePill('یک ردیف', 'accent'));
  specs.appendChild(await makePill('Title + Folio', 'neutral'));
  specs.appendChild(await makePill('Collapse ≠ Close', 'neutral'));
  section.appendChild(specs);

  const variants = [];
  const themes = ['Light', 'Dark'];
  const panes = ['Editor', 'Preview'];
  const states = ['Default', 'Active'];
  for (const theme of themes) {
    for (const pane of panes) {
      for (const state of states) {
        variants.push(await paneHeaderVariant(theme, pane, state));
      }
    }
  }

  const set = await makeComponentSet(
    variants,
    section,
    'Pane Header',
    1200,
    24,
    24,
    2
  );
  set.description = 'Header for each pane in Raavi split editing. Physical left action collapses the pane; title, folio and pane identity remain on one line. Default neutral surfaces have no decorative border.';

  const titleKey = set.addComponentProperty('Title', 'TEXT', 'ویرایش');
  const folioKey = set.addComponentProperty('Folio', 'TEXT', 'برگ ۱');
  const showFolioKey = set.addComponentProperty('Show Folio', 'BOOLEAN', true);
  set.children.forEach(function (variant) {
    const title = variant.findOne(function (node) { return node.name === 'Title'; });
    const folio = variant.findOne(function (node) { return node.name === 'Folio'; });
    const folioLabel = variant.findOne(function (node) { return node.name === 'Folio Label'; });
    if (title) title.componentPropertyReferences = { characters: titleKey };
    if (folio) folio.componentPropertyReferences = { visible: showFolioKey };
    if (folioLabel) folioLabel.componentPropertyReferences = { characters: folioKey };
  });

  fitVerticalFrame(section);
  return {
    section: section,
    set: set,
    variants: variants,
    properties: {
      title: titleKey,
      folio: folioKey,
      showFolio: showFolioKey
    }
  };
}

async function dividerVariant(theme, state) {
  const component = componentFrame(
    'Theme=' + theme + ', State=' + state,
    16,
    240,
    'NONE'
  );
  await setTheme(component, theme);
  component.clipsContent = false;

  const hitArea = fixedFrame('Hit Area', 16, 240, 'NONE');
  hitArea.x = 0;
  hitArea.y = 0;
  hitArea.fills = [];
  hitArea.strokes = [];
  component.appendChild(hitArea);

  if (state === 'Dragging') {
    const dragField = fixedFrame('Dragging Field', 12, 232, 'NONE');
    dragField.x = 2;
    dragField.y = 4;
    dragField.cornerRadius = 6;
    await bindPaint(dragField, 'fills', VARS.accentSubtle, 0.72);
    dragField.strokes = [];
    component.appendChild(dragField);
  }

  if (state === 'Focus') {
    const focusRing = fixedFrame('Focus Ring', 12, 236, 'NONE');
    focusRing.x = 2;
    focusRing.y = 2;
    focusRing.cornerRadius = 6;
    focusRing.fills = [];
    focusRing.strokeWeight = 2;
    focusRing.strokeAlign = 'INSIDE';
    await bindPaint(focusRing, 'strokes', VARS.focus);
    component.appendChild(focusRing);
  }

  const lineWidth = state === 'Default' ? 1 : 2;
  const line = fixedFrame('Visible Rule', lineWidth, 232, 'NONE');
  line.x = (16 - lineWidth) / 2;
  line.y = 4;
  line.constraints = { horizontal: 'CENTER', vertical: 'STRETCH' };
  line.cornerRadius = lineWidth / 2;
  await bindPaint(
    line,
    'fills',
    state === 'Default' ? VARS.border : (state === 'Hover' ? VARS.accentHover : VARS.accent)
  );
  line.strokes = [];
  component.appendChild(line);

  return component;
}

async function makeDividerGallery(set, section) {
  const gallery = autoFrame('Divider / State Gallery', 'HORIZONTAL', 20, 20);
  gallery.layoutWrap = 'WRAP';
  gallery.counterAxisSizingMode = 'FIXED';
  gallery.resize(1160, 100);
  await bindPaint(gallery, 'fills', VARS.canvas);
  await bindNumber(gallery, 'cornerRadius', VARS.radiusSurface, 14);
  gallery.strokes = [];

  const stateLabels = {
    Default: 'پیش‌فرض',
    Hover: 'هاور',
    Dragging: 'درگ',
    Focus: 'فوکوس'
  };

  for (const theme of ['Light', 'Dark']) {
    for (const state of ['Default', 'Hover', 'Dragging', 'Focus']) {
      const column = autoFrame(theme + ' / ' + state, 'VERTICAL', 10, 0);
      column.counterAxisAlignItems = 'CENTER';
      column.appendChild(await makeText(
        'State Label',
        (theme === 'Light' ? 'روشن' : 'تاریک') + ' · ' + stateLabels[state],
        STYLES.caption,
        VARS.textSecondary,
        { size: 12 }
      ));
      const well = fixedFrame('Divider Well', 96, 272, 'NONE');
      await setTheme(well, theme);
      await bindPaint(well, 'fills', VARS.surface);
      await bindNumber(well, 'cornerRadius', VARS.radiusSurface, 14);
      well.strokes = [];
      const component = set.children.find(function (child) {
        return matchesVariant(child, { Theme: theme, State: state });
      });
      const instance = component.createInstance();
      instance.x = 40;
      instance.y = 16;
      well.appendChild(instance);
      column.appendChild(well);
      gallery.appendChild(column);
    }
  }
  fitSingleRowFrame(gallery);
  section.appendChild(gallery);
  return gallery;
}

async function buildDividers(root) {
  const section = await makeSection(
    'Divider / Section',
    'Divider',
    'یک hit-area شانزده‌پیکسلی با خط دیداری ۱ تا ۲ پیکسل. خط، نسبت دو برگ را تغییر می‌دهد؛ آبی فقط در hover، focus و dragging ظاهر می‌شود و سطح Default هیچ border یا پس‌زمینهٔ تزئینی ندارد.'
  );
  root.appendChild(section);

  const specs = autoFrame('Divider / Specs', 'HORIZONTAL', 8, 0);
  specs.layoutWrap = 'WRAP';
  specs.appendChild(await makePill('Hit area = 16px', 'neutral'));
  specs.appendChild(await makePill('Rule = 1px', 'neutral'));
  specs.appendChild(await makePill('Arrow = 5%', 'neutral'));
  specs.appendChild(await makePill('Enter = 50/50', 'accent'));
  specs.appendChild(await makePill('Home / End = جمع‌کردن', 'neutral'));
  section.appendChild(specs);

  const variants = [];
  for (const theme of ['Light', 'Dark']) {
    for (const state of ['Default', 'Hover', 'Dragging', 'Focus']) {
      variants.push(await dividerVariant(theme, state));
    }
  }

  const set = await makeComponentSet(
    variants,
    section,
    'Divider',
    432,
    24,
    28,
    8
  );
  set.description = 'Accessible vertical split-pane separator. The interaction target is 16px while the visible rule remains 1–2px. Arrow keys move by 5%, Enter restores 50/50, and Home/End collapse the corresponding pane.';
  const gallery = await makeDividerGallery(set, section);
  fitVerticalFrame(section);
  return { section: section, set: set, variants: variants, gallery: gallery };
}

function spineLabelFor(status) {
  const labels = {
    Synced: 'اسکرول هماهنگ',
    Free: 'اسکرول آزاد',
    'Reveal Editor': 'نمایش ویرایشگر',
    'Reveal Preview': 'نمایش پیش‌نمایش',
    'Collapse Editor': 'جمع‌شدن ویرایشگر',
    'Collapse Preview': 'جمع‌شدن پیش‌نمایش'
  };
  return labels[status];
}

async function registrationDot(name, theme, active) {
  const dot = figma.createEllipse();
  dot.name = name;
  dot.resize(7, 7);
  dot.fills = [];
  dot.strokeWeight = active ? 2 : 1;
  dot.strokeAlign = 'INSIDE';
  await bindPaint(dot, 'strokes', active ? VARS.accent : VARS.borderStrong);
  return dot;
}

async function registrationSpineVariant(theme, status, dividerSet) {
  const component = componentFrame(
    'Theme=' + theme + ', Status=' + status,
    32,
    360,
    'NONE'
  );
  await setTheme(component, theme);
  await bindPaint(
    component,
    'fills',
    status.indexOf('Collapse') === 0 || status.indexOf('Reveal') === 0
      ? VARS.accentSubtle
      : VARS.subtle
  );
  await bindNumber(component, 'cornerRadius', VARS.radiusSurface, 14);
  component.strokes = [];
  component.clipsContent = true;

  const dividerState = status.indexOf('Collapse') === 0 ? 'Dragging' : 'Default';
  const dividerComponent = dividerSet.children.find(function (child) {
    return matchesVariant(child, { Theme: theme, State: dividerState });
  });
  const dividerInstance = dividerComponent.createInstance();
  dividerInstance.name = 'Divider Instance';
  dividerInstance.resize(16, 360);
  dividerInstance.x = 8;
  dividerInstance.y = 0;
  component.appendChild(dividerInstance);

  const isEmphasized = status !== 'Free';
  const topDot = await registrationDot('Registration Dot / Top', theme, isEmphasized);
  topDot.x = 12.5;
  topDot.y = 14;
  component.appendChild(topDot);
  const bottomDot = await registrationDot('Registration Dot / Bottom', theme, isEmphasized);
  bottomDot.x = 12.5;
  bottomDot.y = 339;
  component.appendChild(bottomDot);

  const control = fixedFrame('Spine Control', 28, 28, 'NONE');
  control.x = 2;
  control.y = 50;
  await bindNumber(control, 'cornerRadius', VARS.radiusAction, 10);
  await bindPaint(control, 'fills', VARS.surface);
  control.strokes = [];

  let iconId = IDS.icons.link;
  let iconRotation = 0;
  if (status.indexOf('Reveal') === 0 || status.indexOf('Collapse') === 0) {
    iconId = IDS.icons.panelCollapse;
    const pointsToEditor = status.indexOf('Editor') > -1;
    iconRotation = pointsToEditor ? 0 : 180;
  }
  const controlIcon = await makeCanonicalIcon(iconId, 'Control Icon', iconRotation);
  controlIcon.x = (28 - controlIcon.width) / 2;
  controlIcon.y = (28 - controlIcon.height) / 2;
  control.appendChild(controlIcon);

  if (status === 'Free') {
    const slash = fixedFrame('Unlinked Mark', 18, 2, 'NONE');
    slash.x = 5;
    slash.y = 13;
    slash.rotation = -45;
    slash.cornerRadius = 1;
    await bindPaint(slash, 'fills', VARS.textSecondary);
    slash.strokes = [];
    control.appendChild(slash);
  }
  component.appendChild(control);

  const label = await makeText(
    'Status Label',
    spineLabelFor(status),
    STYLES.caption,
    status.indexOf('Collapse') === 0 ? VARS.accentHover : VARS.textSecondary,
    {
      width: 220,
      height: 18,
      fixedHeight: true,
      align: 'CENTER',
      size: 11,
      font: status.indexOf('Collapse') === 0 ? FONT_MEDIUM : FONT_REGULAR
    }
  );
  component.appendChild(label);
  // Exact clockwise track: x=7..25 and y=90..310 inside the 32×360 spine.
  label.relativeTransform = [
    [0, 1, 7],
    [-1, 0, 310]
  ];

  return component;
}

async function makeSpineGallery(set, section) {
  const gallery = autoFrame('Registration Spine / Status Gallery', 'VERTICAL', 20, 24);
  gallery.counterAxisSizingMode = 'FIXED';
  gallery.resize(1488, 100);
  await bindPaint(gallery, 'fills', VARS.canvas);
  await bindNumber(gallery, 'cornerRadius', VARS.radiusSurface, 14);
  gallery.strokes = [];

  for (const theme of ['Light', 'Dark']) {
    const themeRow = autoFrame('Theme Row / ' + theme, 'HORIZONTAL', 20, 0);
    themeRow.counterAxisAlignItems = 'MIN';
    themeRow.appendChild(await makeText(
      'Theme Label',
      theme === 'Light' ? 'روشن' : 'تاریک',
      STYLES.label,
      VARS.textStrong,
      { width: 72, size: 14, fixedHeight: true, height: 24 }
    ));
    for (const status of [
      'Synced',
      'Free',
      'Reveal Editor',
      'Reveal Preview',
      'Collapse Editor',
      'Collapse Preview'
    ]) {
      const column = autoFrame(status, 'VERTICAL', 10, 0);
      column.counterAxisAlignItems = 'CENTER';
      const well = fixedFrame('Spine Well', 112, 392, 'NONE');
      await setTheme(well, theme);
      await bindPaint(well, 'fills', VARS.surface);
      await bindNumber(well, 'cornerRadius', VARS.radiusSurface, 14);
      well.strokes = [];
      const component = set.children.find(function (child) {
        return matchesVariant(child, { Theme: theme, Status: status });
      });
      const instance = component.createInstance();
      instance.x = 40;
      instance.y = 16;
      well.appendChild(instance);
      column.appendChild(well);
      column.appendChild(await makeText(
        'Status Caption',
        spineLabelFor(status),
        STYLES.caption,
        VARS.textSecondary,
        { width: 112, size: 11, align: 'CENTER' }
      ));
      themeRow.appendChild(column);
    }
    gallery.appendChild(themeRow);
  }
  fitVerticalFrame(gallery);
  section.appendChild(gallery);
  return gallery;
}

async function buildRegistrationSpines(root, dividerSet) {
  const section = await makeSection(
    'Registration Spine / Section',
    'Registration Spine',
    'ستون ثبت، Divider نیست: به کاربر می‌گوید دو برگ نمایش‌های هم‌زمان یک سندند، وضعیت قفل اسکرول را نشان می‌دهد و در حالت تک‌برگی مسیر بازگردانی برگ دیگر را نگه می‌دارد. Divider به‌صورت instance در زیر آن ترکیب شده است.'
  );
  root.appendChild(section);

  const specs = autoFrame('Registration Spine / Specs', 'HORIZONTAL', 8, 0);
  specs.layoutWrap = 'WRAP';
  specs.appendChild(await makePill('۳۲px عرض', 'neutral'));
  specs.appendChild(await makePill('Divider instance', 'accent'));
  specs.appendChild(await makePill('Sync / Free', 'neutral'));
  specs.appendChild(await makePill('Reveal Editor / Preview', 'neutral'));
  specs.appendChild(await makePill('Collapse Ready', 'neutral'));
  section.appendChild(specs);

  const variants = [];
  for (const theme of ['Light', 'Dark']) {
    for (const status of [
      'Synced',
      'Free',
      'Reveal Editor',
      'Reveal Preview',
      'Collapse Editor',
      'Collapse Preview'
    ]) {
      variants.push(await registrationSpineVariant(theme, status, dividerSet));
    }
  }

  const set = await makeComponentSet(
    variants,
    section,
    'Registration Spine',
    520,
    24,
    28,
    6
  );
  set.description = 'Registration spine for Raavi split editing. It composes the Divider primitive, communicates synchronized versus free scrolling, restores a collapsed pane, and announces collapse-ready drag thresholds without relying on color alone.';
  const labelKey = set.addComponentProperty(
    'Status Label',
    'TEXT',
    'اسکرول هماهنگ'
  );
  set.children.forEach(function (variant) {
    const label = variant.findOne(function (node) {
      return node.name === 'Status Label';
    });
    if (label) label.componentPropertyReferences = { characters: labelKey };
  });

  const gallery = await makeSpineGallery(set, section);
  fitVerticalFrame(section);
  return {
    section: section,
    set: set,
    variants: variants,
    gallery: gallery,
    properties: { label: labelKey }
  };
}

async function makeDocumentLines(theme, kind, width) {
  const body = autoFrame('Pane Body', 'VERTICAL', kind === 'Editor' ? 12 : 18, 28);
  body.counterAxisSizingMode = 'FIXED';
  body.primaryAxisSizingMode = 'FIXED';
  body.resize(width, 326);
  await setTheme(body, theme);
  await bindPaint(body, 'fills', kind === 'Editor' ? VARS.editor : VARS.surface);
  body.strokes = [];

  if (kind === 'Editor') {
    body.appendChild(await makeText(
      'Source Heading',
      '# یک سند، دو نمایش',
      STYLES.h3,
      VARS.textStrong,
      { width: width - 56, size: 20, lineHeight: 32 }
    ));
    body.appendChild(await makeText(
      'Source Copy',
      'متن در همین برگ ویرایش می‌شود و پیش‌نمایش هم‌زمان در برگ روبه‌رو باقی می‌ماند.',
      STYLES.body,
      VARS.textPrimary,
      { width: width - 56, size: 15, lineHeight: 28 }
    ));
    body.appendChild(await makeText(
      'Source List',
      '- نسبت دو برگ محلی ذخیره می‌شود\n- Enter تقسیم را ۵۰/۵۰ می‌کند\n- آستانهٔ ۱۰٪ برگ کوچک‌تر را جمع می‌کند',
      STYLES.body,
      VARS.textSecondary,
      { width: width - 56, size: 14, lineHeight: 27 }
    ));
  } else {
    body.appendChild(await makeText(
      'Preview Heading',
      'یک سند، دو نمایش',
      STYLES.h2,
      VARS.textStrong,
      { width: width - 56, size: 28, lineHeight: 42 }
    ));
    body.appendChild(await makeText(
      'Preview Copy',
      'ویرایشگر و پیش‌نمایش دو منبع جدا نیستند. ستون ثبت میان آن‌ها پیوند معنایی، اسکرول هماهنگ و مسیر بازگردانی برگ جمع‌شده را آشکار نگه می‌دارد.',
      STYLES.body,
      VARS.textPrimary,
      { width: width - 56, size: 16, lineHeight: 31 }
    ));
    const note = autoFrame('Preview Note', 'VERTICAL', 4, 14);
    note.layoutAlign = 'STRETCH';
    await bindPaint(note, 'fills', VARS.accentSubtle);
    await bindNumber(note, 'cornerRadius', VARS.radiusAction, 10);
    note.strokes = [];
    note.appendChild(await makeText(
      'Note Title',
      'قاعدهٔ ثبت',
      STYLES.label,
      VARS.accentHover,
      { size: 13, font: FONT_BOLD }
    ));
    note.appendChild(await makeText(
      'Note Copy',
      'آبی فقط برای عمل، فوکوس و وضعیت فعال استفاده می‌شود.',
      STYLES.caption,
      VARS.textSecondary,
      { width: width - 84, size: 12, lineHeight: 22 }
    ));
    body.appendChild(note);
  }
  return body;
}

async function panePanel(theme, kind, paneHeaderSet, width) {
  const panel = autoFrame(kind + ' Pane', 'VERTICAL', 0, 0);
  panel.counterAxisSizingMode = 'FIXED';
  panel.primaryAxisSizingMode = 'FIXED';
  panel.resize(width, 382);
  panel.clipsContent = true;
  await setTheme(panel, theme);
  await bindPaint(panel, 'fills', VARS.surface);
  await bindNumber(panel, 'cornerRadius', VARS.radiusSurface, 14);
  panel.strokes = [];

  const headerComponent = paneHeaderSet.children.find(function (child) {
    return matchesVariant(child, {
      Theme: theme,
      Pane: kind,
      State: kind === 'Editor' ? 'Active' : 'Default'
    });
  });
  const header = headerComponent.createInstance();
  header.name = kind + ' Pane Header';
  header.resize(width, 56);
  panel.appendChild(header);
  panel.appendChild(await makeDocumentLines(theme, kind, width));
  return panel;
}

async function makeUsageSample(theme, paneHeaderSet, spineSet) {
  const sample = autoFrame('Split View Usage / ' + theme, 'VERTICAL', 14, 24);
  sample.counterAxisSizingMode = 'FIXED';
  sample.resize(1488, 100);
  await setTheme(sample, theme);
  await bindPaint(sample, 'fills', VARS.subtle);
  await bindNumber(sample, 'cornerRadius', VARS.radiusSurface, 14);
  sample.strokes = [];

  sample.appendChild(await makeText(
    'Theme Caption',
    theme === 'Light' ? 'نمونهٔ روشن' : 'نمونهٔ تاریک',
    STYLES.label,
    VARS.textStrong,
    { size: 14, font: FONT_BOLD }
  ));

  const stage = autoFrame('Two Pane Stage', 'HORIZONTAL', 20, 18);
  stage.counterAxisSizingMode = 'FIXED';
  stage.primaryAxisSizingMode = 'FIXED';
  stage.resize(1440, 418);
  stage.counterAxisAlignItems = 'CENTER';
  await bindPaint(stage, 'fills', VARS.canvas);
  await bindNumber(stage, 'cornerRadius', VARS.radiusSurface, 14);
  stage.strokes = [];

  stage.appendChild(await panePanel(theme, 'Preview', paneHeaderSet, 654));
  const spineComponent = spineSet.children.find(function (child) {
    return matchesVariant(child, { Theme: theme, Status: 'Synced' });
  });
  const spine = spineComponent.createInstance();
  spine.name = 'Registration Spine / Synced';
  spine.resize(32, 382);
  stage.appendChild(spine);
  stage.appendChild(await panePanel(theme, 'Editor', paneHeaderSet, 654));
  sample.appendChild(stage);
  fitVerticalFrame(sample);
  return sample;
}

async function makeInteractionRow(keys, action, detail) {
  const row = autoFrame('Interaction / ' + action, 'HORIZONTAL', 16, 0);
  row.layoutAlign = 'STRETCH';
  row.counterAxisAlignItems = 'CENTER';
  row.resize(1440, 1);
  row.primaryAxisSizingMode = 'FIXED';
  row.counterAxisSizingMode = 'AUTO';
  const keyFrame = autoFrame('Keys', 'HORIZONTAL', 6, 0);
  keyFrame.resize(260, 36);
  keyFrame.primaryAxisSizingMode = 'FIXED';
  keyFrame.counterAxisSizingMode = 'FIXED';
  keyFrame.counterAxisAlignItems = 'CENTER';
  keyFrame.appendChild(await makeText(
    'Key Label',
    keys,
    STYLES.caption,
    VARS.accentHover,
    { width: 244, size: 12, align: 'LEFT', fixedHeight: true, height: 24 }
  ));
  row.appendChild(keyFrame);
  const copy = autoFrame('Copy', 'VERTICAL', 3, 0);
  copy.resize(1164, 1);
  copy.counterAxisSizingMode = 'FIXED';
  copy.primaryAxisSizingMode = 'AUTO';
  copy.appendChild(await makeText(
    'Action',
    action,
    STYLES.label,
    VARS.textStrong,
    { width: 1120, size: 14, font: FONT_BOLD }
  ));
  copy.appendChild(await makeText(
    'Detail',
    detail,
    STYLES.caption,
    VARS.textSecondary,
    { width: 1120, size: 12, lineHeight: 22 }
  ));
  row.appendChild(copy);
  fitSingleRowFrame(row);
  return row;
}

async function buildUsage(root, paneHeaderSet, dividerSet, spineSet) {
  const section = await makeSection(
    'Split View / Usage Section',
    'Usage، رفتار و دسترس‌پذیری',
    'چیدمان فیزیکی ثابت است: پیش‌نمایش در چپ، ستون ثبت در میانه و ویرایشگر در راست. جهت متن RTL است، اما جغرافیای پنجره و کنترل‌های ویندوز mirror نمی‌شوند.'
  );
  root.appendChild(section);
  section.appendChild(await makeUsageSample('Light', paneHeaderSet, spineSet));
  section.appendChild(await makeUsageSample('Dark', paneHeaderSet, spineSet));

  const interaction = autoFrame('Interaction Contract', 'VERTICAL', 14, 24);
  interaction.layoutAlign = 'STRETCH';
  await bindPaint(interaction, 'fills', VARS.subtle);
  await bindNumber(interaction, 'cornerRadius', VARS.radiusSurface, 14);
  interaction.strokes = [];
  interaction.appendChild(await makeText(
    'Interaction Heading',
    'قرارداد تغییر نسبت و جمع‌شدن',
    STYLES.h3,
    VARS.textStrong,
    { width: 1400, size: 20, lineHeight: 32 }
  ));
  interaction.appendChild(await makeInteractionRow(
    'Drag / Pointer',
    'تغییر پیوستهٔ نسبت',
    'تمام hit-area تقسیم‌کننده قابل درگ است؛ خط دیداری باریک می‌ماند.'
  ));
  interaction.appendChild(await makeInteractionRow(
    '← / →',
    'گام پنج‌درصدی',
    'aria-valuenow نسبت پیش‌نمایش و aria-valuetext نسبت هر دو برگ را اعلام می‌کند.'
  ));
  interaction.appendChild(await makeInteractionRow(
    'Enter / Double click',
    'بازگشت به ۵۰/۵۰',
    'تقسیم برابر می‌شود و آخرین نسبت معتبر به‌صورت محلی به‌روزرسانی می‌گردد.'
  ));
  interaction.appendChild(await makeInteractionRow(
    'Home / End',
    'جمع‌کردن برگ متناظر',
    'پیش از commit، Registration Spine حالت Collapse Ready را هم با متن و هم با تغییر شکل نشان می‌دهد.'
  ));
  interaction.appendChild(await makeInteractionRow(
    'Tab + Space',
    'قفل یا آزادکردن اسکرول',
    'کنترل مستقل داخل ستون ثبت است و focus ring سه‌پیکسلی واضح دارد.'
  ));
  interaction.appendChild(await makeInteractionRow(
    'Reduced motion',
    'بدون پرش',
    'تغییر حالت تقریباً بی‌درنگ است؛ سند، cursor، selection و semantic anchor remount نمی‌شوند.'
  ));
  section.appendChild(interaction);

  const qa = autoFrame('Split View / QA Contract', 'VERTICAL', 8, 20);
  qa.layoutAlign = 'STRETCH';
  await bindPaint(qa, 'fills', VARS.accentSubtle);
  await bindNumber(qa, 'cornerRadius', VARS.radiusAction, 10);
  qa.strokes = [];
  qa.appendChild(await makeText(
    'QA Title',
    'QA: ساختاری و قابل آزمون',
    STYLES.label,
    VARS.accentHover,
    { size: 14, font: FONT_BOLD }
  ));
  qa.appendChild(await makeText(
    'QA Copy',
    'Pane Header: ۸ variant · Divider: ۸ variant · Registration Spine: ۱۲ variant · همهٔ متن‌ها Vazirmatn · آیکن‌ها Material Symbols · بدون لایهٔ پنهان · بدون border در Neutral · Divider داخل Spine یک Instance واقعی است.',
    STYLES.body,
    VARS.textSecondary,
    { width: 1400, size: 14, lineHeight: 27 }
  ));
  section.appendChild(qa);
  fitVerticalFrame(section);
  return { section: section, interaction: interaction, qa: qa };
}

async function buildAll() {
  nodeCache.clear();
  variableCache.clear();
  styleCache.clear();
  await prepareFonts();
  const page = await ensurePage();
  await clearOwnedRoot(page);
  const root = await makeRoot(page);

  const pane = await buildPaneHeaders(root);
  const divider = await buildDividers(root);
  const spine = await buildRegistrationSpines(root, divider.set);
  const usage = await buildUsage(root, pane.set, divider.set, spine.set);

  // Freeze the final documentation height from its actual children so page
  // export and selection bounds include every documented component.
  fitVerticalFrame(root);

  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);

  return {
    stage: 'build',
    status: 'created',
    pageId: page.id,
    documentationId: root.id,
    sections: {
      paneHeader: pane.section.id,
      divider: divider.section.id,
      registrationSpine: spine.section.id,
      usage: usage.section.id
    },
    components: {
      paneHeader: {
        setId: pane.set.id,
        variantIds: pane.variants.map(function (node) { return node.id; }),
        variantCount: pane.variants.length,
        properties: pane.properties
      },
      divider: {
        setId: divider.set.id,
        variantIds: divider.variants.map(function (node) { return node.id; }),
        variantCount: divider.variants.length,
        galleryId: divider.gallery.id
      },
      registrationSpine: {
        setId: spine.set.id,
        variantIds: spine.variants.map(function (node) { return node.id; }),
        variantCount: spine.variants.length,
        galleryId: spine.gallery.id,
        properties: spine.properties
      }
    },
    usage: {
      sectionId: usage.section.id,
      interactionId: usage.interaction.id,
      qaId: usage.qa.id
    }
  };
}

function walk(node, visitor) {
  visitor(node);
  if ('children' in node) {
    node.children.forEach(function (child) { walk(child, visitor); });
  }
}

function boundVariableCount(node) {
  let count = 0;
  if (node.boundVariables) count += Object.keys(node.boundVariables).length;
  ['fills', 'strokes'].forEach(function (property) {
    const paints = node[property];
    if (Array.isArray(paints)) {
      paints.forEach(function (paint) {
        if (paint && paint.boundVariables) {
          count += Object.keys(paint.boundVariables).length;
        }
      });
    }
  });
  return count;
}

function hiddenLayerNames(node) {
  const hidden = [];
  walk(node, function (candidate) {
    if (candidate !== node && candidate.visible === false) hidden.push(candidate.name);
  });
  return hidden;
}

function fontIssues(node) {
  const issues = [];
  walk(node, function (candidate) {
    if (candidate.type !== 'TEXT') return;
    if (candidate.fontName === figma.mixed) {
      issues.push(candidate.name + ': mixed font');
      return;
    }
    const family = candidate.fontName.family;
    if (family !== 'Vazirmatn' && family !== 'Material Symbols Rounded') {
      issues.push(candidate.name + ': ' + family);
    }
  });
  return issues;
}

function clippedAbsoluteIssues(node) {
  const issues = [];
  walk(node, function (parent) {
    if (!('children' in parent)) return;
    const mustContainChildren = parent.clipsContent ||
      parent.name === ROOT_NAME ||
      parent.type === 'COMPONENT_SET' ||
      parent.name.indexOf(' / Section') > -1 ||
      parent.name.indexOf(' / State Gallery') > -1 ||
      parent.name.indexOf(' / Status Gallery') > -1;
    if (!mustContainChildren) return;
    const parentBounds = parent.absoluteRenderBounds || parent.absoluteBoundingBox;
    if (!parentBounds) return;
    parent.children.forEach(function (child) {
      const childBounds = child.absoluteRenderBounds || child.absoluteBoundingBox;
      if (!childBounds) return;
      if (
        childBounds.x < parentBounds.x - 0.5 ||
        childBounds.y < parentBounds.y - 0.5 ||
        childBounds.x + childBounds.width > parentBounds.x + parentBounds.width + 0.5 ||
        childBounds.y + childBounds.height > parentBounds.y + parentBounds.height + 0.5
      ) {
        issues.push(parent.name + ' clips ' + child.name);
      }
    });
  });
  return issues;
}

function setAxes(set) {
  const axes = {};
  set.children.forEach(function (child) {
    const parsed = parseVariant(child.name);
    Object.keys(parsed).forEach(function (key) {
      if (!axes[key]) axes[key] = [];
      if (axes[key].indexOf(parsed[key]) === -1) axes[key].push(parsed[key]);
    });
  });
  return axes;
}

async function audit() {
  const page = figma.root.children.find(function (candidate) {
    return candidate.type === 'PAGE' && candidate.name === PAGE_NAME;
  });
  if (!page) throw new Error('Split View page has not been built.');
  const root = page.findOne(function (node) { return node.name === ROOT_NAME; });
  if (!root) throw new Error('Split View documentation root is missing.');
  const paneSet = page.findOne(function (node) {
    return node.type === 'COMPONENT_SET' && node.name === 'Pane Header';
  });
  const dividerSet = page.findOne(function (node) {
    return node.type === 'COMPONENT_SET' && node.name === 'Divider';
  });
  const spineSet = page.findOne(function (node) {
    return node.type === 'COMPONENT_SET' && node.name === 'Registration Spine';
  });
  if (!paneSet || !dividerSet || !spineSet) {
    throw new Error('One or more component sets are missing.');
  }

  const issues = [];
  if (paneSet.children.length !== 8) issues.push('Pane Header variant count is not 8.');
  if (dividerSet.children.length !== 8) issues.push('Divider variant count is not 8.');
  if (spineSet.children.length !== 12) issues.push('Registration Spine variant count is not 12.');

  const hidden = hiddenLayerNames(root);
  if (hidden.length) issues.push('Hidden layers: ' + hidden.join(', '));
  const fonts = fontIssues(root);
  if (fonts.length) issues.push('Font issues: ' + fonts.join(', '));
  const clipping = clippedAbsoluteIssues(root);
  if (clipping.length) issues.push('Clipping: ' + clipping.join(', '));

  const defaultPaneVariants = paneSet.children.filter(function (variant) {
    return parseVariant(variant.name).State === 'Default';
  });
  defaultPaneVariants.forEach(function (variant) {
    const container = variant.findOne(function (node) { return node.name === 'Container'; });
    if (!container || (Array.isArray(container.strokes) && container.strokes.length > 0)) {
      issues.push('Pane Header neutral border rule failed: ' + variant.name);
    }
    if (variant.height !== 56) issues.push('Pane Header height failed: ' + variant.name);
    const title = variant.findOne(function (node) { return node.name === 'Title'; });
    if (title && title.height > 28) issues.push('Pane Header title wrapped: ' + variant.name);
  });

  dividerSet.children.filter(function (variant) {
    return parseVariant(variant.name).State === 'Default';
  }).forEach(function (variant) {
    if (Array.isArray(variant.strokes) && variant.strokes.length > 0) {
      issues.push('Divider neutral border rule failed: ' + variant.name);
    }
    if (variant.width !== 16) issues.push('Divider hit area is not 16px: ' + variant.name);
    const line = variant.findOne(function (node) { return node.name === 'Visible Rule'; });
    if (!line || Math.round(line.width) !== 1) {
      issues.push('Divider default rule is not 1px: ' + variant.name);
    }
  });

  let dividerInstanceCount = 0;
  spineSet.children.forEach(function (variant) {
    if (variant.width !== 32) issues.push('Registration Spine width is not 32px: ' + variant.name);
    if (Array.isArray(variant.strokes) && variant.strokes.length > 0) {
      issues.push('Registration Spine neutral border rule failed: ' + variant.name);
    }
    variant.findAll(function (node) {
      return node.type === 'INSTANCE' && node.name === 'Divider Instance';
    }).forEach(function () { dividerInstanceCount += 1; });
  });
  if (dividerInstanceCount !== 12) {
    issues.push('Divider composition count in Registration Spine is not 12.');
  }

  let bindings = 0;
  let iconInstances = 0;
  walk(root, function (node) {
    bindings += boundVariableCount(node);
    if (node.type === 'INSTANCE' && node.name.indexOf('Divider Instance') === -1) {
      iconInstances += 1;
    }
  });
  if (bindings < 250) issues.push('Foundation binding count is unexpectedly low: ' + bindings);
  if (iconInstances < 40) issues.push('Material Symbol instance count is unexpectedly low: ' + iconInstances);

  return {
    stage: 'audit',
    passed: issues.length === 0,
    issues: issues,
    pageId: page.id,
    documentationId: root.id,
    componentSets: {
      paneHeader: {
        id: paneSet.id,
        count: paneSet.children.length,
        axes: setAxes(paneSet)
      },
      divider: {
        id: dividerSet.id,
        count: dividerSet.children.length,
        axes: setAxes(dividerSet)
      },
      registrationSpine: {
        id: spineSet.id,
        count: spineSet.children.length,
        axes: setAxes(spineSet)
      }
    },
    checks: {
      hiddenLayerCount: hidden.length,
      fontIssueCount: fonts.length,
      clippingIssueCount: clipping.length,
      foundationBindingCount: bindings,
      materialSymbolInstanceCount: iconInstances,
      dividerInstanceCount: dividerInstanceCount,
      paneHeaderOneRow: !issues.some(function (item) {
        return item.indexOf('Pane Header title wrapped') > -1;
      }),
      neutralBorderless: !issues.some(function (item) {
        return item.indexOf('neutral border rule failed') > -1;
      })
    }
  };
}

async function exportNode(stage) {
  const page = figma.root.children.find(function (candidate) {
    return candidate.type === 'PAGE' && candidate.name === PAGE_NAME;
  });
  if (!page) throw new Error('Split View page has not been built.');
  const targets = {
    'export-pane': {
      name: 'Pane Header / Section',
      filename: 'raavi-split-view-pane-header.png',
      scale: 1.35
    },
    'export-divider': {
      name: 'Divider / Section',
      filename: 'raavi-split-view-divider.png',
      scale: 1.35
    },
    'export-spine': {
      name: 'Registration Spine / Section',
      filename: 'raavi-split-view-registration-spine.png',
      scale: 1.1
    },
    'export-usage': {
      name: 'Split View / Usage Section',
      filename: 'raavi-split-view-usage.png',
      scale: 1
    },
    'export-page': {
      name: ROOT_NAME,
      filename: 'raavi-split-view-page.png',
      scale: 0.7
    }
  };
  const target = targets[stage];
  if (!target) throw new Error('Unknown export stage: ' + stage);
  const node = page.findOne(function (candidate) {
    return candidate.name === target.name;
  });
  if (!node) throw new Error('Export target not found: ' + target.name);
  const bytes = await node.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: target.scale }
  });
  figma.ui.postMessage({
    type: 'export',
    filename: target.filename,
    bytes: Array.from(bytes)
  });
  return {
    stage: stage,
    status: 'exported',
    nodeId: node.id,
    filename: target.filename,
    width: node.width,
    height: node.height,
    scale: target.scale
  };
}

async function runStage(stage) {
  if (stage === 'build') return buildAll();
  if (stage === 'audit') return audit();
  if (stage.indexOf('export-') === 0) return exportNode(stage);
  throw new Error('Unknown stage: ' + stage);
}

figma.ui.onmessage = async function (message) {
  if (message.type === 'close') {
    figma.closePlugin();
    return;
  }
  if (message.type !== 'run') return;
  const stage = message.stage;
  try {
    const result = await runStage(stage);
    figma.ui.postMessage({ type: 'result', stage: stage, result: result });
    figma.notify(stage === 'audit' && result.passed === false
      ? 'ممیزی کامل شد؛ موارد نیازمند اصلاح وجود دارد.'
      : 'مرحلهٔ ' + stage + ' کامل شد.');
  } catch (error) {
    const payload = {
      name: error && error.name ? error.name : 'Error',
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : ''
    };
    figma.ui.postMessage({ type: 'error', stage: stage, error: payload });
    figma.notify('خطا: ' + payload.message, { error: true });
  }
};
