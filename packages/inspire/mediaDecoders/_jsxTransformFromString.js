/*!
 * This is content extracted from the library jsx-transform version 2.3.0 at
 * https://github.com/alexmingoia/jsx-transform/tree/fd91bd38a2f6be9ff47178399e3f2f69ed4a1964.
 *
 * As this version is denoted with license "BSD Licensed" with package.json licence being 0BSD and
 * nothing else, it is understood to refer to the quite permissive
 * https://spdx.org/licenses/0BSD.html or "BSD Zero Clause License".
 *
 * The library is stripped for the needs of ValOS VSX and JSX
 * transpilation and linted with ValOS style.
 */

import { transform as jstransform, Syntax } from "jstransform";
import utils from "jstransform/src/utils";

/**
 * Desugar JSX and return transformed string.
 *
 * @example
 *
 * ```javascript
 * var jsx = require('jsx-transform');
 *
 * jsx.fromString('<h1>Hello World</h1>', {
 *   factory: 'mercury.h'
 * });
 * // => 'mercury.h("h1", null, ["Hello World"])'
 * ```
 *
 * @param {String} str
 * @param {Object=} options
 * @param {String} options.factory Factory function name for element creation.
 * @param {String=} options.spreadFn Name of function for use with spread
 * attributes (default: Object.assign).
 * @param {String=} options.unknownTagPattern uses given pattern for unknown
 * tags where `{tag}` is replaced by the tag name. Useful for rending mercury
 * components as `Component.render()` instead of `Component()`.
 * @param {Boolean=} options.passUnknownTagsToFactory Handle unknown tags
 * like known tags, and pass them as an object to `options.factory`. If
 * true, `createElement(Component)` instead of `Component()` (default: false).
 * @param {Boolean=} options.unknownTagsAsString Pass unknown tags as string
 * to `options.factory` (default: false).
 * @param {Boolean=} options.arrayChildren Pass children as array instead of
 * arguments (default: true).
 * @param {Function=} options.transformExpressionText callback for transforming expression content
 * text blocks. First parameter is text, second parameter is { line, column } (default: undefined).
 * @returns {String}
 */
export default function jsxTransformFromString (str, options) {
  const transformed = jstransform([visitNode], str, processOptions(options)).code;
  return trimTrailingSpaces(transformed);
}

function trimTrailingSpaces (val) {
  return val.replace(/[^\S\r\n]+$/gm, "");
}

function processOptions (options) {
  let ret = options;
  if (typeof ret !== "object") {
    ret = {};
  }

  if (typeof ret.factory !== "string") {
    throw new Error("Missing options.factory function name.");
  }

  // parses the file as an ES6 module, except disabled implicit strict-mode
  if (typeof ret.sourceType === "undefined") {
    ret.sourceType = "nonStrictModule";
  }

  // defaults to true to keep existing behaviour (but inconsietent with babel and react-tools)
  if (typeof ret.arrayChildren === "undefined") {
    ret.arrayChildren = true;
  }

  if (typeof ret.spreadFn !== "string") {
    ret.spreadFn = "Object.assign";
  }

  if (typeof ret.unknownTagPattern !== "string") {
    ret.unknownTagPattern = "{tag}";
  }

  return ret;
}

/**
 * Visit tag node and desugar JSX.
 *
 * @see {@link https://github.com/facebook/jstransform}
 * @param {Function} traverse
 * @param {Object} object
 * @param {String} path
 * @param {Object} state
 * @returns {Boolean}
 * @private
 */
