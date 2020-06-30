// @flow

import Lens, { descriptorOptions } from "~/inspire/ui/Lens";

export default function injectLensObjects (
    valos: Object, rootScope: Object, hostDescriptors: Object) {
  valos.Lens = Lens;
  const lensDescriptors = {};
  for (const [slotName, createLensParameters] of Object.entries(descriptorOptions)) {
    const { value, type, description, isEnabled, rootValue } = createLensParameters();
    const descriptor = {
      valos: true, symbol: true,
      value, type, description,
      writable: false, enumerable: true, configurable: false,
    };
    if (isEnabled !== undefined) {
      Object.assign(descriptor, { slotName: true, isEnabled });
    }
    lensDescriptors[slotName] = Object.freeze(descriptor);
    hostDescriptors.set(Lens[slotName], descriptor);
    if (rootValue) rootScope[Lens[slotName]] = Object.freeze(rootValue);
  }
  hostDescriptors.set(Lens, lensDescriptors);
  return Lens;
}
