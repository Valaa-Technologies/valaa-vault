const { extractee: { aggregate, blockquote, c, cpath, em, ref, strong } } = require("@valos/vdoc");

const { outputError } = require("@valos/tools/wrapError");

module.exports = {
  /**
   * Construct a revdoc:ABNF element.
   *
   * @param {*} text
   * @param {*} rest
   * @returns
   */
  example () {
    return {
      "@type": "revdoc:Example",
      "vdoc:content": [].slice.call(arguments), // eslint-disable-line prefer-rest-params
    };
  },

  /**
   * Construct a revdoc:ABNF element.
   *
   * @param {*} text
   * @param {*} rest
   * @returns
   */
  abnf (text) {
    // Add validation and maybe restructuring?
    return {
      // TODO(iridian, 2019-08): Figure out if there's any sense in
      // providing language identifiers for non-natural languages.
      ...c("https://tools.ietf.org/html/rfc5234", text),
      "@type": "revdoc:ABNF",
    };
  },

  /**
   * Construct a revdoc:JSONLD element.
   *
   * @param {*} text
   * @param {*} rest
   * @returns
   */
  jsonld (text) {
    // Add validation and maybe restructuring?
    return {
      // TODO(iridian, 2019-08): Figure out if there's any sense in
      // providing language identifiers for non-natural languages.
      ...c("https://www.w3.org/TR/json-ld11/", text),
      "@type": "revdoc:JSONLD",
    };
  },

  /**
   * Construct a revdoc:ABNF element.
   *
   * @param {*} text
   * @param {*} rest
   * @returns
   */
  turtle (text) {
    // Add validation and maybe restructuring?
    return {
      // TODO(iridian, 2019-08): Figure out if there's any sense in
      // providing language identifiers for non-natural languages.
      ...c("https://www.w3.org/TR/turtle/", text),
      "@type": "revdoc:Turtle",
    };
  },

  /**
   * Construct ReSpec authors section based on the @valos/type-vault
   * valma configuration of the current working directory.
   *
   * @param {*} authorNames
   * @returns
   */
  authors (...authorNames) {
    const toolsetsPath = `${process.cwd()}/toolsets.json`;
    const authorLookup = (((require(toolsetsPath)["@valos/type-vault"] || {})
        .tools || {}).docs || {}).authors || {};
    return (authorNames || []).map(authorName => {
      const author = authorLookup[authorName];
      if (!author) {
        throw new Error(`Cannot find author '${authorName}' from toolsetConfig("${
          toolsetsPath}")["@valos/type-vault"].tools.docs.authors`);
      }
      return author;
    });
  },

  /**
   * Construct revdoc:dfn element.
   *
   * @param {*} text
   * @param {*} definitionId
   * @param {*} explanation
   * @returns
   */
  dfn (text, definitionId, ...explanation) {
    return aggregate({
      "revdoc:dfn": definitionId,
      "vdoc:content": [strong(ref(text, definitionId))],
    }, "vdoc:content", ...explanation);
  },

  /**
   * Construct revdoc:Package reference element.
   *
   * @param {*} packageName
   * @param {*} rest
   * @returns
   */
  pkg (packageName, ...rest) {
    return {
      ...ref(em(packageName), packageName, ...rest),
      "@type": "revdoc:Package",
    };
  },

  /**
   * Construct revdoc:Command reference element.
   *
   * @param {*} packageName
   * @param {*} rest
   * @returns
   */
  command (commandName) {
    return {
      ...cpath(commandName),
      "@type": "revdoc:Command",
    };
  },

  /**
   * Construct revdoc:Invokation element.
   * Splits and spreads parts strings by whitespaces and if the first
   * part is a string wraps it in a revdoc:Command if it is a string.
   *
   *
   * @param {*} parts
   * @returns
   */
  invokation (...parts) {
    return {
      "@type": "revdoc:Invokation",
      "vdoc:words": [].concat(...parts.map(
              part => (typeof part !== "string" ? [part] : part.split(/(\s+)/))))
          .filter(w => (typeof w !== "string") || !w.match(/^\s+$/))
          .map((w, i) => ((i || typeof w !== "string") ? w : module.exports.command(w))),
    };
  },

  /**
   * Construct revdoc:CommandLineInteraction rows element.
   *
   * @param {*} rows
   * @returns
   */
  cli (...rows) {
    const commandedRows = rows.map(line => ((typeof line !== "string")
        ? line
        : module.exports.invokation(line)));
    let currentContext = "";
    const contextedRows = [];
    for (const row of commandedRows) {
      if ((row != null) && (row["@type"] === "vdoc:ContextBase")) {
        currentContext = row;
      } else {
        contextedRows.push([currentContext, "$ ", row]);
      }
    }
    return {
      "@type": "revdoc:CommandLineInteraction",
      "vdoc:entries": contextedRows,
    };
  },

  filterKeysWithAnyOf (entryFieldName, searchedValueOrValues = [], container) {
    return filterKeysWithFieldReduction(entryFieldName, searchedValueOrValues, container,
        (a, [field, searched]) => a || field.includes(searched));
  },

  filterKeysWithAllOf (entryFieldName, searchedValueOrValues = [], container) {
    return filterKeysWithFieldReduction(entryFieldName, searchedValueOrValues, container,
        (a, [field, searched]) => a && field.includes(searched), true);
  },

  filterKeysWithNoneOf (entryFieldName, searchedValueOrValues = [], container) {
    return filterKeysWithFieldReduction(entryFieldName, searchedValueOrValues, container,
        (a, [field, searched]) => a && !field.includes(searched), true);
  },

  valosRaemFieldClasses: [
    "valos-raem:Field",
    "valos-raem:ExpressedField", "valos-raem:EventLoggedField", "valos-raem:CoupledField",
    "valos-raem:GeneratedField", "valos-raem:TransientField", "valos-raem:AliasField",
  ],

  filterKeysWithFieldReduction,

  prepareTestDoc (title) {
    const tests = [];
    return {
      itExpects (named, operations, toSatisfy, result) {
        if (!named) return {};
        tests.push([named, operations, toSatisfy, result]);
        return {
          "dc:title": named,
          "#0": [
            ...[].concat(operations)
                .map(extractExampleText)
                .map((bodyText, index) => [index ? "via" : "we expect", blockquote(c(bodyText))]),
            toSatisfy,
            blockquote(c(extractExampleText(result))),
          ],
        };
      },
      runTestDoc () {
        if (typeof describe !== "undefined") {
          describe(`testdoc: ${title}`, () => {
            for (const [named, operations, toSatisfy, result] of tests) {
              it(named, async () => {
                try {
                  const actual = await [].concat(operations).reduce(async (a, op) => {
                    const ra = await a;
                    return op(typeof ra === "function" ? ra() : ra);
                  });
                  expect(typeof actual === "function" ? await actual() : actual)[toSatisfy](
                      typeof result === "function" ? await result() : result);
                } catch (error) {
                  outputError(error, `Exception noted while running testdoc test ${named}`);
                  throw error;
                }
              });
            }
          });
        }
      }
    };
  },

  extractExampleText,
};

function extractExampleText (example) {
  if (typeof example === "function") {
    const bodyText = example.toString();
    return bodyText.slice(
        Math.min(bodyText.indexOf("{") !== -1 ? bodyText.indexOf("{") : bodyText.length,
            bodyText.indexOf(">") !== -1 ? bodyText.indexOf(">") : bodyText.length) + 1,
        Math.max(bodyText.lastIndexOf("}"), bodyText.length));
  }
  return JSON.stringify(example, null, 2);
}

function filterKeysWithFieldReduction (entryFieldName, searchedValueOrValues, container,
    reduction, initial) {
  const searchedValues = [].concat(
      searchedValueOrValues !== undefined ? searchedValueOrValues : []);
  return Object.entries(container)
      .filter(([, entry]) => searchedValues
          .reduce((a, searchedValue) => reduction(a, [
            [].concat(entry[entryFieldName] !== undefined ? entry[entryFieldName] : []),
            searchedValue,
          ]), initial))
      .map(([key]) => key);
}
