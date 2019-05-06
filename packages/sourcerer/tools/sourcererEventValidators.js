// @flow

import { validators as eventVersion0Dot2Validators } from "~/raem/events";
import eventVersion0Dot1Validators from "./event-version-0.1/validators0Dot1";

export default {
  ...eventVersion0Dot2Validators,
  0.1: eventVersion0Dot1Validators,
};
