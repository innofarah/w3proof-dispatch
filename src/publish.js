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
const { configpath, toolprofilespath, agentprofilespath } = initialVals;
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
        // publish declarations first (because they need to be linked in formulas)
        // consider an entry in "declarations" (like "fib": ..) in the input file to have two possible values: either [string] or ["ipld:ciddeclarationobjcet"]
        // publish according to "format" in the given input file, first we consider the "sequence" format 
        // considering the "format" attribute to be fixed (exists all the time) for all the possible input-formats (considering that input-formats might differ according to format of published objects)
        let format = input["format"];
        let cid = "";
        // maybe do some checking here of the given file structure if correct? 
        if (format == "declaration") {
            // only one declaration object exists in this case
            //let name = Object.keys(input["declarations"])[0]
            let declarationObj = input["declaration"];
            cid = yield publishDeclaration(declarationObj);
            console.log("published declaration object of cid: " + cid);
        }
        else if (format == "annotated-declaration") {
            let annotatedDeclarationObj = input["annotated-declaration"];
            cid = yield publishAnnotatedDeclaration(annotatedDeclarationObj);
            console.log("published annotated declaration object of cid: " + cid);
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
        else if (format == "sequence") { // sequence of assertions
            let nameSequence = input["name"];
            let assertionsObj = input["assertions"];
            cid = yield publishSequence(assertionsObj, input, nameSequence);
            console.log("published sequence (of assertions) object of cid: " + cid);
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
let publishDeclaration = (declarationObj) => __awaiter(void 0, void 0, void 0, function* () {
    // consider an entry in "declaration" (like "fib": ..) in the input file to have two possible values: either [string] or "ipld:ciddeclarationobject"
    // use ipfsAddObj to add the declarations end object
    let language = declarationObj["language"];
    let content = declarationObj["content"];
    let cidLanguage = "", cidContent = "", cidDeclaration = "";
    if (typeof language == "string" && language.startsWith("ipld:"))
        cidLanguage = language.split(":")[1]; // should add checking here that cid refers to correct type (in general not just here)
    else
        cidLanguage = yield ipfsAddObj(language);
    if (typeof content == "string" && content.startsWith("ipld:"))
        cidContent = content.split(":")[1];
    else
        cidContent = yield ipfsAddObj(content);
    let declarationGlobal = {
        "format": "declaration",
        "language": { "/": cidLanguage },
        "content": { "/": cidContent }
    };
    let cidObj = yield ipfsAddObj(declarationGlobal);
    //publishedDeclarations[name] = cidObj
    cidDeclaration = cidObj;
    return cidDeclaration;
});
// change into annotated  -> what is annotations"?
let publishAnnotatedDeclaration = (annotatedDeclarationObj) => __awaiter(void 0, void 0, void 0, function* () {
    let declaration = annotatedDeclarationObj["declaration"];
    let annotation = annotatedDeclarationObj["annotation"];
    let cidDeclaration = "", cidAnnotation = "";
    if (typeof declaration == "string" && declaration.startsWith("ipld:"))
        cidDeclaration = declaration.split(":")[1];
    else {
        cidDeclaration = yield publishDeclaration(declaration);
    }
    if (typeof annotation == "string" && annotation.startsWith("ipld:"))
        cidAnnotation = annotation.split(":")[1];
    else {
        cidAnnotation = yield ipfsAddObj(annotation);
    }
    let annotatedDeclarationGlobal = {
        "format": "annotated-declaration",
        "declaration": { "/": cidDeclaration },
        "annotation": { "/": cidAnnotation }
    };
    let cid = yield ipfsAddObj(annotatedDeclarationGlobal);
    //publishedNamedFormulas[name] = cid
    return cid;
});
let publishFormula = (formulaObj, input) => __awaiter(void 0, void 0, void 0, function* () {
    let language = formulaObj["language"];
    let content = formulaObj["content"];
    let cidLanguage = "", cidContent = "";
    if (typeof language == "string" && language.startsWith("ipld:"))
        cidLanguage = language.split(":")[1];
    else
        cidLanguage = yield ipfsAddObj(language);
    if (typeof content == "string" && content.startsWith("ipld:"))
        cidContent = content.split(":")[1];
    else
        cidContent = yield ipfsAddObj(content);
    let declarationNames = formulaObj["declarations"];
    let declarationLinks = [];
    for (let declarationName of declarationNames) {
        let declarationCid = "";
        if (declarationName.startsWith("ipld:"))
            declarationCid = declarationName.split(":")[1];
        else
            declarationCid = yield publishDeclaration(input["declarations"][declarationName]);
        declarationLinks.push({ "/": declarationCid });
    }
    let formulaGlobal = {
        "format": "formula",
        "language": { "/": cidLanguage },
        "content": { "/": cidContent },
        "declarations": declarationLinks
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
    let tool = productionObj["tool"];
    let sequent = productionObj["sequent"];
    let cidTool = "", cidSequent = "";
    // add spec and checks later that sequent is "ipld:.." or {..}
    if (typeof sequent == "string" && sequent.startsWith("ipld:"))
        cidSequent = sequent.split(":")[1];
    else {
        cidSequent = yield publishSequent(sequent, input);
    }
    if (typeof tool == "string" && tool.startsWith("ipld:"))
        cidTool = tool.split(":")[1];
    else {
        try {
            let toolProfiles = JSON.parse(fs.readFileSync(toolprofilespath));
            if (toolProfiles[tool]) {
                cidTool = toolProfiles[tool]["tool"];
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
        "tool": { "/": cidTool }
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
    let statement = assertionObj["statement"];
    let cidStatement = "";
    if (typeof statement == "string" && statement.startsWith("ipld:"))
        cidStatement = statement.split(":")[1];
    else {
        // should do additional checking
        if (statement["format"] == "production") {
            cidStatement = yield publishProduction(statement["production"], input);
        }
        else if (statement["format"] == "annotated-production") {
            let production = statement["production"];
            let annotation = statement["annotation"];
            let annotatedProductionObj = {
                "production": production,
                "annotation": annotation
            };
            console.log("entered here");
            console.log(annotatedProductionObj);
            cidStatement = yield publishAnnotatedProduction(annotatedProductionObj, input);
        }
    }
    try {
        let agentProfiles = JSON.parse(fs.readFileSync(agentprofilespath));
        if (agentProfiles[agentProfileName]) {
            let agentProfile = agentProfiles[agentProfileName];
            const sign = crypto.createSign('SHA256');
            sign.write(cidStatement);
            sign.end();
            const signature = sign.sign(agentProfile["private-key"], 'hex');
            let assertionGlobal = {
                "format": "assertion",
                "agent": agentProfile["public-key"],
                "statement": { "/": cidStatement },
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
let publishSequence = (assertionsObj, input, nameSequence) => __awaiter(void 0, void 0, void 0, function* () {
    let assertionsLinks = [];
    for (let assertionObj of assertionsObj) {
        let cidAssertion = yield publishAssertion(assertionObj, input);
        assertionsLinks.push({ "/": cidAssertion });
    }
    let sequenceGlobal = {
        "format": "sequence",
        "name": nameSequence,
        "assertions": assertionsLinks
    };
    let cidSequence = yield ipfsAddObj(sequenceGlobal);
    return cidSequence;
});
module.exports = { publishCommand };
