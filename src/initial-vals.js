"use strict";
const os = require('os');
const confdirpath = os.homedir() + '/.config/w3proof-dispatch';
const configpath = confdirpath + "/config.json";
const keystorepath = confdirpath + "/keystore.json";
const agentprofilespath = confdirpath + "/agentprofiles.json";
const toolprofilespath = confdirpath + "/toolprofiles.json";
const allowlistpath = confdirpath + "/allowlist.json";
module.exports = { configpath, confdirpath, keystorepath, agentprofilespath, toolprofilespath, allowlistpath };
