module.exports = function configureBabel (api, rootPrefix) {
  if (api) {
    api.cache(false);
  }

  const ret = {
    ignore: ["node_modules/**/*"],
    presets: [
      "@babel/preset-env",
      "@babel/preset-react",
    ],
    plugins: [
      ["@babel/plugin-transform-runtime", {
        // There is a bug with babel 7.0.0-beta.49: https://github.com/babel/babel/issues/8061
        helpers: false,
        // regenerator:true would remove global.regeneratorRuntime which some libraries need
        // (notably: indexeddbshim)
        regenerator: false,
      }],
      ["babel-plugin-root-import", { rootPathSuffix: "packages" }],

      // This MUST come before proposal-class-properties. Otherwise places which use hasOwnProperty
      // to test for presence of cached values will break: class-properties will interpret flow
      // type as instruction to initialize variables to undefined.
      "@babel/plugin-transform-flow-strip-types",

      // Stage 0

      // "@babel/plugin-proposal-function-bind",

      // Stage 1

      // export ns from / export default from
      "@babel/plugin-proposal-export-default-from",

      // foo ||= bar ~== (foo = (foo || bar))
      // "@babel/plugin-proposal-logical-assignment-operators",

      // foo?.bar ~== (foo || {}).bar - This would be soo useful but isn't used atm.
      // ["@babel/plugin-proposal-optional-chaining", { loose: false }],

      // value |> unaryCallback |> anotherCallback ~== anotherCallback(unaryCallback(value))
      // ["@babel/plugin-proposal-pipeline-operator", { proposal: "minimal" }],

      // foo ?? "if-nullish" ~== (foo != null) ? foo : "if-nullish"
      // ["@babel/plugin-proposal-nullish-coalescing-operator", { loose: false }],

      // do { if (x > 10) "big" else "small" } ~== (x > 10 ? "big" : "small")
      // "@babel/plugin-proposal-do-expressions",

      // Stage 2

      ["@babel/plugin-proposal-decorators", { legacy: true }],

      // Generator sent syntax
      // "@babel/plugin-proposal-function-sent",

      // export * as ns from
      // "@babel/plugin-proposal-export-namespace-from",

      // 1_000_000
      // "@babel/plugin-proposal-numeric-separator",

      // foo || (throw new Error ("falsy!"))
      // "@babel/plugin-proposal-throw-expressions",

      // Stage 3

      // import()
      // "@babel/plugin-syntax-dynamic-import",

      // "@babel/plugin-syntax-import-meta",
      ["@babel/plugin-proposal-class-properties", { loose: false }],

      // line separators etc. inside regular "" strings
      // "@babel/plugin-proposal-json-strings"
    ],
  };
  if (process.env.TARGET_ENV === "package-assemble") {
    ret.plugins = ret.plugins.filter(plugin => (plugin[0] !== "babel-plugin-root-import"));
    ret.plugins.push(["module-resolver", { root: ["./packages"], alias: { "~": rootPrefix } }]);
  }
  return ret;
};