function visitNode (traverse, object, path, state) {
  const options = state.g.opts;
  const factory = (options.factory);
  const arrayChildren = options.arrayChildren;
  const openingEl = object.openingElement;
  const closingEl = object.closingElement;
  const nameObj = openingEl.name;
  const attributes = openingEl.attributes;
  const spreadFn = options.spreadFn;
  const unknownTagPattern = options.unknownTagPattern;

  if (options.transformExpressionText && !state.g.sourceMap) {
    state.g.sourceMap = { addMapping () {} };
  }

  if (!options.renameAttrs) {
    options.renameAttrs = {};
  }

  utils.catchup(openingEl.range[0], state, trimLeft);

  let tagName = nameObj.name;
  const isJSXIdentifier = nameObj.type === Syntax.JSXIdentifier;
  const knownTag = tagName[0] !== tagName[0].toUpperCase() && isJSXIdentifier;
  const hasAtLeastOneSpreadAttribute = attributes.some(
      attr => attr.type === Syntax.JSXSpreadAttribute);
  let secondArg = false;

  if (knownTag) {
    utils.append(`${factory}('`, state); // DOM('div', ...)
  } else if (options.passUnknownTagsToFactory) {
    if (options.unknownTagsAsString) {
      utils.append(`${factory}('`, state);
    } else {
      utils.append(`${factory}(`, state);
    }
  }

  utils.move(nameObj.range[0], state);

  if (knownTag) {
    // DOM('div', ...)
    utils.catchup(nameObj.range[1], state);
    utils.append("'", state);
    secondArg = true;
  } else if (options.passUnknownTagsToFactory) {
    // DOM(Component, ...)
    utils.catchup(nameObj.range[1], state);
    if (options.unknownTagsAsString) {
      utils.append("'", state);
    }
    secondArg = true;
  } else {
    // Component(...)
    tagName = unknownTagPattern.replace("{tag}", nameObj.name);
    utils.append(tagName, state);
    utils.move(
      nameObj.range[1] + (tagName.length - nameObj.name.length),
      state
    );
    utils.append("(", state);
  }

  if (hasAtLeastOneSpreadAttribute) {
    if (options.passUnknownTagsToFactory || knownTag) {
      utils.append(`, ${spreadFn}({`, state);
    } else {
      utils.append(`${spreadFn}({`, state);
    }
  } else if (attributes.length) {
    if (secondArg) {
      utils.append(", ", state);
    }
    utils.append("{", state);
  }

  let previousWasSpread = false;

  attributes.forEach((attr, index) => {
    let isLast = (index === (attributes.length - 1));

    if (attr.type === Syntax.JSXSpreadAttribute) {
      // close the previous or initial object
      if (!previousWasSpread) {
        utils.append("}, ", state);
      }

      // Move to the expression start, ignoring everything except parenthesis
      // and whitespace.
      utils.catchup(attr.range[0], state, stripNonParen);
      // Plus 1 to skip `{`.
      utils.move(attr.range[0] + 1, state);
      utils.catchup(attr.argument.range[0], state, stripNonParen);

      traverse(attr.argument, path, state);

      utils.catchup(attr.argument.range[1], state);

      // Move to the end, ignoring parenthesis and the closing `}`
      utils.catchup(attr.range[1] - 1, state, stripNonParen);

      if (!isLast) {
        utils.append(", ", state);
      }

      utils.move(attr.range[1], state);

      previousWasSpread = true;

      return;
    }

    // If the next attribute is a spread, we're effective last in this object
    if (!isLast) {
      isLast = attributes[index + 1].type === Syntax.JSXSpreadAttribute;
    }

    /* JSX does not support namespace attributes but VSX does
    if (attr.name.namespace) {
      throw new Error(
        "Namespace attributes not supported. JSX is not XML."
      );
    }
    */
    const name = !attr.name.namespace
        ? attr.name.name
        : `$${attr.name.namespace.name}:${attr.name.name.name}`;

    utils.catchup(attr.range[0], state, trimLeft);

    if (previousWasSpread) {
      utils.append("{", state);
    }

    utils.append(`${quoteJSObjKey(name)}: `, state);

    if (attr.value) {
      utils.move(attr.name.range[1], state);
      utils.catchupNewlines(attr.value.range[0], state);
      if (attr.value.type === Syntax.Literal) {
        renderJSXLiteral(attr.value, isLast, state);
      } else {
        renderJSXExpressionContainer(traverse, attr.value, isLast, path, state);
      }
    } else {
      state.g.buffer += "true";
      state.g.position = attr.name.range[1];
      if (!isLast) {
        utils.append(", ", state);
      }
    }

    utils.catchup(attr.range[1], state, trimLeft);

    previousWasSpread = false;
  });

  if (!openingEl.selfClosing) {
    utils.catchup(openingEl.range[1] - 1, state, trimLeft);
    utils.move(openingEl.range[1], state);
  }

  if (attributes.length && !previousWasSpread) {
    utils.append("}", state);
  }

  if (hasAtLeastOneSpreadAttribute) {
    utils.append(")", state);
  }

  const children = object.children;
  let lastRenderableIndex;
  if (children.length) {
    if (!attributes.length) {
      if (secondArg) {
        utils.append(", ", state);
      }
      utils.append("null", state);
    }

    children.forEach((child, index) => {
      if (child.type !== Syntax.JSXExpressionContainer ||
        child.expression.type !== Syntax.JSXEmptyExpression) {
        lastRenderableIndex = index;
      }
    });

    if (lastRenderableIndex !== undefined) {
      utils.append(", ", state);
    }

    if (arrayChildren && (lastRenderableIndex !== undefined)) {
      utils.append("[", state);
    }

    children.forEach((child, index) => {
      utils.catchup(child.range[0], state, trimLeft);

      // const isFirst = index === 0;
      const isLast = index >= lastRenderableIndex;

      if (child.type === Syntax.Literal) {
        renderJSXLiteral(child, isLast, state);
      } else if (child.type === Syntax.JSXExpressionContainer) {
        renderJSXExpressionContainer(traverse, child, isLast, path, state);
      } else {
        traverse(child, path, state);
        if (!isLast) {
          utils.append(",", state);
        }
      }

      utils.catchup(child.range[1], state, trimLeft);
    });
  }

  if (openingEl.selfClosing) {
    // everything up to />
    utils.catchup(openingEl.range[1] - 2, state, trimLeft);
    utils.move(openingEl.range[1], state);
  } else {
    // everything up to </close>
    utils.catchup(closingEl.range[0], state, trimLeft);
    utils.move(closingEl.range[1], state);
  }

  if (arrayChildren && (lastRenderableIndex !== undefined)) {
    utils.append("]", state);
  }

  utils.append(")", state);

  return false;
}

