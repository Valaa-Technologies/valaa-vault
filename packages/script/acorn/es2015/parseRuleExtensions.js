// @flow

/* eslint-disable max-len */

import { Kuery } from "~/script/VALSK";

import Transpiler from "~/script/acorn/ValaaScriptTranspiler";
import * as es5 from "~/script/acorn/es5/parseRules";

/* eslint-disable max-len */

// Extensions to core ESTree AST node types for ES2015 grammar,
// see https://github.com/estree/estree/blob/master/es2015.md

// Programs

export interface Program extends es5.Program {
  sourceType: "script" | "module"; body: [ es5.Statement | ModuleDeclaration ];
}
// Parsers must specify `sourceType` as `"module"` if the source has been parsed as an ES6 module.
// Otherwise, `sourceType` must be `"script"`.

// Functions

export interface Function extends es5.Function { generator: boolean; }

// Statements

export interface ForOfStatement extends es5.ForInStatement { type: "ForOfStatement"; }
export function parseForOfStatement (/* transpiler: Transpiler, ast: ForOfStatement,
    options: Object */) {
  throw new Error("ForOf not implemented yet");
  /*
  const listDataKuery = transpiler.kueryFromAst(ast.right, options);
  return transpiler.VALK().doStatements(transpiler.VALK()
      .to(listDataKuery)
      .map(transpiler.VALK()
          .setScopeValues(...transpiler.patternSettersFromAst(ast.left,
              { ...options, initializer: transpiler.VALK().head() }))
          .to(transpiler.createControlBlock())
          // TODO(iridian): Add support for 'return' and 'break' flow control statements. Continue
          // should work out-of-the-box.
          .to(transpiler.kueryFromAst(ast.body, options)))
  );
  */
}

// Declarations

export interface VariableDeclaration extends es5.VariableDeclaration {
  kind: "var" | "let" | "const";
}
export function parseVariableDeclaration (transpiler: Transpiler, ast: VariableDeclaration,
    options: Object): Kuery {
  // TODO(iridian): Could merge all side-effect free selectors into a selection object.
  return transpiler.VALK().setScopeValues(...[].concat(
      ...ast.declarations.map((declarator: Kuery) =>
          es5.parseVariableDeclarator(transpiler, declarator, options, ast.kind !== "const"))));
}

// Expressions

export interface Super extends es5.Node { type: "Super"; }
export interface CallExpression extends es5.CallExpression {
  callee: es5.Expression | Super; arguments: [ es5.Expression | SpreadElement ];
}
export function parseCallExpression (transpiler: Transpiler, ast: CallExpression,
    options: Object): Kuery {
  const args = transpiler.argumentsFromArray(ast.arguments, options);
  const hasSpreadArguments = args.find(arg => arg.thisIsSpreadElement);
  // without any spreadElements we can use es5 call Expression parser
  if (!hasSpreadArguments) {
    return es5.parseCallExpression(transpiler, ast, options);
  }
  const test = es5.extractEscapedKueryFromCallExpression(transpiler, ast, options);
  if (test.escapedKuery) { throw new Error(`Spread arguments not supported for escaped kueries`); }
  const callComponents = es5.makeComponentsForCallExpression(transpiler, ast, options);
  return callComponents.stem.apply(callComponents.callee, callComponents.this_,
      transpiler.VALK().array().call(
          transpiler.VALK().propertyValue("concat"),
          transpiler.VALK().head(),
          ...args.map(arg => {
            if (arg.thisIsSpreadElement) {
              return arg.kuery;
            }
            return transpiler.VALK().array(arg);
          })));
}


export interface MemberExpression extends es5.MemberExpression { object: es5.Expression | Super; }
// A `super` pseudo-expression.

export interface SpreadElement extends Node { type: "SpreadElement"; argument: es5.Expression; }
export function parseSpreadElement (transpiler: Transpiler, ast: SpreadElement,
    options: Object): any {
  return { thisIsSpreadElement: true, kuery: transpiler.kueryFromAst(ast.argument, options) };
}

