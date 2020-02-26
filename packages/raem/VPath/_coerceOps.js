const { validateVRID } = require("./_validateOps");

const _uuidv4Regex = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

const _migrateLookup = {};

export function coerceAsVRID (rawId) {
  let ret = _migrateLookup[rawId];
  if (!ret) {
    if (rawId[0] === "@") ret = validateVRID(rawId);
    else if (!rawId) ret = "@@";
    else {
      let gridType;
      let [gridValue, subPath] = rawId.split("/.:");
      subPath = subPath ? `.:${subPath}@` : "";
      if ((gridValue.length === 36) && gridValue.match(_uuidv4Regex)) {
        gridType = "u4";
      } else if (gridValue.length === 40) {
        gridType = "cih";
      } else if (gridValue.length === 128) {
        gridType = "bvob";
      } else {
        gridType = "raw";
        gridValue = encodeURIComponent(gridValue);
      }
      ret = `@$~${gridType}:${gridValue}@${subPath}@`;
    }
    _migrateLookup[rawId] = ret;
  }
  return ret;
}
