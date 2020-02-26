// @flow

import { Action, isTransactedLike } from "~/raem/events";

import Connection from "~/sourcerer/api/Connection";

import { dumpObject } from "~/tools";

export default function extractChronicleEvent0Dot2 (connection: Connection, action: Action,
    excludeMetaless: ?boolean) {
  const meta = action.meta || action.local;
  if (!meta) return excludeMetaless ? undefined : action;
  const chronicles = meta.chronicles;
  if (chronicles && !chronicles[connection.getChronicleURI()]) return undefined;
  const ret = { ...action };
  try {
    delete ret.meta;
    delete ret.local;
    if (ret.aspects) ret.aspects = { ...ret.aspects };
    if (!chronicles) return ret;
    if (Object.keys(chronicles).length !== 1) {
      if (!isTransactedLike(action)) {
        throw new Error(`Non-TRANSACTED-like multi-chronicle command type ${
            action.type} not supported`);
      }
      if (action.type !== "TRANSACTED") {
        throw new Error(`Multi-chronicle ${action.type} not implemented`);
      }
    }
    if (action.actions) {
      ret.actions = action.actions
          .map(subAction => extractChronicleEvent0Dot2(
              connection, subAction, meta.chronicleURI !== connection.getChronicleURI()))
          .filter(notFalsy => notFalsy);
      if (!ret.actions.length) {
        throw new Error(`INTERNAL ERROR: No TRANSACTED.actions found for current chronicle ${
            ""}in a multi-chronicle TRANSACTED action`);
      }
      if ((ret.type === "TRANSACTED") && (ret.actions.length === 1)) {
        const simplifiedAction = ret.actions[0];
        delete ret.actions;
        Object.assign(ret, simplifiedAction);
      }
    }
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error, 1,
        new Error(`extractChronicleEvent0Dot2(${connection.getName()})`),
        "\n\taction:", ...dumpObject(action),
        "\n\taction chronicles:", ...dumpObject(chronicles),
        "\n\tcurrent ret:", ...dumpObject(ret),
    );
  }
}
