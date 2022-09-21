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
const { Web3Storage } = require('web3.storage');
const { CarReader } = require('@ipld/car');
const initialVals = require("./initial-vals");
const { configpath, profilespath } = initialVals;
let publishedFormulas = {};
let publishedSequents = [];
let publishedAssertions = [];
let publishCommand = (filename, profileName, directoryPath, storage) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let theorems = JSON.parse(fs.readFileSync(directoryPath + "/" + filename + ".json"));
        // publish all formula objects first (to have all the cids ready before publishing a sequent in case a formula is listed as lemma)
        for (let conclusionName of Object.keys(theorems)) {
            yield publishFormula(conclusionName, theorems[conclusionName]["conclusion"], theorems[conclusionName]["Sigma"]);
        }
        for (let conclusionName of Object.keys(theorems)) {
            let sequentsLemmas = theorems[conclusionName]["lemmas"];
            for (let sequentLemmas of sequentsLemmas) {
                yield publishSequent(conclusionName, sequentLemmas);
            }
        }
        for (let sequentCid of publishedSequents) {
            yield publishAssertion(sequentCid, profileName);
        }
        let sequenceCid = yield publishSequence(filename, publishedAssertions); //for now publish sequence as composed of assertions signed by the same profile
        console.log("Input from Prover Published: The root cid of the published sequence of assertions by profile: " + profileName + " is " + sequenceCid);
        // if cloud (global), publish the final sequence cid (dag) through the web3.storage api
        if (storage == "cloud") {
            publishDagToCloud(sequenceCid);
        }
    }
    catch (error) {
        console.error(error);
    }
});
let publishFormula = (formulaName, formula, sigma) => __awaiter(void 0, void 0, void 0, function* () {
    let th = {
        "format": "formula",
        "formula": formula,
        "Sigma": sigma
    };
    let cid = yield ipfsAddObj(th);
    let thNamed = {
        "format": "named-formula",
        "name": formulaName,
        "formula": { "/": cid }
    };
    let cidNamed = yield ipfsAddObj(thNamed);
    publishedFormulas[formulaName] = cidNamed;
});
let publishSequent = (conclusionName, lemmas) => __awaiter(void 0, void 0, void 0, function* () {
    let lemmasIpfs = [];
    for (let lemma of lemmas) {
        if (lemma.startsWith("ipfs:")) {
            // assuming the cids in "lemmas" should refer to a "formula" object
            //(if we remove the .thc generation and replace it with generation of the output format.json file produced by w3proof-dispatch get)
            let cidFormula = lemma.split(":")[1];
            // should we test that the cid refers to a formula object here? (check later where it's best to do the cid objects type checking?)
            lemmasIpfs.push({ "/": cidFormula });
            // allowed cids: sequent/assertion and sequence types
        }
        else {
            lemmasIpfs.push({ "/": publishedFormulas[lemma] });
        }
    }
    let seq = {
        "format": "sequent",
        "lemmas": lemmasIpfs,
        "conclusion": { "/": publishedFormulas[conclusionName] }
    };
    let cid = yield ipfsAddObj(seq);
    publishedSequents.push(cid);
});
let publishAssertion = (sequentCid, profileName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let profiles = JSON.parse(fs.readFileSync(profilespath));
        if (profiles[profileName]) {
            let profile = profiles[profileName];
            const sign = crypto.createSign('SHA256');
            sign.write(sequentCid);
            sign.end();
            const signature = sign.sign(profile["private-key"], 'hex');
            let assertion = {
                "format": "assertion",
                "agent": profile["public-key"],
                "sequent": { "/": sequentCid },
                "signature": signature
            };
            let assertionCid = yield ipfsAddObj(assertion);
            publishedAssertions.push(assertionCid);
        }
        else
            throw new Error("ERROR: given profile name does not exist");
    }
    catch (error) {
        console.error(error);
        process.exit(0);
    }
});
let publishSequence = (sequenceName, sequentsCids) => __awaiter(void 0, void 0, void 0, function* () {
    let sequentsLinks = [];
    for (let cid of sequentsCids) {
        sequentsLinks.push({ "/": cid });
    }
    let sequence = {
        "format": "sequence",
        "name": sequenceName,
        "sequents": sequentsLinks
    };
    let sequenceCid = yield ipfsAddObj(sequence);
    return sequenceCid;
});
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
        fs.unlink('tmpcar.car', (err) => {
            if (err)
                throw err;
        });
    }
    catch (err) {
        console.log(err);
    }
});
module.exports = { publishCommand };
