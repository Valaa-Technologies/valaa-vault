// @flow

import { parse } from "acorn";
import type { Node } from "~/script/acorn/es5/grammar";

import { Kuery, dumpObject } from "~/raem/VALK";
import {
  getSourceEntryInfo, addSourceEntryInfo, addStackFrameToError, SourceInfoTag,
} from "~/raem/VALK/StackTrace";
import { isBuiltinStep, getBuiltinStepName, getBuiltinStepArguments }
    from "~/raem/VALK/raemSteppers";

import Language from "~/script/acorn/Language";

import { invariantify, invariantifyObject, isSymbol, FabricEventTarget } from "~/tools";

export default class ValoscriptTranspiler extends FabricEventTarget {
  language: Language;
  acornParseOptions: Object;

  constructor (parent: FabricEventTarget, language: Language, acornParseOptions: Object) {
    super(parent, 1, language.name);
    invariantifyObject(language, "ValoscriptTranspiler.language", { instanceOf: Language });
    invariantifyObject(acornParseOptions.VALK, "ValoscriptTranspiler.language",
        { instanceOf: Kuery });
    this._VALK = acornParseOptions.VALK;
    this.language = language;
    this.acornParseOptions = { ...language.acornParseOptions, ...acornParseOptions };
  }

  VALK () { return this._VALK; }

  transpileKueryFromText (source: string, options: Object = {}): Kuery {
    const actualTranspiler = Object.create(this);
    actualTranspiler._indent = options.verbosity || undefined;
    actualTranspiler._sourceInfo = options.sourceInfo;
    let ast;
    const cache = options.cache;
    try {
      let cacheEntry = (cache || {}).bySourceText && cache.bySourceText[source];
      if (!cacheEntry) {
        ast = parse(source, actualTranspiler.acornParseOptions);
        const scopeAccesses = {};
        const kuery = actualTranspiler
            .kueryFromAst(ast, { scopeAccesses, contextRuleOverrides: {} })
            .setScopeAccesses(scopeAccesses);
        if (options.sourceInfo) kuery[SourceInfoTag] = options.sourceInfo;
        if (!cache) return kuery;

        const kueryText = JSON.stringify(kuery.toVAKON(),
            (key, value) => (isSymbol(value) ? String(value) : value), 0);
        cacheEntry = cache.byKueryText && cache.byKueryText[kueryText];
        if (!cacheEntry) {
          cacheEntry = {
            kuery, sourceMap: (options.sourceInfo || {}).sourceMap, refCount: 0,
          };
          (cache.byKueryText || (cache.byKueryText = {}))[kueryText] = cacheEntry;
        } else if (options.sourceInfo) {
          // Distinct source but identical semantic content. Reuse
          // the cached kuery to allow deduplication of live kuery
          // subscriptions with identical semantics. A new sourceMap
          // is needed with keys of the cached kuery but values of
          // the freshly parsed kuery sourceMap entries (whose locs
          // correspond to the fresh file).
          options.sourceInfo.sourceMap = _combineSourceMap(new Map(),
              cacheEntry.kuery.toVAKON(), kuery.toVAKON(), options.sourceInfo.sourceMap);
        }
        (cache.bySourceText || (cache.bySourceText = {}))[source] = cacheEntry;
      } else if (options.sourceInfo) {
        // Exact source match can reuse the sourceInfo directly as
        // line/columns match straight up. Only need to extend the
        // cached kuery with the new sourceInfo as it might have
        // different file name etc.
        options.sourceInfo.sourceMap = cacheEntry.sourceMap;
      }
      ++cacheEntry.refCount;
      if (!options.sourceInfo) return cacheEntry.kuery;
      const wrappedKuery = Object.create(cacheEntry.kuery);
      wrappedKuery[SourceInfoTag] = options.sourceInfo;
      options.sourceInfo.cacheEntry = cacheEntry;
      return wrappedKuery;
    } catch (error) {
      let errorText = source;
      if (error.loc) {
        const sourceLines = source.split("\n");
        const underline = `${" ".repeat(error.loc.column)}^^^`;
        errorText = sourceLines.slice(0, error.loc.line)
            .concat(underline)
            .concat(sourceLines.slice(error.loc.line)).join("\n");
        const sourceInfo = actualTranspiler._sourceInfo;
        if (sourceInfo) {
          addStackFrameToError(error,
              addSourceEntryInfo(sourceInfo, {}, { loc: { start: error.loc } }),
              sourceInfo);
        }
      }
      throw actualTranspiler.wrapErrorEvent(error, 1, `transpileKueryFromText`,
          "\n\ttext:", `\n${"```"}\n${errorText}\n${"```"}\n`,
          "\n\tast:", ...dumpObject(ast),
      );
    }
    function _combineSourceMap (targetSourceMap, kuery, origin, originSourceMap) {
      if (kuery && (typeof kuery === "object") && origin && (typeof origin === "object")) {
        const originEntry = originSourceMap.get(origin);
        if (originEntry) targetSourceMap.set(kuery, originEntry);
        Object.entries(kuery).forEach(([key, kueryEntry]) =>
            _combineSourceMap(targetSourceMap, kueryEntry, origin[key], originSourceMap));
      }
      return targetSourceMap;
    }
  }

