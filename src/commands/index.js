const translateLanguages = require("./translateLanguages");
const translateChannel = require("./translateChannel");
const translateStatus = require("./translateStatus");
const muteLanguage = require("./muteLanguage");

const commands = [translateLanguages, translateChannel, translateStatus, muteLanguage];

module.exports = { commands };
