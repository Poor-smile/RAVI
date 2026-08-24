export type FormulaNodeId = string;

export type FormulaAtomKind = "number" | "identifier" | "symbol" | "text";
export type FormulaMatrixDelimiter =
  | "none"
  | "parentheses"
  | "brackets"
  | "braces"
  | "bars"
  | "double-bars";
export type FormulaLargeOperator =
  | "sum"
  | "product"
  | "limit"
  | "integral"
  | "double-integral"
  | "triple-integral"
  | "contour-integral"
  | "derivative"
  | "partial-derivative";
export type FormulaAccent =
  | "hat"
  | "bar"
  | "vector"
  | "dot"
  | "double-dot"
  | "tilde"
  | "overline"
  | "underline";

type FormulaNodeBase = { id: FormulaNodeId };

export type FormulaSlotNode = FormulaNodeBase & {
  kind: "slot";
  name: string;
  required: boolean;
};

export type FormulaAtomNode = FormulaNodeBase & {
  kind: "atom";
  atomKind: FormulaAtomKind;
  value: string;
  editable: boolean;
};

export type FormulaRowNode = FormulaNodeBase & {
  kind: "row";
  children: FormulaExpressionNode[];
};

export type FormulaFractionNode = FormulaNodeBase & {
  kind: "fraction";
  numerator: FormulaExpressionNode;
  denominator: FormulaExpressionNode;
};

export type FormulaScriptNode = FormulaNodeBase & {
  kind: "script";
  base: FormulaExpressionNode;
  subscript?: FormulaExpressionNode;
  superscript?: FormulaExpressionNode;
};

export type FormulaRadicalNode = FormulaNodeBase & {
  kind: "radical";
  radicand: FormulaExpressionNode;
  index?: FormulaExpressionNode;
};

export type FormulaFenceNode = FormulaNodeBase & {
  kind: "fence";
  open: string;
  body: FormulaExpressionNode;
  close: string;
};

export type FormulaFunctionNode = FormulaNodeBase & {
  kind: "function";
  name: string;
  arguments: FormulaExpressionNode[];
  subscript?: FormulaExpressionNode;
};

export type FormulaLargeOperatorNode = FormulaNodeBase & {
  kind: "large-operator";
  operator: FormulaLargeOperator;
  body: FormulaExpressionNode;
  lower?: FormulaExpressionNode;
  upper?: FormulaExpressionNode;
  variable?: FormulaExpressionNode;
  differential?: FormulaExpressionNode;
  order?: FormulaExpressionNode;
};

export type FormulaMatrixNode = FormulaNodeBase & {
  kind: "matrix";
  rows: number;
  columns: number;
  cells: FormulaExpressionNode[];
  delimiter: FormulaMatrixDelimiter;
};

export type FormulaCasesRow = {
  id: FormulaNodeId;
  value: FormulaExpressionNode;
  condition: FormulaExpressionNode;
};

export type FormulaCasesNode = FormulaNodeBase & {
  kind: "cases";
  rows: FormulaCasesRow[];
};

export type FormulaAccentNode = FormulaNodeBase & {
  kind: "accent";
  accent: FormulaAccent;
  body: FormulaExpressionNode;
};

export type FormulaBinomialNode = FormulaNodeBase & {
  kind: "binomial";
  upper: FormulaExpressionNode;
  lower: FormulaExpressionNode;
};

export type FormulaExpressionNode =
  | FormulaSlotNode
  | FormulaAtomNode
  | FormulaRowNode
  | FormulaFractionNode
  | FormulaScriptNode
  | FormulaRadicalNode
  | FormulaFenceNode
  | FormulaFunctionNode
  | FormulaLargeOperatorNode
  | FormulaMatrixNode
  | FormulaCasesNode
  | FormulaAccentNode
  | FormulaBinomialNode;

export type FormulaNodeFactory = () => FormulaNodeId;

let fallbackNodeSequence = 0;

export function createFormulaNodeId(): FormulaNodeId {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `formula-${globalThis.crypto.randomUUID()}`;
  }
  fallbackNodeSequence += 1;
  return `formula-${Date.now().toString(36)}-${fallbackNodeSequence.toString(36)}`;
}

