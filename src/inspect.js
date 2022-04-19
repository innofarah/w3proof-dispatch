const { exec, execSync, execFile } = require('child_process');
const { assert, error } = require('console');
const fs = require('fs')
const crypto = require('crypto')
const os = require('os')
const util = require('util')
const stream = require('stream')
const fetch = require('node-fetch').default

let config, gateway
let configpath = os.homedir() + "/.config/w3proof-dispatch/config.json"

// remove this later from here and put it in a main function - this check should only be done if the user specified the ipfsstation to be gateway 
try {
    let configFile = fs.readFileSync(configpath)
    config = JSON.parse(configFile)
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
    // the data to verify : here it's the asset's cid in the object
    let dataToVerify = assertion["asset"]["/"]

    const verify = crypto.createVerify('SHA256')
    verify.write(dataToVerify)
    verify.end()
    let signatureVerified = verify.verify(claimedPublicKey, signature, 'hex')



    let dataToDisplay =
        "The provided ipfs path refers to an 'assertion' format. \n" +
        "This assertion is claimed to be produced by the principal " +
        "of public key: \n" + claimedPublicKey +
        "It refers to the 'asset' of address " + assertion["asset"]["/"] + "\n"

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
            "principalsToTrustList": [],
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
        console.log(result["principalsToTrustList"])
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
                result["principalsToTrustList"].push(obj["principal"])
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

// the cid should refer to an assertion or asset format + the asset should refer to an abella-script not specification
let get_execution = async (cid) => {
    try {
        await ensureFullDAG(cid)
        // after the full dag is ensured to exist locally : 

        let rootObject = execSync("ipfs dag get " + cid, { encoding: 'utf-8' })
        rootObject = JSON.parse(rootObject)
        let executionFile = { "text": "" }

        if (rootObject["format"] == "assertion") {
            // insert skip for all proof scripts in the structure (doesn't matter if there are links to assets, these are considered to be signed/checked implicitly by some assertion (either the root assertion or other) in the structure)
            let asset = JSON.parse(execSync("ipfs dag get " + cid + "/asset", { encoding: 'utf-8' }))
            if (asset["asset-type"] != "abella-script") { // for now we only allow this type of asset in get_execution (which is used at import)
                throw error
            }

            //rootFileText = execSync("ipfs cat " + cid + "/asset/text", { encoding : 'utf-8' })
            processImport(asset, executionFile, true) // true corresponds to "skip" which means starting from an assertion

        }
        else if (rootObject["format"] == "asset") {
            // consider finding an "assertion" as a stop/separation sign : skip what's after it
            if (rootObject["asset-type"] != "abella-script") {
                throw error
            }
            processImport(rootObject, executionFile, false)
        }

        //console.log(executionFile["text"])
        fs.writeFileSync(cid + ".thm", executionFile["text"])

        who_to_trust(cid)

    } catch (err) {
        console.log(err)
    }
}

// considering that the asset is ensured to be of type "abella-script" (for now)
// considering now the case where there is no specification
let processImport = (asset, executionFile, skip) => {

    // !!!CHECK IF TRUE: considering (for now) that the imports exist at the beginning of the file, and that their order does not matter (the imports in the same file do not depend on each other)

    // call this function for each import with skip : true

    try {
        for (var importedName in asset["imports"]) {
            let importedObj = JSON.parse(execSync("ipfs dag get " + asset["imports"][importedName]["/"], { encoding: 'utf-8' }))
            if (importedObj["format"] == "assertion") {
                importedObj = JSON.parse(execSync("ipfs dag get " + asset["imports"][importedName]["/"] + "/asset", { encoding: 'utf-8' }))
                processImport(importedObj, executionFile, true)
            }
            else if (importedObj["format"] == "asset") {
                processImport(importedObj, executionFile, skip)
            }
            else if (importedObj["format"] != "asset") {
                throw error
            }

        }

        // after that, write all the theorems in the file with SKIPS instead of the proof script (if exists) if skip : true, write the scripts otherwise

        //asset(the var) is now an asset format for sure
        processNonImports(asset, executionFile, skip) // processText

    } catch (err) {
        console.log(err)
    }
}

// considering that it takes only abella-script asset type
let processNonImports = (asset, executionFile, skip) => {
    let executionFileText = executionFile["text"]

    try {
        if (asset["asset-type"] != "abella-script") {
            throw error
        }

        let textcid = asset["text"]["/"]
        let text = execSync("ipfs cat " + textcid, { encoding: 'utf8' })
        fs.writeFileSync(textcid + ".thm", text)
        try {
            execSync("./executables/abella.exe -a " + textcid + ".thm -o " + textcid + ".json", { encoding: 'utf-8' })

            let textjson = JSON.parse(fs.readFileSync(textcid + ".json"))
            console.log(textjson)
            fs.unlink(textcid + ".thm", (err) => {
                if (err) throw err;
            });
            fs.unlink(textcid + ".json", (err) => {
                if (err) throw err;
            });

        } catch (err) {
            //console.log(err)
        }

        //console.log(textjson)
        /*let inTheorem = false
        let skipped = false

        let commands = text.split(".");
        for (let command of commands) {
            let initialCommand = command
            command = command.trim();

            if(command[0] == "%") {
                //console.log("..." + command + "...") 
                let theCommand = ""
                lines = command.split("\n")
                //console.log(lines)
                lines.forEach(line => {
                    line = line.trim()
                    if (line[0] == "%") {
                        //executionFileText += line + "\n"
                    }
                    else if (line != "") {
                        theCommand += line + "\n"
                    }
                });
                command = theCommand + "\n"
                //console.log(command)
            }
            //console.log("..." + command + "...")
            if (command.substring(0, 13) == "Specification") {
                // do not print specification line, considering that only one specification is allowed per file and that the main file which has the imports has it specified
                //console.log(command)
            }
            else if (command.substring(0, 6) == "Import") {
                // don't put in executiontext - do nothing
                skipped = false
            }
            else if (command.substring(0, 7) == "Theorem") {
                //console.log(command)
                executionFileText += initialCommand + ".\n"
                inTheorem = true
                skipped = false
                //console.log(command)
            }
            else if (!isTopLevelCommand(command) && inTheorem) { // in the theorem
                if (skip) {
                    //console.log(command)
                    if (!skipped) {
                        executionFileText += "skip.\n"
                        skipped = true
                    }
                }
                else {
                    executionFileText += initialCommand + ".\n"
                }
            }
            else if (isTopLevelCommand(command) && inTheorem) {
                inTheorem = false
                skipped = false
                executionFileText += initialCommand + "."
            }
            else if (command == "") {
                executionFileText += "\n"
            }
            else {
                executionFileText += initialCommand + "."
            }

        }

        executionFile["text"] = executionFileText

    */

    } catch (err) {
        console.log(err)
    }
}

let isTopLevelCommand = (command) => {
    // just for a temporary solution
    //let topLevelCommands = ["Theorem", "Define", "CoDefine", "Specification", "Import", "Query", "Split", "Set", "Show", "Quit", "Close"]

    if (command.startsWith("Theorem") || command.startsWith("Define") || command.startsWith("CoDefine")
        || command.startsWith("Specification") || command.startsWith("Import") || command.startsWith("Query")
        || command.startsWith("Split") || command.startsWith("Set") || command.startsWith("Show")
        || command.startsWith("Quit") || command.startsWith("Close")) {

        return true

    }

    return false

}

module.exports = { inspect_shallow, inspect_in_depth, who_to_trust, ensureFullDAG, get_execution }
