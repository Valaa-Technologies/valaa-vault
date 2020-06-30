import UIComponent from "~/inspire/ui/UIComponent";

describe("vss", () => {
  let testComponent;
  const mockClasses = { foo: "bar" };
  const mockStyleMediaProperty = {
    typeName: "Property",
    value: context => context.foo || "bar",
    value2: context => context.test || "qwerty",
    value3: context => context.notHere || "poiuyt",
    value4: "hello"
  };
  const mockContext = {
    getVSSSheet: jest.fn(),
    uiContext: {
      foo: "wooo"
    }
  };

  beforeEach(() => {
    testComponent = new UIComponent({ parentUIContext: {} }, mockContext);
    testComponent.state = {
      uiContext: {
        focus: { get: jest.fn(() => mockStyleMediaProperty) },
        ...mockContext.uiContext
      }
    };
    mockContext.getVSSSheet.mockReturnValueOnce({ classes: mockClasses });
  });
});