export interface ArrayExpression extends es5.ArrayExpression {
  elements: [ es5.Expression | SpreadElement | null ];
}

export function parseArrayExpression (transpiler: Transpiler, ast: ArrayExpression,
    options: Object): any {
  const elems = transpiler.argumentsFromArray(ast.elements, options);
  const hasSpreadElements = elems.find((e) => e.thisIsSpreadElement);
  if (!hasSpreadElements) {
    return transpiler.VALK().array(...elems);
  }
  return transpiler.VALK().array().call(
    transpiler.VALK().propertyValue("concat"),
    transpiler.VALK().head(),
    ...elems.map(elem => {
      if (elem.thisIsSpreadElement) {
        return elem.kuery;
      }
      return transpiler.VALK().array(elem);
    })
  );
}
// CallExpression extensions in 'super' section, with 'arguments' having SpreadElement in it
// Spread expression, e.g., `[head, ...iter, tail]`, `f(head, ...iter, ...tail)`.

export interface AssignmentExpression extends es5.AssignmentExpression { left: es5.Pattern; }

// Note that pre-ES6 code was allowed to pass references around and so left was much more liberal;
// an implementation might choose to continue using old definition if it needs to support such
// legacy code.

export interface Property extends es5.Property {
  key: es5.Expression; method: boolean; shorthand: boolean; computed: boolean;
}

export interface ArrowFunctionExpression extends es5.Function, es5.Expression {
  type: "ArrowFunctionExpression"; body: es5.BlockStatement | es5.Expression; expression: boolean;
}
// A fat arrow function expression, e.g., `let foo = (bar) => { /* body */ }`.
// SpiderMonkey version: export interface ArrowExpression extends Function, Expression {
//   type: "ArrowExpression"; params: [ Pattern ]; defaults: [ Expression ];
//   rest: Identifier | null; body: BlockStatement | Expression; generator: boolean; expression:
//   boolean;
// }
export function parseArrowFunctionExpression (transpiler: Transpiler, ast: ArrowFunctionExpression,
    options: Object): Kuery {
  if (!ast.expression) {
    return es5.parseFunctionHelper(transpiler, ast, {
      ...options,
      // omit 'this' hoisting even if used by the function. As it
      // stands arrow function assumes 'this' is provided by the
      // surrounding context capture.
      omitThisFromScope: true,
    });
  }
  const functionOptions = {
    ...options,
    surroundingFunction: { topLevel: false, hoists: [] }, // List of 'var' names to hoist.
    contextRuleOverrides: { ...options.contextRuleOverrides, ...es5.functionContextRuleOverrides },
    headIsThis: true,
  };
  const body = transpiler.kueryFromAst(ast.body, functionOptions);
  const paramDeclarations = es5.scopeSettersFromParamDeclarators(transpiler, ast, functionOptions);
  return transpiler.VALK().capture(transpiler.VALK().fromValue(
      transpiler.VALK().pathConcat(
          transpiler.VALK().fromThis(),
          paramDeclarations,
          body).toJSON()));
}

export interface YieldExpression extends es5.Expression {
  type: "YieldExpression"; argument: es5.Expression | null; delegate: boolean;
}
// A `yield` expression.

// Template Literals

export interface TemplateLiteral extends es5.Expression {
  type: "TemplateLiteral"; quasis: [ TemplateElement ]; expressions: [ es5.Expression ];
}
export function parseTemplateLiteral (transpiler: Transpiler, ast: TemplateLiteral,
    options: Object): Kuery {
  const quasisKueries = ast.quasis.map(quasi => transpiler.kueryFromAst(quasi, options));

  if (quasisKueries.length === 1) {
    return quasisKueries[0];
  }
  const expressionsKueries = ast.expressions.map(
      expression => transpiler.kueryFromAst(expression, options));
  const sortedList = [];
  expressionsKueries.forEach((e, i) => {
    sortedList.push(quasisKueries[i]);
    sortedList.push(expressionsKueries[i]);
  });
  sortedList.push(quasisKueries.pop());
  return transpiler.VALK().add(...sortedList);
}

