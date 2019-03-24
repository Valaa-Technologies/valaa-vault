// @flow
import { GraphQLInterfaceType, GraphQLString } from "graphql/type";

import primaryField from "~/raem/tools/graphql/primaryField";
import Data, { dataInterface } from "~/raem/schema/Data";
import { dataTypeResolver } from "~/raem/tools/graphql/typeResolver";

const INTERFACE_DESCRIPTION = "tag";

export function tagInterface (/* objectDescription: string = INTERFACE_DESCRIPTION */) {
  return {
    name: "Tag",

    interfaces: () => [Data],

    fields: () => ({
      ...dataInterface(INTERFACE_DESCRIPTION).fields(),

      ...primaryField("tagURI", GraphQLString,
        // TODO(iridian): There are several questions here. First of all, the content id of the tag
        // could in fact be the canonical tag URI in principle and not the content hash.
        // To allow or not allow multiple schemes for a single tag? Pro: schema can be changed if
        // it turns out to be bad. Con: in principle a schema should be complete and never change.
        // Pro: alternative, more user-readable schemas can be introduced on the side.
        // Con: adds possibly useless complexity. Keeping the option open in principle, although
        // aiming to have ValOS Tags be unambiguous and directly string-comparable.
        `The tag URI as per https://tools.ietf.org/html/rfc4151. Tags never form a part
of the content id. This allows tag URI schemas to refer to the same Tag separately or internally
using different sub-schemas. The tag URI must be complete against the GraphQL schema that defines
it so that a fully expanded GraphQL Tag data object can be created from the URI.
ValOS schema tags are of the form tag://valaa.com,2017:dataType(:subType)/content where
dataType is the particular Tag data type string (such as Literal or Identifier) subType is an
additional optional qualifier for the dataType and content is in a format determined by the data
type. ValOS schema does not allow for sub-schemas and thus two ValOS tags are the same if and only
if they compare the same as per RFC (have same machine representation, ie. equal by typical string
comparison).`
      ),
    }),

    resolveType: dataTypeResolver,
  };
}

export default new GraphQLInterfaceType(tagInterface());
