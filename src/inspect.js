const { execSync } = require('child_process');
const { error } = require('console');
const fs = require('fs')
const crypto = require('crypto')
const os = require('os')
const util = require('util')
const stream = require('stream')
const fetch = require('node-fetch').default

let config, gateway, keystore
let configpath = os.homedir() + "/.config/w3proof-dispatch/config.json"
let keystorepath = os.homedir() + "/.config/w3proof-dispatch/keystore.json"

// remove this later from here and put it in a main function - this check should only be done if the user specified the ipfsstation to be gateway 
try {
    // create config.json if it does not exist in the proper directory
    if (!fs.readFileSync(configpath)) {
        fs.writeFileSync(configpath, JSON.stringify({}))
    }
    else {
        config = JSON.parse(fs.readFileSync(configpath))
    }

    // create keystore.json if it does not exist in the proper directory
    if (!fs.existsSync(keystorepath)) {
        fs.writeFileSync(keystorepath, JSON.stringify({}))
    }
    else {
        keystore = JSON.parse(fs.readFileSync(keystorepath))
    }

    if (config["my-gateway"]) gateway = config["my-gateway"]
    else throw (err)

} catch (err) {
    console.log(err)
}

let inspect_shallow = (cid) => {
    // try to read the cid from local ipfs repo
    // if it does not exist locally => read from gateway
    // if the retrieved format is not an 'asset' or an 'assertion' format -> error

    try {
        let cmd = "ipfs dag get " + cid
        let tmpobj = execSync(cmd, { encoding: 'utf-8' })
        tmpobj = JSON.parse(tmpobj)
        //console.log(tmpobj)
        if (tmpobj["format"] == "assertion") {
            displayAssertion(tmpobj)
        }
        else if (tmpobj["format"] == "asset") {
            displayAsset(tmpobj)
        }
        else throw ("UNSUPPORTED FORMAT !")

    } catch (err) { // if the ipfs path/cid is not found locally, try to get from gateway
        console.log(err)
    }
}

// considered to only take a previously verified asset format object (can also add verification but now unnecessary), same for displayAssertion()
let displayAsset = (asset) => {
    let dataToDisplay =
        "The provided ipfs path refers to an 'asset' format. \n"
        + "The asset's type is '" + asset["asset-type"] + "' \n"
        + "Its name at production is " + asset["name"] + " \n"
    // the rest of information depends on the asset's type (here we are only considering abella spec and script)
    if (asset["asset-type"] == "abella-script") {
        dataToDisplay += "Its text can be retrieved by the address: " + asset["text"]["/"] + " \n"

        if (asset["specification"] != "") {
            dataToDisplay += "It has the 'specification' with name " + Object.keys(asset["specification"])[0]
                + " and referred to by the address: " + asset["specification"][Object.keys(asset["specification"])[0]]["/"] + " \n"
        }
        else {
            dataToDisplay += "It has no specification. " + "\n"
        }

        if (Object.keys(asset["imports"]) == 0) {
            dataToDisplay += "It has no imports. \n"
        }
        else {
            dataToDisplay += "It imports the following addresses: \n"
            Object.keys(asset["imports"]).forEach(key => {
                dataToDisplay += key + " : " + asset["imports"][key]["/"] + "\n"
            })
        }
    }
    else if (asset["asset-type"] == "abella-specification") {
        dataToDisplay += "It's .sig file text can be retrieved by the address " + asset["textsig"]["/"] + " \n"
            + "It's .mod file text can be retrieved by the address " + asset["textmod"]["/"] + " \n"
        if (Object.keys(asset["accum"]) == 0) {
            dataToDisplay += "It has no accumulated specifications. \n"
        }
        else {
            dataToDisplay += "It accumulates the following addresses: \n"
            Object.keys(asset["accum"]).forEach(key => {
                dataToDisplay += key + " : " + asset["accum"][key]["/"] + "\n"
            })
        }
    }

    console.log(dataToDisplay)

}

