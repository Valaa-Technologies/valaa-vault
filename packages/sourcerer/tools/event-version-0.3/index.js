export const EVENT_VERSION = "0.3";
export function encodeVPlotValue (value) {
  return encodeURIComponent(value)
      .replace(/[%!'()*]/g, c => (c === "%" ? "'" : `'${c.charCodeAt(0).toString(16)}`));
}

export function decodeVPlotValue (value) {
  return value.replace(/'/g, "%").decodeURIComponent(value);
}

