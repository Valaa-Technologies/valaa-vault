module.exports = {
  html: {
    "VDoc:Document": emitSBoMDocHTML,
    "VSbomdoc:Document": emitSBoMDocHTML,
  },
};

function emitSBoMDocHTML (node, emission, stack) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>${stack.emitNode(node["dc:title"], "")}</title>
  </head>
  <body>
    ${stack.emitNode(node["VDoc:content"], "")}
  </body>
</html>
`;
}
