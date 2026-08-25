const translateLanguages = require("./translateLanguages");
const translateChannel = require("./translateChannel");
const translateStatus = require("./translateStatus");
const muteLanguage = require("./muteLanguage");
const memberList = require("./memberList");
const languageChannels = require("./languageChannels");

const commands = [translateLanguages, translateChannel, translateStatus, muteLanguage, memberList, languageChannels];

module.exports = { commands };
