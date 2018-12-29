const shared = require("@valos/toolset-vault/shared/.eslintrc");

module.exports = Object.assign({}, shared, {
  // Add overrides here
  // Stick to es5: current version of eslint doesn't seem to support all of es6.
  rules: Object.assign({}, shared.rules, {
    "react/forbid-prop-types": 0,
    "react/sort-comp": 0, // for some reason getters/setters are enabled, which is quite annoying
    "react/jsx-filename-extension": 0, // having a different extension gives little value, toolchain detects the JSX anyway
    "react/jsx-indent": 0, // tired of fighting against how the jsx-indent feels like it knows better
    "react/prefer-stateless-function": 0, // stateless/stateful change can happen: need to restructure is annoying and provides little value
    "jsx-a11y/no-static-element-interactions": 0,

    // ## 2018-12 Migration from eslint 3 to 5+ made several options stricter and
    // introduced a lot of new ones. Disable most and review later.
    "react/jsx-one-expression-per-line": 0,
    "react/destructuring-assignment": 0,
    "react/require-default-props": 0,
    "react/no-unused-prop-types": 0,
    "react/no-access-state-in-setstate": 0,
    "react/button-has-type": 0,
  }),
});
