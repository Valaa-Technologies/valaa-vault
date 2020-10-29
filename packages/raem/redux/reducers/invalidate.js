// @flow
import Bard from "~/raem/redux/Bard";

export default function invalidate (bard: Bard) {
  bard.setPassages([]);
  return bard.state;
}