let displayAssertion = (assertion) => {
    // first verify the signature

    let signature = assertion["signature"]
    let claimedPublicKey = assertion["principal"]
    let fingerPrint
    if (keystore[claimedPublicKey]) {
        fingerPrint = keystore[claimedPublicKey]
    }
    else {
        fingerPrint = crypto.createHash('sha256').update(rootObject["principal"]).digest('hex')
        keystore[claimedPublicKey] = fingerPrint
        fs.writeFileSync(keystorepath, JSON.stringify(keystore))
    }
    // the data to verify : here it's the asset's cid in the object
    let dataToVerify = assertion["asset"]["/"]

    const verify = crypto.createVerify('SHA256')
    verify.write(dataToVerify)
    verify.end()
    let signatureVerified = verify.verify(claimedPublicKey, signature, 'hex')



    let dataToDisplay =
        "The provided ipfs path refers to an 'assertion' format. \n" +
        "This assertion is claimed to be produced by the principal " +
        "of public key: \n" + fingerPrint +
        "\nIt refers to the 'asset' of address " + assertion["asset"]["/"] + "\n"

    if (signatureVerified) {
        dataToDisplay += "The provided signature is SUCCESSFULLY verified \n "
    }
    else {
        dataToDisplay += "The provided signature verification has FAILED"
    }

    console.log(dataToDisplay)
}

let getAllTrustInfo = async (cid) => {
    // since we will read all the dag objects, it is better to retrieve it fully initially
    try {
        await ensureFullDAG(cid)
        // the following is executed if the ensureFullDAG was successfull -> meaning that we are sure that the whole dag we want to read exists in the ipfs local cache to read it in an easier way

        let result = {
            "principalsToTrustList": new Set(),
            "unverifiedAssertionsList": {},
            "verifiedAssertionsList": {},
            "unsignedObjectsList": {},
            //   "unsigned": false      // change to true if there exists unsigned object | unverified assertion
        }

        processObject(cid, result)

        //if (result["unsigned"]) {
        //    result["principalsToTrustList"].push("!unsigned")
        //}
        return result

    } catch (err) {
        console.log(err) // in case ensureFullDAG() failed
    }
}

let who_to_trust = async (cid) => {
    let result = {}
    try {
        result = await getAllTrustInfo(cid)

        let cmd = "ipfs dag get " + cid
        let obj = execSync(cmd, { encoding: 'utf-8' })
        obj = JSON.parse(obj)
        if (obj["format"] != "assertion") {
            console.log("The root object referred to by this cid is not of an 'assertion' format, so you do not 'trust it'")
            console.log("However, the principals to be trusted in the rest of the dag are: ")
        }
        result["principalsToTrustList"].forEach((value)=>{console.log(value)})
        if (Object.keys(result["unverifiedAssertionsList"]) != 0) {
            // even if we do not allow to publish with an invalid assertion ipfs address, it's better to check because any actor would be able to upload an assertion format object with an invalid signature
            console.log("ATTENTION: this structure contains the following invalid assertions")
            console.log(result["unverifiedAssertionsList"])
        }

        return result["principalsToTrustList"]
    }
    catch (err) {
        console.log(err)
    }
}

let inspect_in_depth = async (cid) => {
    let result = {}
    try {
        result = await getAllTrustInfo(cid)
        console.log(util.inspect(result, { showHidden: false, depth: null, colors: true }))
    }
    catch (err) {
        console.log(err)
    }
}

let processObject = (cid, result) => {
    try {
        let cmd = "ipfs dag get " + cid
        let obj = execSync(cmd, { encoding: 'utf-8' })
        obj = JSON.parse(obj)

        if (obj["format"] == "assertion") {
            if (verifySignature(obj)) {

                let fingerPrint
                if (keystore[obj["principal"]]) {
                    fingerPrint = keystore[obj["principal"]]
                } 
                else {
                    fingerPrint = crypto.createHash('sha256').update(rootObject["principal"]).digest('hex')
                    keystore[claimedPublicKey] = fingerPrint
                    fs.writeFileSync(keystorepath, JSON.stringify(keystore))
                }

                result["principalsToTrustList"].add(fingerPrint)
                result["verifiedAssertionsList"][cid] = obj
            }
            else {
                result["unsigned"] = true
                result["unverifiedAssertionsList"][cid] = obj
            }
            let asset = execSync("ipfs dag get " + cid + "/asset", { encoding: 'utf-8' })
            asset = JSON.parse(asset)

            if (asset["asset-type"] == "abella-script") {
                Object.keys(asset["imports"]).forEach(key => {
                    processObject(asset["imports"][key]["/"], result)
                })

                if (obj["specification"] != "") {
                    Object.keys(asset["specification"]).forEach(key => {
                        processObject(asset["specification"][key]["/"], result)
                    })
                }
            }
            //else if (asset["asset-type"] == "abella-specification") {
            // we do not consider this since we do not allow signing specifications for now (no meaning)
            //}
        }
        else if (obj["format"] == "asset") {
            result["unsignedObjectsList"][cid] = obj

            if (obj["asset-type"] == "abella-script") {
                Object.keys(obj["imports"]).forEach(key => {
                    processObject(obj["imports"][key]["/"], result)
                })

                if (obj["specification"] != "") {
                    Object.keys(obj["specification"]).forEach(key => {
                        processObject(obj["specification"][key]["/"], result)
                    })
                }
            }
            else if (obj["asset-type"] == "abella-specification") {
                Object.keys(obj["accum"]).forEach(key => {
                    processObject(obj["accum"][key]["/"], result)
                })
            }
        }
        else throw ("UNSUPPORTED FORMAT !")
    } catch (err) {
        console.log(err)
    }
}

