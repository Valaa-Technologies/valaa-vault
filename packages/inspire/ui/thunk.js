export function unthunkRepeat (value, context) {
  return !isThunk(value) ? value : unthunkRepeat(value(context), context);
}

export function isThunk (candidate) {
  return (typeof candidate === "function") && !isReactComponent(candidate);
}

export function isReactComponent (candidate) {
  return candidate && candidate.$$typeof;
}
