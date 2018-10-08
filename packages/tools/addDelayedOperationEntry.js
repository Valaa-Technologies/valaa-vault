// @flow

export default function addDelayedOperationEntry (operation: Object, entry: any) {
  if (!operation.entries) {
    operation.entries = [];
    operation.results = new Promise(
        (resolve, reject) => { operation.resolve = resolve; operation.reject = reject; });
    operation.resolveWith = maybeThenable =>
        Promise.resolve(maybeThenable).then(operation.resolve, operation.reject);
  }
  const index = operation.entries.length;
  operation.entries.push(entry);
  return operation.results.then(values => values[index]);
}
