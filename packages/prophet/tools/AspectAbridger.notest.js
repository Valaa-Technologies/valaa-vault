// @flow

import AspectAbridger from "~/prophet/tools/AspectAbridger";

describe("AspectAbridger", () => {
  let packer;
  beforeEach(() => {
    packer = new AspectAbridger();
    packer.defineProductions(0, [
      "~", "/", undefined, null, true, false, // 0-5
      "~[]", "~ref", "~refurl", "~$:authorityURI", "~$:partitionId", "~$:partitionURI", // 6-11
      { version: "~$0", command: "~$1", log: "~$2", event: "~$3" }, // 12, aspects
      { id: "~$0" }, // 13, command
      { index: "~$0", timeStamp: "~$1" }, // log
      { type: "~$0", actions: "~$1" }, // transacted-like
      { type: "~$0", typeName: "~$1", id: "~$2", initialState: "~$3" }, // created-like
      { name: "~$0", owner: "~$1", partitionAuthorityURI: "~$2" }, // initialState
      { name: "~$0", owner: "~$1", target: "~$2" }, // initialState
      { name: "~$0", owner: "~$1", value: "~$2" }, // initialState
      { typeName: "~$0", value: "~$1" }, // value
      { type: "~$0", typeName: "~$1", id: "~$2", sets: "~$3" }, // fields-set-like
      { name: "~$0" },
      { name: "~$0", owner: "~$1" },
    ]);
    packer.defineProductions(30, [
      "0.1", "0.2", "0.3", "TRANSACTED", "TIMED",
      "FROZEN", "CREATED", "DUPLICATED", "RECOMBINED", "DESTROYED",
      "FIELDS_SET", "ADDED_TO", "REMOVED_FROM", "REPLACED_WITHIN", "Entity",
      "Relation", "Media", "Property", "Literal", "Reference",
      "relations", "properties",
    ]);
  });

  it("unpacks basic examples correctly", () => {
    packer.defineProductions(60, [
      "~012,~032", // aspects "0.2"
      "~015,~034", // TRANSACTED
      ["~060,~013(~$0),~014(~$1,~$2)", ["~061", "~$3"]],
      "~016,~037,~045", // CREATED Entity
      "~016,~037,~046", // CREATED Relation
      "~064,~07(~$0),~018(~$1,~07([~$2,relations]),~$3)",
      "~016,~037,~048", // CREATED Property
      "~065,~07(~$0!.:~$1),~019(~$2,~07([~1,properties]),~020(Literal,~2))",
      "~021,~041,~045", // FIELDS_SET Entity
      "~068,~07(~$0),~022(~$1))",
      "~063,~07(~$0),~023(~$1,~07(~$2))",
    ]);

    expect(packer.unabridgeEvents([{
      productions: [
        "5204683b-a286-4f5a-ad85-3a99b2c83958",
        "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest",
        "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958",
        "Root: client",
      ],
      abridgement: ["~62,b9066071-e189-4198-9028-bcacd750ed75,0,1544703658608", [
        ["~63,~/0/0,~17(~/-/3,~3,~/0/1)"]
      ]],
    }, {
      productions: [
        "10ea41a2-3d03-4ecd-a2a4-48d7759ccf86",
      ],
      abridgement: ["~62,07ed7b88-ee52-4705-bd12-bab214e0486c,1,1544703658657", [
        ["~65,~/-/0,PERMISSIONS,~/0/0,~7(~/0/1?id=20afd9e6-6fcd-453c-9278-0b5078400a3f#)"],
        ["~67,~/-/0,role,owner"],
        ["~67,~/-/0,read,~4"],
        ["~67,~/-/0,write,~4"],
      ]],
    }, {
      abridgement: ["~62,02666cdd-fb60-42de-b1d3-bbd39d8ffb76,2,1544703668236", [
        ["~69,~/0/0,Matchmaking"]
      ]],
    }, {
      productions: [
        "14999cd5-49a7-4a2f-a118-ed79ded025e1",
      ],
      abridgement: ["~62,c9a20298-efd5-4eeb-995e-47823b66134b,3,1544703671759", [
        ["~63,~/-/0,New%20Entity,~/0/0"]
      ]],
    }, {
      abridgement: ["~62,f1d04938-0742-4a50-afd1-4b4f7b177ba1,4,1544703673563", [
        ["~69,~/3/0,Client"]
      ]],
    }])).toEqual([
      {
        version: "0.2",
        command: { id: "b9066071-e189-4198-9028-bcacd750ed75" },
        log: { index: 0, timeStamp: 1544703658608 },
        event: {
          type: "TRANSACTED",
          actions: [
            {
              type: "CREATED",
              typeName: "Entity",
              id: ["5204683b-a286-4f5a-ad85-3a99b2c83958", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
              initialState: {
                owner: null,
                partitionAuthorityURI: "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest",
                name: "Root: client"
              }
            }
          ]
        }
      }, {
        version: "0.2",
        command: { id: "07ed7b88-ee52-4705-bd12-bab214e0486c" },
        log: { index: 1, timeStamp: 1544703658657 },
        event: {
          type: "TRANSACTED",
          actions: [
            {
              type: "CREATED",
              typeName: "Relation",
              id: ["5204683b-a286-4f5a-ad85-3a99b2c83958!-:PERMISSIONS:1:0", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
              initialState: {
                owner: ["5204683b-a286-4f5a-ad85-3a99b2c83958", "relations", null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
                name: "PERMISSIONS",
                target: ["20afd9e6-6fcd-453c-9278-0b5078400a3f", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=20afd9e6-6fcd-453c-9278-0b5078400a3f"]
              }
            },
            {
              type: "CREATED",
              typeName: "Property",
              id: ["5204683b-a286-4f5a-ad85-3a99b2c83958!-:PERMISSIONS:1:0!.:role", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
              initialState: {
                owner: ["5204683b-a286-4f5a-ad85-3a99b2c83958!-:PERMISSIONS:1:0", "properties", null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
                name: "role",
                value: { typeName: "Literal", value: "owner" }
              }
            },
            {
              type: "CREATED",
              typeName: "Property",
              id: ["5204683b-a286-4f5a-ad85-3a99b2c83958!-:PERMISSIONS:1:0!.:read", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
              initialState: {
                owner: ["5204683b-a286-4f5a-ad85-3a99b2c83958!-:PERMISSIONS:1:0", "properties", null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
                name: "read",
                value: { typeName: "Literal", value: true }
              }
            },
            {
              type: "CREATED",
              typeName: "Property",
              id: ["5204683b-a286-4f5a-ad85-3a99b2c83958!-:PERMISSIONS:1:0!.:write", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
              initialState: {
                owner: ["5204683b-a286-4f5a-ad85-3a99b2c83958!-:PERMISSIONS:1:0", "properties", null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
                name: "write",
                value: { typeName: "Literal", value: true }
              }
            }
          ]
        }
      }, {
        version: "0.2",
        command: { id: "02666cdd-fb60-42de-b1d3-bbd39d8ffb76" },
        log: { index: 2, timeStamp: 1544703668236 },
        event: {
          type: "TRANSACTED",
          actions: [
            {
              type: "FIELDS_SET",
              typeName: "Entity",
              id: ["5204683b-a286-4f5a-ad85-3a99b2c83958", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
              sets: { name: "Matchmaking" }
            }
          ]
        }
      }, {
        version: "0.2",
        command: { id: "c9a20298-efd5-4eeb-995e-47823b66134b" },
        log: { index: 3, timeStamp: 1544703671759 },
        event: {
          type: "TRANSACTED",
          actions: [
            {
              type: "CREATED",
              typeName: "Entity",
              id: ["14999cd5-49a7-4a2f-a118-ed79ded025e1", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
              initialState: {
                name: "New Entity",
                owner: ["5204683b-a286-4f5a-ad85-3a99b2c83958", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"]
              }
            }
          ]
        }
      }, {
        version: "0.2",
        command: { id: "f1d04938-0742-4a50-afd1-4b4f7b177ba1" },
        log: { index: 4, timeStamp: 1544703673563 },
        event: {
          type: "TRANSACTED",
          actions: [
            {
              id: ["14999cd5-49a7-4a2f-a118-ed79ded025e1", null, null, "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],
              typeName: "Entity",
              type: "FIELDS_SET",
              sets: { name: "Client" }
            }
          ]
        }
      }
    ]);
  });
});