let verifySignature = (assertion) => { // first ensure that this is an assertion format (fix later)
    try {
        if (assertion["format"] != "assertion") {
            throw error
        }
        else {
            let signature = assertion["signature"]
            let claimedPublicKey = assertion["principal"]
            // the data to verify : here it's the asset's cid in the object
            let dataToVerify = assertion["asset"]["/"]

            const verify = crypto.createVerify('SHA256')
            verify.write(dataToVerify)
            verify.end()
            let signatureVerified = verify.verify(claimedPublicKey, signature, 'hex')
            return signatureVerified
        }
    } catch (err) {
        console.log("wrong format")
    }
}

let ensureFullDAG = async (cid) => {
    try {
        //test if it exists locally / or tries to retrieve the missing links in case the ipfs daemon is activated
        let cmd = "ipfs dag export " + cid + " > tmpp.car"
        // for now : causes a problem if we use an address with slashes "/" since ipfs export doesn't support it currently
        execSync(cmd, { encoding: 'utf-8' }) // this fails if there are missing links from the local ipfs repo / or unsuccessful to retrieve in case the ipfs daemon is activated
        fs.unlink('tmpp.car', (err) => {
            if (err) throw err;
        });
    } catch (err) {
        console.log("There are missing links that were not found in the local ipfs cache OR the ipfs daemon (if activated) has not been able to find them, trying to retrieve them from the specified gateway ..")
        let url = gateway + "/api/v0/dag/export?arg=" + cid
        //let result = await axios.get(url)
        // problem here: we need to return the result as a stream to properly create the .car file from it -> axios not sufficient

        try {
            const streamPipeline = util.promisify(stream.pipeline);

            const response = await fetch(url);

            if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);

            await streamPipeline(response.body, fs.createWriteStream('tmpp.car'));

            //fs.writeFileSync("tmpp.car", response.body)
            execSync("ipfs dag import tmpp.car", { encoding: 'utf-8' })
            fs.unlink('tmpp.car', (err) => {
                if (err) throw err;
            });
        } catch (err) {
            console.log(err)
            process.exit()
        }
    }
}

let get_specification = async (cid) => {
    try {
        await ensureFullDAG(cid)
        let rootObject = JSON.parse(execSync("ipfs dag get " + cid, { encoding: 'utf-8' }))
        if (!(rootObject["format"] == "asset" && rootObject["asset-type"] == "abella-specification")) {
            throw (error("Wrong Format !"))
        }
        let sigFileText = "sig " + rootObject["name"] + ".\n"
        let modFileText = "module " + rootObject["name"] + ".\n"

        let specText = { "sigFileText": sigFileText, "modFileText": modFileText }

        Object.keys(rootObject["accum"]).forEach(key => {
            addAccum(specText, rootObject["accum"][key]["/"])
        });

        let rootSigText = trimSpecText("sig", execSync("ipfs cat " + rootObject["textsig"]["/"]))
        let rootModText = trimSpecText("mod", execSync("ipfs cat " + rootObject["textmod"]["/"]))

        specText["sigFileText"] += rootSigText
        specText["modFileText"] += rootModText

        fs.writeFileSync(cid + ".sig", specText["sigFileText"])
        fs.writeFileSync(cid + ".mod", specText["modFileText"])

    } catch (err) {
        console.log(err)
    }
}

