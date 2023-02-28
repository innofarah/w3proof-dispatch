"use strict";
// in this file a lot should be added; for example, verifying that all things refered in the sequence are of the same language (check first if this is what we want?)
// for now only check that the the object has the correct attributes (without checking the types of their values)
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const crypto = require('crypto');
const fs = require('fs');
const { execSync } = require('child_process');
const util = require('util');
const stream = require('stream');
const fetch = require('node-fetch').default;
const { Web3Storage } = require('web3.storage');
const { CarReader } = require('@ipld/car');
const initialVals = require("./initial-vals");
const { configpath, agentprofilespath, toolprofilespath, keystorepath, allowlistpath } = initialVals;
let isDeclaration = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "declaration") {
        return ("language" in obj && "content" in obj);
    }
};
let isAnnotatedDeclaration = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "annotated-declaration") {
        return ("declaration" in obj && "annotation" in obj);
    }
};
let isFormula = (obj) => {
    if (Object.keys(obj).length == 4 && "format" in obj && obj["format"] == "formula") {
        return ("language" in obj && "content" in obj && "declarations" in obj);
    }
    return false;
};
let isAnnotatedFormula = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "annotated-formula") {
        return ("formula" in obj && "annotation" in obj);
    }
    return false;
};
let isSequent = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "sequent") {
        return ("dependencies" in obj && "conclusion" in obj);
    }
    return false;
};
let isAnnotatedSequent = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "annotated-sequent") {
        return ("sequent" in obj && "annotation" in obj);
    }
    return false;
};
let isTool = (obj) => {
    if (Object.keys(obj).length == 2 && "format" in obj && obj["format"] == "tool") {
        return ("content" in obj);
    }
    return false;
};
let isLanguage = (obj) => {
    if (Object.keys(obj).length == 2 && "format" in obj && obj["format"] == "language") {
        return ("content" in obj);
    }
    return false;
};
let isProduction = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "production") {
        return ("sequent" in obj && "tool" in obj);
    }
    return false;
};
let isAnnotatedProduction = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "annotated-production") {
        return ("production" in obj && "annotation" in obj);
    }
    return false;
};
let isAssertion = (obj) => {
    if (Object.keys(obj).length == 4 && "format" in obj && obj["format"] == "assertion") {
        return ("agent" in obj && "statement" in obj && "signature" in obj);
    }
    return false;
};
let isCollection = (obj) => {
    if (Object.keys(obj).length == 3 && "format" in obj && obj["format"] == "collection") {
        return ("name" in obj && "elements" in obj);
    }
    return false;
};
// the standard format types to publish and get
let isOfSpecifiedTypes = (obj) => {
    return (isDeclaration(obj) || isFormula(obj)
        || isSequent(obj) || isProduction(obj)
        || isAssertion(obj) || isCollection(obj)
        || isAnnotatedDeclaration(obj) || isAnnotatedFormula(obj)
        || isAnnotatedSequent(obj) || isAnnotatedProduction(obj));
};
let verifySignature = (assertion) => {
    let signature = assertion["signature"];
    let claimedPublicKey = assertion["agent"];
    // the data to verify : here it's the asset's cid in the object
    let dataToVerify = assertion["statement"]["/"];
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
// --------------------------
// for adding to ipfs (+cloud)
// --------------------------
let ipfsAddObj = (obj) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        fs.writeFileSync("tmpJSON.json", JSON.stringify(obj));
        let addcmd = "ipfs dag put tmpJSON.json --pin";
        let output = execSync(addcmd, { encoding: 'utf-8' });
        fs.unlinkSync('tmpJSON.json');
        return output.substring(0, output.length - 1);
    }
    catch (error) {
        console.error("ERROR: adding object to ipfs failed");
        return "";
    }
});
// subject to change, check if adding as file is the correct (and better) thing to do for declarations content and formula string
/*let ipfsAddFile = async (data: string) => {
    try {
        fs.writeFileSync("tmpFile.txt", data)
        let addcmd = "ipfs add tmpFile.txt --cid-version 1 --pin"
        let output = execSync(addcmd, { encoding: 'utf-8' })

        fs.unlinkSync('tmpFile.txt')
        //return output.substring(0, output.length - 1)
        return output.split(" ")[1] // not really best way to do it (must us nodjs ipfs api not cmd)
    } catch (error) {
        console.error("ERROR: adding object to ipfs failed");
        return ""
    }
}*/
let publishDagToCloud = (cid) => __awaiter(void 0, void 0, void 0, function* () {
    let web3Token, web3Client;
    try {
        let config = JSON.parse(fs.readFileSync(configpath));
        if (config["my-web3.storage-api-token"]
            && config["my-web3.storage-api-token"] != "**insert your token here**") {
            web3Token = config["my-web3.storage-api-token"];
            web3Client = new Web3Storage({ token: web3Token });
        }
        else {
            throw new Error("ERROR: setting a web3.storage token is required as the chosen mode for publishing is 'cloud' and not 'local'.");
        }
        let cmd = "ipfs dag export " + cid + " > tmpcar.car";
        execSync(cmd, { encoding: 'utf-8' });
        const inStream = fs.createReadStream('tmpcar.car');
        // read and parse the entire stream in one go, this will cache the contents of
        // the car in memory so is not suitable for large files.
        const reader = yield CarReader.fromIterable(inStream);
        const cid1 = yield web3Client.putCar(reader);
        console.log("DAG successfully published to web3.storage!");
        console.log("root cid: " + cid);
        fs.unlink('tmpcar.car', (err) => {
            if (err)
                throw err;
        });
    }
    catch (err) {
        console.log(err);
    }
});
module.exports = { isOfSpecifiedTypes, isDeclaration, isFormula, isSequent, isProduction, isAssertion,
    isCollection, isAnnotatedDeclaration, isAnnotatedFormula, isAnnotatedSequent,
    isAnnotatedProduction,
    verifySignature, fingerPrint, inAllowList, ipfsGetObj, ensureFullDAG,
    ipfsAddObj, publishDagToCloud };
