{ constants: ["~", "/",
    undefined,
    null,
    true,
    false,
    "~[]", // array production
    "~ref",
    "~refurl",
    "~$:authorityURI",
    "~$:partitionId",
    "~$:partitionURI",
    { version: "~$0", command: "~$1", log: "~$2", event: "~$3" }, // aspects
    { id: "~$0" }, // command
    { index: "~$0", timeStamp: "~$1" }, // log
    { type: "~$0", actions: "~$1" }, // transacted-like
    { type: "~$0", typeName: "~$1", id: "~$2", initialState: "~$3" }, // created-like
    { name: "~$0", owner: "~$1", partitionAuthorityURI: "~$2" }, // initialState
    { name: "~$0", owner: "~$1", target: "~$2" }, // initialState
    { name: "~$0", owner: "~$1", value: "~$2" }, // initialState
    { typeName: "~$0", value: "~$1" }, // value
    { type: "~$0", typeName: "~$1", id: "~$2", sets: "~$3" }, // fields-set-like
    { name: "~$0" },
    { name: "~$0", owner: "~$1" },
  ],

  productions: [
    "~012,~032", // aspects "0.2"
    "~015,~034", // TRANSACTED
    ["~060,~013(~$0),~014(~$1,~$2)", ["~061", "~$3"]],
    "~016,~037,~045", // CREATED Entity
    "~016,~037,~046", // CREATED Relation
    "~064,~07(~$0),~018(~$1,~07(~$2,relations),~$3)",
    "~016,~037,~048", // CREATED Property
    "~065,~07(~$0!.:~$1),~019(~$2,~07(~1,properties),~020(Literal,~2))",
    "~021,~041,~045", // FIELDS_SET Entity
    "~068,~07(~$0),~022(~$1))",
    "~063,~07(~$0),~023(~$1,~07(~$2))",
  ],
  value:


[
["5204683b-a286-4f5a-ad85-3a99b2c83958",
 "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest",
 "valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958",
 "Root: client",
 ["~62,b9066071-e189-4198-9028-bcacd750ed75,0,1544703658608",[
  ["~63,~/0/0,~17(~/3,~3,~/0/1)"]
]]],
["10ea41a2-3d03-4ecd-a2a4-48d7759ccf86",["~62,07ed7b88-ee52-4705-bd12-bab214e0486c,1,1544703658657",[["~65,~/0,PERMISSIONS,~/0/0,~8(~/0/1?id=20afd9e6-6fcd-453c-9278-0b5078400a3f#)"],["~67,~/0,role,owner"],["~67,~/0,read,~4"],["~67,~/0,write,~4"]]]],
[["~62,02666cdd-fb60-42de-b1d3-bbd39d8ffb76,2,1544703668236",[
  ["~69,~10,Matchmaking"]
]]],
["14999cd5-49a7-4a2f-a118-ed79ded025e1",
 ["~62,c9a20298-efd5-4eeb-995e-47823b66134b,3,1544703671759",[
  ["~63,~/0,New%20Entity,~/0/0"]
]]]
]


["14999cd5-49a7-4a2f-a118-ed79ded025e1",["~62,c9a20298-efd5-4eeb-995e-47823b66134b,2,1544703671759",[["~63,~/0,New%20Entity,~/0/0"]]]]
{"actions":[{"typeName":"Entity","id":["14999cd5-49a7-4a2f-a118-ed79ded025e1",null,null,"valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"],"initialState":{"name":"New Entity","owner":["5204683b-a286-4f5a-ad85-3a99b2c83958",null,null,"valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/developtest?id=5204683b-a286-4f5a-ad85-3a99b2c83958"]},"type":"CREATED"}],"type":"TRANSACTED","aspects":{"version":"0.2","command":{"id":"c9a20298-efd5-4eeb-995e-47823b66134b"},"log":{"index":3,"timeStamp":1544703671759}}}

  2: (v,h,scope) => scope.partitionURI,
  3: (v,h,s,[,version,command,log,event,envelope,]) => ({
    version, command, log, event, envelope, buffer,
  }),
  4: (v,h,s,[,type,actions]) => ({
    type, actions,
  }),
  5: (v,h,s,[,type,actions]) => ({
    type, actions,
  }),
  (v,h,s,[,id,index,timeStamp,actions]) => ({
    type: "TRANSACTED",

    id, index, timeStamp, commandId, body: { ", actions }
  }),
  (v,h,s,[,id,reference]) => ({
    id,
    type: "FIELDS_SET",
    typeName: "Property",
    sets: { value: { typeName: "Identifier", reference } },
  }),
}

[] = "~";
["~1"] = "/";
["~2"] = partitionURI;
["~3",3] = {"eventId":_1}