let addAccum = (specText, cid) => {
    let accumObj = JSON.parse(execSync("ipfs dag get " + cid, { encoding: 'utf-8' }))

    Object.keys(accumObj["accum"]).forEach(key => {
        addAccum(specText, accumObj["accum"][key]["/"])
    });

    let accumSigText = trimSpecText("sig", execSync("ipfs cat " + accumObj["textsig"]["/"]))
    let accumModText = trimSpecText("mod", execSync("ipfs cat " + accumObj["textmod"]["/"]))

    specText["sigFileText"] += accumSigText
    specText["modFileText"] += accumModText
}

let trimSpecText = (fileType, fileText) => {
    let resultText = ""
    // still have to deal with the /* */ comment
    let lines = fileText.toString().split("\n")
    lines.forEach(line => {
        line = line.trim()
        if (line[0] == "%") {
            resultText += line + "\n"
        }
        else if (line[0] != "%") {
            let commands = line.toString().split(".")
            commands.forEach(command => {
                command = command.trim()
                if (fileType == "sig" && command != "") {
                    if (command.startsWith("sig") || command.startsWith("accum_sig")) { }
                    else if (command[0] == "%") {
                        resultText += command + "\n"
                    }
                    else resultText += command + "."
                }
                else if (fileType == "mod" && command != "") {
                    if (command.startsWith("module") || command.startsWith("accumulate")) { }
                    else if (command.startsWith("%")) {
                        resultText += command + "\n"
                    }
                    else resultText += command + "."
                }
            });
            resultText += "\n"
        }
    });

    return resultText
}


let executionFileText = ""
let spec_detected = { "value": false }
let keysToTrust = new Set()
// the cid should refer to an assertion or asset format + the asset should refer to an abella-script not specification
let get_execution = async (cid) => {
    //let executionFile = { "text": "" }
    try {
        await ensureFullDAG(cid)
        // after the full dag is ensured to exist locally : 

        let rootObject = execSync("ipfs dag get " + cid, { encoding: 'utf-8' })

        rootObject = JSON.parse(rootObject)

        if (rootObject["format"] == "assertion") {
            // insert skip for all proof scripts in the structure (doesn't matter if there are links to assets, these are considered to be signed/checked implicitly by some assertion (either the root assertion or other) in the structure)

            keystore = JSON.parse(fs.readFileSync(keystorepath))
            if (!keystore[rootObject["principal"]]) { // to calculate the fingerprint only once
                let fingerPrint = crypto.createHash('sha256').update(rootObject["principal"]).digest('hex')
                keystore[rootObject["principal"]] = fingerPrint
                fs.writeFileSync(keystorepath, JSON.stringify(keystore))
            }

            keysToTrust.add(keystore[rootObject["principal"]])
            
            let asset = JSON.parse(execSync("ipfs dag get " + cid + "/asset", { encoding: 'utf-8' }))
            if (asset["asset-type"] != "abella-script") { // for now we only allow this type of asset in get_execution (which is used at import)
                throw error
            }

            //rootFileText = execSync("ipfs cat " + cid + "/asset/text", { encoding : 'utf-8' })
            await processAssetExec(asset, true, keystore[rootObject["principal"]]) // true corresponds to "skip" which means starting from an assertion

        }
        else if (rootObject["format"] == "asset") {
            // consider finding an "assertion" as a stop/separation sign : skip what's after it
            if (rootObject["asset-type"] != "abella-script") {
                throw error
            }
            await processAssetExec(rootObject, false, keystore[rootObject["principal"]])
        }

        //console.log(executionFile["text"])
        //console.log(executionFile)
        //console.log(executionFile["text"])
        fs.writeFileSync(cid + ".thm", executionFileText)
        
        //who_to_trust(cid)
        //console.log(keysToTrust)

    } catch (err) {
        console.log(err)
    }
}

// considering that the asset is ensured to be of type "abella-script" (for now)
// considering now the case where there is no specification

