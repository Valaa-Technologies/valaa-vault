// @flow

import type Discourse from "./Discourse";

// Transactor will never have a full type, as it is a prototype
// inheritor from its base object. This allows the Transactor object to
// efficiently retain and expose the full API of the underlying
// Discourse object.
export type Transactor = Discourse & {

};
