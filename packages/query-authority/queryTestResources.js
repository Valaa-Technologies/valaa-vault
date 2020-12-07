import { literal, pointer } from "~/engine/VALEK";

import { created } from "~/raem/events";
import { vRef } from "~/raem/VRL";

export default [
  created({ id: ["test-ownling"], typeName: "Entity", initialState: {
    name: "test_ownling",
    owner: ["test"]
  }, }),
  created({ id: ["query-test-entity"], typeName: "Entity", initialState: {
    name: "query_test_entity",
    owner: ["test"]
  }, }),
  created({ id: ["query-test-relation"], typeName: "Relation", initialState: {
    name: "query_test_relation",
    owner: ["test"]
  }, }),
  created({ id: ["query-test-media"], typeName: "Media", initialState: {
    name: "query_test_media",
    owner: ["test"]
  }, }),
  created({ id: ["query-test-string"], typeName: "Property", initialState: {
    name: "test_string", owner: vRef("query-test-entity", "properties"),
    value: literal("hello world")
  }, }),
  created({ id: ["query-test-anotherstring"], typeName: "Property", initialState: {
    name: "test_anotherstring", owner: vRef("query-test-entity", "properties"),
    value: literal("hello world")
  }, }),
  created({ id: ["query-test-int"], typeName: "Property", initialState: {
    name: "test_int", owner: vRef("query-test-entity", "properties"),
    value: literal(42)
  }, }),
  created({ id: ["query-test-boolean"], typeName: "Property", initialState: {
    name: "test_boolean", owner: vRef("query-test-entity", "properties"),
    value: literal(true)
  }, }),
  created({ id: ["query-test-null"], typeName: "Property", initialState: {
    name: "test_null", owner: vRef("query-test-entity", "properties"),
    value: literal(null)
  }, }),
  created({ id: ["query-test-object"], typeName: "Property", initialState: {
    name: "test_object", owner: vRef("query-test-entity", "properties"),
    value: literal({ hello: "world" })
  }, }),
  created({ id: ["query-test-ownling"], typeName: "Property", initialState: {
    name: "pointer_to_test_ownling",
    owner: vRef("query-test-entity", "properties"),
    value: pointer(["test-ownling"]),
  }, }),
];
