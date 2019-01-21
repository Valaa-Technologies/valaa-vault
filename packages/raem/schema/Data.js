// @flow
import { GraphQLInterfaceType, GraphQLID, GraphQLNonNull, GraphQLString } from "graphql/type";
import generatedField from "~/raem/tools/graphql/generatedField";
import contentHashResolver from "~/raem/tools/graphql/contentHashResolver";
import { dataTypeResolver } from "~/raem/tools/graphql/typeResolver";
import dataFieldValue from "~/raem/tools/denormalized/dataFieldValue";

const INTERFACE_DESCRIPTION = "data";

// TODO(iridian): Implement Data referentiality by Decree that Data objects with Resource
// references must always have an id. See below for more.

export function dataInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Data",

    description: `A transient, stateless, content-hash-identified ${objectDescription} object.
With no first class identity and state it cannot be mutated or destroyed. Any changes require
creation of new Data objects and mutation of Resource's that contain them.`,

    fields: () => ({
      ...generatedField("id", new GraphQLNonNull(GraphQLID),
          `Content-hashed uuid v5 identifier of this ${objectDescription}`,
          contentHashResolver,
      ),

      ...generatedField("typeName", new GraphQLNonNull(GraphQLString),
          `Type name this ${objectDescription}`,
          source => dataFieldValue(source, "typeName")
      ),

      ...generatedField("contentHash", new GraphQLNonNull(GraphQLID),
          `Alias for 'id' which can be used to differentiate a Data and Resource`,
          contentHashResolver,
          { affiliatedType: "Data" },
      ),

      /* TODO(iridian): Implement data reference fields.
        * This way we could have three paired shadowField list couplings:
        * Data.referredDatas <-> Data.referringDatas
        * Data.referredResources <-> Resource.referringDatas
        * Resource.referredDatas <-> Data.referringResources
        * shadowField couplings are
        * 1. derivative: not considered part of the Data identity proper and not factored in in the
        *                Data id generation. This allows them to change.
        * 2. contextual: not globally comprehensive in time or space. They are not guaranteed to
        *                list absolutely every possible coupling, only those which are known in
        *                context. This context is defined by interactions with the local front-end
        *                Prophet.
        * This allows shadow-lists to change locally in given Prophet when references known to that
        * Prophet are being created and destroyed.
        * The referredResources is transitive by referredDatas: if Data A has a referred Data B, and
        * B has a referred Resource R, then A also will have referred Resource R. This allows the
        * full Data graph be mapped out with a single kuery without recursion.
        * For example, take the following FIELDS_SET:
        * fieldsSet({ id, typeName: "MyResource", sets: {
        *   myResourceData: { myDataSubData: { subDataTargetResource: myResourceId } },
        * } });
        * Two Data are specified as expanded objects, inner one containing subDataTargetResource and
        * outer one containing myDataSubData. But because recursively both contain a Resource
        * reference in myResourceId, both of these would be consolidated and given an id.
        * Also, _both_ consolidated Data objects would contain myResourceId in their
        * Data.referredResources and thus conversely myResourceId:Resource.referringDatas will
        * contain both Data id's. Thus a simple kuery:
        * vMyResource.get(
        *   VALK.to("referringDatas")
        *   .select({ "id": "id", "referringResources": "referringResources",
        *       referringDatas": ["referringDatas", "id"] })
        * );
        * Will nicely return all referring Data objects and their local structure as O(n*d) op.
        * n is the number of incoming references and d the average (over n) depth of nested Data's.
        * For most practical purposes this is O(n) (O(nlogn) if d ~ O(logn)).

      ...shadowField("referredDatas", new GraphQLList(Data),
          `TODO(iridian): Write description`, {
            shadow: true,
            transitiveThrough: "referredDatas",
            coupling: toMany({ coupledField: "referringDatas" }),
          }
      ),
      ...shadowField("referringDatas", new GraphQLList(Data),
          `TODO(iridian): Write description`, {
            shadow: true,
            transitiveThrough: "referringDatas",
            coupling: toMany({ coupledField: "referredDatas" }),
          }
      ),
      ...shadowField("referredResources", new GraphQLList(Data),
          `TODO(iridian): Write description`, {
            shadow: true,
            type: new GraphQLList(Resource),
            coupling: toMany({ coupledField: "referringDatas" }),
          }
      ),
      ...shadowField("referringResources", new GraphQLList(Data),
          `TODO(iridian): Write description`, {
            shadow: true,
            type: new GraphQLList(Resource),
            coupling: toMany({ coupledField: "referredDatas" }),
          }
      ),
      */
    }),

    resolveType: dataTypeResolver,
  };
}

export default new GraphQLInterfaceType(dataInterface());
