import fs from 'fs'
import { exec, execSync } from 'child_process';
import { Web3Storage, getFilesFromPath } from 'web3.storage';
import { CarReader } from '@ipld/car';

let config = "", gateway = "", web3Token = ""
try {
    let configFile = fs.readFileSync("config.json")
    config = JSON.parse(configFile)
    if (config["my-gateway"]) gateway = config["my-gateway"] 
    else throw(err)
    if (config["my-web3.storage-api-token"]) web3Token = config["my-web3.storage-api-token"]
    else throw(err)
} catch (err) {
    console.log("unable to read configuration file, or incorrect format of expected configuration file")
    process.exit(1)
}
 
if (!(process.argv[2] && process.argv[3])) {
    console.log("Missing arguments for process")
    process.exit(1)
}

const mainFileName = process.argv[2]
const directoryPath = process.argv[3]
let queue = []
let publishedObjs = {}

let web3Client = new Web3Storage({ token: web3Token })

let processFile = (fileName) => {
    let fileText = fs.readFileSync(directoryPath + "/" + fileName + ".thm").toString()
    let fileObject = {}
    // assuming that the initial file given to the tool is a .thm file - we could change that later to publish specification files or others.
    fileObject[fileName] = { "type" : ".thm", "imports": [], "text": {}, "name": fileName, "specification" : {} }
    let textWithoutImports = ""
    let initialLines = fileText.split("\r\n")

    initialLines.forEach(initialLine => {
        initialLine.trim()
        if (initialLine[0] == "%") {
            // escaping special characters in a comment since they might exist
            initialLine = initialLine.replace(/[\"$]/g, '\\$&');
            textWithoutImports += initialLine

        } // still have to deal with the /* ... */ comment
        else if (initialLine.substring(0, 6) == "Import") { // we are only considering imports to be in the preamble of the file
            //here we split by "." to test if there are multiple imports on the same line
            let commands = initialLine.split(".")
            commands.forEach(command => {
                command = command.trim()
                if (command.substring(0, 6) == "Import") {
                    let importedName = command.split("\"")[1]
                    if (importedName.substring(0, 7) == "ipfs://") {    // -- Import "ipfs://bafyre.../.../.." --> read the object, and store by its name as stored in the ipfs object
                        let parts = importedName.split("//")
                        let path = parts[parts.length - 1]
                        //let output = execSync("ipfs dag get " + path, { encoding: 'utf-8' })
                        //execSync("wget 'http://dweb.link/api/v0/dag/get/" + path + "'")   // doesn't work since the object might contain nonexistent (locally) nodes, that's why we get merkle dag not found error when trying to export the whole dag -> dag get only gets one node, so here also, we have to export the whole dag in a car file then import it to the local storage
                        let cmd = "wget '" + gateway + "/api/v0/dag/export?arg=" + path + "' -O tmpdag.car --quiet"
                        execSync(cmd, { encoding: 'utf-8' })
                        cmd = "ipfs dag import tmpdag.car"
                        execSync(cmd)
                        execSync("rm tmpdag.car")
                        execSync("wget '" + gateway + "/api/v0/dag/get/" + path + "' --quiet")
                        let output = JSON.parse(fs.readFileSync(path))
                        execSync("rm " + path)
                        fileObject[fileName]["imports"].push(output["name"])
                        publishedObjs[output["name"]] = { "/": path }
                    }
                    else fileObject[fileName]["imports"].push(importedName)
                }
                else {
                    // if another command starts on the same line of imports 
                    textWithoutImports += command
                    if (command == commands[commands.length - 1]) { // not "." at the end of the line
                    }
                    else {
                        if (initialLine != "" && initialLine != "\r\n") textWithoutImports += "."
                        // (if there is a dot, the commands[commands.length-1] is "")
                    }
                }
            })
        }
        else if (initialLine.substring(0, 13) == "Specification") { // unlike "Import" where a file (and a line in a file) can contain multiple imports, there would be only *one* specification for a .thm file [?]
            // suppose now that that the specification is alone on a line (no Import or anything after it on the line)
            let specName = initialLine.split("\"")[1]
            // object type -spec, spec name, link to mod text, link to sig text, link to another object with type -spec
            let specObject = { "type" : "spec", "name" : specName, "mod" : {}, "sig" : {}, "accum" : {} }
            if (specName.substring(0, 7) == "ipfs://") {

            }
            else {
                // read sig file - seperate "sig .." line, "accum_sig .." line, and other text, upload the text and add its link to the "sig" attribute
                // read mod file - seperate "module .." line, "accumulate .." line, and other text, upload the text and add its link to the "mod" attribute
                // now considering that the first part is on a line, and the second part is on another line ... fix later
                let initialsigText = fs.readFileSync(directoryPath + "/" + specName + ".sig").toString()
                let sigLines = initialsigText.split("\r\n")
                let sigRawText = ""
                sigLines.forEach(line => {
                    line.trim()
                    if (line.substring(0, 3) == "sig") {
                        // do nothing (don't add it to the raw text)
                    }      
                    else if (line.substring(0, 9) == "accum_sig") {
                        let accumulatedPath = line.split(" ")[1]
                        if (accumulatedPath.substring(0, 7) == "ipfs://") {

                        } 
                        else {

                        }
                    }           
                });
            }
        }
        else { // no "import" -> write line as it is
            textWithoutImports += initialLine // didn't escape characters here since they don't belong to abella's syntax? (we assumed initially that the file is compiled correctly in abella before using this tool)
        }

        //if (initialLine != "\r\n" && initialLine != "") 
        textWithoutImports += "\r\n"
    })

    let cmd = "echo \"" + textWithoutImports + "\" > textWithoutImports.txt"
    execSync(cmd)
    const output = execSync('ipfs add textWithoutImports.txt --quieter --cid-version 1', { encoding: 'utf-8' });  // the default is 'buffer'
    fileObject[fileName]["text"]["/"] = output.substring(0, output.length - 1) // without the final "\n"

    queue.push(fileObject)

    fileObject[fileName]["imports"].forEach(importedName => {
        if (!publishedObjs[importedName]) {
            processFile(importedName)
        }
    });
}

let publish = (current) => {
    for (const [key, value] of Object.entries(current)) {
        if (current[key]["imports"].length == 0) {
            current[key]["imports"] = {}
        }
        else {
            let imports = current[key]["imports"]
            current[key]["imports"] = {}
            imports.forEach(importedName => {
                current[key]["imports"][importedName] = publishedObjs[importedName]
            });
        }
        let cmd = "echo '" + JSON.stringify(current[key]) + "' > tmpJSON.json"
        execSync(cmd)
        let addcmd = "ipfs dag put tmpJSON.json --pin"
        let output = execSync(addcmd, { encoding: 'utf-8' })
        publishedObjs[key] = { "/": output.substring(0, output.length - 1) }
        if (queue.length > 0) publish(queue.pop())
        // finished
        else if (queue.length == 0) {
            publishFinalDag(output.substring(0, output.length - 1)).catch((err) => {
                console.error(err)
                process.exit(1)
            })
        }
    }
}

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
    execSync("rm tmpcar.car")
    //console.log(await web3Client.status(cid1))
}

processFile(mainFileName)
let current = queue.pop()
publish(current)

execSync("rm textWithoutImports.txt")
execSync("rm tmpJSON.json")
