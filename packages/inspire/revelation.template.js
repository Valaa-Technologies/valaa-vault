// @flow

import { arrayOf, dictionaryOf, deprecated } from "~/inspire/Revelation";

export default {
  name: "",
  version: "",
  description: "",
  author: "",
  license: "",
  private: false,
  valaa: deprecated({},
      "DEPRECATED: Section revelation.valaa is deprecated\n\tprefer revelation.gateway"),
  gateway: {
    name: "@valos/inspire",
    version: "",
    description: "Inspire - Valaa Browser Gateway",
    runtime: "",

    verbosity: 0,
    plugins: arrayOf(plugin()),

    authorityConfigs: dictionaryOf(authorityConfig()),
    scribe: { verbosity: 0 },
    oracle: { verbosity: 0 },
    reducer: { verbosity: 0 },
    corpus: { verbosity: 0 },
    falseProphet: { verbosity: 0 },
  },
  prologue: {
    endpoint: "",
    rootPartitionURI: "",
    endpoints: dictionaryOf(""),
    partitionInfos: dictionaryOf(partitionInfo()),
    bvobInfos: dictionaryOf(bvobInfo()),
    bvobBuffers: dictionaryOf(bvobBuffer()),
    blobInfos: dictionaryOf(blobInfo()), // deprecated
    blobBuffers: dictionaryOf(blobBuffer()), // deprecated
  }
};

function plugin () {
  return {
    ContentAPI: {
      name: "",
      schema: undefined,
      mutations: undefined,
      validators: undefined,
      reducers: undefined,
    },
    schemeModules: dictionaryOf(schemeModule()),
    mediaDecoders: dictionaryOf(mediaDecoder()),
    authorityConfigs: dictionaryOf(authorityConfig()),
  };
}

function schemeModule () {
  return {
    scheme: "",
    getAuthorityURIFromPartitionURI () {},
    obtainAuthorityConfig () {},
    createAuthorityProphet () {},
  };
}

function mediaDecoder () {
  return {
    mediaTypes: arrayOf({ type: "", subtype: "" }),
    decode () {},
  };
}

function authorityConfig () {
  return {
    authorityURI: "",
    scheme: "",
    type: "",
    name: "",
    credentials: { accessKeyId: "", secretAccessKey: "", region: "", IdentityPoolId: "" },
    api: { endpoint: "", verifyEndpoint: "" },
    iot: { endpoint: "" },
    s3: { pendingBucketName: "", liveBucketName: "" },
    repositoryIndexId: false,
    noconnect: null,
    test: null,
  };
}

function partitionInfo () {
  return {
    name: "",
    commandId: NaN, // last commandId. Deprecated in favor of commandCount (add +1 when migrating)
    commandCount: NaN,
    eventId: NaN, // last eventId. Deprecated in favor of truthCount (add +1 when migrating)
    truthCount: NaN,
    logs: {
      commandQueue: arrayOf(actionDeprecated()),
      eventLog: arrayOf(actionDeprecated()), // Deprecated since 0.2. Use truthLog instead.
      truthLog: arrayOf(action()),
      latestMediaInfos: dictionaryOf({
        mediaId: "",
        mediaInfo: {
          name: "",
          bvobId: "",
          blobId: "", // Deprecated since 0.2. Use bvobId instead.
        },
        isPersisted: null,
        isInMemory: null,
      }),
    },
  };
}

function actionDeprecated () {
  return {
    type: "",
    version: "", // Deprecated since 0.2. Use aspects.version instead.
    commandId: "", // Deprecated since 0.2. Use aspects.command.id instead.
    timeStamp: NaN, // Deprecated since 0.2. Use aspects.log.timeStamp instead.
    partitions: dictionaryOf({
      eventId: NaN, // Deprecated since 0.2. Use aspects.log.index isntead.
      partitionAuthorityURI: "", // Deprecated since 0.2: events are now single-partition only.
    }),
    // aspects: aspects(),
    /*
    typeName: "",
    id: [],
    actions: [],
    initialState: {},
    */
  };
}

function action () {
  return {
    type: "",
    aspects: aspects(),
    /*
    typeName: "",
    id: [],
    actions: [],
    initialState: {},
    */
  };
}

function aspects () {
  return {
    version: "",
    command: {
      id: "",
    },
    log: {
      index: NaN,
      timeStamp: NaN,
    },
  };
}

function bvobInfo () {
  return {
    byteLength: NaN,
    persistRefCount: NaN,
  };
}

function bvobBuffer () {
  return {
    base64: "",
  };
}

function blobInfo () {
  // deprecated
  return {
    byteLength: NaN,
    persistRefCount: NaN,
  };
}

function blobBuffer () {
  // deprecated
  return {
    base64: "",
  };
}
