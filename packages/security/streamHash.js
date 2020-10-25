const crypto = require("crypto");

module.exports = {
  hexSHA512PromiseFromStream,
};

function hexSHA512PromiseFromStream (contentStream) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash("sha512");
      contentStream.on("error", reject);
      contentStream.on("end", () => {
        hash.end();
        const digest = hash.read();
        if (digest) {
          resolve(digest.toString("hex"));
        } else {
          reject(new Error("Could not resolve digest for stream"));
        }
      });
      contentStream.pipe(hash);
    } catch (err) {
      reject(err);
    }
  });
}
