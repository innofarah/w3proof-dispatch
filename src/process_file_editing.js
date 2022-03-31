const wget = require("wget-improved")

/*let processFile = (asset, fileExtension, directoryPath) => {
    if (fileExtension == ".thm") {
        processAbellaScript(asset, directoryPath)
    }
    else if (fileExtension == ".sig" || fileExtension == ".mod") {
        processAbellaSpecification(asset, directoryPath)
    }
}*/


let processAbellaSpecification = (asset, directoryPath) => {
    let fileText = fs.readFileSync(directoryPath + "/" + asset["name"] + ".mod").toString() //read accumulations only from .mod file (since they similarly exist (the same) in the .sig file)
    let lines = fileText.split("\n")
    lines.forEach(line => {
        line.trim()
        let commands = line.split(".")
        commands.forEach(command => {
            command = command.trim()
            if (command.substring(0, 10) == "accumulate") { // in .mod file 
                // considering that the specification file only accumulates(like imports) specification files
                processCommand(command, "accumulate", asset)
            }
        })
    });

    publishRawText(asset, fileText, ".mod")
    let sigFileText = fs.readFileSync(directoryPath + "/" + asset["name"] + ".sig").toString()
    publishRawText(asset, sigFileText, ".sig")

    queueGlobal.push(asset)

    asset["accum"].forEach(accumName => {
        if (!publishedObjs[accumName]) {
            processAsset(accumName, "abella-specification", directoryPath)
        }
    });
}


let processAbellaScript = (asset, directoryPath) => {
    let fileText = fs.readFileSync(directoryPath + "/" + asset["name"] + ".thm").toString()
    let lines = fileText.split("\n")
    lines.forEach(line => {
        line.trim()
        let commands = line.split(".")
        commands.forEach(command => {
            command = command.trim()
            if (command.substring(0, 13) == "Specification") {
                processCommand(command, "specification", asset)
            }
            else if (command.substring(0, 6) == "Import") {
                processCommand(command, "import", asset)
            }
        })
    });

    publishRawText(asset, fileText, ".thm")
    queueGlobal.push(asset)

    //TEMP COMMENT !!!
    asset["imports"].forEach(importedName => {
        if (!publishedObjs[importedName]) {
            processAsset(importedName, "abella-script", directoryPath)
        }
    });
    if (asset["specification"]) {
        if (!publishedObjs[asset["specification"]]) {
            processAsset(asset["specification"], "abella-specification", directoryPath)
        }
    }
}

let processCommand = (command, commandType, asset) => {

    let delimiter = ""
    if (commandType == "accumulate") delimiter = " "
    else delimiter = "\""

    // name : specification or imported name
    let name = command.split(delimiter)[1]
    if (name.substring(0, 7) == "ipfs://") {
        let parts = name.split("//")
        let path = parts[parts.length - 1]
        addIpfsLinktoAsset(path, commandType, asset)
    }
    else {
        if (commandType == 'specification') asset["specification"] = name
        else if (commandType == "import") asset["imports"].push(name)
        else if (commandType == "accumulate") asset["accum"].push(name)
    }
}




// first get asset/assertion file -> check if format is assertion -> get asset file -> process
let addIpfsLinktoAsset = async (path, commandType, asset) => {
    await getAssetFile(path)
    //after getting the 'asset' into tmpjson.json
    let tmpobj = JSON.parse(fs.readFileSync('tmpobj.json'))
    if (commandType == "specification") {
        asset["specification"] = tmpobj["name"]
    }
    else if (commandType == "import") {
        asset["imports"].push(tmpobj["name"])
    }
    else if (commandType == "accumulate") {
        asset["accum"].push(tmpobj["name"])
    }
    publishedObjs[tmpobj["name"]] = { "/": path }
    fs.unlink('tmpobj.json', (err) => {
        if (err) throw err;
    })
}

let getAssetFile = async (path) => { // creats a tmpobj.json file which contains the asset's json object
    try { // check if the object referred to by 'path' is found locally (or globally if ipfs daemon is running)
        let cmd = "ipfs dag get " + path + " > tmpobj.json"
        execSync(cmd, { encoding: 'utf-8' })
        tmpobj = JSON.parse(fs.readFileSync('tmpobj.json'))
        if (tmpobj["format"] == "assertion") {
            try {
                cmd = "ipfs dag get " + path + "/asset > tmpobj.json"
                execSync(cmd, { encoding: 'utf-8' })
            } catch (error) {
                let download = wget.download(gateway + "/api/v0/dag/get?arg=" + path + "/asset", "tmpobj.json")
                download.on('end', function () { })
            }
        }
    } catch (error) {
        let download = wget.download(gateway + "/api/v0/dag/get?arg=" + path, "tmpobj.json")
        download.on('end', function () {
            if (tmpobj["format"] == "assertion") {
                try {
                    cmd = "ipfs dag get " + tmpobj["asset"]["/"] + " > tmpobj.json"
                    execSync(cmd, { encoding: 'utf-8' })
                } catch (error) {
                    let download = wget.download(gateway + "/api/v0/dag/get?arg=" + path + "/asset", "tmpobj.json")
                    download.on('end', function () { })
                }
            }
        })
    }
}
