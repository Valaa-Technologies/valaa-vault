// @flow

/* eslint-disable max-len */
import Transpiler from "~/script/acorn/ValoscriptTranspiler";
import { Kuery } from "~/script/VALSK";

import { dumpObject } from "~/tools";

// # Node objects

// ESTree AST nodes are represented as `Node` objects, which may have any prototype inheritance but
// which implement the following interface:
export interface Node { +type?: string; loc?: SourceLocation | null; }

/*
    The `type` field is a string representing the AST variant type. Each subtype of `Node` is
  documented below with the specific string of its `type` field. You can use this field to determine
  which interface a node implements.
    The `loc` field represents the source location information of the node. If the node contains no
  information about the source location, the field is `null`; otherwise it is an object consisting
  of a start position (the position of the first character of the parsed source region) and
  an end position (the position of the first character after the parsed source region):
*/
export interface SourceLocation { source: string | null; start: Position, end: Position }

// Each `Position` object consists of a `line` number (1-indexed) and a `column` number (0-indexed):
export interface Position { line: number; column: number; }

// # Identifier

export interface Identifier extends Expression, Pattern {
  type: "Identifier"; name: string;
}
// An identifier. Note that an identifier may be an expression or a destructuring pattern.
export function parseIdentifier (transpiler: Transpiler, ast: Identifier,
    options: Object): Kuery {
  if (options.leftSideRole === "pattern") {
    transpiler.addScopeAccess(options.scopeAccesses, ast.name, "pattern");
    return [[ast.name, !options.leftSideMutable
        ? transpiler.VALK().createConstIdentifier(options.initializer)
        : transpiler.VALK().createLetIdentifier(options.initializer)
    ]];
  }
  if (options.leftSideRole === "modify") {
    transpiler.addScopeAccess(options.scopeAccesses, ast.name, "modify");
    return (toValueAlterationVAKON: Kuery) =>
        transpiler.VALK().alterIdentifier(ast.name, toValueAlterationVAKON);
  }
  if (options.leftSideRole === "delete") {
    return () => transpiler.VALK().deleteIdentifier(ast.name);
  }
  transpiler.addScopeAccess(options.scopeAccesses, ast.name, "read");
  return transpiler.VALK().identifierValue(ast.name);
}


// # Literal

export interface Literal extends Node, Expression {
  type: "Literal"; value: string | boolean | null | number | RegExp;
}
// A literal token. Note that a literal can be an expression.
export function parseLiteral (transpiler: Transpiler, ast: Literal/* , options: Object */): Kuery {
  return transpiler.VALK().toTemplate(ast.value);
}


export interface RegExpLiteral extends Literal {
  regex: { pattern: string; flags: string; };
}
/* The `regex` property allows regexes to be represented in environments that don’t
support certain flags such as `y` or `u`. In environments that don't support
these flags `value` will be `null` as the regex can't be represented natively.
*/
export function parseRegExpLiteral (transpiler: Transpiler, ast: RegExpLiteral,
    /* options: Object */): Kuery {
  return transpiler.VALK().regexp(ast.regex.pattern, ast.regex.flags);
}


// # Programs

const programContextRuleOverrides: Object = {
  // overrideThisExpression: ((t) => t.VALK().head()),
  overrideBreakStatement: ((t, ast, options) =>
      t.parseError(ast, options, "'break' statement forbidden in top-level context")),
  overrideContinueStatement: ((t, ast, options) =>
      t.parseError(ast, options, "'continue' statement forbidden in top-level context")),
  overrideReturnStatement: ((t, ast, options) =>
      t.parseError(ast, options, "'return' statement forbidden in top-level context")),
};

export interface Program extends Node { type: "Program"; body: [ Statement ]; }
// A complete program source tree.
export function parseProgram (transpiler: Transpiler, ast: Program, options: Object): Kuery {
  if (!ast.body.length) return transpiler.VALK().void();
  const topLevelOptions = { ...options,
    contextRuleOverrides: programContextRuleOverrides,
    scopeAccesses: {},
    surroundingFunction: {
      topLevel: true,
      requireControlLooping: false,
    },
    surroundingBlock: { requireFlowReturn: 0, requireFlowLooping: 0 },
    unbreakable: true,
  };
  let globals;
  // TODO(iridian, 2019-03): wtf. This is always false, and as such
  // should probably come after the kueryFromAst(body) has evaluated.
  // But how does the current system work?
  // Note: I think it doesn't: the main pathway of VSX arrow functions
  // works because 'this' gets set in Vrapper._valospaceScope explicitly
  // but this is why kuery properties don't work.
  if (topLevelOptions.scopeAccesses.this) {
    (globals || (globals = {})).this = ["§->", null];
  }
  let ret = transpiler.VALK();
  if (globals) ret = ret.setScopeValues(globals);
  let lastNode = ast.body.slice(-1)[0];
  let body;
  if (lastNode.type === "ExpressionStatement") {
    body = ast.body.slice(0, -1);
  } else if (transpiler.acornParseOptions.sourceType === "script") {
    throw transpiler.parseError(lastNode, options,
        "The last top-level statement in a valoscript inline body must be an expression");
  } else {
    lastNode = undefined;
    body = ast.body;
  }
  if (body.length > 0) {
    ret = ret.pathConcat(transpiler.kueryFromAst(
        { type: "BlockStatement", body }, topLevelOptions));
    topLevelOptions.scopeAccesses = topLevelOptions.previousBlockOptions.scopeAccesses;
  }
  if (lastNode) {
    topLevelOptions.unbreakable = false;
    ret = ret.to(transpiler.kueryFromAst(lastNode.expression, topLevelOptions));
  }
  transpiler.exposeOuterScopeAccesses(topLevelOptions.scopeAccesses, options.scopeAccesses);
  return ret;
}