export function formulaSlot(
  name: string,
  required = true,
  id = createFormulaNodeId(),
): FormulaSlotNode {
  return { id, kind: "slot", name, required };
}

export function formulaAtom(
  value: string,
  atomKind: FormulaAtomKind = "identifier",
  id = createFormulaNodeId(),
  editable = true,
): FormulaAtomNode {
  return { id, kind: "atom", atomKind, value, editable };
}

export function formulaRow(
  children: FormulaExpressionNode[] = [],
  id = createFormulaNodeId(),
): FormulaRowNode {
  return { id, kind: "row", children };
}

export function emptyFormulaTree(idFactory: FormulaNodeFactory = createFormulaNodeId) {
  const active = formulaSlot("equation", true, idFactory());
  return {
    root: formulaRow([active], idFactory()),
    activeNodeId: active.id,
  };
}

export type FormulaNodePathPart = string | number;
export type FormulaNodeLocation = {
  node: FormulaExpressionNode;
  path: FormulaNodePathPart[];
  ancestors: FormulaExpressionNode[];
};

type ChildEntry = {
  path: FormulaNodePathPart[];
  node: FormulaExpressionNode;
};

function childEntries(node: FormulaExpressionNode): ChildEntry[] {
  switch (node.kind) {
    case "slot":
    case "atom":
      return [];
    case "row":
      return node.children.map((child, index) => ({ path: ["children", index], node: child }));
    case "fraction":
      return [
        { path: ["numerator"], node: node.numerator },
        { path: ["denominator"], node: node.denominator },
      ];
    case "script":
      return [
        { path: ["base"], node: node.base },
        ...(node.subscript ? [{ path: ["subscript"], node: node.subscript }] : []),
        ...(node.superscript ? [{ path: ["superscript"], node: node.superscript }] : []),
      ];
    case "radical":
      return [
        ...(node.index ? [{ path: ["index"], node: node.index }] : []),
        { path: ["radicand"], node: node.radicand },
      ];
    case "fence":
      return [{ path: ["body"], node: node.body }];
    case "function":
      return [
        ...(node.subscript ? [{ path: ["subscript"], node: node.subscript }] : []),
        ...node.arguments.map((argument, index) => ({ path: ["arguments", index], node: argument })),
      ];
    case "large-operator":
      return [
        ...(node.lower ? [{ path: ["lower"], node: node.lower }] : []),
        ...(node.upper ? [{ path: ["upper"], node: node.upper }] : []),
        { path: ["body"], node: node.body },
        ...(node.variable ? [{ path: ["variable"], node: node.variable }] : []),
        ...(node.differential ? [{ path: ["differential"], node: node.differential }] : []),
        ...(node.order ? [{ path: ["order"], node: node.order }] : []),
      ];
    case "matrix":
      return node.cells.map((cell, index) => ({ path: ["cells", index], node: cell }));
    case "cases":
      return node.rows.flatMap((row, index) => [
        { path: ["rows", index, "value"], node: row.value },
        { path: ["rows", index, "condition"], node: row.condition },
      ]);
    case "accent":
      return [{ path: ["body"], node: node.body }];
    case "binomial":
      return [
        { path: ["upper"], node: node.upper },
        { path: ["lower"], node: node.lower },
      ];
  }
}

export function findFormulaNode(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
): FormulaNodeLocation | undefined {
  const visit = (
    node: FormulaExpressionNode,
    path: FormulaNodePathPart[],
    ancestors: FormulaExpressionNode[],
  ): FormulaNodeLocation | undefined => {
    if (node.id === nodeId) return { node, path, ancestors };
    for (const child of childEntries(node)) {
      const found = visit(child.node, [...path, ...child.path], [...ancestors, node]);
      if (found) return found;
    }
    return undefined;
  };
  return visit(root, [], []);
}

