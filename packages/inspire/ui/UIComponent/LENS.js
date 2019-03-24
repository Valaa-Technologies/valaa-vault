// @flow

import { wrapError } from "~/tools";

import type UIComponent from "./UIComponent";

/**
 * A template literal tag for referring to UI elements by name.
 *
 * Useful for forwarding UI mode implementations:
 * For example: <Valoscope activeLens={LENS`lensPropertyNotFoundLens`}> means that if activeLens is
 * requested the lensPropertyNotFoundLens implementation is used for it.
 *
 * @export
 * @param {string} lookupLensNames
 * @param {...any[]} directLenses
 * @returns
 */
export default function LENS (lookupLensNames: string[], ...directLenses: any[]) {
  return function lens (scope: any, component: UIComponent) {
    console.error("DEPRECATED: LENS`", lookupLensNames.join("..."), "`",
        "\n\tprefer: slot symbols found in valos.Lens.*");
    for (let i = 0; i !== lookupLensNames.length; ++i) {
      try {
        const lookedUpLens = lookupLensNames[i]
            && component.tryRenderSlotAsLens(lookupLensNames[i]);
        if (typeof lookedUpLens !== "undefined") return lookedUpLens;
        if (i < directLenses.length && typeof directLenses[i] !== "undefined") {
          return component.renderLens(directLenses[i], undefined, `LENS[i]`);
        }
      } catch (error) {
        throw wrapError(error,
            `During ${component.debugId()}\n .LENS, with:`,
            "\n\tlookupLensNames:", lookupLensNames,
            "\n\tdirectLenses:", directLenses,
            "\n\tcurrent index:", i);
      }
    }
    return null;
  };
}