// # Functions

export interface Function extends Node {
  id: Identifier | null; params: [ Pattern ]; body: BlockStatement;
}
// A function [declaration](#functiondeclaration) or [expression](#functionexpression).


// # Statements

export interface Statement extends Node { }
// Any statement.

export interface ExpressionStatement extends Statement {
  type: "ExpressionStatement"; expression: Expression;
}
// An expression statement, i.e., a statement consisting of a single expression.
export function parseExpressionStatement (transpiler: Transpiler, ast: ExpressionStatement,
    options: Object): Kuery {
  return transpiler.statements(transpiler.kueryFromAst(ast.expression, options));
}


const shortCircuitStatementTypes: Object = {
  BreakStatement: true, ContinueStatement: true, ThrowStatement: true, ReturnStatement: true,
};
const skipStatementTypes: Object = {
  EmptyStatement: true,
};
export interface BlockStatement extends Statement {
  type: "BlockStatement"; body: [ Statement ];
}
// A block statement, i.e., a sequence of statements surrounded by braces.
export function parseBlockStatement (transpiler: Transpiler, ast: BlockStatement,
    options: Object): Kuery {
  const blockOptions = options.previousBlockOptions = { ...options,
    scopeAccesses: {},
    surroundingBlock: {
      hoists: [],
      requireFlowReturn: 0,
      requireFlowLooping: 0,
    }
  };
  const body = parseStatementList(transpiler, ast.body, blockOptions);
  options.surroundingBlock.requireFlowReturn += blockOptions.surroundingBlock.requireFlowReturn;
  options.surroundingBlock.requireFlowLooping += blockOptions.surroundingBlock.requireFlowLooping;
  transpiler.exposeOuterScopeAccesses(blockOptions.scopeAccesses, options.scopeAccesses);
  const ret = (blockOptions.surroundingBlock.hoists.length
          ? transpiler.statements(
              transpiler.VALK().setScopeValues(...blockOptions.surroundingBlock.hoists))
          : transpiler.VALK())
      .to(body);
  return ret;
}
export function parseStatementList (transpiler: Transpiler, statements: Array<Statement>,
    options: Object): Kuery {
  if (!statements.length) return transpiler.VALK();
  // Head is used for flow control. break, continue, return etc. will set head as null. This will
  // short-circuit the remaining valk path to the surrounding block or language construct.
  const innerOptions = { ...options, unbreakable: undefined };
  if (options.unbreakable) {
    const statementKueries = statements.map(statementAst => {
      if (shortCircuitStatementTypes[statementAst.type]) {
        throw transpiler.parseError(statementAst, options, `control flow statements (here '${
            statementAst.type}') are not allowed in unbreakable statement lists`);
      }
      return transpiler.kueryFromAst(statementAst, innerOptions);
    }).filter(kuery => kuery && kuery.isActiveKuery());
    return statementKueries.length ? transpiler.statements(...statementKueries) : transpiler.VALK();
  }
  let shortCircuiting = false;
  return statements.reduce((accum: Kuery, statementAst) => {
    if (shortCircuiting || skipStatementTypes[statementAst.type]) return accum;
    const breakableKuery =
        options.surroundingBlock.requireFlowReturn || options.surroundingBlock.requireFlowLooping
            ? accum.nullable() : accum;
    const statementKuery = transpiler.kueryFromAst(statementAst, innerOptions);
    if (!statementKuery || !statementKuery.isActiveKuery()) return accum;
    const ret = breakableKuery.to(statementKuery);
    if (!shortCircuitStatementTypes[statementAst.type]) return ret;
    shortCircuiting = true;
    return ret;
  }, transpiler.VALK());
}

export interface EmptyStatement extends Statement {
  type: "EmptyStatement";
}
// An empty statement, i.e., a solitary semicolon.
export function parseEmptyStatement (transpiler: Transpiler/* , ast: EmptyStatement,
    options: Object */): Kuery {
  return transpiler.VALK();
}


export interface DebuggerStatement extends Statement {
  type: "DebuggerStatement";
}
// A `debugger` statement.
export function parseDebuggerStatement (transpiler: Transpiler/* , ast: DebuggerStatement,
    options: Object */): Kuery {
  return transpiler.VALK().comment("debugger");
}


export interface WithStatement extends Statement {
  type: "WithStatement"; object: Expression; body: Statement;
}
// A `with` statement.
export function parseWithStatement (transpiler: Transpiler, ast: WithStatement,
    options: Object): Kuery {
  throw transpiler.parseError(ast, options,
      "'with' is disabled in strict mode (the only mode valoscript allows)");
}


// ## Control Flow

