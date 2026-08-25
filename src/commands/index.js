const translateLanguages = require("./translateLanguages");
const translateChannel = require("./translateChannel");
const translateStatus = require("./translateStatus");
const muteLanguage = require("./muteLanguage");
const memberList = require("./memberList");

const commands = [translateLanguages, translateChannel, translateStatus, muteLanguage, memberList];

module.exports = { commands };
