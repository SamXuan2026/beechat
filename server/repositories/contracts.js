const REQUIRED_METHODS = [
  "channelById",
  "channelMembers",
  "channelMessages",
  "directMessages",
  "channelFiles",
  "audits",
  "createChannelMessage",
  "createDirectMessage",
  "updateMessageContent",
  "revokeMessage",
  "migrationStatus",
  "health"
];

function assertRepositoryContract(repository) {
  const missing = REQUIRED_METHODS.filter((method) => typeof repository[method] !== "function");
  if (missing.length) {
    throw new Error(`仓储实现缺少方法：${missing.join(", ")}`);
  }
  return true;
}

function unsupportedRepositoryMethod(method) {
  return () => {
    throw new Error(`仓储方法尚未实现：${method}`);
  };
}

module.exports = {
  REQUIRED_METHODS,
  assertRepositoryContract,
  unsupportedRepositoryMethod
};