export interface ReturnStatement extends Statement {
  type: "ReturnStatement"; argument: Expression | null;
}
// A `return` statement.
export function parseReturnStatement (transpiler: Transpiler, ast: ReturnStatement,
    options: Object): Kuery {
  options.surroundingBlock.requireFlowReturn = true;
  return transpiler.VALK().void(transpiler.VALK().setHeadProperties({
    return: {
      result: !ast.argument ? transpiler.VALK().void()
          : transpiler.VALK().toTemplate(transpiler.kueryFromAst(ast.argument, options))
    },
    looping: 0,
  }));
}


export interface LabeledStatement extends Statement {
  type: "LabeledStatement"; label: Identifier; body: Statement;
}
// A labeled statement, i.e., a statement prefixed by a `break`/`continue` label.

export interface BreakStatement extends Statement {
  type: "BreakStatement"; label: Identifier | null;
}
// A `break` statement.
export function parseBreakStatement (transpiler: Transpiler, ast: BreakStatement,
    options: Object): Kuery {
  options.surroundingBlock.requireFlowLooping = true;
  return transpiler.VALK().void(transpiler.VALK().setHeadProperties({ looping: 0 }));
}

export interface ContinueStatement extends Statement {
  type: "ContinueStatement"; label: Identifier | null;
}
// A `continue` statement.
export function parseContinueStatement (transpiler: Transpiler, ast: ContinueStatement,
    options: Object): Kuery {
  options.surroundingBlock.requireFlowLooping = true;
  return transpiler.VALK().void(transpiler.VALK().setHeadProperties({ looping: 1 }));
}


// ## Choice

export interface IfStatement extends Statement {
  type: "IfStatement"; test: Expression; consequent: Statement; alternate: Statement | null;
}
// An `if` statement.
export function parseIfStatement (transpiler: Transpiler, ast: IfStatement,
    options: Object): Kuery {
  return transpiler.VALK().if(transpiler.kueryFromAst(ast.test, options), {
    then: transpiler.kueryFromAst(ast.consequent, options),
    else: !ast.alternate
        ? transpiler.VALK().head()
        : transpiler.kueryFromAst(ast.alternate, options),
  });
}


export interface SwitchStatement extends Statement {
  type: "SwitchStatement"; discriminant: Expression; cases: [ SwitchCase ]; lexical: boolean;
}
// A `switch` statement.
export function parseSwitchStatement (transpiler: Transpiler, ast: SwitchStatement,
    options: Object): Kuery {
  const caseDatas = ast.cases.map(case_ => parseSwitchCase(transpiler, case_, options));
  let defaultIndex = caseDatas.length;
  const matchCases = caseDatas
      .map(([testKuery], index) => [testKuery, transpiler.VALK().fromValue(index)])
      .filter(([testKuery, index]) => testKuery || ((defaultIndex = index) && false));
  return caseDatas.reduce((accum: Kuery, [, consequentKuery], caseIndex) =>
      accum.nullable()
          .if(transpiler.VALK().greaterOrEqualTo(
              caseIndex, transpiler.VALK().fromScope("__switchCaseIndex__")),
              { then: consequentKuery, else: transpiler.VALK().head() }),
      transpiler.VALK().setScopeValues(["__switchCaseIndex__", transpiler.VALK().switch(
          transpiler.kueryFromAst(ast.discriminant, options),
          matchCases,
          { default: transpiler.VALK().fromValue(defaultIndex) },
      )])
  );
}

export interface SwitchCase extends Node {
  type: "SwitchCase"; test: Expression | null; consequent: [ Statement ];
}
// A `case` (if `test` is an `Expression`) or `default` (if `test === null`) clause in the body of
// a `switch` statement.
function parseSwitchCase (transpiler: Transpiler, ast: SwitchCase,
    options: Object): [Kuery, Kuery] {
  return [
    ast.test && transpiler.kueryFromAst(ast.test, options),
    parseStatementList(transpiler, ast.consequent, options),
  ];
}


// ## Exceptions

export interface ThrowStatement extends Statement {
  type: "ThrowStatement"; argument: Expression;
}
// A `throw` statement.
export function parseThrowStatement (transpiler: Transpiler, ast: ThrowStatement,
    options: Object): Kuery {
  return transpiler.VALK().throw(transpiler.kueryFromAst(ast.argument, options));
}

export interface TryStatement extends Statement {
  type: "TryStatement"; block: BlockStatement; handler: CatchClause | null;
  guardedHandlers: [ CatchClause ]; finalizer: BlockStatement | null;
}
// A `try` statement. If `handler` is `null` then `finalizer` must be a `BlockStatement`.
export function parseTryStatement (transpiler: Transpiler, ast: TryStatement,
    options: Object): Kuery {
  transpiler.warn(
      "parseTryStatement: treated as basic BlockStatement; exceptions will fall through");
  return transpiler.kueryFromAst(ast.block, options);
}

export interface CatchClause extends Node {
  type: "CatchClause"; param: Pattern; guard: Expression | null; body: BlockStatement;
}
// A `catch` clause following a `try` block.
export function parseCatchClause (transpiler: Transpiler/* , ast: CatchClause,
    options: Object */): Kuery {
  transpiler.warn("kueryFromCatchClause: unimplemented: ignored");
}


// ## Loops

export interface WhileStatement extends Statement {
  type: "WhileStatement"; test: Expression; body: Statement;
}
// A `while` statement.
export function parseWhileStatement (transpiler: Transpiler, ast: WhileStatement,
    options: Object): Kuery {
  return _parseLoopStatement(transpiler, ast, options, "while");
}