  kueryFromAst (ast: Node, options: Object, type: string = ast.type) {
    if (!options) throw new Error("kueryFromAst.options missing");
    const ret = this.parseAst(ast, options, type);
    if (ret && !(ret instanceof Kuery)) {
      throw this.parseError(ast, options,
          "kueryFromAst.ast must resolve to null or Kuery", "\n\tresolved to:", ret);
    }
    return ret;
  }

  modifierFromAst (ast: Node, options: Object, type: string = ast.type) {
    if (!options) throw new Error("modifierFromAst.options missing");
    const ret = this.parseAst(ast, options, type);
    if (ret && (typeof ret !== "function")) {
      throw this.parseError(ast, options,
          "modifierFromAst.ast must resolve to a function", "\n\tresolved to:", ret);
    }
    return ret;
  }

  patternSettersFromAst (ast: Node, options: Object, type: string = ast.type) {
    if (!options) throw new Error("patternSettersFromAst.options missing");
    const patternOptions = { ...options, leftSideRole: "pattern", };
    const ret = this.parseAst(ast, patternOptions, type);
    if (!Array.isArray(ret)) {
      throw this.parseError(ast, patternOptions,
          "patternSettersFromAst.ast must resolve to scopeSetters array",
          "\n\tresolved to:", ...dumpObject(ret));
    }
    return ret;
  }

  parseAst (ast: Node, options: Object = { scopeAccesses: {}, contextRuleOverrides: {} },
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
      if (rule === undefined) {
        rule = this.language.parseRules[`parse${type}`];
        invariantify(typeof rule === "function",
            `ValoscriptTranspiler(${this.language.name}).parseAst.ast.type '${type
                }' parse rule not found:`,
            "\n\tlanguage:", this.language,
            "\n\trules:", this.language.parseRules);
      }
      result = rule(this, ast, options);
      if (this._sourceInfo) {
        if (result instanceof Kuery) {
          this.addSourceKueryInfo(result, ast);
        } else if (Array.isArray(result)) {
          for (const entry of result) {
            if (entry[0] instanceof Kuery) this.addSourceKueryInfo(entry[0], ast);
            if (entry[1] instanceof Kuery) this.addSourceKueryInfo(entry[1], ast);
          }
        }
      }
      return result;
    } catch (error) {
      const wrappedError = this.wrapErrorEvent(error, 1, `parseFromAst(${type})`,
          "\n\tast:", ...dumpObject(ast),
          "\n\toptions:", ...dumpObject(options),
      );
      // If no sourceInfo, or the parse error stack already has an entry (user only cares about the
      // innermost transpilation error: no call stacks here), skip the rest
      if (!this._sourceInfo || wrappedError.sourceStackFrames) throw wrappedError;
      throw addStackFrameToError(wrappedError,
          addSourceEntryInfo(this._sourceInfo, {}, { ...ast }),
          this._sourceInfo);
    } finally {
      if (indent !== undefined) {
        this.log(`\n${" ".repeat(indent)}: ${type}, result:`, JSON.stringify(result, null, 0));
      }
      this._indent = indent;
    }
  }

  addSourceKueryInfo (kuery: Kuery, ast) {
    return this._recurseToSourceMap(kuery.toVAKON(), ast, true);
  }

  _recurseToSourceMap (vakon: any, parentAst: Node, rootAst: boolean) {
    if (typeof vakon !== "object") return undefined;
    const entry = getSourceEntryInfo(this._sourceInfo, vakon);
    if (entry) return entry;
    // Check if one and only one sub-entry has a source-info entry. If
    // so, we expand it to be the sourceinfo for this vakon and all its
    // sub-entries. Otherwise we inherit our parent.
    const existingSubEntryAsts = Array.isArray(vakon)
        ? vakon.map(subVAKON => this._recurseToSourceMap(subVAKON, null, false))
            .filter(subEntry => !!subEntry)
        : [];
    const actualAst = rootAst || (existingSubEntryAsts.length !== 1)
        ? parentAst
        : existingSubEntryAsts[0];
    if (!parentAst) return actualAst; // This is just the pre-process run.
    addSourceEntryInfo(this._sourceInfo, vakon, { ...actualAst });
    if (Array.isArray(vakon)) {
      vakon.forEach(subVAKON => this._recurseToSourceMap(subVAKON, actualAst, false));
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
    return this.wrapErrorEvent(error, 1, "parseError()",
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
   * @memberof ValoscriptTranspiler
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

  addScopeAccess (scopeAccesses: Object, name: string, type: string) {
    const currentType = scopeAccesses[name];
    if (!currentType
        || (currentType === "read")
        || ((currentType === "modify") && (type !== "read"))
        || ((type !== "read") && (type !== "modify"))) {
      scopeAccesses[name] = type;
    }
  }

  exposeOuterScopeAccesses (innerScopeAccesses, outerScopeAccesses) {
    Object.entries(innerScopeAccesses).forEach(([name, type]) => {
      if ((type === "read") || (type === "modify")) {
        this.addScopeAccess(outerScopeAccesses, name, type);
      }
    });
  }
}
