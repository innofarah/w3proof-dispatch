const fs = require('fs')
const { exec, execSync } = require('child_process');
const { Web3Storage, getFilesFromPath } = require('web3.storage');
const { CarReader } = require('@ipld/car');
const os = require('os')
const crypto = require('crypto')
const axios = require('axios');

let queueGlobal = []
let publishedObjs = {}
let config = "", gateway = "", web3Token = "", web3Client = ""

//let platform = os.platform()
let configpath = ""
//if (platform == 'freebsd' || platform == 'linux' || platform == 'sunos' || platform == 'darwin' || platform == 'win32') {
configpath = os.homedir() + "/.config/w3proof-dispatch/config.json"
//}

let keygen = () => { // now just using default parameters
    /* const {
        publicKey,
        privateKey
    } = crypto.generateKeyPairSync('rsa', {
        modulusLength : 4096,
        publicKeyEncoding: {
            type : 'spki',
            format : 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            cipher: 'aes-256-cbc',
            passphrase: 'top secret'
        }
    }) */

    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'sect239k1',
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    //console.log("private key : " + privateKey)
    //console.log("public key : " + publicKey)
    // add them to the configuration file: for now 
    let configFile = fs.readFileSync(configpath)
    config = JSON.parse(configFile)
    config["public-key"] = publicKey
    config["private-key"] = privateKey
    try {
        fs.writeFileSync(configpath, JSON.stringify(config))
    }
    catch (err) {
        console.log(err.message)
    }
}

let setweb3token = (token) => {
    let configFile = fs.readFileSync(configpath)
    config = JSON.parse(configFile)
    config["my-web3.storage-api-token"] = token
    try {
        fs.writeFileSync(configpath, JSON.stringify(config))
    }
    catch (err) {
        console.log(err.message)
    }
}

let setgateway = (gateway) => {
    let configFile = fs.readFileSync(configpath)
    config = JSON.parse(configFile)
    config["my-gateway"] = gateway
    fs.writeFileSync(configpath, JSON.stringify(config))
}

let listconfig = () => {
    let configFile = fs.readFileSync(configpath)
    config = JSON.parse(configFile)
    console.log(config)
    //Object.entries(config).forEach(element => {
    //    console.log(element[0] + " : " + element[1])
    //});
}

let processAsset = async (assetName, assetType, directoryPath) => {
    let asset = {}
    if (assetType == "abella-script") {
        asset = { "format": "asset", "asset-type": "abella-script", "name": assetName, "specification": "", "imports": [], "text": {} }
        await processAbellaScript(asset, directoryPath)
    }
    else if (assetType == "abella-specification") {
        asset = { "format": "asset", "asset-type": "abella-specification", "name": assetName, "accum": [], "textmod": {}, "textsig": {} }
        // we assume that the files are correctly formatted (both .sig and .mod files are correctly written, and that they exist within the same directory and with the same name (but different extension))
        await processAbellaSpecification(asset, directoryPath)
    }
}

let processAbellaSpecification = async (asset, directoryPath) => {
    let fileText = fs.readFileSync(directoryPath + "/" + asset["name"] + ".mod").toString() //read accumulations only from .mod file (since they similarly exist (the same) in the .sig file)
    let lines = fileText.split("\n")

    for (let line of lines) {
        line.trim()
        let commands = line.split(".")

        for (let command of commands) {
            command = command.trim()
            if (command.substring(0, 10) == "accumulate") { // in .mod file 
                // considering that the specification file only accumulates(like imports) specification files
                await processCommand(command, "accumulate", asset)
            }
        }
    }

    publishRawText(asset, fileText, ".mod")
    let sigFileText = fs.readFileSync(directoryPath + "/" + asset["name"] + ".sig").toString()
    publishRawText(asset, sigFileText, ".sig")

    queueGlobal.push(asset)

    for (const accumName of asset["accum"]) {
        if (!publishedObjs[accumName]) {
            await processAsset(accumName, "abella-specification", directoryPath)
            //promisesGlobal.push(processAsset(accumName, "abella-specification", directoryPath))
        }
    }
}


let processAbellaScript = async (asset, directoryPath) => {
    let fileText = fs.readFileSync(directoryPath + "/" + asset["name"] + ".thm").toString()
    let lines = fileText.split("\n")

    for (let line of lines) {
        line = line.trim();
        let commands = line.split(".");
        for (let command of commands) {
            command = command.trim();
            if (command.substring(0, 13) == "Specification") {
                await processCommand(command, "specification", asset);
            }
            else if (command.substring(0, 6) == "Import") {
                await processCommand(command, "import", asset);
            }
        }
    }

    publishRawText(asset, fileText, ".thm")
    queueGlobal.push(asset)

    for (const importedName of asset["imports"]) {
        if (!publishedObjs[importedName]) {
            await processAsset(importedName, "abella-script", directoryPath)
        }
    }
    if (asset["specification"]) {
        if (!publishedObjs[asset["specification"]]) {
            await processAsset(asset["specification"], "abella-specification", directoryPath)
        }
    }
}