export interface DoWhileStatement extends Statement {
  type: "DoWhileStatement"; body: Statement; test: Expression;
}
// A `do`/`while` statement.
export function parseDoWhileStatement (transpiler: Transpiler, ast: DoWhileStatement,
    options: Object): Kuery {
  return _parseLoopStatement(transpiler, ast, options, "doWhile");
}

export interface ForStatement extends Statement {
  type: "ForStatement"; init: VariableDeclaration | Expression | null; test: Expression | null;
  update: Expression | null; body: Statement;
}
// A `for` statement.
export function parseForStatement (transpiler: Transpiler, ast: ForStatement,
    options: Object): Kuery {
  return _parseLoopStatement(transpiler, ast, options, "for");
}

function _parseLoopStatement (transpiler: Transpiler, ast: any,
    options: Object, loopType: "while" | "doWhile" | "for") {
  const bodyOptions = { ...options,
    scopeAccesses: {},
    surroundingBlock: { requireFlowReturn: 0, requireFlowLooping: 0 }
  };
  const body = transpiler.kueryFromAst(ast.body, bodyOptions);
  transpiler.exposeOuterScopeAccesses(bodyOptions.scopeAccesses, options.scopeAccesses);
  if (!bodyOptions.surroundingBlock.requireFlowReturn &&
      !bodyOptions.surroundingBlock.requireFlowLooping) {
    // Loop with no continue, break or return statements inside.
    switch (loopType) {
      default: throw new Error(`INTERNAL ERROR: no such loopType '${loopType}'`);
      case "while":
        return transpiler.VALK().while(
            transpiler.kueryFromAst(ast.test, options),
            transpiler.statements(body));
      case "doWhile":
        return transpiler.VALK().while(
            transpiler.statements(body).to(transpiler.kueryFromAst(ast.test, options)));
      case "for": {
        let core = transpiler.VALK().while(
            transpiler.kueryFromAst(ast.test, options),
            !ast.update
                ? transpiler.statements(body)
                : transpiler.statements(body, transpiler.kueryFromAst(ast.update, options)));
        if (ast.init) {
          const init = transpiler.kueryFromAst(ast.init, options);
          core = ast.init.type !== "VariableDeclaration"
              ? transpiler.statements(init, core)
              : init.to(core);
        }
        return core;
      }
    }
  }
  options.surroundingFunction.requireControlLooping = true;
  options.surroundingBlock.requireFlowReturn += bodyOptions.surroundingBlock.requireFlowReturn;
  let core;
  switch (loopType) {
    default: throw new Error(`INTERNAL ERROR: no such loopType '${loopType}'`);
    case "while":
      core = transpiler.VALK().while(transpiler.VALK().and(
          transpiler.kueryFromAst(ast.test, options),
          transpiler.statements(body).to("looping")));
      break;
    case "doWhile":
      core = transpiler.VALK().while(transpiler.VALK().and(
          transpiler.statements(body).to("looping"),
          transpiler.kueryFromAst(ast.test, options)));
      break;
    case "for": {
      core = transpiler.VALK().while(transpiler.VALK().and(
              transpiler.kueryFromAst(ast.test, options),
              transpiler.statements(body).to("looping"),
          ),
          ...(ast.update ? [transpiler.statements(
              transpiler.kueryFromAst(ast.update, options))] : [])
      );
      if (ast.init) {
        const init = transpiler.kueryFromAst(ast.init, options);
        core = ast.init.type !== "VariableDeclaration"
            ? transpiler.statements(init, core)
            : init.to(core);
      }
      break;
    }
  }
  const resetLooping = bodyOptions.surroundingBlock.requireFlowLooping
          && options.surroundingFunction.requireControlLooping
      ? transpiler.VALK().setHeadProperties({ looping: 1 })
      : undefined;
  return bodyOptions.surroundingBlock.requireFlowReturn
          ? core.if(transpiler.VALK().to("return").not(), resetLooping && { then: resetLooping })
      : resetLooping ? core.to(resetLooping)
          : core;
}

export interface ForInStatement extends Statement {
  type: "ForInStatement"; left: VariableDeclaration | Expression; right:
  Expression; body: Statement; each: boolean;
}
// A `for`/`in` statement.
export function parseForInStatement (transpiler: Transpiler, ast: ForInStatement,
    options: Object): Kuery {
  options.surroundingFunction.requireControlLooping = true;
  return transpiler.VALK()
      .repeat(transpiler.VALK().and(
          transpiler.kueryFromAst(ast.test, options),
          transpiler.kueryFromAst(ast.body, options)))
      .if(transpiler.VALK().to("return").not(),
          { then: transpiler.VALK().setHeadProperties({ looping: 1 }) });
}


// ## Declarations

export interface Declaration extends Statement { }
// Any declaration node. Note that declarations are considered statements; this is because
// declarations can appear in any statement context.

export interface FunctionDeclaration extends Function, Declaration {
  type: "FunctionDeclaration"; id: Identifier; params: [ Pattern ]; defaults: [ Expression ];
  rest: Identifier | null; body: BlockStatement | Expression; generator: boolean;
  expression: boolean;
}
// A function declaration. Note that unlike in the parent interface `Function`, the `id` cannot be
// `null`.
export function parseFunctionDeclaration (transpiler: Transpiler, ast: FunctionDeclaration,
    options: Object): Kuery {
  options.surroundingBlock.hoists.push(...transpiler.patternSettersFromAst(ast.id,
      { ...options, initializer: parseFunctionExpression(transpiler, ast, options) }));
  return transpiler.VALK();
}

