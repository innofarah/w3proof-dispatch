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
const verification = require("./verifications");
const { configpath, profilespath, keystorepath } = initialVals;
const { isDeclarations, isFormula, isNamedFormula, isSequent, isAssertion, isSequence, verifySignature } = verification;
// we need a general get <cid> command that works according to "format":
// declarations ->
// formula ->
// named-formula ->
// sequent ->
// assertion ->
// sequence -> similar to the way we has a standard format for "sequence" at publish, there will be a similar one at get
// etc...  
// dispatch will produce an output for all these object types, and a consumer (prover for ex) would decide what format it reads and how it should read it.
//let getCommand = async (cid: string, filepath) => {
let getCommand = (cid, directoryPath) => __awaiter(void 0, void 0, void 0, function* () {
    /*let outputPath
    if (Object.values(filepath).length != 0) {
        outputPath =  Object.values(filepath)
    }
    else { // if no filepath argument(option) is given
        outputPath = cid + ".json" // the default value for the output file path
    }*/
    let result = {};
    yield ensureFullDAG(cid);
    try {
        let mainObj = yield ipfsGetObj(cid);
        if (Object.keys(mainObj).length != 0) { // test if mainObj != {}
            if (!isDeclarations(mainObj) && !isFormula(mainObj) && !isNamedFormula(mainObj) && !isSequent(mainObj) && !isAssertion(mainObj) && !isSequence(mainObj))
                throw new Error("ERROR: Retrieved object has unknown/invalid format.");
            let mainObjFormat = mainObj["format"];
            // for now we will implement only "sequence" get
            if (mainObjFormat == "declarations") {
                yield getDeclarations(cid, mainObj, result);
            }
            else if (mainObjFormat == "named-formula") {
                yield getNamedFormula(cid, mainObj, result);
            }
            else if (mainObjFormat == "formula") {
                yield getFormula(cid, mainObj, result);
            }
            else if (mainObjFormat == "sequent") {
                yield getSequent(cid, mainObj, result);
            }
            else if (mainObjFormat == "assertion") {
                yield getAssertion(cid, mainObj, result);
            }
            else if (mainObjFormat == "sequence") {
                yield getSequence(cid, mainObj, result);
            }
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
let processFormula = (cid, result, named) => __awaiter(void 0, void 0, void 0, function* () {
    let mainObj = yield ipfsGetObj(cid);
    let output = {};
    if (named) {
        output["name"] = mainObj["name"];
        output["cid-formula"] = mainObj["formula"]["/"];
        mainObj = yield ipfsGetObj(mainObj["formula"]["/"]);
    }
    output["language"] = mainObj["language"];
    output["content"] = yield ipfsGetObj(mainObj["content"]["/"]);
    output["declarations"] = mainObj["declarations"]["/"];
    let cidDeclarations = mainObj["declarations"]["/"];
    if (!result["declarations"][cidDeclarations]) {
        result["declarations"][cidDeclarations] = yield processDeclarations(cidDeclarations, result);
    }
    return output;
});
let processDeclarations = (cid, result) => __awaiter(void 0, void 0, void 0, function* () {
    let declarationsObj = yield ipfsGetObj(cid);
    let declarationsOutput = {};
    declarationsOutput["language"] = declarationsObj["language"];
    let content = yield ipfsGetObj(declarationsObj["content"]["/"]);
    declarationsOutput["content"] = content;
    return declarationsOutput;
});
let processAssertion = (assertion, result) => __awaiter(void 0, void 0, void 0, function* () {
    let sequent = yield ipfsGetObj(assertion["sequent"]["/"]);
    let assertionOutput = {};
    assertionOutput["agent"] = fingerPrint(assertion["agent"]);
    let conclusionCid = sequent["conclusion"]["/"];
    assertionOutput["conclusion"] = conclusionCid;
    result["named-formulas"][conclusionCid] = yield processFormula(conclusionCid, result, true);
    assertionOutput["lemmas"] = [];
    for (let lemmaLink of sequent["lemmas"]) {
        let lemmaCid = lemmaLink["/"];
        assertionOutput["lemmas"].push(lemmaCid);
        result["named-formulas"][lemmaCid] = yield processFormula(lemmaCid, result, true);
    }
    return assertionOutput;
});
let processSequent = (cid, result) => __awaiter(void 0, void 0, void 0, function* () {
    let sequent = yield ipfsGetObj(cid);
    let sequentOutput = {};
    let conclusionCid = sequent["conclusion"]["/"];
    sequentOutput["conclusion"] = conclusionCid;
    result["named-formulas"][conclusionCid] = yield processFormula(conclusionCid, result, true);
    sequentOutput["lemmas"] = [];
    for (let lemmaLink of sequent["lemmas"]) {
        let lemmaCid = lemmaLink["/"];
        sequentOutput["lemmas"].push(lemmaCid);
        result["named-formulas"][lemmaCid] = yield processFormula(lemmaCid, result, true);
    }
    return sequentOutput;
});
let getDeclarations = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "declarations";
    let declarationsOutput = yield processDeclarations(cidObj, result);
    result["declaration"] = declarationsOutput;
});
let getFormula = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "formula";
    result["formula"] = {};
    result["declarations"] = {};
    let formulaOutput = yield processFormula(cidObj, result, false);
    result["formula"] = formulaOutput;
});
let getNamedFormula = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "named-formula";
    result["named-formula"] = {};
    result["declarations"] = {};
    let namedFormulaOutput = yield processFormula(cidObj, result, true);
    result["named-formula"] = namedFormulaOutput;
});
let getSequent = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "sequent";
    result["sequent"] = {}; // notice putting "sequent" instead of "assertion" and "assertions"
    result["named-formulas"] = {}; // same as assertion and assertions
    result["declarations"] = {};
    let sequentOutput = yield processSequent(cidObj, result);
    result["sequent"] = sequentOutput;
});
let getAssertion = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "assertion";
    // no result["language"] as not a "sequence" --> maybe remove this also from sequent? don't know
    // no result["name"] too as assertions/sequents has no given names
    result["assertion"] = {}; // notice putting "assertion" and not "assertions"
    result["named-formulas"] = {}; // possibly many formulas will be linked and thus many declarations too
    result["declarations"] = {};
    let assertion = yield ipfsGetObj(cidObj);
    if (verifySignature(assertion)) { // should we verify the assertion type?
        let assertionOutput = yield processAssertion(assertion, result);
        result["assertion"] = assertionOutput;
    }
    else {
        console.log("ERROR: Assertion not verified");
        process.exit(1);
    }
});
let getSequence = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "sequence";
    result["language"] = obj["language"];
    result["name"] = obj["name"];
    result["assertions"] = [];
    result["named-formulas"] = {};
    result["declarations"] = {};
    let assertionsLinks = obj["assertions"]; // a sequence is a collection of assertions
    for (let link of assertionsLinks) {
        let assertion = yield ipfsGetObj(link["/"]);
        if (verifySignature(assertion)) { // should we verify the assertion type?
            let assertionOutput = yield processAssertion(assertion, result);
            result["assertions"].push(assertionOutput);
        }
        else {
            console.log("ERROR: Assertion not verified");
            process.exit(1);
        }
    }
});
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
module.exports = { getCommand };
