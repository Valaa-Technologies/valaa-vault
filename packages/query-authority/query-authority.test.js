import foo from "./index.js";

describe("Query authority", () => {
	it("*", () => {
	  expect(foo())
        .toEqual(true);
	});
});