export interface VariableDeclaration extends Declaration {
  type: "VariableDeclaration"; declarations: [ VariableDeclarator ]; kind: "var"
}
// A variable declaration.
export interface VariableDeclarator extends Node {
  type: "VariableDeclarator"; id: Pattern; init: Expression | null;
}
// A variable declarator.
export function parseVariableDeclaration (transpiler: Transpiler, ast: VariableDeclaration,
    options: Object): Kuery {
  // TODO(iridian): Could merge all side-effect free selectors into a selection object.
  return transpiler.VALK().setScopeValues(...[].concat(...ast.declarations.map(
      (declarator: Kuery) => parseVariableDeclarator(transpiler, declarator, options))));
}

export function parseVariableDeclarator (transpiler: Transpiler,
    { id, init }: { id: Pattern, init: Kuery | Expression | null }, options: Object,
    leftSideMutable: boolean = true) {
  return transpiler.patternSettersFromAst(id, {
    ...options,
    leftSideMutable,
    initializer: (init && !(init instanceof Kuery))
        ? transpiler.kueryFromAst(init, options)
        : (options.initializer || init),
  });
}

// # Expressions

const VALK_OPS = {
  unaryvoid: "void",
  unarydelete: "",
  unarytypeof: "typeof",
  instanceof: "instanceof",
  in: "in",
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
  "%": "remainder",
  "**": "exponentiate",
  "&": "bitAND",
  "|": "bitOR",
  "^": "bitXOR",
  "<<": "bitShiftLeft",
  ">>": "bitShiftRight",
  ">>>": "bitShiftZeroFillRight",
  "===": "equalTo",
  "==": "looseEqualTo",
  "~": "bitNOT",
  ">": "greaterThan",
  "!==": "notEqualTo",
  "!=": "looseNotEqualTo",
  "<": "lessThan",
  "<=": "lessOrEqualTo",
  ">=": "greaterOrEqualTo",
  "!": "not",
  "&&": "and",
  "||": "or",

  "unary~": "bitNOT",
  "unary-": "negate",
  "unary!": "not"
};

export interface Expression extends Node, Pattern { }
// Any expression node. Since the left-hand side of an assignment may be any expression in general,
// an expression can also be a pattern.

export interface ThisExpression extends Expression { type: "ThisExpression"; }
// A `this` expression.
export function parseThisExpression (transpiler: Transpiler, ast: ThisExpression,
    options: Object): Kuery {
  if (options.headIsThis) return transpiler.VALK().head();
  transpiler.addScopeAccess(options.scopeAccesses, "this", "read");
  return transpiler.VALK().fromThis();
}

export interface ArrayExpression extends Expression {
  type: "ArrayExpression"; elements: [ Expression | null ];
}
// An array expression.
export function parseArrayExpression (transpiler: Transpiler, ast: ArrayExpression,
    options: Object): Kuery {
  return transpiler.VALK().array(...ast.elements.map(node => (node
      ? transpiler.kueryFromAst(node, options)
      : transpiler.VALK().void()
  )));
}

export interface ObjectExpression extends Expression {
  type: "ObjectExpression"; properties: [ Property ];
}
// An object expression.
export interface Property extends Node {
  type: "Property"; computed: boolean, key: Literal | Identifier; value: Expression;
  kind: "init" | "get" | "set";
}
// A literal property in an object expression can have either a string or number as its `value`.
// Ordinary property initializers have a `kind` value `"init"`; getters and setters have the kind
// values `"get"` and `"set"`, respectively.
export function parseObjectExpression (transpiler: Transpiler, ast: ObjectExpression,
    options: Object): Kuery {
  let literalObject;
  const propertySetters = [];
  for (const { computed, key, value, kind } of ast.properties) {
    const staticName = ((key.type === "Literal") && key.value)
        || (!computed && (key.type === "Identifier") && key.name);
    if (staticName) {
      if (value.type === "Literal") {
        (literalObject || (literalObject = {}))[staticName] = value.value;
      } else {
        propertySetters.push([staticName, transpiler.kueryFromAst(value, options)]);
      }
    } else if (computed) {
      const previousOverride = options.contextRuleOverrides.overrideThisExpression;
      if (previousOverride) options.contextRuleOverrides.overrideThisExpression = undefined;
      propertySetters.push([
        transpiler.kueryFromAst(key, options), transpiler.kueryFromAst(value, options),
      ]);
      if (previousOverride) options.contextRuleOverrides.overrideThisExpression = previousOverride;
    } else if (kind !== "init") {
      throw new Error("Getters and setters not implemented");
    }
  }
  return transpiler.VALK().object(...(literalObject ? [literalObject] : []), ...propertySetters);
}

export const functionContextRuleOverrides: Object = {
  overrideThisExpression: undefined,
  overrideBreakStatement: undefined,
  overrideContinueStatement: undefined,
  overrideReturnStatement: undefined,
};

