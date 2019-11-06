const {
  ObjectSchema, BooleanType, StringType, URIReferenceType,

  EmailType, UnixEpochSecondsType, ZoneExtendedISO8601Type,
  // DateExtendedISO8601Type, TimeExtendedISO8601Type,
  // DateTimeZoneExtendedISO8601Type,

  namedResourceType, extendType, mappingToManyOf,
} = require("../schema-builder/types");

exports.createTestDateTimeType = () => ({
  [ObjectSchema]: { valospace: {
    // TODO: come up with a mapping definition solution
  } },
  unixSeconds: UnixEpochSecondsType, // JSON request double fractions are accepted but floored out.
  zone: ZoneExtendedISO8601Type, // "+02", "+13:45"

  /*
  // Derived fields
  date: DateExtendedISO8601Type,
  // date information affiliation: floor(timestamp / 86400)

  time: TimeExtendedISO8601Type, // "01:43" , "23:59:59.13", "00"
  // time information affiliation: timestamp % 86400

  datetime: DateTimeZoneExtendedISO8601Type, // "2019-01-11T23:59:59.13+13:45"
  // datetime information affiliation: timestamp, zone
  */
});
exports.TestDateTimeType = exports.createTestDateTimeType();

exports.createTestTagType = () => namedResourceType("TestTag", [], {
  [ObjectSchema]: {
    description: "Test Tag resource",
    valospace: {
      gate: {
        name: "tags",
        injection: [["out*:TAG"], [".$V:target"]],
      },
    },
  },
  name: extendType(StringType, { summary: "Tag name" }),
});
exports.TestTagType = exports.createTestTagType();

exports.createTestThingType = () => namedResourceType("TestThing", [], {
  [ObjectSchema]: {
    valospace: {
      gate: {
        name: "things",
        injection: [["out*:THING"], [".$V:target"]],
      },
      projection: [".:fields"]
    },
  },
  $V: {
    id: { valospace: { projection: [[".$V:owner"], [".$V:rawId"]] } },
  },
  name: StringType, // title
  description: StringType,
  visible: BooleanType,
  contact: {
    [ObjectSchema]: {},
    email: EmailType,
    facebook: StringType,
    linkedin: StringType,
    phone: StringType,
    website: URIReferenceType,
  },
  owned: {
    [ObjectSchema]: {
      // TODO: permission-based hiding.
    },
    news: () => mappingToManyOf("owned/news", exports.TestNewsItemType,
        [[".:owned"], ["out*:NEWSITEM"]],
        { highlight: BooleanType }),
  },

  // Meta
  tags: () => mappingToManyOf("tags", exports.TestTagType,
      [[".:tags"], ["out*:TAG"]],
      { [ObjectSchema]: { valospace: { filterable: true } },
  }),

  // Presentation
  icon: StringType,
  image: extendType(StringType, { valospace: { projection: [".$V:name"] } }),
});
exports.TestThingType = exports.createTestThingType();

exports.createTestProfileType = () => namedResourceType("TestProfile", exports.TestThingType, {
  owned: {
    services: () => mappingToManyOf("owned/services", exports.TestServiceType,
        [[".:owned"], ["out*:SERVICE"]],
        { highlight: BooleanType }),
  },
});
exports.TestProfileType = exports.createTestProfileType();

// TestThing routes

exports.createTestNewsItemType = () => namedResourceType("TestNewsItem", exports.TestThingType, {
  [ObjectSchema]: {
    description: "Test News Item resource",
    valospace: {
      gate: {
        name: "news",
        injection: [["out*:NEWSITEM"], [".$V:target"]],
        toFilter: [".:visible"],
      },
    },
  },
  startTime: exports.TestDateTimeType,
  endTime: exports.TestDateTimeType,
});
exports.TestNewsItemType = exports.createTestNewsItemType();

exports.createTestIndividualType = () =>
    namedResourceType("TestIndividual", exports.TestProfileType, {
  [ObjectSchema]: {
    description: "Test Individual resource",
    valospace: {
      gate: {
        name: "individuals",
        injection: [["out*:INDIVIDUAL"], [".$V:target"]],
        toFilter: [".:visible"],
      },
    },
  },
  title: StringType,
  company: StringType,
  interests: () => mappingToManyOf("interests", exports.TestTagType,
      [[".:interests"], ["out*:INTEREST"]],
      { [ObjectSchema]: { valospace: { filterable: true } } }),
});
exports.TestIndividualType = exports.createTestIndividualType();

exports.createTestServiceType = () => namedResourceType("TestService", exports.TestProfileType, {
  [ObjectSchema]: {
    summary: "Is service summary",
    description: "Test Service resource",
    tags: ["Test", "Service"],
    valospace: {
      gate: {
        name: "services",
        injection: [["out*:SERVICE"], [".$V:target"]],
        toFilter: [".:visible"],
      },
    },
  },
});
exports.TestServiceType = exports.createTestServiceType();