export interface TaggedTemplateExpression extends es5.Expression {
  type: "TaggedTemplateExpression"; tag: es5.Expression; quasi: TemplateLiteral;
}

export function parseTaggedTemplateExpression (transpiler: Transpiler, ast: TaggedTemplateExpression,
    options: Object): Kuery {
  const stringArgAst = {
    type: "ArrayExpression",
    elements: ast.quasi.quasis
  };
  const callArgAst = {
    type: "CallExpression",
    callee: ast.tag,
    arguments: [stringArgAst, ...ast.quasi.expressions],
  };
  return transpiler.kueryFromAst(callArgAst, options);
}
export interface TemplateElement extends Node {
  type: "TemplateElement"; tail: boolean; value: { cooked: string; raw: string; };
}
export function parseTemplateElement (transpiler: Transpiler, ast: TemplateElement): Kuery {
  return transpiler.VALK().fromValue(ast.value.cooked);
}

// Patterns

export interface AssignmentProperty extends Property {
  type: "Property"; /* inherited */ value: es5.Pattern; kind: "init"; method: false;
}
export interface ObjectPattern extends es5.Pattern {
  type: "ObjectPattern"; properties: [ AssignmentProperty ];
}
// SpiderMonkey version: export interface ObjectPattern extends Pattern {
//   type: "ObjectPattern"; properties: [ { key: Literal | Identifier, value: Pattern } ];
// }
export interface ArrayPattern extends es5.Pattern {
  type: "ArrayPattern"; elements: [ es5.Pattern | null ];
}
export function parseArrayPattern (transpiler: Transpiler, ast: ArrayPattern,
    options: Object): Kuery {
  return {
    thisIsArrayPattern: true, kuery: transpiler.kueriesFromAst(ArrayPattern.elements, options)
  };
}

export interface RestElement extends es5.Pattern {
  type: "RestElement"; argument: es5.Pattern;
}

export interface AssignmentPattern extends es5.Pattern {
  type: "AssignmentPattern"; left: es5.Pattern; right: es5.Expression;
}
// An identifier. Note that an identifier may be an expression or a destructuring pattern.
export function parseAssignmentPattern (transpiler: Transpiler, ast: AssignmentPattern,
    options: Object): Kuery {
  if (options.leftSideRole !== "pattern") {
    throw transpiler.parseError(ast, options,
        `AssignmentPattern expects 'pattern' as options.leftSideRole, got '${
              options.leftSideRole}'`);
  }
  if (typeof options.initializer === "undefined") {
    throw transpiler.parseError(ast, options,
        `AssignmentPattern expects defined options.initializer, got 'undefined'`);
  }
  return transpiler.patternSettersFromAst(ast.left, {
    ...options,
    initializer: options.initializer.ifDefined(
        { else: transpiler.kueryFromAst(ast.right, options) }),
  });
}

// Classes

export interface Class extends Node {
  id: es5.Identifier | null; superClass: es5.Expression | null; body: ClassBody;
}
export interface ClassBody extends Node {
  type: "ClassBody"; body: [ MethodDefinition ];
}
export interface MethodDefinition extends Node {
  type: "MethodDefinition"; key: es5.Expression; value: es5.FunctionExpression;
  kind: "constructor" | "method" | "get" | "set"; computed: boolean; static: boolean;
}
export interface ClassDeclaration extends Class, es5.Declaration {
  type: "ClassDeclaration"; id: es5.Identifier;
}
export interface ClassExpression extends Class, es5.Expression {
  type: "ClassExpression";
}
export interface MetaProperty extends es5.Expression {
  type: "MetaProperty"; meta: es5.Identifier; property: es5.Identifier;
}

