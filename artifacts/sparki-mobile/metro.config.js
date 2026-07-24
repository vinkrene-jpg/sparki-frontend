const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const workspaceRoot = path.resolve(__dirname, "../..");
const ignoredDirs = [
  path.join(workspaceRoot, "artifacts/api-server/dist"),
  path.join(workspaceRoot, "artifacts/api-server/dist-tests"),
  path.join(workspaceRoot, "artifacts/sparki/dist"),
  path.join(workspaceRoot, "artifacts/mockup-sandbox/dist"),
];

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const extraBlocks = ignoredDirs.map(
  (dir) => new RegExp(`^${escapeForRegex(dir)}(/.*)?$`),
);

const existingBlockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.resolver.blockList = [...existingBlockList, ...extraBlocks];

module.exports = config;