export interface FunctionExpression extends Function, Expression {
  type: "FunctionExpression"; id: Identifier | null; params: [ Pattern ]; defaults: [ Expression ];
  rest: Identifier | null; body: BlockStatement | Expression; generator: boolean;
  expression: boolean;
}
// A `function` expression.
export function parseFunctionExpression (transpiler: Transpiler, ast: FunctionExpression,
    options: Object): Kuery {
  return parseFunctionHelper(transpiler, ast, options);
}

export function parseFunctionHelper (transpiler: Transpiler, ast: FunctionExpression,
    options: Object): Kuery {
  const functionOptions = {
    ...options,
    scopeAccesses: {},
    surroundingFunction: {
      topLevel: false,
      hoists: [],
      requireControlLooping: false,
    }, // List of 'var' names to hoist.
    contextRuleOverrides: { ...options.contextRuleOverrides, ...functionContextRuleOverrides },
    omitThisFromScope: undefined,
  };
  const body = transpiler.kueryFromAst(ast.body, functionOptions);
  let controlHeader = transpiler.VALK();
  if (!options.omitThisFromScope) {
    transpiler.addScopeAccess(functionOptions.scopeAccesses, "this", "hoist");
    transpiler.addScopeAccess(functionOptions.scopeAccesses, "arguments", "hoist");
    controlHeader = controlHeader.setScopeValues({ this: transpiler.VALK().head() });
  }

  controlHeader = controlHeader.to(transpiler.createControlBlock(
      functionOptions.surroundingFunction.requireControlLooping ? { looping: 1 } : {}));
  const paramDeclarations = scopeSettersFromParamDeclarators(transpiler, ast, functionOptions);
  const functionScopeHoists = functionOptions.surroundingFunction.hoists.length &&
      transpiler.VALK().setScopeValues(...functionOptions.surroundingFunction.hoists.map(
          hoistName => ({ [hoistName]: { value: transpiler.VALK().void() } })));
  transpiler.exposeOuterScopeAccesses(functionOptions.scopeAccesses, options.scopeAccesses);
  const captivePath = transpiler.VALK()
      .pathConcat(controlHeader, paramDeclarations, functionScopeHoists)
      .to(transpiler.statements(body))
      .to("return").nullable().to("result");
  return transpiler.VALK().capture(
      transpiler.VALK().fromValue(captivePath.toVAKON()),
      transpiler.VALK().fromValue("§nonlive"));
}

export function scopeSettersFromParamDeclarators (transpiler: Transpiler,
    { params, /* defaults, */ rest }:
    { params: Pattern[], defaults: ?Expression[], rest: Identifier | null }, options: Object) {
  const setters = [].concat(...params.map((pattern: Pattern, index: number) =>
      transpiler.patternSettersFromAst(pattern,
          { ...options, initializer: transpiler.VALK().fromScope("arguments").toIndex(index) })));
  if (rest) {
    transpiler.addScopeAccess(options.scopeAccesses, rest.name, "hoist");
    setters.push([rest.name, params.length
        ? transpiler.VALK().fromScope("arguments").call("slice", null, params.length)
        : transpiler.VALK().fromScope("arguments")
    ]);
  }
  return setters.length ? transpiler.VALK().setScopeValues(...setters) : transpiler.VALK();
}

// ## Unary expressions

export interface UnaryExpression extends Expression {
  type: "UnaryExpression"; operator: UnaryOperator; prefix: boolean; argument: Expression;
}
// A unary operator expression.
export type UnaryOperator = "-" | "+" | "!" | "~" | "typeof" | "void" | "delete";
// A unary operator token.
export function parseUnaryExpression (transpiler: Transpiler, ast: UnaryExpression,
    options: Object): Kuery {
  if (ast.operator === "delete") {
    return parseDeleteExpression(transpiler, ast, options);
  }
  const operatorLookupName = `unary${ast.operator}`;
  if (typeof operatorLookupName === "undefined") {
    throw transpiler.parseError(ast, options, `Unhandled unary operator ${ast.operator}`);
  }
  return transpiler.VALK()[VALK_OPS[operatorLookupName]](
    transpiler.kueryFromAst(ast.argument, options));
}

export function parseDeleteExpression (transpiler: Transpiler, ast: UpdateExpression,
    options: Object): Kuery {
  const createDeleteKuery =
      transpiler.modifierFromAst(ast.argument, { ...options, leftSideRole: "delete" });
  if (typeof createDeleteKuery !== "function") {
    throw transpiler.parseError(ast, options,
        "'delete' argument must be either an identifier or a member property lookup");
  }
  return createDeleteKuery();
}

export interface UpdateExpression extends Expression {
  type: "UpdateExpression"; operator: UpdateOperator; argument: Expression; prefix: boolean;
}
// An update (increment or decrement) operator expression.
export type UpdateOperator = "++" | "--";
// An update (increment or decrement) operator token.
export function parseUpdateExpression (transpiler: Transpiler, ast: UpdateExpression,
    options: Object): Kuery {
  const createModifierKuery =
      transpiler.modifierFromAst(ast.argument, { ...options, leftSideRole: "modify" });
  if (typeof createModifierKuery !== "function") {
    throw transpiler.parseError(ast, options,
        `'${ast.operator}' argument must be a left hand side value`);
  }
  // TODO(iridian): This just blindly assumes that the 'value' is Literal: it will fail at
  // runtime appropriately if the 'value' is not, but the debug message is going to be teh suck.
  return createModifierKuery(
      transpiler.VALK().fromValue([ast.operator === "++" ? "§+" : "§-", null, ["§'", 1]]));
}