// Modules

export interface ModuleDeclaration extends Node { }
// A module `import` or `export` declaration.

export interface ModuleSpecifier extends Node { local: es5.Identifier; }
// A specifier in an import or export declaration.
/*
export function parseModuleSpecifier (transpiler: Transpiler, ast: ModuleSpecifier,
  options: Object): Kuery {
  console.log(ast);
} */

// Imports

export interface ImportDeclaration extends ModuleDeclaration {
  type: "ImportDeclaration";
  specifiers: [ ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier ];
  source: es5.Literal;
}

export function parseImportDeclaration (transpiler: Transpiler, ast: ExportNamedDeclaration,
    options: Object): Kuery {
  const initials = ast.specifiers.map((specifier) => {
    if (specifier.type === "ImportDefaultSpecifier") {
      return {
        type: "MemberExpression",
        object: {
          type: "CallExpression",
          callee: { type: "Identifier", name: "require" },
          arguments: [ast.source]
        },
        property: { type: "Identifier", name: "default" },
      };
    }
    if (specifier.type === "ImportSpecifier") {
      return {
        type: "MemberExpression",
        object: {
          type: "CallExpression",
          callee: { type: "Identifier", name: "require" },
          arguments: [ast.source]
        },
        property: specifier.imported,
      };
    }
    if (specifier.type === "ImportNamespaceSpecifier") {
      return {
        type: "CallExpression",
        callee: { type: "Identifier", name: "require" },
        arguments: [ast.source]
      };
    }
    throw transpiler.parseError(`import feature ${specifier.type} not implemented yet.`);
  });

  const variableDeclarations = initials.map((e, i) => ({
    type: "VariableDeclaration",
    kind: "const",
    declarations: [{
      type: "VariableDeclarator",
      id: { type: "Identifier", name: ast.specifiers[i].local.name },
      init: e
    }]
  }));

  const kueries = variableDeclarations.map(
      (declaration) => transpiler.kueryFromAst(declaration, options));
  return transpiler.VALK().add(...kueries);
}
// An import declaration, e.g., `import foo from "mod";`.

export interface ImportSpecifier extends ModuleSpecifier {
  type: "ImportSpecifier"; imported: es5.Identifier;
}
/*
An imported variable binding, e.g., `{foo}` in `import {foo} from "mod"` or `{foo as bar}` in
`import {foo as bar} from "mod"`. The `imported` field refers to the name of the export imported
from the module. The `local` field refers to the binding imported into the local module scope.
If it is a basic named import, such as in `import {foo} from "mod"`, both `imported` and `local`
are equivalent `Identifier` nodes; in this case an `Identifier` node representing `foo`. If it is
an aliased import, such as in `import {foo as bar} from "mod"`, the `imported` field is
an `Identifier` node representing `foo`, and the `local` field is an `Identifier` node
representing `bar`.
*/

export interface ImportDefaultSpecifier extends ModuleSpecifier { type: "ImportDefaultSpecifier"; }
// A default import specifier, e.g., `foo` in `import foo from "mod.js"`.

export interface ImportNamespaceSpecifier extends ModuleSpecifier {
  type: "ImportNamespaceSpecifier";
}
// A namespace import specifier, e.g., `* as foo` in `import * as foo from "mod.js"`.