// considering that it takes only abella-script asset type
let processAssetExec = async (asset, skip, currentKey) => {
    // call this function for each import with skip : true/false
    //asset(the var) is now an asset format for sure

    try {
        if (asset["asset-type"] != "abella-script") {
            throw error
        }

        if (asset["parsedcontent"] && asset["parsedcontent"]["/"]) {
            let parsedcontentcid = asset["parsedcontent"]["/"]
            let commands = JSON.parse(execSync("ipfs cat " + parsedcontentcid, { encoding: "utf-8" }))

            for (let command of commands) {
                if (command["type"] == "top_command") {
                    await processTopCommand(command, skip, currentKey)
                    //includes: Theorem, Specification, Import, Define, CoDefine, Query, Split, Set, Show, Quit, Close
                }
                else if (command["type"] == "proof_command") {
                    await processProofCommand(command, skip)
                    // print when !skip
                }
                else if (command["type"] == "system_message") {
                    processSystemMessage(command)
                    // do not print
                    // if severity = error -> throw error invalid file 

                }
                else {
                    // ?? processOtherCommands(command)
                }
            }
        }
    } catch (err) {
        console.log(err)
    }
}

let processTopCommand = async (command, skip, currentKey) => {

    //let executionFileText = executionFile["text"]

    if (command["command"].startsWith("Specification")) {
        // construct the specification file [with full accumulations]
        // the argument is always an ipfs cid (not a local name, since by design we changed local names to cid at publish phase)
        // the specification should be written only once (there should only be one specification reference according to abella)
        // ignore specification commands in imported files (redundant) -> this leads to the necessity of having the same cid refer to the same specification used by two different users -> publishing should be deterministic regarding the produced cid
        if (!spec_detected["value"]) {
            let specificationcid = command["command"].substring(22, command["command"].length - 1)
            await get_specification(specificationcid)
            executionFileText += command["command"] + ".\n"
            spec_detected["value"] = true
        }
    }
    else if (command["command"].startsWith("Theorem")) {
        // print + print "skip" if skip
        executionFileText += "\n" + command["command"] + ".\n"
        if (skip) {
            executionFileText += "skip. % " + currentKey
        }
    }
    else if (command["command"].startsWith("Import")) {
        //console.log(executionFileText)
        //console.log("------------------------------------------")
        // process the import here instead of doing so from the asset imports attribute -> imports not only at the beginning of the file would be treated
        // the argument is always an ipfs cid (by design, at publishing, all links become cids instead of local names)

        let importedcid = command["command"].substring(12, command["command"].length - 1)

        //console.log("commmanddd " + command["command"])
        let importedObj = JSON.parse(execSync("ipfs dag get " + importedcid, { encoding: 'utf-8' }))
        if (importedObj["format"] == "assertion") {
            if (!keystore[importedObj["principal"]]) { // to calculate the fingerprint only once
                let fingerPrint = crypto.createHash('sha256').update(importedObj["principal"]).digest('hex')
                //console.log(fingerPrint)
                keystore = JSON.parse(fs.readFileSync(keystorepath))
                keystore[importedObj["principal"]] = fingerPrint
                fs.writeFileSync(keystorepath, JSON.stringify(keystore))
            }

            keysToTrust.add(keystore[importedObj["principal"]])
            currentKey = keystore[importedObj["principal"]]

            importedObj = JSON.parse(execSync("ipfs dag get " + importedcid + "/asset", { encoding: 'utf-8' }))

            /////////////


            /////////////
            await processAssetExec(importedObj, true, currentKey)
        }
        else if (importedObj["format"] == "asset") {
            //console.log("here")
            await processAssetExec(importedObj, skip, currentKey)
        }
        else if (importedObj["format"] != "asset") {
            throw error
        }
        //console.log(executionFileText)
        //console.log("----------------------------------")
    }
    else {
        // print other commands
        executionFileText += "\n" + command["command"] + "."
    }

    //executionFile["text"] = executionFileText

    //console.log(executionFile)

}

let processProofCommand = async (command, skip) => {
    // print if !skip  
    //let executionFileText = executionFile["text"]
    //console.log(executionFileText)
    //console.log("---------------------------------------------------")
    if (!skip) {
        executionFileText += command["command"] + "."
    }
    //executionFile["text"] = executionFileText
}

let processSystemMessage = (command) => {
    if (command["severity"] == "error") {
        console.log("not completely valid abella script")
        // we do not allow to execute/publish in such case for now
        process.exit(0)
    }
}

module.exports = { inspect_shallow, inspect_in_depth, who_to_trust, ensureFullDAG, get_execution, verifySignature, get_specification }
