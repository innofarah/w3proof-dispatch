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
const initialVals = require("./initial-vals");
const { configpath, toolprofilespath, languagespath, agentprofilespath } = initialVals;
const utilities = require("./utilities");
const { ipfsAddObj, publishDagToCloud } = utilities;
//let publishedNamedFormulas: { [key: string]: string } = {}
//let publishedFormulas: string[] = []
//let publishedSequents: string[] = []
//let publishedAssertions: string[] = []
//let publishedDeclarations: { [key: string]: string } = {}
let publishCommand = (inputPath, target) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let input = JSON.parse(fs.readFileSync(inputPath)); // json file expected
        // publish contexts first (because they need to be linked in formulas)
        // consider an entry in "contexts" (like "fib": ..) in the input file to have two possible values: either [string] or ["ipld:cidcontextobjcet"]
        // publish according to "format" in the given input file, first we consider the "sequence" format 
        // considering the "format" attribute to be fixed (exists all the time) for all the possible input-formats (considering that input-formats might differ according to format of published objects)
        let format = input["format"];
        let cid = "";
        // maybe do some checking here of the given file structure if correct? 
        if (format == "context") {
            // only one declaration object exists in this case
            //let name = Object.keys(input["declarations"])[0]
            let contextObj = input["context"];
            cid = yield publishContext(contextObj);
            console.log("published context object of cid: " + cid);
        }
        else if (format == "annotated-context") {
            let annotatedContextObj = input["annotated-context"];
            cid = yield publishAnnotatedContext(annotatedContextObj);
            console.log("published annotated context object of cid: " + cid);
        }
        else if (format == "formula") {
            let formulaObj = input["formula"];
            cid = yield publishFormula(formulaObj, input);
            console.log("published formula object of cid: " + cid);
        }
        else if (format == "annotated-formula") {
            let annotatedFormulaObj = input["annotated-formula"];
            cid = yield publishAnnotatedFormula(annotatedFormulaObj, input);
            console.log("published annotated formula object of cid: " + cid);
        }
        else if (format == "sequent") {
            let sequentObj = input["sequent"];
            cid = yield publishSequent(sequentObj, input);
            console.log("published sequent object of cid: " + cid);
        }
        else if (format == "annotated-sequent") {
            let annotatedSequentObj = input["annotated-sequent"];
            cid = yield publishAnnotatedSequent(annotatedSequentObj, input);
            console.log("published annotated sequent object of cid: " + cid);
        }
        else if (format == "production") {
            let productionObj = input["production"];
            cid = yield publishProduction(productionObj, input);
            console.log("published production object of cid: " + cid);
        }
        else if (format == "annotated-production") {
            let annotatedProductionObj = input["annotated-production"];
            cid = yield publishAnnotatedProduction(annotatedProductionObj, input);
            console.log("published annotated production object of cid: " + cid);
        }
        else if (format == "assertion") {
            let assertionObj = input["assertion"];
            cid = yield publishAssertion(assertionObj, input);
            console.log("published assertion object of cid: " + cid);
        }
        else if (format == "collection") { // collection of links to global objects
            let name = input["name"];
            let elements = input["elements"];
            cid = yield publishCollection(name, elements, input);
            console.log("published collection object of cid: " + cid);
        }
        else {
            console.error(new Error("unknown input format"));
        }
        // if "target" is cloud (global), publish the final sequence cid (dag) through the web3.storage api
        if (cid != "" && target == "cloud") {
            yield publishDagToCloud(cid);
        }
    }
    catch (error) {
        console.error(error);
    }
});
// !!!!!!!!!!!! should add more safety checks - do later (for all the publishing functions)
let publishContext = (contextObj) => __awaiter(void 0, void 0, void 0, function* () {
    // consider an entry in "declaration" (like "fib": ..) in the input file to have two possible values: either [string] or "ipld:ciddeclarationobject"
    // use ipfsAddObj to add the declarations end object
    let language = contextObj["language"];
    let content = contextObj["content"];
    let cidLanguage = "", cidContent = "", cidContext = "";
    if (typeof language == "string" && language.startsWith("ipld:"))
        cidLanguage = language.split(":")[1];
    else {
        try {
            let languages = JSON.parse(fs.readFileSync(languagespath));
            if (languages[language]) { // assuming the cids in languages are of "format"="language" --> check later
                cidLanguage = languages[language]["language"];
            }
            else
                throw new Error("ERROR: given language record name does not exist");
        }
        catch (error) {
            console.error(error);
            process.exit(0);
        }
    }
    if (typeof content == "string" && content.startsWith("ipld:"))
        cidContent = content.split(":")[1];
    else
        cidContent = yield ipfsAddObj(content);
    let contextGlobal = {
        "format": "context",
        "language": { "/": cidLanguage },
        "content": { "/": cidContent }
    };
    let cidObj = yield ipfsAddObj(contextGlobal);
    //publishedDeclarations[name] = cidObj
    cidContext = cidObj;
    return cidContext;
});
// change into annotated  -> what is annotations"?
let publishAnnotatedContext = (annotatedContextObj) => __awaiter(void 0, void 0, void 0, function* () {
    let context = annotatedContextObj["context"];
    let annotation = annotatedContextObj["annotation"];
    let cidContext = "", cidAnnotation = "";
    if (typeof context == "string" && context.startsWith("ipld:"))
        cidContext = context.split(":")[1];
    else {
        cidContext = yield publishContext(context);
    }
    if (typeof annotation == "string" && annotation.startsWith("ipld:"))
        cidAnnotation = annotation.split(":")[1];
    else {
        cidAnnotation = yield ipfsAddObj(annotation);
    }
    let annotatedContextGlobal = {
        "format": "annotated-context",
        "context": { "/": cidContext },
        "annotation": { "/": cidAnnotation }
    };
    let cid = yield ipfsAddObj(annotatedContextGlobal);
    //publishedNamedFormulas[name] = cid
    return cid;
});
let publishFormula = (formulaObj, input) => __awaiter(void 0, void 0, void 0, function* () {
    let language = formulaObj["language"];
    let content = formulaObj["content"];
    let cidLanguage = "", cidContent = "";
    if (typeof language == "string" && language.startsWith("ipld:"))
        cidLanguage = language.split(":")[1];
    else {
        try {
            let languages = JSON.parse(fs.readFileSync(languagespath));
            if (languages[language]) { // assuming the cids in languages are of "format"="language" --> check later
                cidLanguage = languages[language]["language"];
            }
            else
                throw new Error("ERROR: given language record name does not exist");
        }
        catch (error) {
            console.error(error);
            process.exit(0);
        }
    }
    if (typeof content == "string" && content.startsWith("ipld:"))
        cidContent = content.split(":")[1];
    else
        cidContent = yield ipfsAddObj(content);
    let contextNames = formulaObj["context"];
    let contextLinks = [];
    for (let contextName of contextNames) {
        let contextCid = "";
        if (contextName.startsWith("ipld:"))
            contextCid = contextName.split(":")[1];
        else
            contextCid = yield publishContext(input["contexts"][contextName]);
        contextLinks.push({ "/": contextCid });
    }
    let formulaGlobal = {
        "format": "formula",
        "language": { "/": cidLanguage },
        "content": { "/": cidContent },
        "context": contextLinks
    };
    let cid = yield ipfsAddObj(formulaGlobal);
    //publishedFormulas.push(cid)
    return cid;
});
// change into annotated -> ...
let publishAnnotatedFormula = (annotatedFormulaObj, input) => __awaiter(void 0, void 0, void 0, function* () {
    let formula = annotatedFormulaObj["formula"];
    let annotation = annotatedFormulaObj["annotation"];
    let cidFormula = "", cidAnnotation = "";
    if (typeof formula == "string" && formula.startsWith("ipld:"))
        cidFormula = formula.split(":")[1];
    else {
        cidFormula = yield publishFormula(formula, input);
    }
    if (typeof annotation == "string" && annotation.startsWith("ipld:"))
        cidAnnotation = annotation.split(":")[1];
    else {
        cidAnnotation = yield ipfsAddObj(annotation);
    }
    let annotatedFormulaGlobal = {
        "format": "annotated-formula",
        "formula": { "/": cidFormula },
        "annotation": { "/": cidAnnotation }
    };
    let cid = yield ipfsAddObj(annotatedFormulaGlobal);
    //publishedNamedFormulas[name] = cid
    return cid;
});
let publishSequent = (sequentObj, input) => __awaiter(void 0, void 0, void 0, function* () {
    let conclusionName = sequentObj["conclusion"];
    let cidConclusion = "";
    if (conclusionName.startsWith("ipld:"))
        cidConclusion = conclusionName.split(":")[1];
    else {
        let conclusionObj = input["formulas"][conclusionName];
        /*let conclusionGlobal = {
            "language": conclusionObj["language"],
            "content": conclusionObj["content"],
            "declarations": conclusionObj["declarations"]
        }*/
        cidConclusion = yield publishFormula(conclusionObj, input);
    }
    let dependenciesNames = sequentObj["dependencies"];
    let dependenciesIpfs = [];
    for (let dependency of dependenciesNames) {
        let ciddependency = "";
        if (dependency.startsWith("ipld:")) {
            // assuming the cids in "lemmas" should refer to a "formula" object
            //(if we remove the .thc generation and replace it with generation of the output format.json file produced by w3proof-dispatch get)
            ciddependency = dependency.split(":")[1];
            // should we test that the cid refers to a formula object here? (check later where it's best to do the cid objects type checking?)
        }
        else {
            let dependencyObj = input["formulas"][dependency];
            /*let dependencyGlobal = {
                "language": dependencyObj["language"],
                "content": dependencyObj["content"],
                "declaration": dependencyObj["declaration"]
            }*/
            ciddependency = yield publishFormula(dependencyObj, input);
        }
        dependenciesIpfs.push({ "/": ciddependency });
    }
    let sequentGlobal = {
        "format": "sequent",
        "dependencies": dependenciesIpfs,
        "conclusion": { "/": cidConclusion }
    };
    let cid = yield ipfsAddObj(sequentGlobal);
    //publishedSequents.push(cid)
    return cid;
});
let publishAnnotatedSequent = (annotatedSequentObj, input) => __awaiter(void 0, void 0, void 0, function* () {
    let sequent = annotatedSequentObj["sequent"];
    let annotation = annotatedSequentObj["annotation"];
    let cidSequent = "", cidAnnotation = "";
    if (typeof sequent == "string" && sequent.startsWith("ipld:"))
        cidSequent = sequent.split(":")[1];
    else {
        cidSequent = yield publishSequent(sequent, input);
    }
    if (typeof annotation == "string" && annotation.startsWith("ipld:"))
        cidAnnotation = annotation.split(":")[1];
    else {
        cidAnnotation = yield ipfsAddObj(annotation);
    }
    let annotatedSequentGlobal = {
        "format": "annotated-sequent",
        "sequent": { "/": cidSequent },
        "annotation": { "/": cidAnnotation }
    };
    let cid = yield ipfsAddObj(annotatedSequentGlobal);
    //publishedNamedFormulas[name] = cid
    return cid;
});
let publishProduction = (productionObj, input) => __awaiter(void 0, void 0, void 0, function* () {
    let mode = productionObj["mode"];
    let sequent = productionObj["sequent"];
    let modeValue; // the currently expected mode values
    let cidTool = "", cidSequent = "";
    // add spec and checks later that sequent is "ipld:.." or {..}
    if (typeof sequent == "string" && sequent.startsWith("ipld:"))
        cidSequent = sequent.split(":")[1];
    else
        cidSequent = yield publishSequent(sequent, input);
    // these are just the CURRENTLY known production modes to dispatch
    // but later, maybe this would be extended : the important point is 
    //that tools that publish and get global objects have some expected modes,
    //according to some specification (maybe standard maybe more)
    // OR maybe make it more general? --> dispatch doesn't check restricted mode values?
    if (mode == null || mode == "axiom" || mode == "conjecture") {
        modeValue = mode;
    }
    // other than the expected modes keywords, the current specification of a production,
    // and what dispatch expects is a "tool" format cid (either directly put in the input 
    //as ipld:cid or through a profile name which is specific to dispatch 
    //(but the end result is the same, which is the cid of the tool format object))
    else if (typeof mode == "string" && mode.startsWith("ipld:")) {
        cidTool = mode.split(":")[1];
        modeValue = { "/": cidTool };
    }
    else {
        try {
            let toolProfiles = JSON.parse(fs.readFileSync(toolprofilespath));
            if (toolProfiles[mode]) { // assuming the cids in toolProfiles are of "format"="tool" --> check later
                cidTool = toolProfiles[mode]["tool"];
                modeValue = { "/": cidTool };
            }
            else
                throw new Error("ERROR: given toolProfile name does not exist");
        }
        catch (error) {
            console.error(error);
            process.exit(0);
        }
    }
    let productionGlobal = {
        "format": "production",
        "sequent": { "/": cidSequent },
        "mode": modeValue
    };
    let cidProduction = yield ipfsAddObj(productionGlobal);
    return cidProduction;
});
let publishAnnotatedProduction = (annotatedProductionObj, input) => __awaiter(void 0, void 0, void 0, function* () {
    let production = annotatedProductionObj["production"];
    let annotation = annotatedProductionObj["annotation"];
    let cidProduction = "", cidAnnotation = "";
    if (typeof production == "string" && production.startsWith("ipld:"))
        cidProduction = production.split(":")[1];
    else {
        cidProduction = yield publishProduction(production, input);
    }
    if (typeof annotation == "string" && annotation.startsWith("ipld:"))
        cidAnnotation = annotation.split(":")[1];
    else {
        cidAnnotation = yield ipfsAddObj(annotation);
    }
    let annotatedProductionGlobal = {
        "format": "annotated-production",
        "production": { "/": cidProduction },
        "annotation": { "/": cidAnnotation }
    };
    let cid = yield ipfsAddObj(annotatedProductionGlobal);
    //publishedNamedFormulas[name] = cid
    return cid;
});
// refer to either production or annotatedproduction. how
let publishAssertion = (assertionObj, input) => __awaiter(void 0, void 0, void 0, function* () {
    let agentProfileName = assertionObj["agent"];
    let claim = assertionObj["claim"];
    let cidClaim = "";
    if (typeof claim == "string" && claim.startsWith("ipld:"))
        cidClaim = claim.split(":")[1];
    else {
        // should do additional checking
        if (claim["format"] == "production") {
            cidClaim = yield publishProduction(claim["production"], input);
        }
        else if (claim["format"] == "annotated-production") {
            let production = claim["production"];
            let annotation = claim["annotation"];
            let annotatedProductionObj = {
                "production": production,
                "annotation": annotation
            };
            cidClaim = yield publishAnnotatedProduction(annotatedProductionObj, input);
        }
    }
    try {
        let agentProfiles = JSON.parse(fs.readFileSync(agentprofilespath));
        if (agentProfiles[agentProfileName]) {
            let agentProfile = agentProfiles[agentProfileName];
            const sign = crypto.createSign('SHA256');
            sign.write(cidClaim);
            sign.end();
            const signature = sign.sign(agentProfile["private-key"], 'hex');
            let assertionGlobal = {
                "format": "assertion",
                "agent": agentProfile["public-key"],
                "claim": { "/": cidClaim },
                "signature": signature
            };
            let cidAssertion = yield ipfsAddObj(assertionGlobal);
            //publishedAssertions.push(cidAssertion)
            return cidAssertion;
        }
        else
            throw new Error("ERROR: given profile name does not exist");
    }
    catch (error) {
        console.error(error);
        process.exit(0);
    }
});
// also needs more checking
let publishGeneric = (element, input) => __awaiter(void 0, void 0, void 0, function* () {
    let cid = "";
    let actualElement = element["element"];
    if (element["format"] == "context")
        cid = yield publishContext(actualElement);
    else if (element["format"] == "annotated-context")
        cid = yield publishAnnotatedContext(actualElement);
    else if (element["format"] == "formula")
        cid = yield publishFormula(actualElement, input);
    else if (element["format"] == "annotated-formula")
        cid = yield publishAnnotatedFormula(actualElement, input);
    else if (element["format"] == "sequent")
        cid = yield publishSequent(actualElement, input);
    else if (element["format"] == "annotated-sequent")
        cid = yield publishAnnotatedSequent(actualElement, input);
    else if (element["format"] == "production")
        cid = yield publishProduction(actualElement, input);
    else if (element["format"] == "annotated-production")
        cid = yield publishAnnotatedProduction(actualElement, input);
    else if (element["format"] == "assertion")
        cid = yield publishAssertion(actualElement, input);
    return cid;
});
let publishCollection = (name, elements, input) => __awaiter(void 0, void 0, void 0, function* () {
    let elementsLinks = [];
    for (let element of elements) {
        let cidElement = yield publishGeneric(element, input);
        elementsLinks.push({ "/": cidElement });
    }
    let collectionGlobal = {
        "format": "collection",
        "name": name,
        "elements": elementsLinks
    };
    let cidCollection = yield ipfsAddObj(collectionGlobal);
    return cidCollection;
});
module.exports = { publishCommand };