function mapFormulaChildren(
  node: FormulaExpressionNode,
  mapper: (child: FormulaExpressionNode) => FormulaExpressionNode,
): FormulaExpressionNode {
  switch (node.kind) {
    case "slot":
    case "atom":
      return node;
    case "row":
      return { ...node, children: node.children.map(mapper) };
    case "fraction":
      return { ...node, numerator: mapper(node.numerator), denominator: mapper(node.denominator) };
    case "script":
      return {
        ...node,
        base: mapper(node.base),
        subscript: node.subscript ? mapper(node.subscript) : undefined,
        superscript: node.superscript ? mapper(node.superscript) : undefined,
      };
    case "radical":
      return {
        ...node,
        radicand: mapper(node.radicand),
        index: node.index ? mapper(node.index) : undefined,
      };
    case "fence":
      return { ...node, body: mapper(node.body) };
    case "function":
      return {
        ...node,
        subscript: node.subscript ? mapper(node.subscript) : undefined,
        arguments: node.arguments.map(mapper),
      };
    case "large-operator":
      return {
        ...node,
        body: mapper(node.body),
        lower: node.lower ? mapper(node.lower) : undefined,
        upper: node.upper ? mapper(node.upper) : undefined,
        variable: node.variable ? mapper(node.variable) : undefined,
        differential: node.differential ? mapper(node.differential) : undefined,
        order: node.order ? mapper(node.order) : undefined,
      };
    case "matrix":
      return { ...node, cells: node.cells.map(mapper) };
    case "cases":
      return {
        ...node,
        rows: node.rows.map((row) => ({
          ...row,
          value: mapper(row.value),
          condition: mapper(row.condition),
        })),
      };
    case "accent":
      return { ...node, body: mapper(node.body) };
    case "binomial":
      return { ...node, upper: mapper(node.upper), lower: mapper(node.lower) };
  }
}

export function replaceFormulaNode(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
  replacement: FormulaExpressionNode,
): FormulaExpressionNode {
  if (root.id === nodeId) return replacement;
  let changed = false;
  const next = mapFormulaChildren(root, (child) => {
    const replaced = replaceFormulaNode(child, nodeId, replacement);
    if (replaced !== child) changed = true;
    return replaced;
  });
  return changed ? next : root;
}

export function firstFormulaSlot(node: FormulaExpressionNode): FormulaSlotNode | undefined {
  if (node.kind === "slot") return node;
  for (const child of childEntries(node)) {
    const slot = firstFormulaSlot(child.node);
    if (slot) return slot;
  }
  return undefined;
}

export function formulaLeafNodes(
  node: FormulaExpressionNode,
): Array<FormulaSlotNode | FormulaAtomNode> {
  if (node.kind === "slot") return [node];
  if (node.kind === "atom") return node.editable ? [node] : [];
  return childEntries(node).flatMap((child) => formulaLeafNodes(child.node));
}

export type FormulaTreeMutation = {
  root: FormulaExpressionNode;
  activeNodeId: FormulaNodeId;
};

export function insertFormulaStructureAtSlot(
  root: FormulaExpressionNode,
  slotId: FormulaNodeId,
  structure: FormulaExpressionNode,
): FormulaTreeMutation {
  const target = findFormulaNode(root, slotId)?.node;
  if (!target || target.kind !== "slot") return { root, activeNodeId: slotId };
  const nextRoot = replaceFormulaNode(root, slotId, structure);
  return {
    root: nextRoot,
    activeNodeId: firstFormulaSlot(structure)?.id ?? structure.id,
  };
}

export function setFormulaSlotValue(
  root: FormulaExpressionNode,
  slotId: FormulaNodeId,
  value: string,
  atomKind: FormulaAtomKind = "identifier",
  idFactory: FormulaNodeFactory = createFormulaNodeId,
): FormulaTreeMutation {
  const atom = formulaAtom(value, atomKind, idFactory());
  return insertFormulaStructureAtSlot(root, slotId, atom);
}

