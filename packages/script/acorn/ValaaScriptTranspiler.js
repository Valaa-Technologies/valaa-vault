// @flow

import { parse } from "acorn";
import type { Node } from "~/script/acorn/es5/grammar";

import { Kuery, dumpObject } from "~/raem/VALK";
import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";
import { isBuiltinStep, getBuiltinStepName, getBuiltinStepArguments }
    from "~/raem/VALK/builtinSteppers";

import Language from "~/script/acorn/Language";

import { invariantify, invariantifyObject, LogEventGenerator } from "~/tools";

export default class ValaaScriptTranspiler extends LogEventGenerator {
  language: Language;
  acornParseOptions: Object;

  constructor (language: Language, acornParseOptions: Object) {
    super({ name: language.name });
    invariantifyObject(language, "ValaaScriptTranspiler.language", { instanceOf: Language });
    invariantifyObject(acornParseOptions.VALK, "ValaaScriptTranspiler.language",
        { instanceOf: Kuery });
    this._VALK = acornParseOptions.VALK;
    this.language = language;
    this.acornParseOptions = { ...language.acornParseOptions, ...acornParseOptions };
  }

  VALK () { return this._VALK; }

  transpileKueryFromText (expressionText: string, options: Object = {}): Kuery {
    const actualTranspiler = Object.create(this);
    actualTranspiler._indent = options.verbosity || undefined;
    actualTranspiler._sourceInfo = options.sourceInfo;
    let ast;
    try {
      ast = parse(expressionText, actualTranspiler.acornParseOptions);
      const ret = actualTranspiler.kueryFromAst(ast);
      if (options.sourceInfo) ret[SourceInfoTag] = options.sourceInfo;
      return ret;
    } catch (error) {
      let errorText = expressionText;
      if (error.loc) {
        const sourceLines = expressionText.split("\n");
        const underline = `${" ".repeat(error.loc.column)}^^^`;
        errorText = sourceLines.slice(0, error.loc.line)
            .concat(underline)
            .concat(sourceLines.slice(error.loc.line)).join("\n");
        const parseDummy = {};
        actualTranspiler._sourceInfo.sourceMap.set(parseDummy, {
          loc: { start: error.loc },
        });
        addStackFrameToError(error, parseDummy, actualTranspiler._sourceInfo);
      }
      throw actualTranspiler.wrapErrorEvent(error, `transpileKueryFromText`,
          "\n\ttext:", { text: `\n${"```"}\n${errorText}\n${"```"}\n` },
          "\n\tast:", ...dumpObject(ast),
      );
    }
  }

  kueryFromAst (ast: Node, options: Object = { scope: {}, contextRuleOverrides: Object },
      type: string = ast.type) {
    const ret = this.parseAst(ast, options, type);
    if (ret && !(ret instanceof Kuery)) {
      throw this.parseError(ast, options,
          "kueryFromAst.ast must resolve to null or Kuery", "\n\tresolved to:", ret);
    }
    return ret;
  }

  modifierFromAst (ast: Node, options: Object = { scope: {}, contextRuleOverrides: Object },
      type: string = ast.type) {
    const ret = this.parseAst(ast, options, type);
    if (ret && (typeof ret !== "function")) {
      throw this.parseError(ast, options,
          "modifierFromAst.ast must resolve to a function", "\n\tresolved to:", ret);
    }
    return ret;
  }

  patternSettersFromAst (ast: Node, options: Object = { scope: {}, contextRuleOverrides: Object },
      type: string = ast.type) {
    const patternOptions = { ...options, leftSideRole: "pattern", };
    const ret = this.parseAst(ast, patternOptions, type);
    if (!Array.isArray(ret)) {
      throw this.parseError(ast, patternOptions,
          "patternSettersFromAst.ast must resolve to scopeSetters array",
          "\n\tresolved to:", ...dumpObject(ret));
    }
    return ret;
  }

  parseAst (ast: Node, options: Object = { scope: {}, contextRuleOverrides: Object },
      type: string) {
    let rule = options.contextRuleOverrides && options.contextRuleOverrides[`override${type}`];
    const indent = this._indent;
    let result;
    try {
      if (indent !== undefined) {
        this._indent += 2;
        this.log(`\n${" ".repeat(indent)}: ${type}, options:`, JSON.stringify(options, null, 0),
            ...(rule ? ["\n\tusing rule override:", rule.name] : []));
      }
      if (typeof rule === "undefined") {
        rule = this.language.parseRules[`parse${type}`];
        invariantify(typeof rule === "function",
            `ValaaScriptTranspiler(${this.language.name}).parseAst.ast.type '${type
                }' parse rule not found:`,
            "\n\tlanguage:", this.language,
            "\n\trules:", this.language.parseRules);
      }
      result = rule(this, ast, options);
      if ((result instanceof Kuery) && this._sourceInfo) {
        this._recurseToSourceMap(result.toVAKON(), ast, true);
      }
      return result;
    } catch (error) {
      const wrappedError = this.wrapErrorEvent(error, `parseFromAst(${type})`,
          "\n\tast:", ...dumpObject(ast),
          "\n\toptions:", ...dumpObject(options),
      );
      // If no sourceInfo, or the parse error stack already has an entry (user only cares about the
      // innermost transpilation error: no call stacks here), skip the rest
      if (!this._sourceInfo || wrappedError.sourceStackFrames) throw wrappedError;
      const sourceDummy = {};
      this._sourceInfo.sourceMap.set(sourceDummy, { ...ast });
      throw addStackFrameToError(wrappedError, sourceDummy, this._sourceInfo);
    } finally {
      if (indent !== undefined) {
        this.log(`\n${" ".repeat(indent)}: ${type}, result:`, JSON.stringify(result, null, 0));
      }
      this._indent = indent;
    }
  }

