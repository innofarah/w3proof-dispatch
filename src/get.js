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
const { execSync } = require('child_process');
const crypto = require('crypto');
// cid refers to: formula, sequent, assertion, or sequence
let getCommand = (cid, directoryPath) => __awaiter(void 0, void 0, void 0, function* () {
    let result = {};
    try {
        let mainObj = yield ipfsGetObj(cid);
        if (mainObj != {}) {
            if (!isFormula(mainObj) && !isSequent(mainObj) && !isAssertion(mainObj) && !isSequence(mainObj))
                throw new Error("Retrieved object has unknown/invalid format.");
            let mainObjFormat = mainObj["format"];
            if (mainObjFormat == "assertion") {
                if (verifySignature(mainObj)) {
                    let asset = yield ipfsGetObj(mainObj["asset"]["/"]);
                    yield processSequent(asset, result, mainObj["principal"]);
                }
                else
                    throw new Error("Assertion not verified.");
            }
            else if (mainObjFormat == "asset") {
                let assetType = mainObj["assetType"];
                switch (assetType) {
                    case 'formula':
                        yield processFormula(mainObj);
                    case 'sequent':
                        yield processSequent(mainObj, result, "");
                    case 'sequence':
                        yield processSequence(mainObj, result);
                }
            }
        }
        else
            throw new Error("Retrieved object is empty.");
        if (!fs.existsSync(directoryPath))
            fs.mkdirSync(directoryPath, { recursive: true });
        fs.writeFileSync(directoryPath + "/" + cid + ".json", JSON.stringify(result));
        console.log("dag referred to by this cid is in the file named thecid.json to be used by abella");
    }
    catch (err) {
        console.log(err);
    }
});
let processFormula = (obj) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("the given cid refers to the formula object:");
    console.log(obj);
    console.log("This format is NOT allowed/expected to be imported.");
});
let processSequent = (obj, result, signer) => __awaiter(void 0, void 0, void 0, function* () {
    let lemmas = obj["lemmas"];
    let conclusion = yield ipfsGetObj(obj["conclusion"]["/"]);
    let entry = {};
    let theoremName = conclusion["name"];
    if (result[theoremName]) {
        // test if different cidformula => error, exit
        // if same cidformula => entry = outputObj[theoremName]
        entry = result[theoremName];
        if (entry["cidFormula"] != obj["conclusion"]["/"]) {
            console.error("Different formula using same name --> not allowed");
            process.exit(0);
        }
    }
    else {
        entry["cidFormula"] = obj["conclusion"]["/"];
        entry["formula"] = conclusion["formula"];
        entry["sigmaFormula"] = conclusion["sigma"];
        entry["sequents"] = [];
    }
    let sequent = {};
    sequent["lemmas"] = yield unfoldLemmas(lemmas);
    if (signer != "")
        sequent["signer"] = signer;
    entry["sequents"].push(sequent);
    result[theoremName] = entry;
    //console.log(outputObj)
    //console.log("sequents")
    //console.log(outputObj[theoremName]["sequents"])
});
let processSequence = (obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    let sequentsLinks = obj["sequents"]; // sequents or assertions
    for (let link of sequentsLinks) {
        let entry = yield ipfsGetObj(link["/"]);
        if (isAssertion(entry)) {
            let asset = yield ipfsGetObj(entry["asset"]["/"]);
            yield processSequent(asset, result, entry["principal"]);
        }
        else if (isSequent(entry)) {
            yield processSequent(entry, result, "");
        }
    }
});
let unfoldLemmas = (lemmas) => __awaiter(void 0, void 0, void 0, function* () {
    // fix to add checks
    let lemmaFormulaObjects = [];
    for (let lemma of lemmas) {
        let formulaObject = yield ipfsGetObj(lemma["/"]);
        lemmaFormulaObjects.push({ "name": formulaObject["name"], "formula": formulaObject["formula"], "sigma": formulaObject["sigma"] });
    }
    return lemmaFormulaObjects;
});
let ipfsGetObj = (cid) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let cmd = "ipfs dag get " + cid + " > " + cid + ".json";
        execSync(cmd, { encoding: 'utf-8' });
        let obj = JSON.parse(fs.readFileSync(cid + ".json"));
        fs.unlinkSync(cid + ".json");
        return obj;
    }
    catch (error) {
        console.error("getting object from ipfs failed");
        return {};
    }
});
let isAssertion = (obj) => {
    if (Object.keys(obj).length == 4 && "format" in obj && obj["format"] == "assertion") {
        return ("principal" in obj && "asset" in obj && "signature" in obj);
    }
    return false;
};
let isSequent = (obj) => {
    if (Object.keys(obj).length == 4 && "format" in obj && obj["format"] == "asset") {
        return ("assetType" in obj && obj["assetType"] == "sequent" && "lemmas" in obj && "conclusion" in obj);
    }
    return false;
};
let isSequence = (obj) => {
    if (Object.keys(obj).length == 4 && "format" in obj && obj["format"] == "asset") {
        return ("assetType" in obj && obj["assetType"] == "sequence" && "name" in obj && "sequents" in obj);
    }
    return false;
};
let isFormula = (obj) => {
    if (Object.keys(obj).length == 5 && "format" in obj && obj["format"] == "asset") {
        return ("assetType" in obj && obj["assetType"] == "formula" && "name" in obj && "formula" in obj && "sigma" in obj);
    }
    return false;
};
let verifySignature = (assertion) => {
    let signature = assertion["signature"];
    let claimedPublicKey = assertion["principal"];
    // the data to verify : here it's the asset's cid in the object
    let dataToVerify = assertion["asset"]["/"];
    const verify = crypto.createVerify('SHA256');
    verify.write(dataToVerify);
    verify.end();
    let signatureVerified = verify.verify(claimedPublicKey, signature, 'hex');
    return signatureVerified;
};
module.exports = { getCommand };
