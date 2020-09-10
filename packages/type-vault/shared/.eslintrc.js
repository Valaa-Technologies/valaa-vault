/* ValOS style guide moved to @valos/type-vault/template.vdon/STYLE.vdon.js */

module.exports = {
  "parser": "babel-eslint",
  "extends": "airbnb", // See major exceptions below.
  "parserOptions": {
    "ecmaVersion": 2018,
  },
  "env": {
    "browser": true,
    "node": true,
  },
  "globals": {
    "jest": "readable",
    "FEATURES": "readable",
    "describe": "readable",
    "it": "readable",
    "expect": "readable",
    "beforeEach": "readable",
    "afterEach": "readable",
    "beforeAll": "readable",
    "afterAll": "readable",
    "xit": "readable",
  },
  "plugins": [
    "flowtype",
  ],
  "settings": {
    "import/resolver": "babel-plugin-root-import",
    "flowtype": {
      "onlyFilesWithFlowAnnotation": true,
    },
  },
  "rules": {
    // ## Major exceptions to AirBnB style

    // These are the exceptions with larger impact and thus ones with
    // more thought and rationale.

    // We often use leading underscore for private methods/variables
    "no-underscore-dangle": [0],

    // Flow of a source file when read top-down should be top-down also
    // structurally: high level, entry point functions should be at the
    // top and their implementation detail functions below them. So we
    // allow calling of those implementation functions before they're
    // defined.
    "no-use-before-define": [0],

    // Double quotes are immediately compatible with hyphens (like
    // "it's'") which arguably are more common in human readable
    // strings. With es6 features available, template literals
    // (`foo ${myVariable}`) cover all other use cases and are a better
    // fit when generating code and other machine processed text.
    "quotes": [2, "double", {"avoidEscape": true, "allowTemplateLiterals": true}],

    // Differentiating call-sites and definition is useful for
    // non-content-aware searching.
    "space-before-function-paren": [2, "always"],

    "max-len": ["error", { "code": 100, "tabWidth": 2 }],

    // ## Minor exceptions to AirBnB style

    // These exceptions are more of convenience, might have weaker or
    // even obsolete reasons and thus are subject to change more easily.

    "arrow-parens": 0,
    "class-methods-use-this": 0,
    "comma-dangle": [0],
    "global-require": 0, // Some techniques require require (no pun intended)
    "new-cap": [0], // eslint doesn't recognize decorator mixins as classes
    "newline-per-chained-call": 0, // VALK kueries like .nullable() don't need newline
    "no-continue": 0,
    "no-console": [0], // 2 for prod, maybe?
    "no-nested-ternary": [0], // chaining ternaries for inline-switching while questionable is common in our codebase
    "no-param-reassign": [2, { "props": false }],
    "no-plusplus": 0,
    "no-prototype-builtins": 0, // We're using meta operations relatively commonly
    "no-loop-func": 0, // var is disallowed, so this is less of a problem.
    "no-inner-declarations": 0, // come on now... probably gonna move away from this preset
    "object-property-newline": 0,
    "one-var": 0, // 'let foo, bar, baz;' for pre-declaring variables outside try-blocks so that they are available for debug output in catch-blocks
    "one-var-declaration-per-line": 0, // same as above
    "prefer-arrow-callback": 0, // arrow functions don't have names which are useful with vdocorator

    "import/extensions": 0,
    "import/no-dynamic-require": 0, // Too many infrastructure tools use dynamic requires to warrant putting selective disables aroudn
    "import/no-extraneous-dependencies": 0,
    "import/no-unresolved": 0, // Doesn't work with "~/" root prefix replacement
    "import/prefer-default-export": 0, // lambda's and flow often necessitate a single named export
    "import/no-cycle": 0, // This is unacceptably disabled as it is an excellent flag, but there was too much to fix at once...

    // ## Warning directives

    "complexity": ["warn", 50],
    "no-warning-comments": ["warn", { "terms": ["fixme"], "location": "anywhere" }],

    // ## 2018-12 Migration from eslint 3 to 5+ made several options stricter and
    // introduced a lot of new ones. Disable most and review later.
    indent: "off",
    // "indent-legacy": "error",
    "object-curly-newline": 0,
    "no-await-in-loop": 0,
    "implicit-arrow-linebreak": 0,
    "no-return-assign": 0,
    "operator-linebreak": 0,
    "lines-between-class-members": 0,
    "prefer-destructuring": 0,
    "function-paren-newline": 0,
    "no-restricted-syntax": 0,
    "no-restricted-globals": 0,
    "no-multi-assign": 0, // An idiom where a lookup structure entry is set to a value and where
                          // a local variable is initialized at the same time is common in the
                          // codebase and feels more natural and readable using multi-assign
    "no-multi-spaces": 0, // Occasional comment left-alignment necessitates left-pad multi-spaces
  },
};
