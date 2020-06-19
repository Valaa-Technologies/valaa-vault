// @flow

import Vrapper from "~/engine/Vrapper";

export default function getImplicitMediaInterpretation (candidate: any, opName: string,
    options: any) {
  if (!(candidate instanceof Vrapper)) return candidate;
  if (options && options.deprecated) {
    const candidateName = candidate.step("name", Object.create(options));
    console.debug("DEPRECATED: implicit media interpretation when performing", opName, "against",
        `'${candidateName}'`,
        "\n\tprefer: explicit media interpretation");
  }
  const actualOptions = options || {};
  if (!actualOptions.hasOwnProperty("synchronous")) actualOptions.synchronous = true;
  return candidate.extractValue(actualOptions);
}
