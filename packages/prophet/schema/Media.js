// @flow
import { GraphQLObjectType, GraphQLString, GraphQLInt } from "graphql/type";

import primaryField from "~/raem/tools/graphql/primaryField";
import { toOne } from "~/raem/tools/graphql/coupling";

import Blob from "~/raem/schema/Blob";
import Describable from "~/raem/schema/Describable";
import Discoverable from "~/raem/schema/Discoverable";
import TransientFields from "~/raem/schema/TransientFields";
import Resource from "~/raem/schema/Resource";
import MediaType from "~/raem/schema/MediaType";
import Scope from "~/script/schema/Scope";

import Relatable, { relatableInterface } from "~/script/schema/Relatable";
import TransientScriptFields from "~/script/schema/TransientScriptFields";

const OBJECT_DESCRIPTION = "media";

export const MEDIA_FROM_ANY = "MEDIA_FROM_ANY";
export const MEDIA_FROM_DIRECTORY = "MEDIA_FROM_DIRECTORY";

export default new GraphQLObjectType({
  name: "Media",

  description: `Describes an identifiable singular whole of ${OBJECT_DESCRIPTION} content, ` +
      `means of accessing it and metadata associated with it. This content can undergo updates.`,

  interfaces: () => [
    Relatable, Scope, TransientScriptFields,
    Describable, Discoverable, Resource, TransientFields,
  ],

  fields: () => ({
    ...relatableInterface(OBJECT_DESCRIPTION).fields(),

    ...primaryField("sourceURL", GraphQLString,
        `The source URL of this ${OBJECT_DESCRIPTION}`),

    // TODO(iridian): Make this Non-null again and fix the imports
    // type: new GraphQLNonNull(MediaType),
    ...primaryField("mediaType", MediaType,
        `The media type of this ${OBJECT_DESCRIPTION}`),

    ...primaryField("size", GraphQLInt,
        `Size of the ${OBJECT_DESCRIPTION
            } content in bytes if known, null otherwise (f.ex. if streaming content)`),

    ...primaryField("content", Blob,
        `Content of the ${OBJECT_DESCRIPTION
            } if known, null otherwise (f.ex. if streaming content)`,
        { coupling: toOne({ coupledField: "contentReferrers" }) }),

    ...primaryField("extension", GraphQLString,
        `File extension of this ${OBJECT_DESCRIPTION}`),

    ...primaryField("created", GraphQLString,
        `The creation ISO-8601 date of this ${OBJECT_DESCRIPTION}`),

    // TODO(iridian): Add validation!
    ...primaryField("modified", GraphQLString,
        `The last modification ISO-8601 date of this ${OBJECT_DESCRIPTION}`),
  }),
});
