// @flow

import Lens, { definitions } from "~/inspire/Lens";

export default function injectLensObjects (
    valos: Object, rootScope: Object, hostDescriptors: Object) {
  valos.Lens = Lens;
  const lensDescriptors = {};
  for (const [slotName, createLensParameters] of Object.entries(definitions)) {
    const { type, description, isEnabled, lens, defaultLens } = createLensParameters();
    const descriptor = {
      valos: true, symbol: true,
      value: lens, type, description,
      writable: false, enumerable: true, configurable: false,
    };
    if (isEnabled) {
      Object.assign(descriptor, { slotName: true, isEnabled, defaultLens });
    }
    lensDescriptors[slotName] = Object.freeze(descriptor);
    hostDescriptors.set(Lens[slotName], descriptor);
    if (defaultLens || lens) {
      rootScope[Lens[slotName]] = Object.freeze(defaultLens || lens);
    }
  }
  hostDescriptors.set(Lens, lensDescriptors);
  return Lens;
}
