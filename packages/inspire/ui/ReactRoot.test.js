import ReactRoot from "~/inspire/ui/ReactRoot";
// mocks
describe("UIContext", () => {
  let testRoot;
  beforeEach(() => {
    testRoot = new ReactRoot({}, { releaseVssSheets: jest.fn() });
  });

  describe("jss integration", () => {
    it("should create a jss sheet manager and user cache on mount", () => {
      testRoot.componentDidMount();
      expect(testRoot._vssSheetManager).toBeDefined();
      expect(testRoot._vssSheetUsers).toBeDefined();
    });

    describe("getVSSSheet", () => {
      beforeEach(() => {
        testRoot.componentDidMount();
      });

      const style1 = { foo: { color: "red" } };
      const style2 = { bar: { color: "red" } };

      const User = function userConstructor (name) { this.name = name; };
      const user1 = new User("user1");
      const user2 = new User("user2");
      const user3 = new User("user3");

      it("should create and return new sheets", () => {
        const result = testRoot.getVSSSheet(style1);
        expect(result).toBeDefined();
        expect(testRoot._vssSheetManager.sheets.length).toBe(1);
      });

      it("should not create duplicate sheets", () => {
        testRoot.getVSSSheet(style1, user1);
        testRoot.getVSSSheet(style1, user1);
        testRoot.getVSSSheet(style2, user1);
        testRoot.getVSSSheet(style2, user1);
        testRoot.getVSSSheet(style2, user1);
        testRoot.getVSSSheet(style2, user1);
        expect(testRoot._vssSheetManager.sheets.length).toBe(2); // style1 and style2
      });

      it("should update references for sheet users and detach sheets with no refs", () => {
        testRoot.getVSSSheet(style1, user1);
        testRoot.getVSSSheet(style1, user2);
        testRoot.getVSSSheet(style1, user3);
        testRoot._vssSheetManager.sheets[0].detach = jest.fn();

        testRoot.releaseVssSheets(user1);
        expect(testRoot._vssSheetManager.sheets[0].detach.mock.calls.length).toEqual(0);

        testRoot.releaseVssSheets(user2);
        expect(testRoot._vssSheetManager.sheets[0].detach.mock.calls.length).toEqual(0);

        testRoot.releaseVssSheets(user3);
        expect(testRoot._vssSheetManager.sheets[0].detach.mock.calls.length).toEqual(1);
      });
    });

    it("should detach all sheets on unmount", () => {
      testRoot._vssSheetManager = {
        sheets: [
          { detach: jest.fn() },
          { detach: jest.fn() },
          { detach: jest.fn() }
        ]
      };
      testRoot.componentWillUnmount();
      expect(testRoot._vssSheetManager.sheets[0].detach.mock.calls.length).toEqual(1);
      expect(testRoot._vssSheetManager.sheets[1].detach.mock.calls.length).toEqual(1);
      expect(testRoot._vssSheetManager.sheets[2].detach.mock.calls.length).toEqual(1);
    });
  });
});
