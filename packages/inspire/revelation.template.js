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
    scribe: { logLevel: 0 },
    oracle: { logLevel: 0 },
    reducer: { logLevel: 0 },
    corpus: { logLevel: 0 },
    falseProphet: { logLevel: 0 },
  },
  prologue: {
    endpoint: "",
    rootPartitionURI: "",
    endpoints: dictionaryOf(""),
    partitionInfos: dictionaryOf(partitionInfo()),
    blobInfos: dictionaryOf(blobInfo()),
    blobBuffers: dictionaryOf(blobBuffer()),
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

function blobInfo () {
  return {
    byteLength: NaN,
    persistRefCount: NaN,
  };
}

function blobBuffer () {
  return {
    base64: "",
  };
}
