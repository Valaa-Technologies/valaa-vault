Object.defineProperty(exports, "__esModule", { value: true });

exports.default = function inProduction () {
  return process.env.NODE_ENV === "production";
};