  _recurseToSourceMap (vakon: any, parentAst: Node, rootAst: boolean = false) {
    if (typeof vakon !== "object") return undefined;
    const entry = this._sourceInfo.sourceMap.get(vakon);
    if (entry) return entry;
    // Check if one and only one sub-entry has a source-info entry. If so, we expand it to be the
    // sourceinfo for this vakon and all its sub-entries. Otherwise we inherit our parent.
    const existingSubEntryAsts = Array.isArray(vakon)
        ? vakon.map(subVAKON => this._recurseToSourceMap(subVAKON, null))
            .filter(subEntry => !!subEntry)
        : [];
    const actualAst = rootAst || (existingSubEntryAsts.length !== 1)
        ? parentAst
        : existingSubEntryAsts[0];
    if (!parentAst) return actualAst; // This is just the pre-process run.
    this._sourceInfo.sourceMap.set(vakon, { ...actualAst });
    if (Array.isArray(vakon)) {
      vakon.forEach(subVAKON => this._recurseToSourceMap(subVAKON, actualAst));
    }
    return actualAst;
  }

  parseError (ast: Node, options: Object, msg: string, ...rest: ?any[]) {
    try {
      const expandedMsg = ast.loc ? `(${ast.loc.start.line}:${ast.loc.start.line}) ${msg}` : msg;
      const error = new Error(expandedMsg);
      error.loc = ast.loc
          ? { column: ast.loc.start.column, line: ast.loc.start.line }
          : { column: 0, line: 0 };
      throw error;
    } catch (error) {
      return this.wrapParseError(error, ast, options, ...rest);
    }
  }

  wrapParseError (error: Error, ast: Node, options: Object, ...rest) {
    return this.wrapErrorEvent(error, "parseError()",
        "\n\tast:", ...dumpObject(ast),
        "\n\noptions:", ...dumpObject(options),
        ...rest);
  }

  /**
   * This function flattens redundant nested VAKON statements into a singular "§@" expression.
   *
   * @param {...Kuery[]} statements
   * @returns
   *
   * @memberof ValaaScriptTranspiler
   */
  statements (...statements: Kuery[]) {
    // return this.VALK().doStatements(...statements);
    let statementVAKONs = [];
    /*
    this.logEvent("compressing statements:",
        ...statements.map(statement => `\n\t${beaumpify(statement.toVAKON())}`));
    */
    for (const statement of statements) {
      const statementVAKON = statement.toVAKON();
      if (isBuiltinStep(statementVAKON) && getBuiltinStepName(statementVAKON) === "§@") {
        statementVAKONs = statementVAKONs.concat(getBuiltinStepArguments(statementVAKON));
      } else if (Array.isArray(statementVAKON)) {
        const statementCount = statementVAKON.findIndex(
            (step) => !isBuiltinStep(step) || (getBuiltinStepName(step) !== "§@"));
        if (statementCount) {
          statementVAKONs.push(...[].concat(
              ...(statementCount === -1 ? statementVAKON : statementVAKON.slice(0, statementCount))
                  .map(step => step.slice(1))));
        }
        if (statementCount !== -1) {
          statementVAKONs.push(statementVAKON.slice(statementCount));
        }
      } else {
        statementVAKONs.push(statementVAKON);
      }
    }
    const ret = this.VALK().doStatements(
        ...statementVAKONs.map(vakon => this.VALK().fromVAKON(vakon)));
    /*
    this.logEvent("compressed statements:",
        ...statements.map(statement => `\n\t${beaumpify(statement.toVAKON())}`),
        "\n\tinto", ...statementVAKONs.map(statement => `\n\t${dumpify(statement)}`));
    */
    return ret;
  }

  createArgs (args: any, options: Object) {
    return args.map(arg => this.kueryFromAst(arg, options))
        .reduce((accum, val, index) => {
          accum[`$${index + 1}`] = val;
          return accum;
        }, {});
  }

  createControlBlock (customSelectors: ?Object = {}) {
    return this.VALK().object(customSelectors);
  }

  kueriesFromArray (args: any, options: Object) {
    return args.map(arg => this.kueryFromAst(arg, options));
  }

  argumentsFromArray (args: any, options: Object) {
    return args.map(arg => this.parseAst(arg, options, arg.type));
  }
}
