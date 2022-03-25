const fs = require('fs')
const { exec, execSync } = require('child_process');
const { Web3Storage, getFilesFromPath } = require('web3.storage');
const { CarReader } = require('@ipld/car');
const os = require('os')
const wget = require('wget-improved');
const crypto = require('crypto')
const capcon = require('capture-console')

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
            type : 'spki',
            format : 'pem'
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

let processAsset = (assetName, assetType, directoryPath) => {
    let asset = {}
    if (assetType == "abella-script") {
        asset = { "format": "asset", "asset-type": "abella-script", "name": assetName, "specification": "", "imports": [], "text": {} }
        processFile(asset, ".thm", directoryPath)
    }
    else if (assetType == "abella-specification") {
        asset = { "format": "asset", "asset-type": "abella-specification", "name": assetName, "accum": [], "textmod": {}, "textsig": {} }
        processFile(asset, ".sig", directoryPath)
        processFile(asset, ".mod", directoryPath)
    }
}

let processFile = (asset, fileExtension, directoryPath) => {
    let fileText = fs.readFileSync(directoryPath + "/" + asset["name"] + fileExtension).toString()
    let lines = fileText.split("\n")
    let rawText = ""
    if (fileExtension == ".thm") {
        lines.forEach(line => {
            line.trim()
            if (line[0] == "%") {
                // escaping special characters in a comment since they might exist
                line = line.replace(/[\$"]/g, '\\$&\"');
                rawText += line
            } // still have to deal with the /* ... */ comment
            else {
                let commands = line.split(".")
                commands.forEach(command => {
                    command = command.trim()
                    if (command.substring(0, 13) == "Specification") {
                        let specName = command.split("\"")[1]
                        if (specName.substring(0, 7) == "ipfs://") {
                            let parts = specName.split("//")
                            let path = parts[parts.length - 1]
                            //let cmd = "wget '" + gateway + "/api/v0/dag/export?arg=" + path + "' -O tmpdag.car --quiet"
                            //execSync(cmd, { encoding: 'utf-8' })
                            //wget({ url: gateway + "/api/v0/dag/export?arg=" + path, dest: "tmpdag.car" });
                            let download = wget.download(gateway + "/api/v0/dag/export?arg=" + path, "tmpdag.car")
                            download.on('end', function () {
                                cmd = "ipfs dag import tmpdag.car"
                                execSync(cmd)
                                //execSync("rm tmpdag.car")
                                fs.unlink('tmpdag.car', (err) => {
                                    if (err) throw err;
                                });
                                //execSync("wget '" + gateway + "/api/v0/dag/get" + path + "' --quiet")
                                //wget({ url: gateway + "/api/v0/dag/export?arg=" + path });

                                let download = wget.download(gateway + "/api/v0/dag/export?arg=" + path)
                                download.on('end', function () {
                                    let output = JSON.parse(fs.readFileSync(path))
                                    //execSync("rm " + path)
                                    fs.unlink(path, (err) => {
                                        if (err) throw err;
                                    });
                                    asset["specification"] = output["name"]
                                    publishedObjs[output["name"]] = { "/": path }
                                });
                            });

                        }
                        else {
                            asset["specification"] = specName
                        }
                    }
                    else if (command.substring(0, 6) == "Import") {
                        let importedName = command.split("\"")[1]
                        if (importedName.substring(0, 7) == "ipfs://") {    // -- Import "ipfs://bafyre.../.../.." --> read the object, and store by its name as stored in the ipfs object
                            let parts = importedName.split("//")
                            let path = parts[parts.length - 1]
                            //let cmd = "wget '" + gateway + "/api/v0/dag/export?arg=" + path + "' -O tmpdag.car --quiet"
                            //execSync(cmd, { encoding: 'utf-8' })
                            //wget({ url: gateway + "/api/v0/dag/export?arg=" + path, dest: "tmpdag.car" }); either an assertion or an asset).

                            let download = wget.download(gateway + "/api/v0/dag/export?arg=" + path, "tmpdag.car")
                            download.on('end', function () {
                                cmd = "ipfs dag import tmpdag.car"
                                execSync(cmd)
                                //execSync("rm tmpdag.car")
                                fs.unlink('tmpdag.car', (err) => {
                                    if (err) throw err;
                                });
                                //execSync("wget '" + gateway + "/api/v0/dag/get/" + path + "' --quiet")
                                //wget({ url: gateway + "/api/v0/dag/export?arg=" + path });
                                let download = wget.download(gateway + "/api/v0/dag/export?arg=" + path)
                                download.on('end', function () {
                                    let output = JSON.parse(fs.readFileSync(path))
                                    //execSync("rm " + path)
                                    fs.unlink(path, (err) => {
                                        if (err) throw err;
                                    });
                                    asset["imports"].push(output["name"])
                                    publishedObjs[output["name"]] = { "/": path }
                                });
                            });
                        }
                        else asset["imports"].push(importedName)
                    }
                    else {
                        if (command != "" && command != "\r\n" && command != "\n") {
                            line = line.trim()
                            if (command == line && line[line.length - 1] == ".") {
                                rawText += command + "."
                            }
                            else if (command == line || command == "*/")
                                rawText += command
                            else
                                rawText += command + "."
                        }
                    }
                })
            }
            rawText += "\r\n"
        });
        publishRawText(asset, rawText, fileExtension)

        queueGlobal.push(asset)

  // here we are  publishing the text without any imports and linking its cid to the asset text attribute
  // and then we are pushing the asset to the global queue for it to be published
  // after that, we are calling processAsset for the imported names
  // instead, we have to first call processAsset for each imported name in order to get its cid, 
  // and after that we would add these cids to the text (replace the local names),
  // after that we put the asset in the queue.
  // so, first we need to ensure that the imported names are published and done
  // so what we initially did with that global queue maybe will not work :( 

        asset["imports"].forEach(importedName => {
            if (!publishedObjs[importedName]) {
                processAsset(importedName, "abella-script", directoryPath)
                console.log(publishedObjs[importedName])
            }
        });



        if (asset["specification"]) {
            if (!publishedObjs[asset["specification"]]) {
                processAsset(asset["specification"], "abella-specification", directoryPath)
            }
        }
    }
    else if (fileExtension == ".sig" || fileExtension == ".mod") {
        let modorsiglinefound = false
        //lines = lines.toString().split("\n")
        lines.forEach(line => {
            line.trim()
            if (line[0] == "%") {
                // escaping special characters in a comment since they might exist
                line = line.replace(/[\$"]/g, '\\$&\"');
                rawText += line
            } // still have to deal with the /* ... */ comment
            else if (!modorsiglinefound && (line.substring(0, 6) == "module" || line.substring(0, 3) == "sig")) {
                modorsiglinefound = true
                // do nothing (don't add this line to the text to make it easier at the construction step)
            }
            else {
                let commands = line.split(".")
                commands.forEach(command => {
                    command = command.trim()
                    if ((fileExtension == ".sig" && command.substring(0, 9) == "accum_sig")
                        || (fileExtension == ".mod" && command.substring(0, 10) == "accumulate")) {
                        if (fileExtension == ".sig") {
                            let specName = command.split(" ")[1]
                            if (specName.substring(0, 7) == "ipfs://") {
                                let parts = specName.split("//")
                                let path = parts[parts.length - 1]
                                //let cmd = "wget '" + gateway + "/api/v0/dag/export?arg=" + path + "' -O tmpdag.car --quiet"
                                //execSync(cmd, { encoding: 'utf-8' })
                                //wget({ url: gateway + "/api/v0/dag/export?arg=" + path, dest: "tmpdag.car" });

                                let download = wget.download(gateway + "/api/v0/dag/export?arg=" + path, "tmpdag.car")
                                download.on('end', function () {
                                    cmd = "ipfs dag import tmpdag.car"
                                    execSync(cmd)
                                    //execSync("rm tmpdag.car")
                                    fs.unlink('tmpdag.car', (err) => {
                                        if (err) throw err;
                                    });
                                    //execSync("wget '" + gateway + "/api/v0/dag/get" + path + "' --quiet")
                                    //wget({ url: gateway + "/api/v0/dag/export?arg=" + path });

                                    let download = wget.download(gateway + "/api/v0/dag/export?arg=" + path)
                                    download.on('end', function () {
                                        let output = JSON.parse(fs.readFileSync(path))
                                        //execSync("rm " + path)
                                        fs.unlink(path, (err) => {
                                            if (err) throw err;
                                        });
                                        asset["accum"].push(output["name"])
                                        publishedObjs[output["name"]] = { "/": path }
                                    });
                                });
                            }
                            else asset["accum"].push(specName)
                        }
                    }
                    else {
                        if (command != "" && command != "\r\n" && command != "\n") {
                            line = line.trim()
                            if (command == line && line[line.length - 1] == ".") {
                                rawText += command + "."
                            }
                            else if (command == line || command == "*/")
                                rawText += command
                            else
                                rawText += command + "."
                        }
                    }
                })
            }
            rawText += "\r\n"
        });
        publishRawText(asset, rawText, fileExtension)

        if (fileExtension == ".sig") { // to add it once to the queue
            queueGlobal.push(asset)
        }

        asset["accum"].forEach(accumName => {
            if (!publishedObjs[accumName] && fileExtension == ".sig") { // to create the asset only once 
                processAsset(accumName, "abella-specification", directoryPath)
            }
        });
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
let publish = (current, target) => {
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
    //let cmd = "echo '" + JSON.stringify(current) + "' > tmpJSON.json"
    //execSync(cmd)

    fs.writeFileSync("tmpJSON.json", JSON.stringify(current))

    let addcmd = "ipfs dag put tmpJSON.json --pin"
    let output = execSync(addcmd, { encoding: 'utf-8' })
    publishedObjs[current["name"]] = { "/": output.substring(0, output.length - 1) }
    if (queueGlobal.length > 0) publish(queueGlobal.pop(), target)
    // finished
    else if (queueGlobal.length == 0 && target.toString() == "web3storage") {
        publishFinalDag(output.substring(0, output.length - 1)).catch((err) => {
            console.error(err)
            process.exit(1)
        })
    }
    else if (queueGlobal.length == 0 && target.toString() == "local") {
        console.log(output.substring(0, output.length - 1))
    }
    //console.log(target)
}

// this is where the final dag structure is published publicly (through web3.storage api) 
let publishFinalDag = async (cid) => {
    let cmd = "ipfs dag export " + cid + " > tmpcar.car"
    execSync(cmd, { encoding: 'utf-8' })
    const inStream = fs.createReadStream('tmpcar.car')
    // read and parse the entire stream in one go, this will cache the contents of
    // the car in memory so is not suitable for large files.
    const reader = await CarReader.fromIterable(inStream)
    const cid1 = await web3Client.putCar(reader)
    //console.log("Uploaded CAR file to Web3.Storage! CID:", cid1)
    console.log(cid1)
    //execSync("rm tmpcar.car")
    fs.unlink('tmpcar.car', (err) => {
        if (err) throw err;
    });
    //return cid1
    //console.log(await web3Client.status(cid1))
}

let main = (mainAssetName, mainAssetType, directoryPath, target) => {
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

    //const mainAssetName = process.argv[2]
    //const mainAssetType = process.argv[3]
    //const directoryPath = process.argv[4]

    processAsset(mainAssetName, mainAssetType, directoryPath)
    let current = queueGlobal.pop()
    publish(current, target)
    //execSync("rm rawText.txt")
    //execSync("rm tmpJSON.json")
    fs.unlink('rawText.txt', (err) => {
        if (err) throw err;
    });
    fs.unlink('tmpJSON.json', (err) => {
        if (err) throw err;
    });
}

let publishSigned = (mainAssetName, mainAssetType, directoryPath, target) => {
    const stdout = capcon.captureStdout(function scope() {  // just a temporary solution -> have to fix main,publish,publishfinaldag.. functions to return cid (possibly change them)
        main(mainAssetName, mainAssetType, directoryPath, target)
    })
    // stdout is what was console logged by the execution of what's inside the scope() function, which his here: the call to the main function
    let assetcid = stdout.substring(0, stdout.length - 1) // just to remove the "\n" from the end of it

    let configFile = fs.readFileSync(configpath)
    config = JSON.parse(configFile)
    let publicKey = config["public-key"]
    let privateKey = config["private-key"]

    // sign the assetcid
    const sign = crypto.createSign('SHA256')
    sign.write(assetcid)
    sign.end()
    const signature = sign.sign(privateKey, 'hex')

    let signatureObject = {
        "type": "signed_script",    // this indicates that this is a signature format object, unlike just "script"
        "asset": {"/" : assetcid},
        "principal": publicKey,
        "signature": signature
    }

    console.log(signatureObject)

    // now we should publish the signature object, and return its cid:
    // here the signature object can be published directly (still local or web3.storage)

    ////////////////// refactor later
    fs.writeFileSync("tmpJSON.json", JSON.stringify(signatureObject))

    let addcmd = "ipfs dag put tmpJSON.json --pin"
    let output = execSync(addcmd, { encoding: 'utf-8' })

    if (target.toString() == "web3storage") {
        publishFinalDag(output.substring(0, output.length - 1)).catch((err) => {
            console.error(err)
            process.exit(1)
        })
    }
    else if (target.toString() == "local") {
        console.log(output.substring(0, output.length - 1))
    }

    fs.unlink('tmpJSON.json', (err) => {
        if (err) throw err;
    });

    console.log("The cid of the signature object is " + output.substring(0, output.length - 1))
    ///////////////////////

        // try to sign some text and then verify it
        /* const sign = crypto.createSign('SHA256')
        sign.write('some data to sign')
        sign.end()
        const signature = sign.sign(privateKey, 'hex')
    
        const verify = crypto.createVerify('SHA256')
        verify.write('some data to sign')
        verify.end()
        console.log(verify.verify(publicKey, signature, 'hex'))*/

}

module.exports = { main, setweb3token, setgateway, listconfig, keygen, publishSigned }