let processCommand = async (command, commandType, asset) => {
    if (commandType == "import" && Object.keys(asset["imports"]).length == 0) asset["imports"] = []

    let delimiter = ""
    if (commandType == "accumulate") delimiter = " "
    else delimiter = "\""

    // name : specification or imported name
    let name = command.split(delimiter)[1]
    if (name.substring(0, 7) == "ipfs://") {
        let parts = name.split("//")
        let path = parts[parts.length - 1]
        await addIpfsLinktoAsset(path, commandType, asset)
    }
    else {
        if (commandType == 'specification') asset["specification"] = name
        else if (commandType == "import") asset["imports"].push(name)
        else if (commandType == "accumulate") asset["accum"].push(name)
    }
}




// first get asset/assertion file -> check if format is assertion -> get asset file -> process
let addIpfsLinktoAsset = async (path, commandType, asset) => {
    let tmpfilename = path + ".json" // different imports were overlapping with same file name (tmpobj.json) - caused a problem, so use a unique file name for each import
    await getAssetFile(path, tmpfilename)
    let tmpobj = fs.readFileSync(tmpfilename)
    tmpobj = JSON.parse(tmpobj)
    if (commandType == "specification") {
        asset["specification"] = tmpobj["name"]
    }
    else if (commandType == "import") {
        // cause the process to exit (error) if trying to publish with an invalid assertion link (we do not allow it to exist normally, it should also be detected however when loading files in case a malicious actor publishes an assertion with an invalid signature manually)
        if (tmpobj["format"] == "assertion") {
            if (!verifySignature(tmpobj)) {
                console.log("an invalid assertion link exists in the imports ! Publishing failed.")
                process.exit()
            }
        }
        asset["imports"].push(tmpobj["name"])
    }
    else if (commandType == "accumulate") {
        asset["accum"].push(tmpobj["name"])
    }
    publishedObjs[tmpobj["name"]] = { "/": path }
    fs.unlink(tmpfilename, (err) => {
        if (err) throw err;
    })
}

let getAssetFile = async (path, tmpfilename) => { // creats a tmpobj.json file which contains the asset's json object
    try { // check if the object referred to by 'path' is found locally (or globally if ipfs daemon is running)
        let cmd = "ipfs dag get " + path + " > " + tmpfilename
        execSync(cmd, { encoding: 'utf-8' })
        tmpobj = JSON.parse(fs.readFileSync(tmpfilename))
        if (tmpobj["format"] == "assertion") {
            try {
                cmd = "ipfs dag get " + path + "/asset > " + tmpfilename
                execSync(cmd, { encoding: 'utf-8' })
            } catch (error) {
                let response = await axios.get(gateway + "/api/v0/dag/get?arg=" + path + "/asset")
                tmpobj = response.data
                fs.writeFileSync(tmpfilename, JSON.stringify(response.data))
            }
        }
    } catch (error) {
        let response = await axios.get(gateway + "/api/v0/dag/get?arg=" + path)
        tmpobj = response.data
        fs.writeFileSync(tmpfilename, JSON.stringify(response.data))
        if (tmpobj["format"] == "assertion") {
            try {
                cmd = "ipfs dag get " + tmpobj["asset"]["/"] + " > " + tmpfilename
                execSync(cmd, { encoding: 'utf-8' })
            } catch (error) {
                try {
                    let response = await axios.get(gateway + "/api/v0/dag/get?arg=" + tmpobj["asset"]["/"])
                    fs.writeFileSync(tmpfilename, JSON.stringify(response.data))
                } catch (err) {
                    console.log(err)
                }
            }
        }
    }
}


let publishRawText = (asset, rawText, fileExtension) => {
    fs.writeFileSync("rawText.txt", rawText)
    const output = execSync('ipfs add rawText.txt --quieter --cid-version 1', { encoding: 'utf-8' });  // the default is 'buffer'
    if (fileExtension == ".thm")
        asset["text"]["/"] = output.substring(0, output.length - 1) // without the final "\n"
    else if (fileExtension == ".sig")
        asset["textsig"]["/"] = output.substring(0, output.length - 1) // without the final "\n"
    else if (fileExtension == ".mod")
        asset["textmod"]["/"] = output.substring(0, output.length - 1) // without the final "\n"
}