// Exports
export interface ExportNamedDeclaration extends ModuleDeclaration {
  type: "ExportNamedDeclaration"; declaration: es5.Declaration | null;
  specifiers: [ ExportSpecifier ]; source: es5.Literal | null;
}
export function parseExportNamedDeclaration (transpiler: Transpiler, ast: ExportNamedDeclaration,
    options: Object): Kuery {
  // declaration is null when using specifiers
  // Specifiers could be translated to use transpiler.kueriesFromAst by separating if scope to
  // the parseExportspecifier function.
  if (!ast.declaration) {
    const exportSpecifiersKueries = ast.specifiers.map((spec) =>
      makeExportsAssignmentKuery(
          spec.exported.name,
          spec.local,
          transpiler,
          options
      )
    );
    return transpiler.VALK().add(...exportSpecifiersKueries);
  }

  if (ast.declaration.type === "VariableDeclaration") {
    const exportsAssignmentKueries = ast.declaration.declarations.map((declaration) =>
       makeExportsAssignmentKuery(
          declaration.id.name,
          declaration.init,
          transpiler, options)
    );
    return transpiler.VALK().add(...exportsAssignmentKueries);
  }

  const functionKuery = transpiler.kueryFromAst(ast.declaration, options);
  const assignmentKuery = makeExportsAssignmentKuery(ast.declaration.id.name, ast.declaration.id,
      transpiler, options);
  return transpiler.VALK().add(...[functionKuery, assignmentKuery]);
}

// An export named declaration, e.g., `export {foo, bar};`, `export {foo} from "mod";` or
// `export var foo = 1;`.
// /Note: Having `declaration` populated with non-empty `specifiers` or non-null `source` results
// in an invalid state./

export interface ExportSpecifier extends ModuleSpecifier {
  type: "ExportSpecifier"; exported: es5.Identifier;
}
/*
An exported variable binding, e.g., `{foo}` in `export {foo}` or `{bar as foo}` in
`export {bar as foo}`. The `exported` field refers to the name exported in the module. The `local`
field refers to the binding into the local module scope. If it is a basic named export, such as in
`export {foo}`, both `exported` and `local` are equivalent `Identifier` nodes; in this case
an `Identifier` node representing `foo`. If it is an aliased export, such as in
`export {bar as foo}`, the `exported` field is an `Identifier` node representing `foo`, and the
`local` field is an `Identifier` node representing `bar`.
*/

export interface ExportDefaultDeclaration extends ModuleDeclaration {
  type: "ExportDefaultDeclaration"; declaration: es5.Declaration | es5.Expression;
}

export function parseExportDefaultDeclaration (transpiler: Transpiler, ast: ExportDefaultDeclaration,
    options: Object): Kuery {
  const assignmentKuery = makeExportsAssignmentKuery(
      "default", ast.declaration, transpiler, options);
  return transpiler.VALK().add(assignmentKuery);
}
    // An export default declaration, e.g., `export default function () {};` or `export default 1;`.

export interface ExportAllDeclaration extends ModuleDeclaration {
  type: "ExportAllDeclaration"; source: es5.Literal;
}

export function parseExportAllDeclaration (transpiler: Transpiler, ast: ExportAllDeclaration,
    options: Object): Kuery {
  const exported = {
    type: "CallExpression",
    callee: { type: "Identifier", name: "require" },
    arguments: [ast.source]
  };

  const variableDeclaration = {
    type: "VariableDeclaration",
    kind: "const",
    declarations: [{
      type: "VariableDeclarator",
      id: { type: "Identifier", name: "exports" },
      init: exported,
    }]
  };
  const assignmentKuery = transpiler.kueryFromAst(variableDeclaration, options);
  const undefineDefault = {
    type: "AssignmentExpression",
    operator: "=",
    left: {
      type: "MemberExpression",
      object: { type: "Identifier", name: "exports" },
      property: { type: "Identifier", name: "default" },
      computed: false,
    },
    right: {
      type: "Literal",
      name: undefined
    }
  };
  const undefineDefaultKuery = transpiler.kueryFromAst(undefineDefault, options);
  return transpiler.VALK().add(assignmentKuery, undefineDefaultKuery);
}

function makeExportsAssignmentKuery (identifier, init, transpiler, options) {
  const assignment = {
    type: "AssignmentExpression",
    operator: "=",
    left: {
      type: "MemberExpression",
      object: { type: "Identifier", name: "exports" },
      property: { type: "Identifier", name: identifier },
      computed: false,
    },
    right: init,
  };

  return transpiler.kueryFromAst(assignment, options);
}
