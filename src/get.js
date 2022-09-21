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
const util = require('util');
const stream = require('stream');
const fetch = require('node-fetch').default;
const initialVals = require("./initial-vals");
const { configpath, profilespath, keystorepath } = initialVals;
// cid refers to: formula, sequent, assertion, or sequence
let getCommand = (cid, directoryPath) => __awaiter(void 0, void 0, void 0, function* () {
    let result = {};
    yield ensureFullDAG(cid);
    try {
        let mainObj = yield ipfsGetObj(cid);
        if (Object.keys(mainObj).length != 0) { // test if mainObj != {}
            if (!isFormula(mainObj) && !isNamedFormula(mainObj) && !isSequent(mainObj) && !isAssertion(mainObj) && !isSequence(mainObj))
                throw new Error("ERROR: Retrieved object has unknown/invalid format.");
            let mainObjFormat = mainObj["format"];
            if (mainObjFormat == "assertion") {
                if (verifySignature(mainObj)) {
                    let sequent = yield ipfsGetObj(mainObj["sequent"]["/"]);
                    yield processSequent(sequent, result, mainObj["agent"]);
                }
                else
                    throw new Error("ERROR: Assertion not verified.");
            }
            else if (mainObjFormat == "formula" || mainObjFormat == "named-formula")
                yield processFormula(mainObj);
            else if (mainObjFormat == "sequent")
                yield processSequent(mainObj, result, "");
            else if (mainObjFormat == "sequence")
                yield processSequence(mainObj, result);
        }
        else
            throw new Error("ERROR: Retrieved object is empty.");
        if (!fs.existsSync(directoryPath))
            fs.mkdirSync(directoryPath, { recursive: true });
        fs.writeFileSync(directoryPath + "/" + cid + ".json", JSON.stringify(result));
        console.log("Input to Prover Constructed: DAG referred to by this cid is in the file named " + cid + ".json");
    }
    catch (err) {
        console.log(err);
    }
});
let processFormula = (obj) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("The given cid refers to the formula object:");
    console.log(obj);
    console.log("This format is NOT allowed/expected to be imported -> NO FILE IS CONSTRUCTED");
});
let processSequent = (obj, result, signer) => __awaiter(void 0, void 0, void 0, function* () {
    let lemmas = obj["lemmas"];
    let namedConclusion = yield ipfsGetObj(obj["conclusion"]["/"]);
    let entry = {};
    let theoremName = namedConclusion["name"];
    if (result[theoremName]) {
        // test if different cidformula => error, exit
        // if same cidformula => entry = outputObj[theoremName]
        entry = result[theoremName];
        if (entry["cidFormula"] != obj["conclusion"]["/"]) {
            console.error("ERROR: Different formula using same name --> not allowed");
            process.exit(0);
        }
    }
    else {
        entry["cidFormula"] = obj["conclusion"]["/"]; // cid of named formula - could change it to raw formula
        let formula = yield ipfsGetObj(namedConclusion["formula"]["/"]);
        entry["formula"] = formula["formula"];
        entry["SigmaFormula"] = formula["Sigma"];
        entry["sequents"] = [];
    }
    let sequent = {};
    sequent["lemmas"] = yield unfoldLemmas(lemmas);
    if (signer != "") {
        let keystore = JSON.parse(fs.readFileSync(keystorepath));
        let fingerPrint;
        if (keystore[signer]) {
            fingerPrint = keystore[signer];
        }
        else {
            fingerPrint = crypto.createHash('sha256').update(signer).digest('hex');
            keystore[signer] = fingerPrint;
            fs.writeFileSync(keystorepath, JSON.stringify(keystore));
        }
        sequent["signer"] = fingerPrint;
    }
    entry["sequents"].push(sequent);
    result[theoremName] = entry;
});
let processSequence = (obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    let sequentsLinks = obj["sequents"]; // sequents or assertions
    for (let link of sequentsLinks) {
        let entry = yield ipfsGetObj(link["/"]);
        if (isAssertion(entry)) {
            if (verifySignature(entry)) {
                let sequent = yield ipfsGetObj(entry["sequent"]["/"]);
                yield processSequent(sequent, result, entry["agent"]);
            }
            else {
                console.log("ERROR: Assertion not verified");
                process.exit(1);
            }
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
        let namedformulaObject = yield ipfsGetObj(lemma["/"]);
        let formulaObject = yield ipfsGetObj(namedformulaObject["formula"]["/"]);
        lemmaFormulaObjects.push({ "name": namedformulaObject["name"], "cidFormula": lemma["/"],
            "formula": formulaObject["formula"], "SigmaFormula": formulaObject["Sigma"] });
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
        console.error("ERROR: getting object from ipfs failed");
        return {};
    }
});
let ensureFullDAG = (cid) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        //test if it exists locally / or tries to retrieve the missing links in case the ipfs daemon is activated
        let cmd = "ipfs dag export -p " + cid + " > tmpp.car";
        // for now : causes a problem if we use an address with slashes "/" since ipfs export doesn't support it currently
        console.log("ipfs daemon working on retrieving DAG .. Please be patient ..");
        execSync(cmd, { encoding: 'utf-8' }); // this fails if there are missing links from the local ipfs repo / or unsuccessful to retrieve in case the ipfs daemon is activated
        fs.unlink('tmpp.car', (err) => {
            if (err)
                throw err;
        });
    }
    catch (err) {
        console.log("There are missing links that were not found in the local ipfs cache OR the ipfs daemon (if activated) has not been able to find them, trying to retrieve them from the specified gateway ..");
        let config = JSON.parse(fs.readFileSync(configpath));
        let gateway;
        if (config["my-gateway"])
            gateway = config["my-gateway"];
        else {
            console.log("ERROR: gateway should be specified as trying to retreive data through it .. ");
            process.exit(1);
        }
        let url = gateway + "/api/v0/dag/export?arg=" + cid;
        //let result = await axios.get(url)
        // problem here: we need to return the result as a stream to properly create the .car file from it -> axios not sufficient
        try {
            const streamPipeline = util.promisify(stream.pipeline);
            const response = yield fetch(url);
            if (!response.ok)
                throw new Error(`unexpected response ${response.statusText}`);
            yield streamPipeline(response.body, fs.createWriteStream('tmpp.car'));
            //fs.writeFileSync("tmpp.car", response.body)
            execSync("ipfs dag import tmpp.car", { encoding: 'utf-8' });
            fs.unlink('tmpp.car', (err) => {
                if (err)
                    throw err;
            });
        }
        catch (err) {
            console.log(err);
            process.exit(1);
        }
    }
});
let isAssertion = (obj) => {
    if (Object.keys(obj).length == 4 && "format" in obj && obj["format"] == "assertion") {
        return ("agent" in obj && "sequent" in obj && "signature" in obj);
    }
    return false;
};
let isSequent = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "sequent") {
        return ("lemmas" in obj && "conclusion" in obj);
    }
    return false;
};
let isSequence = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "sequence") {
        return ("name" in obj && "sequents" in obj);
    }
    return false;
};
let isFormula = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "formula") {
        return ("formula" in obj && "Sigma" in obj);
    }
    return false;
};
let isNamedFormula = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "named-formula") {
        return ("name" in obj && "formula" in obj);
    }
    return false;
};
let verifySignature = (assertion) => {
    let signature = assertion["signature"];
    let claimedPublicKey = assertion["agent"];
    // the data to verify : here it's the asset's cid in the object
    let dataToVerify = assertion["sequent"]["/"];
    const verify = crypto.createVerify('SHA256');
    verify.write(dataToVerify);
    verify.end();
    let signatureVerified = verify.verify(claimedPublicKey, signature, 'hex');
    return signatureVerified;
};
module.exports = { getCommand };