// this is a local publish --> adding into the local ipfs space(node)
let publish = async (current, target, result) => {
    if (current["asset-type"] == "abella-script") {
        if (current["imports"].length == 0) {
            current["imports"] = {}
        }
        else {
            let imports = current["imports"]
            current["imports"] = {}
            imports.forEach(importedName => {
                current["imports"][importedName] = publishedObjs[importedName]
            });
        }
        if (current["specification"] != "") {
            let specName = current["specification"]
            current["specification"] = {}
            current["specification"][specName] = publishedObjs[specName]
        }
    }
    else if (current["asset-type"] == "abella-specification") {
        if (current["accum"].length == 0) {
            current["accum"] = {}
        }
        else {
            let accumulations = current["accum"]
            current["accum"] = {}
            accumulations.forEach(accumName => {
                current["accum"][accumName] = publishedObjs[accumName]
            });
        }
    }

    fs.writeFileSync("tmpJSON.json", JSON.stringify(current))

    let addcmd = "ipfs dag put tmpJSON.json --pin"
    let output = execSync(addcmd, { encoding: 'utf-8' })
    publishedObjs[current["name"]] = { "/": output.substring(0, output.length - 1) }
    // we are sure that the first asset to be published has no imports, so: modify text before publishing the next asset
    if (queueGlobal.length > 0) {
        // once its imports are published, modify the object's/asset's text before publishing it 
        let assetToModify = queueGlobal.pop()
        assetToModify = modifyAsset(assetToModify) // change its text according to the cids of its imports (we know these cids because the imports have been published previously - according to the current implementation according to the global queue)
        await publish(assetToModify, target, result)
    }
    // finished
    else if (queueGlobal.length == 0 && target.toString() == "web3storage") {
        await publishFinalDag(output.substring(0, output.length - 1), result).catch((err) => {
            console.error(err)
            process.exit(1)
        })
    }
    else if (queueGlobal.length == 0 && target.toString() == "local") {
        result["value"] = output.substring(0, output.length - 1)
    }
}

let modifyAsset = (assetToModify) => {
    if (assetToModify["asset-type"] == "abella-script") {
        let text = execSync("ipfs cat " + assetToModify["text"]["/"], { encoding: 'utf-8' })
        assetToModify['imports'].forEach(importedName => {
            let importedcid = publishedObjs[importedName]['/']
            // here, for each import, if the import corresponds to a local filename, replace the name with its corresponding cid
            // then, upload the new text, and replace the text's link cid with the new text cid.

            // either Import "name". or Import "ipfs://cid"

            const regexpImport = new RegExp('Import "' + importedName + '".'); // so, if the import refers to an ipfs address, it won't be matched -> this is only for local imports
            text = text.replace(regexpImport, 'Import "ipfs://' + importedcid + '".');
            // for an "import ipfs://cid", the regular expression doesn't match so nothing would happen and the cid would stay
        });

        // considering that an abella script has only one specification or none
        if (assetToModify["specification"] != "") {
            let specificationcid = publishedObjs[assetToModify["specification"]]['/'] // considering that a specification and a script do not have the same name (so fix this later because it is possible)
            const regexpSpecification = new RegExp('Specification "' + assetToModify["specification"] + '".')
            text = text.replace(regexpSpecification, 'Specification "ipfs://' + specificationcid + '".')
        }

        // publish the new text
        fs.writeFileSync("newText.txt", text)
        const output = execSync('ipfs add newText.txt --quieter --cid-version 1', { encoding: 'utf-8' });  // the default is 'buffer'
        assetToModify["text"]["/"] = output.substring(0, output.length - 1)

        fs.unlink('newText.txt', (err) => {
            if (err) throw err;
        });
    }
    else if (assetToModify["asset-type"] == "abella-specification") {
        let textmod = execSync("ipfs cat " + assetToModify["textmod"]["/"], { encoding: 'utf-8' })
        let textsig = execSync("ipfs cat " + assetToModify["textsig"]["/"], { encoding: 'utf-8' })

        //let regexpsig = new RegExp('sig ' + assetToModify["name"])
        //textsig = textsig.replace(regexpsig, 'sig "ipfs://' + ) !problem here (cycle)

        assetToModify['accum'].forEach(accumulatedName => {
            let accumulatedcid = publishedObjs[accumulatedName]['/'] //asuming that the file names we are using are unique
            const regexpsig = new RegExp("accum_sig " + accumulatedName + ".")
            textsig = textsig.replace(regexpsig, "accum_sig ipfs://" + accumulatedcid + ".")
            const regexpmod = new RegExp("accumulate " + accumulatedName + ".")
            textmod = textmod.replace(regexpmod, "accumulate ipfs://" + accumulatedcid + ".")
        })

        fs.writeFileSync("textsig.txt", textsig)
        fs.writeFileSync("textmod.txt", textmod)

        let output = execSync('ipfs add textsig.txt --quieter --cid-version 1', { encoding: 'utf-8' });  // the default is 'buffer'
        assetToModify["textsig"]["/"] = output.substring(0, output.length - 1)

        output = execSync('ipfs add textmod.txt --quieter --cid-version 1', { encoding: 'utf-8' });  // the default is 'buffer'
        assetToModify["textmod"]["/"] = output.substring(0, output.length - 1)

        fs.unlink('textsig.txt', (err) => {
            if (err) throw err;
        });
        fs.unlink('textmod.txt', (err) => {
            if (err) throw err;
        });

    }

    return assetToModify
}

