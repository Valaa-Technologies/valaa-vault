// @flow

const VALEK = require("~/engine/VALEK");
const created = require("~/raem/events").created;
const vRef = require("~/raem/VRL").vRef;

export default function queryTestResources (testPartitionURI: any) {
  return [
    created({ id: ["test-ownling"], typeName: "Entity", initialState: {
      name: "test_ownling",
      owner: ["test"]
    }, }),
    created({ id: ["query-test-entity"], typeName: "Entity", initialState: {
      name: "query_test_entity",
      owner: ["test"]
    }, }),
    created({ id: ["query-test-ownling-entity"], typeName: "Entity", initialState: {
      name: "query_test_ownling_entity",
      owner: ["query-test-entity"]
    }, }),
    created({ id: ["query-test-ownling-anotherentity"], typeName: "Entity", initialState: {
      name: "query_test_ownling_anotherentity",
      owner: ["query-test-entity"]
    }, }),
    created({ id: ["query-test-ownling-media"], typeName: "Media", initialState: {
      name: "query_test_ownling_media",
      owner: ["query-test-entity"]
    }, }),
    created({ id: ["query-test-ownling-anothermedia"], typeName: "Media", initialState: {
      name: "query_test_ownling_anothermedia",
      owner: ["query-test-entity"]
    }, }),
    created({ id: ["query-test-ownling-relation"], typeName: "Relation", initialState: {
      name: "query_test_ownling_relation",
      owner: ["query-test-entity"],
      target: ["query-test-ownling-entity", { partition: String(testPartitionURI) }]
    }, }),
    created({ id: ["query-test-ownling-anotherrelation"], typeName: "Relation", initialState: {
      name: "query_test_ownling_anotherrelation",
      owner: ["query-test-entity"],
      target: ["query-test-ownling-anotherentity", { partition: String(testPartitionURI) }]
    }, }),
    created({ id: ["query-test-string"], typeName: "Property", initialState: {
      name: "test_string", owner: vRef("query-test-entity", "properties"),
      value: VALEK.literal("hello world")
    }, }),
    created({ id: ["query-test-anotherstring"], typeName: "Property", initialState: {
      name: "test_anotherstring", owner: vRef("query-test-entity", "properties"),
      value: VALEK.literal("hello world")
    }, }),
    created({ id: ["query-test-int"], typeName: "Property", initialState: {
      name: "test_int", owner: vRef("query-test-entity", "properties"),
      value: VALEK.literal(42)
    }, }),
    created({ id: ["query-test-boolean"], typeName: "Property", initialState: {
      name: "test_boolean", owner: vRef("query-test-entity", "properties"),
      value: VALEK.literal(true)
    }, }),
    created({ id: ["query-test-nullable"], typeName: "Property", initialState: {
      name: "test_nullable", owner: vRef("query-test-entity", "properties"),
      value: VALEK.literal(null)
    }, }),
    created({ id: ["query-test-object"], typeName: "Property", initialState: {
      name: "test_object", owner: vRef("query-test-entity", "properties"),
      value: VALEK.literal({ hello: "world" })
    }, }),
    created({ id: ["query-test-ownling"], typeName: "Property", initialState: {
      name: "pointer_to_test_ownling",
      owner: vRef("query-test-entity", "properties"),
      value: VALEK.pointer(["test-ownling"]),
    }, }),
    created({ id: ["query-test-anotherentity"], typeName: "Entity", initialState: {
      name: "query_test_anotherentity",
      owner: ["test"]
    }, }),
    created({ id: ["query-test-ownling-pointer"], typeName: "Property", initialState: {
      name: "pointer_to_query_test_ownling_entity",
      owner: vRef("query-test-anotherentity", "properties"),
      value: VALEK.pointer(["query-test-ownling-entity"])
    }, }),
  ];
}
