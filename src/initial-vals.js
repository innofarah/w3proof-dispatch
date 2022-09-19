"use strict";
const os = require('os');
const confdirpath = os.homedir() + '/.config/w3proof-dispatch';
const configpath = confdirpath + "/config.json";
const keystorepath = confdirpath + "/keystore.json";
const profilespath = confdirpath + "/profiles.json";
module.exports = { configpath, confdirpath, keystorepath, profilespath };
