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
    createDefaultAuthorityConfig () {},
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
    commandId: NaN,
    eventId: NaN,
    logs: {
      commandQueue: arrayOf(action()),
      eventLog: arrayOf(action()),
      latestMediaInfos: dictionaryOf({
        mediaId: "",
        mediaInfo: {
          name: "",
          bvobId: "",
          blobId: "",
        },
        isPersisted: null,
        isInMemory: null,
      }),
    },
  };
}

function action () {
  return {
    type: "",
    version: "",
    commandId: "",
    timeStamp: NaN,
    partitions: dictionaryOf({
      eventId: NaN,
      partitionAuthorityURI: "",
    }),
    /*
    typeName: "",
    id: [],
    actions: [],
    initialState: {},
    */
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
