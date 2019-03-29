// @flow

Object.defineProperty(exports, "__esModule", { value: true });

exports.default = function isPromise (promiseCandidate: any) {
  return (promiseCandidate != null) && (promiseCandidate.then !== undefined)
      && (Promise.resolve(promiseCandidate) === promiseCandidate);
};
