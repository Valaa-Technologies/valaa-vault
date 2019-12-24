import path from "path";
import fs from "fs";

import { contentHashFromUCS2String } from "~/tools/textEncoding";
import { contentHashFromArrayBuffer, contentHashFromNativeStream } from "./contentId";

function toArrayBuffer (buf) {
  const ab = new ArrayBuffer(buf.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
}

describe("contentHash module", () => {
  const testData = [
    /* eslint-disable max-len */
    // Test vectors from https://www.di-mgt.com.au/sha_testvectors.html
    { msg: "abc", hash: "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f" },
    { msg: "", hash: "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e" },
    { msg: "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", hash: "204a8fc6dda82f0a0ced7beb8e08a41657c16ef468b228a8279be331a703c33596fd15c13b1b07f9aa1d3bea57789ca031ad85c7a71dd70354ec631238ca3445" },
    { msg: "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu", hash: "8e959b75dae313da8cf4f72814fc143f8f7779c6eb9f7fa17299aeadb6889018501d289e4900f7e4331b99dec4b5433ac7d329eeb6dd26545e96e55b874be909" },
    // Custom tests generated using echo "test" | openssl dgst -sha512
    { msg: "𝌆", hash: "bc8832b0b2eafb25e80384d6eb8bdf0220a9958a82be364c4e9eadb2c727e5207a6dc910f7630de42d6dc5fbce54db509f7a66698541dac132db4c869d08dd1a" },
    { msg: "κόσμε", hash: "5893077ddf80aa8aa5eb1c63c7a03809fbadfa44cbb9fcfb4f0c4db160c6f9aaab57f7624b3612f4688c3b59823ae956117f59ab30a6e22e482b3815fbf2b98f" },
    { msg: "�ࠀ𐀀", hash: "c47bd79278a2530d3ddf57982e85c41e7652ba289907737ee8ad895e3cf96b04f56d6db838fd06c26b242446a12ef2e95e3d2f820eef7437fd0f6ba8fb4c7542" },
    { msg: "������", hash: "d0c0cd5fba8f512678fbd51aa4e3f38b174234de8031e2d07b5c71f67904893fb7e0226652e3d7cb65aa8650b2d6239857523d1eb8a0d4e113679bd43bb3cb53" },
    { msg: "￾￿﷐﷑﷒﷓﷔﷕﷖﷗﷘﷙﷚﷛﷜﷝﷞﷟﷠﷡﷢﷣﷤﷥﷦﷧﷨﷩﷪﷫﷬﷭﷮﷯", hash: "36d0da1874c290c75ec22a881c1a99b4c4425d51f0e0a342cf7191b0244924cff4a66c89cc58f759ed4f97c72efa09b42be8d6e08e758249c698c4354a4c05ad" }
  ];

  // Expected hashes generated using openssl dgst -sha512 [file]
  const testFiles = [
    { path: path.join(__dirname, "test", "utf8.txt"), hash: "304f67430532c36b971cb51f315b2e9a304df457d66c63fd413ee0b71c1ee7468a09b3d821890b5b11d6fffef454af92299904fa6dcb081c71bb3d7e67e2c8ef" },
    { path: path.join(__dirname, "test", "utf16be.txt"), hash: "afcf0c60d5e230ec82840a06fef7141731a7aa1a5681a15f06244d91d7b4922243afcc256f735dd693aaf156d28d51c9bb967cbf9e00f7b8d4c73f232c83f122" },
    { path: path.join(__dirname, "test", "utf16le.txt"), hash: "38bb3c5fa65dfe4537c6e9c3fb85603756422ed62943d907945572095136d4238ac9c9449630769a9223d2d38a712bb346d84ca36dcbfe16e1bc16d9aa71dad9" },
    { path: path.join(__dirname, "test", "image.png"), hash: "598ea3ab1028138652203d5288e9bc6d70242e6ea3e626e2ddabcee775e77cd30978a037f8815771ee834d532ae2baa2f1e425f095935572818c249b71ceb8f3" },
    { path: path.join(__dirname, "test", "sound.mp3"), hash: "b386920757497b94d15e334d31582b8ea321b01258da59d2904035ae2c915b07d5d59d80eeecece5eb9ee90ae2e40a4116254e8c36cde1ab3ed28b867831dbbc" },
    /* eslint-enable max-len */
  ];

  // Set these env variables to test using a big file.
  const bigFiles = (process.env.VALOS_TEST_BIG_FILE && process.env.VALOS_TEST_BIG_FILE_HASH) ? [
    { path: process.env.VALOS_TEST_BIG_FILE, hash: process.env.VALOS_TEST_BIG_FILE_HASH }
  ] : null;

  describe("Synchronous id generation", () => {
    for (const td of testData) {
      it(`Given input string ${td.msg}, it should calculate ${td.hash}`, () => {
        expect(contentHashFromUCS2String(td.msg)).toEqual(td.hash);
      });
    }

    for (const tf of testFiles) {
      it(`Given input file ${tf.path}, it should calculate ${tf.hash}`, () => {
        expect(contentHashFromArrayBuffer(toArrayBuffer(fs.readFileSync(tf.path))))
            .toEqual(tf.hash);
      });
    }

    // node will OOM if you try to sync hash a big file, so no bigFiles here!
  });

  describe("Asynchronous id generation", () => {
    for (const tf of testFiles) {
      it(`Given input stream ${tf.path}, it should calculate ${tf.hash}`, () => {
        const stream = fs.createReadStream(tf.path);
        return contentHashFromNativeStream(stream).then(hash => {
          expect(hash).toEqual(tf.hash);
        });
      });
    }

    if (bigFiles) {
      for (const tf of bigFiles) {
        it(`Given input stream ${tf.path}, it should calculate ${tf.hash}`, () => {
          const stream = fs.createReadStream(tf.path);
          return contentHashFromNativeStream(stream).then(hash => {
            expect(hash).toEqual(tf.hash);
          });
        }, (2 ** 31) - 1); // last param is maximum timeout for jasmine, Infinity doesnt work
      }
    }
  });
});
