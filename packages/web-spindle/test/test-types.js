const {
  ObjectSchema, BooleanType, StringType, URIReferenceType,

  EmailType, UnixEpochSecondsType, ZoneExtendedISO8601Type,
  // DateExtendedISO8601Type, TimeExtendedISO8601Type,
  // DateTimeZoneExtendedISO8601Type,

  namedResourceType, extendType, mappingToManyOf,
} = require("../schema-builder");

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
        projection: [["-out$.TAG"], [".$V.target"]],
      },
    },
  },
  name: extendType(StringType, { summary: "Tag name" }),
});
exports.TestTagType = exports.createTestTagType();

exports.createTestThingType = () => namedResourceType("TestThing", [], {
  [ObjectSchema]: {
    valospace: {},
  },
  $V: {
    id: { valospace: { reflection: [[".$V.rawId"]] } },
  },
  name: StringType, // title
  description: StringType,
  visible: BooleanType,
  contact: {
    [ObjectSchema]: {},
    email: EmailType,
    phone: StringType,
    website: URIReferenceType,
  },

  // Meta
  tags: () => mappingToManyOf("tags", exports.TestTagType,
      [["-out$.TAG"], ["$valk.nullable"]], {
        [ObjectSchema]: { valospace: { filterable: true } },
        highlight: BooleanType,
      }),

  // Presentation
  icon: StringType,
  image: extendType(StringType, { valospace: { reflection: [".$V.name"] } }),
});
exports.TestThingType = exports.createTestThingType();

// TestThing types

exports.createTestNewsItemType = () => namedResourceType("TestNewsItem", exports.TestThingType, {
  [ObjectSchema]: {
    description: "Test News Item resource",
    valospace: {
      gate: {
        name: "news",
        projection: [["-out$.NEWSITEM"], [".$V.target"]],
        filterCondition: [["$valk.nullable"], [".$.visible"]],
      },
    },
  },
  startTime: exports.TestDateTimeType,
  endTime: exports.TestDateTimeType,
});
exports.TestNewsItemType = exports.createTestNewsItemType();

exports.createTestProfileType = () => namedResourceType("TestProfile", exports.TestThingType, {
  [ObjectSchema]: {},
  owned: {
    [ObjectSchema]: {
      valospace: { reflection: ["@"] },
    },
    services: () => mappingToManyOf("owned/services", exports.TestServiceType,
        [["-out$.SERVICE"], ["$valk.nullable"]],
        { highlight: BooleanType }),
  },
});
exports.TestProfileType = exports.createTestProfileType();

// TestProfile types

exports.createTestIndividualType = () => namedResourceType(
    "TestIndividual", exports.TestProfileType, {
  [ObjectSchema]: {
    description: "Test Individual resource",
    valospace: {
      gate: {
        name: "individuals",
        projection: [["-out$.INDIVIDUAL"], [".$V.target"]],
        filterCondition: [["$valk.nullable"], [".$.visible"]],
      },
    },
  },
  title: StringType,
  company: StringType,
  interests: () => mappingToManyOf("interests", exports.TestTagType,
      [["-out$.INTEREST"], ["$valk.nullable"]],
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
        projection: [["-out$.SERVICE"], [".$V.target"]],
        filterCondition: [["$valk.nullable"], [".$.visible"]],
      },
    },
  },
  owned: {
    news: () => mappingToManyOf("owned/news", exports.TestNewsItemType,
        [["-out$.NEWSITEM"], ["$valk.nullable"]],
        { highlight: BooleanType, [ObjectSchema]: { valospace: { filterable: true } } }),
  },
});
exports.TestServiceType = exports.createTestServiceType();
