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
//const { isSequent, isAssertion, isSequence,
//    verifySignature, fingerPrint, inAllowList, ipfsGetObj, ensureFullDAG } = utilities
let getResult = (cidFormula, assertionsList, resultUnits, path) => __awaiter(void 0, void 0, void 0, function* () {
    let result = [];
    // for the formula itself
    result.push({ "lemmas": [cidFormula], "agents": [] }); //
    // if the formula exists in the file
    if (assertionsList[cidFormula]) {
        let desiredRecord = assertionsList[cidFormula];
        //console.log(desiredRecord)
        for (let assertion of desiredRecord) {
            let ignoreAssertion = false;
            let lemmas = assertion["lemmas"];
            for (let lemma of lemmas) {
                // if lemma == cidFormula ? --> ignore assertion? (not useful?--just add adds useless combinations)
                // if (lemma == cidFormula || path.includes(lemma))
                if (path.includes(lemma))
                    ignoreAssertion = true;
                // if not computed previously
                if (!resultUnits[lemma] && !ignoreAssertion) {
                    if (assertionsList[lemma]) { // if lemma exists in the file, compute and save its result
                        path.push(lemma);
                        resultUnits[lemma] = yield getResult(lemma, assertionsList, resultUnits, path);
                        path.pop();
                    }
                }
            }
            // after computing (if not previously done) the resultUnit for each lemma
            if (!ignoreAssertion) {
                let combinations = yield getAllCombinationsFrom(assertion, resultUnits);
                for (let combination of combinations) {
                    // maybe here it's best for now to remove repetitions
                    // in "lemmas" and "agents"
                    result.push({
                        "lemmas": [...new Set(combination["lemmas"])],
                        "agents": [...new Set(combination["agents"])]
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
    let combinations = []; // combination of form {"lemmas": [], "agents": []}
    let lemmas = assertion["lemmas"];
    let agent = assertion["agent"];
    // consider 2 initial cases: no lemmas -- one lemma:
    // no lemmas: we should return 
    // with combinations = [{"lemmas":[], "agents": [agent]}]
    if (lemmas.length == 0)
        return [{ "lemmas": [], "agents": [agent] }];
    // one lemmas: we should return the resultUnits[lemma] as it is since one lemma, no combinations with other lemmas
    // but with adding the current agent? 
    else if (lemmas.length == 1) {
        //console.log("here " + lemmas[0])
        //console.log(resultUnits)
        if (resultUnits[lemmas[0]]) {
            for (let unit of resultUnits[lemmas[0]]) {
                let agentsPlus = unit["agents"].concat([agent]);
                //console.log(agentsPlus)
                let newUnit = { "lemmas": unit["lemmas"], "agents": agentsPlus };
                combinations.push(newUnit);
            }
            return combinations;
        }
        else { // if the lemma didn't exist anywhere in the file
            return [{ "lemmas": lemmas, "agents": [agent] }];
        }
    }
    // now if lemmas.length >= 2
    // if resultUnits[lemma] is undefined --> terminating case
    // if resultUnits[lemma] is contains the lemma itself -> terminating case
    let localResults = {};
    for (let lemma of lemmas) {
        if (resultUnits[lemma]) { // if defined; if the lemma existed in the searchset (in the file)
            localResults[lemma] = resultUnits[lemma];
        }
        // if resultUnits[lemma] is not defined, we need to only use the lemma (cidFormula) itself for combination
        else
            localResults[lemma] = [{ "lemmas": [lemma], "agents": [] }];
        // but even if it's defined we also need to use it for combination (which was added in getResult)
    }
    // now we have localResults consisting of a list of combinations (records) per lemma
    // compute cartesian product for each 2 sets incrementally until reach end? 
    let keys = Object.keys(localResults);
    let tmp = localResults[keys[0]];
    for (let i = 1; i < keys.length; i++) {
        tmp = yield getCartesian(tmp, localResults[keys[i]]);
    }
    for (let unit of tmp) {
        combinations.push({ "lemmas": unit["lemmas"], "agents": unit["agents"].concat([agent]) });
    }
    return combinations;
});
let getCartesian = (fst, snd) => __awaiter(void 0, void 0, void 0, function* () {
    let cartesian = [];
    let lemmasFst, lemmasSnd, agentsFst, agentsSnd;
    for (let unitFst of fst) {
        lemmasFst = unitFst["lemmas"];
        agentsFst = unitFst["agents"];
        for (let unitSnd of snd) {
            lemmasSnd = unitSnd["lemmas"];
            agentsSnd = unitSnd["agents"];
            cartesian.push({ "lemmas": lemmasFst.concat(lemmasSnd), "agents": agentsFst.concat(agentsSnd) });
        }
    }
    // where should we add the current agent of the assertion?
    return cartesian;
});
// expected filepath: of file assertion-list-for-lookup.json; this is considered to produced from assertioncidlist (do later)
// assuming that the assertions existing in this file have their signatures verified previously.
let lookup = (cidFormula, filepath) => __awaiter(void 0, void 0, void 0, function* () {
    let resultUnits = {};
    let assertionsListJSON = JSON.parse(fs.readFileSync(filepath));
    let result = yield getResult(cidFormula, assertionsListJSON, resultUnits, [cidFormula]);
    //return result
    console.log(result);
});
module.exports = { lookup };
