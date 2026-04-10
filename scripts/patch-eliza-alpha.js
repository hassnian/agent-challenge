import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const patchFile = (relativePath, replacer) => {
  const filePath = resolve(process.cwd(), relativePath);
  const original = readFileSync(filePath, "utf8");
  const next = replacer(original);

  if (next !== original) {
    writeFileSync(filePath, next);
    console.log(`[patch-eliza-alpha] patched ${relativePath}`);
  }
};

patchFile("node_modules/@elizaos/server/dist/index.js", (source) => {
  const nativeBcryptBlock = `var require_bcrypt = __commonJS((exports, module) => {
  var __dirname = \"/home/runner/work/eliza/eliza/node_modules/bcrypt\";
  var path7 = __require(\"path\");
  var bindings = require_node_gyp_build2()(path7.resolve(__dirname));`;

  if (!source.includes(nativeBcryptBlock)) {
    return source;
  }

  return source.replace(
    /var require_bcrypt = __commonJS\(\(exports, module\) => \{[\s\S]*?module\.exports = \{[\s\S]*?getRounds[\s\S]*?\};\n\}\);/,
    `var require_bcrypt = __commonJS((exports, module) => {
  module.exports = __require("bcrypt");
});`
  );
});

patchFile("node_modules/@elizaos/plugin-openai/dist/node/index.node.js", (source) => {
  const emptyEmbeddingGuard = `  if (trimmedText.length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }`;

  if (!source.includes(emptyEmbeddingGuard)) {
    return source;
  }

  return source.replace(
    emptyEmbeddingGuard,
    `  if (trimmedText.length === 0) {
    logger5.debug("[OpenAI] Empty text embedding requested, returning zero vector");
    return new Array(embeddingDimension).fill(0);
  }`
  );
});
