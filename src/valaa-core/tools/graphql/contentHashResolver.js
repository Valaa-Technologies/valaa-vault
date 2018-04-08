import { Map } from "immutable";
import valaaHash from "~/valaa-tools/id/valaaHash";

import { tryRawIdFrom } from "~/valaa-core/ValaaReference";
import dumpify from "~/valaa-tools/dumpify";

export default function contentHashResolver (source, { rootValue }) {
  try {
    // TODO(iridian): Promising v5 uuid, so implement it as such.
    const id = tryRawIdFrom(source.get("id"));
    return id || valaaHash(source.toJS(), {
      // Replace direct references to objects with their id's
      replacer: value => (Map.isMap(value) ? contentHashResolver(value) : value),
    });
  } catch (error) {
    const suggestion = error.message.slice(0, 10) !== "source.get" ? "" : `
  Is this a mutation resolver? If so, remember to wrap resolver in mutationResolver.`;
    rootValue.logger.error(`During contentHashResolver from source: ${dumpify(source, 1000, "...}")}
  forwarding exception: ${error.message.slice(0, 140)}...${suggestion}`);
    throw error;
  }
}