export function insertFormulaSymbolAtActive(
  root: FormulaExpressionNode,
  activeNodeId: FormulaNodeId,
  latex: string,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
): FormulaTreeMutation {
  const location = findFormulaNode(root, activeNodeId);
  if (!location || (location.node.kind !== "slot" && location.node.kind !== "atom")) {
    return { root, activeNodeId };
  }
  const symbol = formulaAtom(latex, "symbol", idFactory(), false);
  if (location.node.kind === "slot") {
    return {
      root: replaceFormulaNode(root, activeNodeId, symbol),
      activeNodeId: symbol.id,
    };
  }

  const parent = location.ancestors.at(-1);
  if (parent?.kind === "row") {
    const index = parent.children.findIndex((child) => child.id === activeNodeId);
    if (index >= 0) {
      const row = {
        ...parent,
        children: [
          ...parent.children.slice(0, index + 1),
          symbol,
          ...parent.children.slice(index + 1),
        ],
      };
      return {
        root: replaceFormulaNode(root, parent.id, row),
        activeNodeId: symbol.id,
      };
    }
  }
  const row = formulaRow([location.node, symbol], idFactory());
  return {
    root: replaceFormulaNode(root, activeNodeId, row),
    activeNodeId: symbol.id,
  };
}

export function wrapFormulaNode(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
  wrapper: (node: FormulaExpressionNode) => FormulaExpressionNode,
): FormulaTreeMutation {
  const target = findFormulaNode(root, nodeId)?.node;
  if (!target) return { root, activeNodeId: nodeId };
  const wrapped = wrapper(target);
  return {
    root: replaceFormulaNode(root, nodeId, wrapped),
    activeNodeId: firstFormulaSlot(wrapped)?.id ?? target.id,
  };
}

export function clearFormulaNode(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
): FormulaTreeMutation {
  const target = findFormulaNode(root, nodeId)?.node;
  if (!target) return { root, activeNodeId: nodeId };
  const replacement = formulaSlot(target.kind === "slot" ? target.name : target.kind, true, idFactory());
  return {
    root: replaceFormulaNode(root, nodeId, replacement),
    activeNodeId: replacement.id,
  };
}

export function duplicateFormulaNode(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
): FormulaTreeMutation {
  const target = findFormulaNode(root, nodeId)?.node;
  if (!target) return { root, activeNodeId: nodeId };
  const clone = cloneFormulaSubtree(target, idFactory);
  const replacement = formulaRow([target, clone], idFactory());
  return {
    root: replaceFormulaNode(root, nodeId, replacement),
    activeNodeId: firstFormulaSlot(clone)?.id ?? clone.id,
  };
}

export function promoteFormulaNode(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
): FormulaTreeMutation {
  const location = findFormulaNode(root, nodeId);
  const parent = location?.ancestors.at(-1);
  if (!location || !parent) return { root, activeNodeId: nodeId };
  const canPromote =
    parent.kind === "accent" ||
    parent.kind === "fence" ||
    (parent.kind === "radical" && !parent.index) ||
    (parent.kind === "row" && parent.children.length === 1);
  if (!canPromote) return { root, activeNodeId: nodeId };
  return {
    root: replaceFormulaNode(root, parent.id, location.node),
    activeNodeId: nodeId,
  };
}

export function cloneFormulaSubtree(
  node: FormulaExpressionNode,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
): FormulaExpressionNode {
  const cloned = mapFormulaChildren(node, (child) => cloneFormulaSubtree(child, idFactory));
  if (cloned.kind === "cases") {
    return {
      ...cloned,
      id: idFactory(),
      rows: cloned.rows.map((row) => ({ ...row, id: idFactory() })),
    };
  }
  return { ...cloned, id: idFactory() };
}

const INTEGRAL_OPERATORS: FormulaLargeOperator[] = [
  "integral",
  "double-integral",
  "triple-integral",
  "contour-integral",
];