// ## Binary expressions

export interface BinaryExpression extends Expression {
  type: "BinaryExpression"; operator: BinaryOperator; left: Expression; right: Expression;
}
// A binary operator expression.
export type BinaryOperator = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "<<" | ">>"
    | ">>>" | "+" | "-" | "*" | "/" | "%" | "|" | "^" | "&" | "in" | "instanceof";
// A binary operator token.
export function parseBinaryExpression (transpiler: Transpiler, ast: BinaryExpression,
    options: Object): Kuery {
  // TODO(iridian): Add proper 'in' handling for Scope'd Resource types.
  const operatorLookupName = VALK_OPS[ast.operator];
  if (typeof operatorLookupName === "undefined") {
    throw transpiler.parseError(ast, options, `Unhandled binary operator ${ast.operator}`);
  }
  return transpiler.VALK()[operatorLookupName](
      transpiler.kueryFromAst(ast.left, options), transpiler.kueryFromAst(ast.right, options));
}

const VALK_ALTERATION_OPS = {
  "=": "",
  "+=": "§+",
  "-=": "§-",
  "*=": "§*",
  "/=": "§/",
  "%=": "§%",
  "&=": "§&",
  "|=": "§|",
  "^=": "§^",
  "<<=": "§<<",
  ">>=": "§>>",
  ">>>=": "§>>>",
};

export interface AssignmentExpression extends Expression {
  type: "AssignmentExpression"; operator: AssignmentOperator; left: Pattern; right: Expression;
}
// An assignment operator expression.
export type AssignmentOperator = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "<<=" | ">>=" | ">>>="
    | "|=" | "^=" | "&=";
// An assignment operator token.
export function parseAssignmentExpression (transpiler: Transpiler, ast: AssignmentExpression,
    options: Object): Kuery {
  const createModifierKuery =
      transpiler.modifierFromAst(ast.left, { ...options, leftSideRole: "modify" });
  if (typeof createModifierKuery !== "function") {
    throw transpiler.parseError(ast, options,
        "AssignmentExpression.ast.left must be a left hand side value");
  }
  const operatorLookupName = VALK_ALTERATION_OPS[ast.operator];
  if (typeof operatorLookupName === "undefined") {
    throw transpiler.parseError(ast, options, `Unhandled assignment operator ${ast.operator}`);
  }
  const rightSideVAKON =
      transpiler.VALK().expression("§'", transpiler.kueryFromAst(ast.right, options));
  const toAlterationVAKON = (ast.operator === "=")
      ? rightSideVAKON
      : transpiler.VALK().expression(operatorLookupName, ["§'", ["§->", null]], rightSideVAKON);
  return createModifierKuery(toAlterationVAKON);
}

export interface LogicalExpression extends Expression {
  type: "LogicalExpression"; operator: LogicalOperator; left: Expression; right: Expression;
}
// A logical operator expression.
export type LogicalOperator = "||" | "&&";
// A logical operator token.
export function parseLogicalExpression (transpiler: Transpiler, ast: LogicalExpression,
    options: Object) {
  const operatorLookupName = VALK_OPS[ast.operator];
  if (typeof operatorLookupName === "undefined") {
    throw transpiler.parseError(ast, options, `Unhandled logical operator ${ast.operator}`);
  }
  return transpiler.VALK()[operatorLookupName](
      transpiler.kueryFromAst(ast.left, options),
      transpiler.kueryFromAst(ast.right, options));
}


export interface MemberExpression extends Expression {
  type: "MemberExpression"; object: Expression; property: Identifier | Expression;
  computed: boolean;
}
// A member expression. If `computed` is `true`, the node corresponds to a computed (`a[b]`) member
// expression and `property` is an `Expression`. If `computed` is `false`, the node corresponds to
// a static (`a.b`) member expression and `property` is an `Identifier`.
export function parseMemberExpression (transpiler: Transpiler, ast: MemberExpression,
    options: Object): Kuery {
  const optionsWOLeftsideRole = { ...options, leftSideRole: "" };
  const object = transpiler.kueryFromAst(ast.object, optionsWOLeftsideRole);
  const propertyName = propertyNameKueryFromMember(transpiler, ast, optionsWOLeftsideRole);
  if (options.leftSideRole === "modify") {
    return (toValueAlterationVAKON: Kuery) =>
        transpiler.VALK().alterProperty(propertyName, toValueAlterationVAKON, object);
  }
  if (options.leftSideRole === "delete") {
    return () => transpiler.VALK().deleteProperty(propertyName, object);
  }
  const toProperty = transpiler.VALK().propertyValue(propertyName);
  transpiler.addSourceKueryInfo(toProperty, ast.property);
  return object.to(toProperty);
}

function propertyNameKueryFromMember (transpiler: Transpiler, ast: MemberExpression,
    options: Object) {
  return !ast.computed
      ? ast.property.name
      : transpiler.kueryFromAst(ast.property, options);
}


// ## Other expressions

