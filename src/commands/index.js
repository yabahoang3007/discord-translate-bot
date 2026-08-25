const translateLanguages = require("./translateLanguages");
const translateChannel = require("./translateChannel");
const translateStatus = require("./translateStatus");

const commands = [translateLanguages, translateChannel, translateStatus];

module.exports = { commands };