export function createFormulaLargeOperator(
  operator: FormulaLargeOperator,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
  seed: Partial<FormulaLargeOperatorNode> = {},
): FormulaLargeOperatorNode {
  const body = seed.body ?? formulaSlot("body", true, idFactory());
  if (INTEGRAL_OPERATORS.includes(operator)) {
    return {
      id: idFactory(),
      kind: "large-operator",
      operator,
      body,
      lower: seed.lower ?? formulaSlot("lower", false, idFactory()),
      upper: seed.upper ?? formulaSlot("upper", false, idFactory()),
      differential: seed.differential ?? seed.variable ?? formulaSlot("differential", true, idFactory()),
    };
  }
  if (operator === "derivative" || operator === "partial-derivative") {
    return {
      id: idFactory(),
      kind: "large-operator",
      operator,
      body,
      variable: seed.variable ?? seed.differential ?? formulaSlot("variable", true, idFactory()),
      order: seed.order ?? formulaSlot("order", false, idFactory()),
    };
  }
  if (operator === "sum" || operator === "product") {
    return {
      id: idFactory(),
      kind: "large-operator",
      operator,
      body,
      lower: seed.lower ?? formulaSlot("lower", true, idFactory()),
      upper: seed.upper ?? formulaSlot("upper", true, idFactory()),
    };
  }
  return {
    id: idFactory(),
    kind: "large-operator",
    operator,
    body,
    lower: seed.lower ?? formulaSlot("approach", true, idFactory()),
  };
}

export function reconfigureFormulaLargeOperator(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
  operator: FormulaLargeOperator,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
  activeNodeId: FormulaNodeId = nodeId,
): FormulaTreeMutation {
  const target = findFormulaNode(root, nodeId)?.node;
  if (!target || target.kind !== "large-operator") return { root, activeNodeId };
  const configured = {
    ...createFormulaLargeOperator(operator, idFactory, target),
    id: target.id,
  };
  const unchanged = target.operator === configured.operator
    && target.body === configured.body
    && target.lower === configured.lower
    && target.upper === configured.upper
    && target.variable === configured.variable
    && target.differential === configured.differential
    && target.order === configured.order;
  if (unchanged) return { root, activeNodeId };
  const nextActiveNodeId = findFormulaNode(configured, activeNodeId)
    ? activeNodeId
    : formulaLeafNodes(configured)[0]?.id ?? configured.id;
  return {
    root: replaceFormulaNode(root, nodeId, configured),
    activeNodeId: nextActiveNodeId,
  };
}

export function createFormulaFunction(
  name = "sin",
  argumentCount = 1,
  withSubscript = false,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
): FormulaFunctionNode {
  if (!Number.isInteger(argumentCount) || argumentCount < 1 || argumentCount > 3) {
    throw new RangeError("Formula functions support between one and three arguments.");
  }
  return {
    id: idFactory(),
    kind: "function",
    name,
    subscript: withSubscript ? formulaSlot("function-subscript", false, idFactory()) : undefined,
    arguments: Array.from({ length: argumentCount }, (_, index) =>
      formulaSlot(`argument-${index + 1}`, true, idFactory()),
    ),
  };
}

export function reconfigureFormulaFunction(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
  options: { name?: string; argumentCount?: number; withSubscript?: boolean },
  idFactory: FormulaNodeFactory = createFormulaNodeId,
  activeNodeId: FormulaNodeId = nodeId,
): FormulaTreeMutation {
  const target = findFormulaNode(root, nodeId)?.node;
  if (!target || target.kind !== "function") return { root, activeNodeId };
  const argumentCount = options.argumentCount ?? target.arguments.length;
  if (!Number.isInteger(argumentCount) || argumentCount < 1 || argumentCount > 3) {
    throw new RangeError("Formula functions support between one and three arguments.");
  }
  const withSubscript = options.withSubscript ?? Boolean(target.subscript);
  const next: FormulaFunctionNode = {
    ...target,
    name: options.name ?? target.name,
    subscript: withSubscript
      ? target.subscript ?? formulaSlot("function-subscript", false, idFactory())
      : undefined,
    arguments: Array.from({ length: argumentCount }, (_, index) =>
      target.arguments[index] ?? formulaSlot(`argument-${index + 1}`, true, idFactory()),
    ),
  };
  const nextActiveNodeId = findFormulaNode(next, activeNodeId)
    ? activeNodeId
    : formulaLeafNodes(next)[0]?.id ?? next.id;
  return { root: replaceFormulaNode(root, nodeId, next), activeNodeId: nextActiveNodeId };
}