/**
 * Returns true if node is JSX tag.
 *
 * @param {Object} object
 * @param {String} path
 * @param {Object} state
 * @returns {Boolean}
 * @private
 */
visitNode.test = (object/* , path, state */) => object.type === Syntax.JSXElement;

/* eslint-disable max-len */
/**
 * Taken from {@link https://github.com/facebook/react/blob/0.10-stable/vendor/fbtransform/transforms/xjs.js}
 *
 * @param {Object} object
 * @param {Boolean} isLast
 * @param {Object} state
 * @param {Number} start
 * @param {Number} end
 * @private
 */
function renderJSXLiteral (object, isLast, state) {
  /* eslint-enable max-len */
  const tokens = object.value.split(/[ \t\r\n]+/);
  if (!tokens[0] && !tokens[1]) {
    if (tokens.length === 2) {
      utils.append("' '", state);
      if (!isLast) utils.append(", ", state);
    } else if (isLast) utils.append("''", state);
  } else {
    utils.append(JSON.stringify(tokens.join(" ")), state);
    if (!isLast) utils.append(", ", state);
  }
  utils.move(object.range[1], state);
}

/* eslint-disable max-len */
/**
 * Taken from {@link https://github.com/facebook/react/blob/0.10-stable/vendor/fbtransform/transforms/xjs.js}
 *
 * @param {Function} traverse
 * @param {Object} object
 * @param {Boolean} isLast
 * @param {String} path
 * @param {Object} state
 * @returns {Boolean}
 * @private
 */
function renderJSXExpressionContainer (traverse, object, isLast, path, state) {
  /* eslint-enable max-len */
  // Plus 1 to skip `{`.
  utils.move(object.range[0] + 1, state);

  const expressionBufferBegin = state.g.buffer.length;
  const line = state.g.sourceLine;
  const column = state.g.sourceColumn;

  traverse(object.expression, path, state);

  if (!isLast && object.expression.type !== Syntax.JSXEmptyExpression) {
    // If we need to append a comma, make sure to do so after the expression.
    utils.catchup(object.expression.range[1], state, trimLeft);
  }

  // Minus 1 to skip `}`.
  utils.catchup(object.range[1] - 1, state, trimLeft);
  utils.move(object.range[1], state);

  if (state.g.opts.transformExpressionText
      && (object.expression.type !== Syntax.JSXEmptyExpression)) {
    const text = state.g.buffer.slice(expressionBufferBegin);
    state.g.buffer = state.g.buffer.slice(0, expressionBufferBegin)
        + state.g.opts.transformExpressionText(text,
            { line, column },
            { line: state.g.sourceLine, column: state.g.sourceColumn });
  }

  if (!isLast && object.expression.type !== Syntax.JSXEmptyExpression) {
    utils.append(", ", state);
  }

  return false;
}

/**
 * Quote invalid object literal keys.
 *
 * @param {String} name
 * @returns {String}
 * @private
 */
function quoteJSObjKey (name) {
  if (!/^[a-z_$][a-z\d_$]*$/i.test(name)) {
    return `'${name}'`;
  }
  return name;
}

/**
 * Trim whitespace left of `val`.
 *
 * @param {String} val
 * @returns {String}
 * @private
 */
function trimLeft (val) {
  return val.replace(/^ +/, "");
}

/**
 * Removes all non-parenthesis characters
 */
const reNonParen = /([^()])/g;

function stripNonParen (value) {
  return value.replace(reNonParen, "");
}
