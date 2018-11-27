// @flow
import Bard from "~/raem/redux/Bard";

export default function freeze (bard: Bard) {
  bard.setPassages((bard.passage.actions || [])
      .map(action => bard.createPassageFromAction(action)));
  return bard.state;
}
