"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require('fs');
const crypt = require('crypto');
//const { configpath, confdirpath, keystorepath, agentprofilespath } = require('./initial-vals')
const initialVals = require("./initial-vals");
const { configpath, confdirpath, keystorepath, agentprofilespath, toolprofilespath, languagespath, allowlistpath } = initialVals;
const utilities = require("./utilities");
const { ipfsAddObj, publishDagToCloud } = utilities;
let setup = () => {
    // try to read ~/.config/w3proof-dispatch/config.json --> create if doesn't exist
    if (!fs.existsSync(configpath)) {
        fs.mkdirSync(confdirpath, { recursive: true }); // it creates any directory in the specified path if it does not exist
        let configObj = {
            "my-gateway": "http://dweb.link",
            "my-web3.storage-api-token": "**insert your token here**",
        };
        fs.writeFileSync(configpath, JSON.stringify(configObj));
    }
    if (!fs.existsSync(keystorepath)) {
        fs.writeFileSync(keystorepath, JSON.stringify({}));
    }
    if (!fs.existsSync(agentprofilespath)) {
        fs.writeFileSync(agentprofilespath, JSON.stringify({}));
    }
    if (!fs.existsSync(toolprofilespath)) {
        fs.writeFileSync(toolprofilespath, JSON.stringify({}));
    }
    if (!fs.existsSync(languagespath)) {
        fs.writeFileSync(languagespath, JSON.stringify({}));
    }
    if (!fs.existsSync(allowlistpath)) {
        fs.writeFileSync(allowlistpath, JSON.stringify([]));
    }
};
let createAgent = (profileName) => {
    /* const {
        publicKey,
        privateKey
    } = crypto.generateKeyPairSync('rsa', {
        modulusLength : 4096,
        publicKeyEncoding: {
            type : 'spki',
            format : 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            cipher: 'aes-256-cbc',
            passphrase: 'top secret'
        }
    }) */
    const { privateKey, publicKey } = crypt.generateKeyPairSync('ec', {
        namedCurve: 'sect239k1',
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    // create a profile and add it to the profiles file
    let fingerPrint = crypt.createHash('sha256').update(publicKey).digest('hex');
    let profiles = JSON.parse(fs.readFileSync(agentprofilespath));
    let newProfile = {
        "name": profileName,
        "public-key": publicKey,
        "private-key": privateKey,
        "fingerprint": fingerPrint
    };
    profiles[profileName] = newProfile;
    try {
        fs.writeFileSync(agentprofilespath, JSON.stringify(profiles));
        console.log("Agent profile " + profileName + " created successfully!");
    }
    catch (err) {
        console.log(err);
    }
};
let createTool = (toolProfileName, inputType, input) => __awaiter(void 0, void 0, void 0, function* () {
    let toolCid = "";
    if (inputType == "file") {
        try {
            let data = fs.readFileSync(input, { encoding: 'utf-8' }); //assuming the data is text
            // but maybe it's not?
            //let data = fs.readFileSync(input)
            let contentCid = yield ipfsAddObj(data);
            toolCid = yield ipfsAddObj({
                "format": "tool",
                "content": { "/": contentCid }
            });
        }
        catch (err) {
            console.log(err);
            process.exit(process.exitCode);
        }
    }
    else if (inputType == "json") {
        try {
            let data = JSON.parse(fs.readFileSync(input)); //assuming the data is json
            // but maybe it's not?
            //let data = fs.readFileSync(input)
            let contentCid = yield ipfsAddObj(data);
            toolCid = yield ipfsAddObj({
                "format": "tool",
                "content": { "/": contentCid }
            });
        }
        catch (err) {
            console.log(err);
            process.exit(process.exitCode);
        }
    }
    else if (inputType == "cid")
        toolCid = input; // assuming the cid refers to a "format" = "tool" object --> check later
    let toolProfile = {
        "name": toolProfileName,
        "tool": toolCid
    };
    let toolProfiles = JSON.parse(fs.readFileSync(toolprofilespath));
    toolProfiles[toolProfileName] = toolProfile;
    try {
        fs.writeFileSync(toolprofilespath, JSON.stringify(toolProfiles));
        console.log("Tool profile " + toolProfileName + " created successfully!");
    }
    catch (err) {
        console.log(err);
    }
});
// check that cid refers to "format"="language" type --> later
let createLanguage = (languageName, inputType, input) => __awaiter(void 0, void 0, void 0, function* () {
    let languageCid = "";
    if (inputType == "file") {
        try {
            let data = fs.readFileSync(input, { encoding: 'utf-8' }); //assuming the data is text
            // but maybe it's not?
            //let data = fs.readFileSync(input)
            let contentCid = yield ipfsAddObj(data);
            languageCid = yield ipfsAddObj({
                "format": "language",
                "content": { "/": contentCid }
            });
        }
        catch (err) {
            console.log(err);
            process.exit(process.exitCode);
        }
    }
    else if (inputType == "json") {
        try {
            let data = JSON.parse(fs.readFileSync(input)); //assuming the data is json
            // but maybe it's not?
            //let data = fs.readFileSync(input)
            let contentCid = yield ipfsAddObj(data);
            languageCid = yield ipfsAddObj({
                "format": "language",
                "content": { "/": contentCid }
            });
        }
        catch (err) {
            console.log(err);
            process.exit(process.exitCode);
        }
    }
    else if (inputType == "cid")
        languageCid = input; // assuming the cid refers to a "format" = "language" object --> check later
    let language = {
        "name": languageName,
        "language": languageCid
    };
    let languages = JSON.parse(fs.readFileSync(languagespath));
    languages[languageName] = language;
    try {
        fs.writeFileSync(languagespath, JSON.stringify(languages));
        console.log("Language record " + languageName + " created successfully!");
    }
    catch (err) {
        console.log(err);
    }
});
let setweb3token = (token) => {
    let configFile = fs.readFileSync(configpath);
    let config = JSON.parse(configFile);
    config["my-web3.storage-api-token"] = token;
    try {
        fs.writeFileSync(configpath, JSON.stringify(config));
    }
    catch (err) {
        console.log(err);
    }
};
let setgateway = (gateway) => {
    let configFile = fs.readFileSync(configpath);
    let config = JSON.parse(configFile);
    config["my-gateway"] = gateway;
    try {
        fs.writeFileSync(configpath, JSON.stringify(config));
    }
    catch (err) {
        console.log(err);
    }
};
/*let trustagent = (agent: string) => {
    let allowlistFile = fs.readFileSync(allowlistpath)
    let allowList = JSON.parse(allowlistFile)
    allowList.push(agent)
    allowList = Array.from(new Set(allowList)) // agent listed only once
    try {
        fs.writeFileSync(allowlistpath, JSON.stringify(allowList))
    }
    catch (err) {
        console.log(err)
    }
}*/
let listconfig = () => {
    let configFile = fs.readFileSync(configpath);
    let config = JSON.parse(configFile);
    console.log(config);
};
module.exports = { setup, createAgent, createTool, createLanguage, setweb3token, setgateway, listconfig };
