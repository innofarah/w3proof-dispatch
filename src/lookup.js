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
const { isAssertion, verifySignature, fingerPrint, ipfsGetObj, ensureFullDAG } = utilities;
let getResult = (cidFormula, assertionsList, resultUnits, path) => __awaiter(void 0, void 0, void 0, function* () {
    let result = [];
    // for the formula itself
    result.push({ "dependencies": [cidFormula], "via": [] }); //
    // if the formula exists in the file
    if (assertionsList[cidFormula]) {
        let desiredRecord = assertionsList[cidFormula];
        //console.log(desiredRecord)
        for (let assertion of desiredRecord) {
            let ignoreAssertion = false;
            let dependencies = assertion["dependencies"];
            for (let dep of dependencies) {
                // if dependency == cidFormula ? --> ignore assertion? (not useful?--just add adds useless combinations)
                // if (dependency == cidFormula || path.includes(dependency))
                if (path.includes(dep))
                    ignoreAssertion = true;
                // if not computed previously
                if (!resultUnits[dep] && !ignoreAssertion) {
                    if (assertionsList[dep]) { // if dependency exists in the file, compute and save its result
                        path.push(dep);
                        resultUnits[dep] = yield getResult(dep, assertionsList, resultUnits, path);
                        path.pop();
                    }
                }
            }
            // after computing (if not previously done) the resultUnit for each dependency
            if (!ignoreAssertion) {
                let combinations = yield getAllCombinationsFrom(assertion, resultUnits);
                for (let combination of combinations) {
                    // maybe here it's best for now to remove repetitions
                    // in "dependencies" and "via"
                    result.push({
                        "dependencies": [...new Set(combination["dependencies"])],
                        "via": [...new Set(combination["via"])]
                    });
                    //result.push(combination)
                }
            }
        }
    }
    //return result
    return [...new Set(result)];
});
// A, B, C |- N,  |- N,  A |- N
let getAllCombinationsFrom = (assertion, resultUnits) => __awaiter(void 0, void 0, void 0, function* () {
    // combination of 
    let combinations = []; // combination of form {"dependencies": [], "via": []}
    let dependencies = assertion["dependencies"];
    let agent = assertion["agent"];
    let mode = assertion["mode"];
    // consider 2 initial cases: no dependencies -- one dependency:
    // no dependencies: we should return 
    // with combinations = [{"dependencies":[], "via": [..]}]
    if (dependencies.length == 0)
        return [{ "dependencies": [], "via": [{ agent, mode }] }];
    // one dependencies: we should return the resultUnits[dependency] as it is since one dependency, no combinations with other dependencies
    // but with adding the current agent? 
    else if (dependencies.length == 1) {
        //console.log("here " + dependencies[0])
        //console.log(resultUnits)
        if (resultUnits[dependencies[0]]) {
            for (let unit of resultUnits[dependencies[0]]) {
                let viaPlus = unit["via"].concat([{ agent, mode }]);
                //console.log(viaPlus)
                let newUnit = { "dependencies": unit["dependencies"], "via": viaPlus };
                combinations.push(newUnit);
            }
            return combinations;
        }
        else { // if the dependency didn't exist anywhere in the file
            return [{ "dependencies": dependencies, "via": [{ agent, mode }] }];
        }
    }
    // now if dependencies.length >= 2
    // if resultUnits[dependency] is undefined --> terminating case
    // if resultUnits[dependency] is contains the dependency itself -> terminating case
    let localResults = {};
    for (let dep of dependencies) {
        if (resultUnits[dep]) { // if defined; if the dependency existed in the searchset (in the file)
            localResults[dep] = resultUnits[dep];
        }
        // if resultUnits[dependency] is not defined, we need to only use the dependency (cidFormula) itself for combination
        else
            localResults[dep] = [{ "dependencies": [dep], "via": [] }];
        // but even if it's defined we also need to use it for combination (which was added in getResult)
    }
    // now we have localResults consisting of a list of combinations (records) per dependency
    // compute cartesian product for each 2 sets incrementally until reach end? 
    let keys = Object.keys(localResults);
    let tmp = localResults[keys[0]];
    for (let i = 1; i < keys.length; i++) {
        tmp = yield getCartesian(tmp, localResults[keys[i]]);
    }
    for (let unit of tmp) {
        combinations.push({ "dependencies": unit["dependencies"], "via": unit["via"].concat([{ agent, mode }]) });
    }
    return combinations;
});
let getCartesian = (fst, snd) => __awaiter(void 0, void 0, void 0, function* () {
    let cartesian = [];
    let dependenciesFst, dependenciesSnd, viaFst, viaSnd;
    for (let unitFst of fst) {
        dependenciesFst = unitFst["dependencies"];
        viaFst = unitFst["via"];
        for (let unitSnd of snd) {
            dependenciesSnd = unitSnd["dependencies"];
            viaSnd = unitSnd["via"];
            cartesian.push({ "dependencies": dependenciesFst.concat(dependenciesSnd), "via": viaFst.concat(viaSnd) });
        }
    }
    // where should we add the current agent of the assertion?
    return cartesian;
});
let processAssertion = (cid, result) => __awaiter(void 0, void 0, void 0, function* () {
    yield ensureFullDAG(cid);
    let obj = yield ipfsGetObj(cid);
    if (isAssertion(obj)) {
        let assertion = obj;
        if (verifySignature(assertion)) {
            let agent = fingerPrint(assertion["agent"]);
            let claim = yield ipfsGetObj(assertion["claim"]["/"]);
            let production = {};
            if (claim["format"] == "production")
                production = claim;
            else if (claim["format"] == "annotated-production")
                production = yield ipfsGetObj(claim["production"]["/"]);
            let sequent = yield ipfsGetObj(production["sequent"]["/"]);
            let conclusionCid = sequent["conclusion"]["/"];
            let dependenciesCids = [];
            for (let depLink of sequent["dependencies"]) {
                dependenciesCids.push(depLink["/"]);
            }
            let modeValue = production["mode"];
            // addressing the currently expecting mode values -- or make it more general here? (anything or ipldLink)
            //if (mode == null || mode == "axiom" || mode == "conjecture")
            if (modeValue["/"]) { // case ipldLink (maybe also later should verify cid?)
                modeValue = modeValue["/"];
            }
            else { // case standard string modes
                // modeValue stays the same
            }
            let unit = {
                "agent": agent,
                "mode": modeValue,
                "dependencies": dependenciesCids
            };
            if (!result[conclusionCid])
                result[conclusionCid] = [unit];
            else
                result[conclusionCid].push(unit);
        }
    }
});
let processAssertionList = (assertionList) => __awaiter(void 0, void 0, void 0, function* () {
    //should this list be forced to be all assertions?  -> check later, now we assume it is all assertions
    let result = {};
    for (let cid of assertionList) {
        yield processAssertion(cid, result);
        // processAssertion will only add the 
        // information for cids of "assertion" format (after it verifies that the object is of assertion correct type)
        // also it will ignore an assertion if the signature is invalid
        // it will ignore any other cid "format"
    }
    return result;
});
// expected filepath: of file assertion-list-for-lookup.json; this is considered to produced from assertioncidlist (do later)
let lookup = (cidFormula, filepath, directoryPath) => __awaiter(void 0, void 0, void 0, function* () {
    // must check that formula is of the correct "format" later
    let resultUnits = {};
    let assertionList = JSON.parse(fs.readFileSync(filepath));
    // change here to just read an assertionList of the actual assertions cids,
    // and then dispatch shall produce from it the format that getResult(..) shall read
    let processedAssertionList = yield processAssertionList(assertionList);
    //console.log(processedAssertionList)
    let result = yield getResult(cidFormula, processedAssertionList, resultUnits, [cidFormula]);
    //return result
    //console.log(result)
    try {
        if (!fs.existsSync(directoryPath))
            fs.mkdirSync(directoryPath, { recursive: true });
        fs.writeFileSync(directoryPath + "/" + cidFormula + ".json", JSON.stringify(result));
        console.log("the result of lookup for the formula: " + cidFormula +
            " was output in the file " + directoryPath + "/" + cidFormula + ".json");
    }
    catch (err) {
        console.error(err);
    }
});
module.exports = { lookup };