// this is where the final dag structure is published publicly (through web3.storage api) 
let publishFinalDag = async (cid, result) => {
    try {
        let cmd = "ipfs dag export " + cid + " > tmpcar.car"
        execSync(cmd, { encoding: 'utf-8' })
        const inStream = fs.createReadStream('tmpcar.car')
        // read and parse the entire stream in one go, this will cache the contents of
        // the car in memory so is not suitable for large files.
        const reader = await CarReader.fromIterable(inStream)
        const cid1 = await web3Client.putCar(reader)
        //console.log("Uploaded CAR file to Web3.Storage! CID:", cid1)
        fs.unlink('tmpcar.car', (err) => {
            if (err) throw err;
        });
        result["value"] = cid1
        //console.log("result val " + result["value"])
        //return cid1
        //console.log(await web3Client.status(cid1))
    } catch (err) {
        //console.log(err)
        console.log("Full dag is not present in the local ipfs repository, unable to upload through web3storage as a car file -- for now --> please activate your ipfs daemon and execute your command again in order to try to retrieve the missing links and publish your structure successfully")
    }
}

let mainInterface = async (mainAssetName, mainAssetType, directoryPath, target) => {
    let result = { "value": "" }
    try {
        await main(mainAssetName, mainAssetType, directoryPath, target)
        let current = queueGlobal.pop()
        await publish(current, target, result)
        fs.unlink('rawText.txt', (err) => {
            if (err) throw err;
        });
        fs.unlink('tmpJSON.json', (err) => {
            if (err) throw err;
        });
        console.log("output " + result["value"])
        return result["value"]
    } catch (err) {
        console.log(err)
    }
}

let main = async (mainAssetName, mainAssetType, directoryPath, target) => {
    try {
        let configFile = fs.readFileSync(configpath)
        config = JSON.parse(configFile)
        if (config["my-gateway"]) gateway = config["my-gateway"]
        else throw (err)
        if (config["my-web3.storage-api-token"]) {
            web3Token = config["my-web3.storage-api-token"]
            web3Client = new Web3Storage({ token: web3Token })
        }
        else if (!config["my-web3.storage-api-token"] && target == "web3storage") {
            console.log("setting a web3.storage token is required as the chosen mode for publishing is `web3storage` and not `local`")
            throw (err)
        }
    } catch (err) {
        console.log("unable to read configuration file, or incorrect format of expected configuration file")
        process.exit(1)
    }

    if (!(process.argv[2] && process.argv[3] && process.argv[4])) {
        console.log("Missing arguments for process")
        process.exit(1)
    }

    await processAsset(mainAssetName, mainAssetType, directoryPath)
    console.log("not waiting")
}

let publishSigned = async (mainAssetName, mainAssetType, directoryPath, target) => {

    // do not allow signing a specification for now (because it does not mean an assertion)
    if (mainAssetType == "abella-specification") {
        console.log("do you know what you are doing?")
        console.log("command failed :)")
        process.exit();
    }


    let result = await mainInterface(mainAssetName, mainAssetType, directoryPath, target)
    let assetcid = result

    let configFile = fs.readFileSync(configpath)
    config = JSON.parse(configFile)
    let publicKey = config["public-key"]
    let privateKey = config["private-key"]

    // sign the assetcid
    const sign = crypto.createSign('SHA256')
    sign.write(assetcid)
    sign.end()
    const signature = sign.sign(privateKey, 'hex')

    let assertion = {
        "format": "assertion",
        "principal": publicKey,
        "asset": { "/": assetcid },
        "signature": signature
    }

    console.log(assertion)

    // now we should publish the signature object, and return its cid:
    // here the signature object can be published directly (still local or web3.storage)

    ////////////////// refactor later
    fs.writeFileSync("tmpJSON.json", JSON.stringify(assertion))

    let addcmd = "ipfs dag put tmpJSON.json --pin"
    let output = execSync(addcmd, { encoding: 'utf-8' })

    if (target.toString() == "web3storage") {
        let result = {}
        await publishFinalDag(output.substring(0, output.length - 1), result).catch((err) => {
            console.error(err)
            process.exit(1)
        })
        console.log("the cid of the assertion is " + result["value"])
    }
    else if (target.toString() == "local") {
        console.log("The cid of the assertion is " + output.substring(0, output.length - 1))
    }

    fs.unlink('tmpJSON.json', (err) => {
        if (err) throw err;
    });
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

module.exports = { mainInterface, setweb3token, setgateway, listconfig, keygen, publishSigned }
