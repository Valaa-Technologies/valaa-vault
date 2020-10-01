// @flow

const { symbols: Lens, declarations } = require("~/inspire/Lens");

export default function injectLensObjects (
    valos: Object, rootScope: Object, hostDescriptors: Object) {
  valos.Lens = Lens;
  const lensDescriptors = {};
  for (const [lensName, lensDefinition] of Object.entries(declarations)) {
    const { type, description, isEnabled, lens, defaultLens } = lensDefinition;
    const descriptor = {
      valos: true, symbol: true,
      value: lens, type, description,
      writable: false, enumerable: true, configurable: false,
    };
    if (isEnabled) {
      Object.assign(descriptor, { isSlotName: true, isEnabled, defaultLens });
    }
    lensDescriptors[lensName] = Object.freeze(descriptor);
    hostDescriptors.set(Lens[lensName], descriptor);
    if (defaultLens || lens) {
      rootScope[Lens[lensName]] = Object.freeze(defaultLens || lens);
    }
  }
  hostDescriptors.set(Lens, lensDescriptors);
  return Lens;
}