export function reconfigureFormulaFence(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
  open: string,
  close: string,
  activeNodeId: FormulaNodeId = nodeId,
): FormulaTreeMutation {
  const target = findFormulaNode(root, nodeId)?.node;
  if (!target || target.kind !== "fence") return { root, activeNodeId };
  return { root: replaceFormulaNode(root, nodeId, { ...target, open, close }), activeNodeId };
}

export function resizeFormulaCases(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
  rowCount: number,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
  activeNodeId: FormulaNodeId = nodeId,
): FormulaTreeMutation {
  if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 8) {
    throw new RangeError("Formula cases support between one and eight rows.");
  }
  const target = findFormulaNode(root, nodeId)?.node;
  if (!target || target.kind !== "cases") return { root, activeNodeId };
  const rows = Array.from({ length: rowCount }, (_, index) => target.rows[index] ?? ({
    id: idFactory(),
    value: formulaSlot(`case-value-${index + 1}`, true, idFactory()),
    condition: formulaSlot(`case-condition-${index + 1}`, true, idFactory()),
  }));
  const next: FormulaCasesNode = { ...target, rows };
  const nextActiveNodeId = findFormulaNode(next, activeNodeId)
    ? activeNodeId
    : formulaLeafNodes(next)[0]?.id ?? next.id;
  return { root: replaceFormulaNode(root, nodeId, next), activeNodeId: nextActiveNodeId };
}

export function reconfigureFormulaAccent(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
  accent: FormulaAccent,
  activeNodeId: FormulaNodeId = nodeId,
): FormulaTreeMutation {
  const target = findFormulaNode(root, nodeId)?.node;
  if (!target || target.kind !== "accent") return { root, activeNodeId };
  return { root: replaceFormulaNode(root, nodeId, { ...target, accent }), activeNodeId };
}

export function createFormulaMatrix(
  rows: number,
  columns: number,
  delimiter: FormulaMatrixDelimiter = "brackets",
  idFactory: FormulaNodeFactory = createFormulaNodeId,
): FormulaMatrixNode {
  assertMatrixDimensions(rows, columns);
  return {
    id: idFactory(),
    kind: "matrix",
    rows,
    columns,
    delimiter,
    cells: Array.from({ length: rows * columns }, (_, index) =>
      formulaSlot(`cell-${Math.floor(index / columns) + 1}-${(index % columns) + 1}`, true, idFactory()),
    ),
  };
}

function assertMatrixDimensions(rows: number, columns: number) {
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 || rows > 8 || columns > 8) {
    throw new RangeError("Formula matrices must be between 1×1 and 8×8.");
  }
}

export function resizeFormulaMatrix(
  root: FormulaExpressionNode,
  matrixId: FormulaNodeId,
  rows: number,
  columns: number,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
  activeNodeId: FormulaNodeId = matrixId,
): FormulaTreeMutation {
  assertMatrixDimensions(rows, columns);
  const target = findFormulaNode(root, matrixId)?.node;
  if (!target || target.kind !== "matrix") return { root, activeNodeId };
  if (target.rows === rows && target.columns === columns) return { root, activeNodeId };

  const activeCellIndex = target.cells.findIndex((cell) => Boolean(findFormulaNode(cell, activeNodeId)));

  const cells = Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    if (row < target.rows && column < target.columns) {
      return target.cells[row * target.columns + column];
    }
    return formulaSlot(`cell-${row + 1}-${column + 1}`, true, idFactory());
  });
  const matrix: FormulaMatrixNode = { ...target, rows, columns, cells };
  let nextActiveNodeId = formulaLeafNodes(matrix)[0]?.id ?? matrix.id;
  if (activeCellIndex >= 0) {
    const activeRow = Math.floor(activeCellIndex / target.columns);
    const activeColumn = activeCellIndex % target.columns;
    if (activeRow < rows && activeColumn < columns) {
      nextActiveNodeId = activeNodeId;
    } else {
      const nearestRow = Math.min(activeRow, rows - 1);
      const nearestColumn = Math.min(activeColumn, columns - 1);
      const nearestCell = matrix.cells[nearestRow * columns + nearestColumn];
      nextActiveNodeId = formulaLeafNodes(nearestCell)[0]?.id ?? nearestCell.id;
    }
  }
  return {
    root: replaceFormulaNode(root, matrixId, matrix),
    activeNodeId: nextActiveNodeId,
  };
}

