// @flow

import { Action, isTransactedLike } from "~/raem/events";

import { dumpObject, wrapError } from "~/tools";

export default function extractChronicleEvent0Dot2 (chronicleURI: String, action: Action,
    excludeMetaless: ?boolean) {
  const meta = action.meta || action.local;
  if (!meta) return excludeMetaless ? undefined : action;
  const chronicles = meta.chronicles;
  if (chronicles && !chronicles[chronicleURI]) return undefined;
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
              chronicleURI, subAction, meta.chronicleURI !== chronicleURI))
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
    throw wrapError(error, 1,
        new Error(`During extractChronicleEvent0Dot2(${chronicleURI})`),
        "\n\taction:", ...dumpObject(action),
        "\n\taction chronicles:", ...dumpObject(chronicles),
        "\n\tcurrent ret:", ...dumpObject(ret),
    );
  }
}
