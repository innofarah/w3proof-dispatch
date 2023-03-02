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
const utilities = require("./utilities");
const { isOfSpecifiedTypes, verifySignature, fingerPrint, ipfsGetObj, ensureFullDAG } = utilities;
// we need a general get <cid> command that works according to "format":
// context ->
// formula ->
// sequent ->
// production ->
// assertion ->
// collection -> similar to the way we has a standard format for "collection" at publish, there will be a similar one at get
// etc...  
// dispatch will produce an output for all these object types, and a consumer (prover for ex) would decide what format it reads and how it should read it. (although the meanings of objects are fixed globally as specified)
//let getCommand = async (cid: string, filepath) => {
//let getCommand = async (cid: string, directoryPath) => {
/*let outputPath
if (Object.values(filepath).length != 0) {
    outputPath =  Object.values(filepath)
}
else { // if no filepath argument(option) is given
    outputPath = cid + ".json" // the default value for the output file path
}*/
// cid refers to: context, formula, sequent, production, assertion, collection, etc. // for now
let getCommand = (cid, directoryPath) => __awaiter(void 0, void 0, void 0, function* () {
    let result = {};
    yield ensureFullDAG(cid);
    try {
        let mainObj = yield ipfsGetObj(cid);
        if (Object.keys(mainObj).length != 0) { // test if mainObj != {}
            if (!isOfSpecifiedTypes(mainObj))
                throw new Error("ERROR: Retrieved object has unknown/invalid format.");
            let mainObjFormat = mainObj["format"];
            if (mainObjFormat == "context") {
                yield getContext(cid, mainObj, result);
            }
            else if (mainObjFormat == "annotated-context") {
                yield getAnnotatedContext(cid, mainObj, result);
            }
            else if (mainObjFormat == "formula") {
                yield getFormula(cid, mainObj, result);
            }
            else if (mainObjFormat == "annotated-formula") {
                yield getAnnotatedFormula(cid, mainObj, result);
            }
            else if (mainObjFormat == "sequent") {
                yield getSequent(cid, mainObj, result);
            }
            else if (mainObjFormat == "annotated-sequent") {
                yield getAnnotatedSequent(cid, mainObj, result);
            }
            else if (mainObjFormat == "production") {
                yield getProduction(cid, mainObj, result);
            }
            else if (mainObjFormat == "annotated-production") {
                yield getAnnotatedProduction(cid, mainObj, result);
            }
            else if (mainObjFormat == "assertion") {
                yield getAssertion(cid, mainObj, result);
            }
            else if (mainObjFormat == "collection") {
                yield getCollection(cid, mainObj, result);
            }
        }
        else
            throw new Error("ERROR: Retrieved object is empty.");
        if (!fs.existsSync(directoryPath))
            fs.mkdirSync(directoryPath, { recursive: true });
        fs.writeFileSync(directoryPath + "/" + cid + ".json", JSON.stringify(result));
        console.log("Input to Prover Constructed: DAG referred to by this cid is in the file " + directoryPath + "/" + cid + ".json");
    }
    catch (err) {
        console.log(err);
    }
});
let processContext = (obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    //let declarationObj = await ipfsGetObj(cid)
    let contextObj = obj;
    let contextOutput = {};
    let languageCid = contextObj["language"]["/"];
    contextOutput["language"] = languageCid;
    let language = yield ipfsGetObj(languageCid); // should check format "language"
    let langContent = yield ipfsGetObj(language["content"]["/"]);
    result["languages"][languageCid] = {};
    result["languages"][languageCid]["content"] = langContent;
    let content = yield ipfsGetObj(contextObj["content"]["/"]);
    contextOutput["content"] = content;
    return contextOutput;
});
let processFormula = (obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    //let mainObj = await ipfsGetObj(cid)
    let mainObj = obj;
    let output = {};
    let languageCid = mainObj["language"]["/"];
    output["language"] = languageCid;
    let language = yield ipfsGetObj(languageCid); // should check format "language"
    let langContent = yield ipfsGetObj(language["content"]["/"]);
    result["languages"][languageCid] = {};
    result["languages"][languageCid]["content"] = langContent;
    output["content"] = yield ipfsGetObj(mainObj["content"]["/"]);
    output["context"] = [];
    for (let contextLink of mainObj["context"]) {
        let cidContext = contextLink["/"];
        output["contexts"].push(cidContext);
        if (!result["contexts"][cidContext]) {
            let contextObj = yield ipfsGetObj(cidContext);
            result["contexts"][cidContext] = yield processContext(contextObj, result);
        }
    }
    return output;
});
let processSequent = (obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    //let sequent = await ipfsGetObj(cid)
    let sequent = obj;
    let sequentOutput = {};
    let conclusionCid = sequent["conclusion"]["/"];
    sequentOutput["conclusion"] = conclusionCid;
    let conclusionObj = yield ipfsGetObj(conclusionCid);
    result["formulas"][conclusionCid] = yield processFormula(conclusionObj, result);
    sequentOutput["dependencies"] = [];
    for (let depLink of sequent["dependencies"]) {
        let depCid = depLink["/"];
        sequentOutput["dependencies"].push(depCid);
        if (!result["formulas"][depCid]) {
            let depObj = yield ipfsGetObj(depCid);
            result["formulas"][depCid] = yield processFormula(depObj, result);
        }
    }
    return sequentOutput;
});
let processProduction = (obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    //let production = await ipfsGetObj(cid)
    let production = obj;
    let productionOutput = {};
    let sequentObj = yield ipfsGetObj(production["sequent"]["/"]);
    productionOutput["sequent"] = yield processSequent(sequentObj, result);
    let mode = production["mode"];
    // addressing expected mode values
    //if (mode == null || mode == "axiom" || mode == "conjecture") {
    //    productionOutput["mode"] = mode
    //}
    // make it more general --> getting doesn't restrict mode values, it just outputs what exists?
    if (mode["/"]) { // ipldLink which should refer to a "tool" format object cid
        let toolCid = production["mode"]["/"];
        productionOutput["mode"] = toolCid;
        let tool = yield ipfsGetObj(toolCid); // should check format "tool"
        let toolContent = yield ipfsGetObj(tool["content"]["/"]);
        result["tools"][toolCid] = {};
        result["tools"][toolCid]["content"] = toolContent;
    }
    else { // case any
        productionOutput["mode"] = mode;
    }
    return productionOutput;
});
let processAssertion = (assertion, result) => __awaiter(void 0, void 0, void 0, function* () {
    let claim = yield ipfsGetObj(assertion["claim"]["/"]);
    let assertionOutput = {};
    assertionOutput["agent"] = fingerPrint(assertion["agent"]);
    assertionOutput["claim"] = {};
    if (claim["format"] == "production") {
        assertionOutput["claim"]["format"] = "production";
        assertionOutput["claim"]["production"] = yield processProduction(claim, result);
    }
    else if (claim["format"] == "annotated-production") {
        assertionOutput["claim"]["format"] = "annotated-production";
        let productionObj = yield ipfsGetObj(claim["production"]["/"]);
        assertionOutput["claim"]["production"] = yield processProduction(productionObj, result);
        assertionOutput["claim"]["annotation"] = yield ipfsGetObj(claim["annotation"]["/"]);
        // later if we add more structure to annotation, we could change the usage of the generic ipfsGetObj
    }
    else {
        // if we want to add new claim type later
    }
    /*let conclusionCid = sequent["conclusion"]["/"]
    assertionOutput["conclusion"] = conclusionCid
    result["named-formulas"][conclusionCid] = await processFormula(conclusionCid, result)

    assertionOutput["lemmas"] = []
    for (let lemmaLink of sequent["lemmas"]) {
        let lemmaCid = lemmaLink["/"]
        assertionOutput["lemmas"].push(lemmaCid)
        result["named-formulas"][lemmaCid] = await processFormula(lemmaCid, result)
    }*/
    return assertionOutput;
});
let processGeneric = (element, result) => __awaiter(void 0, void 0, void 0, function* () {
    if (element["format"] == "context")
        return yield processContext(element, result);
    else if (element["format"] == "annotated-context") {
        let resElement = {};
        let contextObj = yield ipfsGetObj(element["context"]["/"]);
        resElement["context"] = yield processContext(contextObj, result);
        resElement["annotation"] = yield ipfsGetObj(element["annotation"]["/"]);
        return resElement;
    }
    else if (element["format"] == "formula")
        return yield processFormula(element, result);
    else if (element["format"] == "annotated-formula") {
        let resElement = {};
        let formulaObj = yield ipfsGetObj(element["formula"]["/"]);
        resElement["formula"] = yield processFormula(formulaObj, result);
        resElement["annotation"] = yield ipfsGetObj(element["annotation"]["/"]);
        return resElement;
    }
    else if (element["format"] == "sequent")
        return yield processSequent(element, result);
    else if (element["format"] == "annotated-sequent") {
        let resElement = {};
        let sequentObj = yield ipfsGetObj(element["sequent"]["/"]);
        resElement["sequent"] = yield processSequent(sequentObj, result);
        resElement["annotation"] = yield ipfsGetObj(element["annotation"]["/"]);
        return resElement;
    }
    else if (element["format"] == "production")
        return yield processProduction(element, result);
    else if (element["format"] == "annotated-production") {
        let resElement = {};
        let productionObj = yield ipfsGetObj(element["production"]["/"]);
        resElement["production"] = yield processProduction(productionObj, result);
        resElement["annotation"] = yield ipfsGetObj(element["annotation"]["/"]);
        return resElement;
    }
    else if (element["format"] == "assertion") {
        return yield processAssertion(element, result);
    }
    return null;
});
let getContext = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "context";
    result["languages"] = {};
    result["context"] = yield processContext(obj, result);
});
let getAnnotatedContext = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "annotated-context";
    result["annotated-context"] = {};
    result["languages"] = {};
    let contextObj = yield ipfsGetObj(obj["context"]["/"]);
    let contextOutput = yield processContext(contextObj, result);
    result["annotated-context"]["context"] = contextOutput;
    result["annotated-context"]["annotation"] = yield ipfsGetObj(obj["annotation"]["/"]);
});
let getFormula = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "formula";
    result["formula"] = {};
    result["contexts"] = {};
    result["languages"] = {};
    let formulaOutput = yield processFormula(obj, result);
    result["formula"] = formulaOutput;
});
let getAnnotatedFormula = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "annotated-formula";
    result["annotated-formula"] = {};
    result["contexts"] = {};
    result["languages"] = {};
    let formulaObj = yield ipfsGetObj(obj["formula"]["/"]);
    let formulaOutput = yield processFormula(formulaObj, result);
    result["annotated-formula"]["formula"] = formulaOutput;
    result["annotated-formula"]["annotation"] = yield ipfsGetObj(obj["annotation"]["/"]);
});
let getSequent = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "sequent";
    result["sequent"] = {}; // notice putting "sequent" instead of "assertion" and "assertions"
    result["formulas"] = {}; // same as assertion and assertions
    result["contexts"] = {};
    result["languages"] = {};
    let sequentOutput = yield processSequent(obj, result);
    result["sequent"] = sequentOutput;
});
let getAnnotatedSequent = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "annotated-sequent";
    result["annotated-sequent"] = {};
    result["formulas"] = {};
    result["contexts"] = {};
    result["languages"] = {};
    let sequentObj = yield ipfsGetObj(obj["sequent"]["/"]);
    let sequentOutput = yield processSequent(sequentObj, result);
    result["annotated-sequent"]["sequent"] = sequentOutput;
    result["annotated-sequent"]["annotation"] = yield ipfsGetObj(obj["annotation"]["/"]);
});
let getProduction = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "production";
    result["production"] = {};
    result["formulas"] = {};
    result["contexts"] = {};
    result["languages"] = {};
    result["tools"] = {};
    let productionOutput = yield processProduction(obj, result);
    result["production"] = productionOutput;
});
let getAnnotatedProduction = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "annotated-production";
    result["annotated-production"] = {};
    result["formulas"] = {};
    result["contexts"] = {};
    result["languages"] = {};
    result["tools"] = {};
    let productionObj = yield ipfsGetObj(obj["production"]["/"]);
    let productionOutput = yield processProduction(productionObj, result);
    result["annotated-production"]["production"] = productionOutput;
    result["annotated-production"]["annotation"] = yield ipfsGetObj(obj["annotation"]["/"]);
});
let getAssertion = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "assertion";
    result["assertion"] = {};
    result["formulas"] = {}; // possibly many formulas will be linked and thus many contexts too
    result["contexts"] = {};
    result["languages"] = {};
    result["tools"] = {};
    //let assertion = await ipfsGetObj(cidObj)
    let assertion = obj;
    if (verifySignature(assertion)) { // should we verify the assertion type?
        let assertionOutput = yield processAssertion(assertion, result);
        result["assertion"] = assertionOutput;
    }
    else {
        console.log("ERROR: Assertion signature not verified: invalid assertion");
        process.exit(1);
    }
});
let getCollection = (cidObj, obj, result) => __awaiter(void 0, void 0, void 0, function* () {
    result["output-for"] = cidObj;
    result["format"] = "collection";
    result["name"] = obj["name"];
    result["elements"] = [];
    result["formulas"] = {};
    result["contexts"] = {};
    result["languages"] = {};
    result["tools"] = {};
    let elementsLinks = obj["elements"];
    for (let link of elementsLinks) {
        let element = yield ipfsGetObj(link["/"]);
        let resElement = {};
        resElement["format"] = element["format"];
        resElement["element"] = yield processGeneric(element, result);
        result["elements"].push(resElement);
    }
});
module.exports = { getCommand };