export function setFormulaMatrixDelimiter(
  root: FormulaExpressionNode,
  matrixId: FormulaNodeId,
  delimiter: FormulaMatrixDelimiter,
  activeNodeId: FormulaNodeId = matrixId,
): FormulaTreeMutation {
  const target = findFormulaNode(root, matrixId)?.node;
  if (!target || target.kind !== "matrix") return { root, activeNodeId };
  if (target.delimiter === delimiter) return { root, activeNodeId };
  const nextActiveNodeId = findFormulaNode(target, activeNodeId)
    ? activeNodeId
    : formulaLeafNodes(target)[0]?.id ?? target.id;
  return {
    root: replaceFormulaNode(root, matrixId, { ...target, delimiter }),
    activeNodeId: nextActiveNodeId,
  };
}

export function formulaTreeDepth(node: FormulaExpressionNode): number {
  const children = childEntries(node);
  if (!children.length) return 1;
  return 1 + Math.max(...children.map((child) => formulaTreeDepth(child.node)));
}

export function formulaBreadcrumb(
  root: FormulaExpressionNode,
  nodeId: FormulaNodeId,
): FormulaExpressionNode[] {
  const location = findFormulaNode(root, nodeId);
  return location ? [...location.ancestors, location.node] : [];
}

export type FormulaHistorySnapshot = {
  root: FormulaExpressionNode;
  activeNodeId: FormulaNodeId;
  label: string;
};

export type FormulaHistoryState = {
  root: FormulaExpressionNode;
  activeNodeId: FormulaNodeId;
  past: FormulaHistorySnapshot[];
  future: FormulaHistorySnapshot[];
  revision: number;
};

export function createFormulaHistory(
  root: FormulaExpressionNode,
  activeNodeId = firstFormulaSlot(root)?.id ?? root.id,
): FormulaHistoryState {
  return { root, activeNodeId, past: [], future: [], revision: 0 };
}

export function commitFormulaTransaction(
  state: FormulaHistoryState,
  label: string,
  mutate: (root: FormulaExpressionNode, activeNodeId: FormulaNodeId) => FormulaTreeMutation,
  limit = 100,
): FormulaHistoryState {
  const next = mutate(state.root, state.activeNodeId);
  if (next.root === state.root && next.activeNodeId === state.activeNodeId) return state;
  const previous: FormulaHistorySnapshot = {
    root: state.root,
    activeNodeId: state.activeNodeId,
    label,
  };
  return {
    root: next.root,
    activeNodeId: next.activeNodeId,
    past: [...state.past, previous].slice(-limit),
    future: [],
    revision: state.revision + 1,
  };
}

export function undoFormulaTransaction(state: FormulaHistoryState): FormulaHistoryState {
  const previous = state.past.at(-1);
  if (!previous) return state;
  return {
    root: previous.root,
    activeNodeId: previous.activeNodeId,
    past: state.past.slice(0, -1),
    future: [
      ...state.future,
      { root: state.root, activeNodeId: state.activeNodeId, label: previous.label },
    ],
    revision: state.revision + 1,
  };
}

export function redoFormulaTransaction(state: FormulaHistoryState): FormulaHistoryState {
  const next = state.future.at(-1);
  if (!next) return state;
  return {
    root: next.root,
    activeNodeId: next.activeNodeId,
    past: [
      ...state.past,
      { root: state.root, activeNodeId: state.activeNodeId, label: next.label },
    ],
    future: state.future.slice(0, -1),
    revision: state.revision + 1,
  };
}
