// During babel 7 beta, some tools read .babelrs.js and some babel.config.js, so we need to provide
// both; .babelrc.js is the deprecated one which forwards to babel.config.js.
module.exports = require("./babel.config")();
