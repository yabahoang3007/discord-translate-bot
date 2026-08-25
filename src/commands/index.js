const translateLanguages = require("./translateLanguages");
const translateChannel = require("./translateChannel");
const translateStatus = require("./translateStatus");
const muteLanguage = require("./muteLanguage");
const memberList = require("./memberList");
const languageChannels = require("./languageChannels");
const declareLanguage = require("./declareLanguage");
const createSticker = require("./createSticker");

const commands = [
  translateLanguages,
  translateChannel,
  translateStatus,
  muteLanguage,
  memberList,
  languageChannels,
  declareLanguage,
  createSticker,
];

module.exports = { commands };