export interface ConditionalExpression extends Expression {
  type: "ConditionalExpression"; test: Expression; alternate: Expression; consequent: Expression;
}
// A conditional expression, i.e., a ternary `?`/`:` expression.
export function parseConditionalExpression (transpiler: Transpiler, ast: ConditionalExpression,
    options: Object): Kuery {
  return transpiler.VALK().if(transpiler.kueryFromAst(ast.test, options), {
    then: transpiler.kueryFromAst(ast.consequent, options),
    else: transpiler.kueryFromAst(ast.alternate, options)
  });
}

export interface CallExpression extends Expression {
  type: "CallExpression"; callee: Expression; arguments: [ Expression ];
}
// A function call or VALK step expression.
export function parseCallExpression (transpiler: Transpiler, ast: CallExpression,
    options: Object): Kuery {
  let args;
  let escapedKuery;
  let stepName;
  let stem;
  let callee;
  let this_;
  try {
    const argumentOptions = !options.headIsThis ? options : { ...options, headIsThis: false };
    args = transpiler.argumentsFromArray(ast.arguments, argumentOptions);
    // Check $-escaped explicit valk kueries

    ({ escapedKuery, stepName } = extractEscapedKueryFromCallExpression(transpiler, ast, options));
    if (escapedKuery) {
      if (!escapedKuery[stepName]) {
        throw new Error(`Cannot find VALK step with name '${stepName}'`);
      }
      return escapedKuery[stepName](...args);
    }
    ({ stem, callee, this_ } = makeComponentsForCallExpression(transpiler, ast, options));
    return stem.call(callee, this_, ...args);
  } catch (error) {
    throw transpiler.wrapParseError(error, ast, options,
        "\n\targs:", ...dumpObject(args),
        "\n\tescapedKuery:", ...dumpObject(escapedKuery),
        "\n\tstepName:", stepName,
        "\n\tcallee:", ...dumpObject(callee),
        "\n\tthis_:", ...dumpObject(this_));
  }
}

export function extractEscapedKueryFromCallExpression (transpiler: Transpiler, ast: CallExpression,
    options: Object) {
  return (ast.callee.type === "Identifier" && ast.callee.name[0] === "$")
      ? { escapedKuery: transpiler.VALK(), stepName: ast.callee.name.slice(1) }
    : (ast.callee.type === "MemberExpression" && (ast.callee.property.name || "")[0] === "$")
        ? {
          escapedKuery: transpiler.kueryFromAst(ast.callee.object, options),
          stepName: ast.callee.property.name.slice(1)
        }
      : { escapedKuery: undefined, stepName: undefined };
}

export function makeComponentsForCallExpression (transpiler: Transpiler, ast: CallExpression,
    options: Object) {
  let stem;
  let callee;
  let this_;
  if (ast.callee.type !== "MemberExpression") {
    stem = transpiler.VALK();
    callee = transpiler.kueryFromAst(ast.callee, options);
    this_ = transpiler.VALK().fromScope();
  } else {
    stem = transpiler.kueryFromAst(ast.callee.object, options);
    const calleeName = propertyNameKueryFromMember(transpiler, ast.callee, options);
    callee = transpiler.VALK().propertyValue(calleeName);
    transpiler.addSourceKueryInfo(callee, ast.callee.property || ast.callee);
    this_ = transpiler.VALK().head();
  }
  return { stem, callee, this_ };
}


export interface NewExpression extends Expression {
  type: "NewExpression"; callee: Expression; arguments: [ Expression ];
}
// A `new` expression.
export function parseNewExpression (transpiler: Transpiler, ast: NewExpression,
    options: Object): Kuery {
  return transpiler.VALK().new(transpiler.kueryFromAst(ast.callee, options),
      ...transpiler.kueriesFromArray(ast.arguments, options));
}

export interface SequenceExpression extends Expression {
  type: "SequenceExpression"; expressions: [ Expression ];
}
// A sequence expression, i.e., a comma-separated sequence of expressions.
export function parseSequenceExpression (transpiler: Transpiler, ast: SequenceExpression,
    options: Object): Kuery {
  return parseStatementList(
          transpiler, ast.expressions.slice(0, -1), { ...options, unbreakable: true })
      .to(transpiler.kueryFromAst(ast.expressions.slice(-1)[0], options));
}

// # Patterns
// Destructuring binding and assignment are not part of ES5, but all binding positions accept `Pattern` to allow for destructuring in ES6. Nevertheless, for ES5, the only `Pattern` subtype is [`Identifier`](#identifier).

export interface Pattern extends Node { }

/*
export interface ComprehensionExpression extends Expression { type: "ComprehensionExpression"; body: Expression; blocks: [ ComprehensionBlock | ComprehensionIf ]; filter: Expression | null; } // SM-specific
export interface GeneratorExpression extends Expression { type: "GeneratorExpression"; body: Expression; blocks: [ ComprehensionBlock | ComprehensionIf ]; filter: Expression | null; } // SM-specific
  export interface ComprehensionBlock extends Node { type: "ComprehensionBlock"; left: Pattern; right: Expression; each: boolean; } // SM-specific
  export interface ComprehensionIf extends Node { type: "ComprehensionIf"; test: Expression; } // SM-specific
export interface GraphExpression extends Expression { type: "GraphExpression"; index: uint32; expression: Literal; } // SM-specific
export interface GraphIndexExpression extends Expression { type: "GraphIndexExpression"; index: uint32; } // SM-specific
export interface LetExpression extends Expression { type: "LetExpression"; head: [ VariableDeclarator ]; body: Expression; } // SM-specific
*/
