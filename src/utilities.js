"use strict";
// in this file a lot should be added; for example, verifying that all things refered in the sequence are of the same language (check first if this is what we want?)
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// for now only check that the the object has the correct attributes (without checking the types of their values)
const crypto = require('crypto');
const fs = require('fs');
const { execSync } = require('child_process');
const util = require('util');
const stream = require('stream');
const fetch = require('node-fetch').default;
const initialVals = require("./initial-vals");
const { configpath, profilespath, keystorepath, allowlistpath } = initialVals;
let isDeclaration = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "declaration") {
        return ("language" in obj && "content" in obj);
    }
};
let isFormula = (obj) => {
    if (Object.keys(obj).length == 4 && "format" in obj && obj["format"] == "formula") {
        return ("language" in obj && "content" in obj && "declaration" in obj);
    }
    return false;
};
let isNamedFormula = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "named-formula") {
        return ("name" in obj && "formula" in obj);
    }
    return false;
};
let isSequent = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "sequent") {
        return ("lemmas" in obj && "conclusion" in obj);
    }
    return false;
};
let isAssertion = (obj) => {
    if (Object.keys(obj).length == 4 && "format" in obj && obj["format"] == "assertion") {
        return ("agent" in obj && "sequent" in obj && "signature" in obj);
    }
    return false;
};
let isSequence = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "sequence") {
        return ("name" in obj && "assertions" in obj);
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
let fingerPrint = (agent) => {
    let keystore = JSON.parse(fs.readFileSync(keystorepath));
    let fingerPrint;
    if (keystore[agent]) {
        fingerPrint = keystore[agent];
    }
    else {
        fingerPrint = crypto.createHash('sha256').update(agent).digest('hex');
        keystore[agent] = fingerPrint;
        fs.writeFileSync(keystorepath, JSON.stringify(keystore));
    }
    return fingerPrint;
};
let inAllowList = (agent) => {
    try {
        let allowList = JSON.parse(fs.readFileSync(allowlistpath));
        return (allowList.includes(agent));
    }
    catch (error) {
        console.error(new Error("problem in checking allowlist"));
        process.exit(1);
    }
};
// --------------------------
// for retrieval from ipfs
// --------------------------
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
module.exports = { isDeclaration, isFormula, isNamedFormula, isSequent, isAssertion,
    isSequence, verifySignature, fingerPrint, inAllowList, ipfsGetObj, ensureFullDAG };
