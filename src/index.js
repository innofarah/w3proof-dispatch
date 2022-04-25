#! /usr/bin/env node

// w3proof-starter
// w3proof-dispatch 

// five commands :
// w3proof-dispatch publish filename type directory local/web3storage --> if not local, the token should be set

// w3proof-dispatch set-web3token the user's token

// w3proof-dispatch set-gateway the preferred gateway

// w3proof-dispatch list-config 

// w3proof-dispatch get ipfspath directory local/gateway -- let the user choose if he wants to retreive the file through the specified gateway or through his ipfs node daemon

const { program } = require('commander')
const os = require('os')
const fs = require('fs')

const { mainInterface, setweb3token, setgateway, listconfig, keygen, publishSigned } = require('./publish.js')
//const { mainget } = require('./get.js')
const { inspect_shallow, inspect_in_depth, who_to_trust, ensureFullDAG, get_execution, get_specification } = require('./inspect.js')
const { config } = require('process')

// create the configuration file (if it doesn't exist) in the usual configuration location according to different operating systems


//let platform = os.platform()
let path = ""
let confdirpath = ""
//if (platform == 'freebsd' || platform == 'linux' || platform == 'sunos' || platform == 'darwin' || platform == 'win32') {
path = os.homedir() + "/.config/w3proof-dispatch/config.json"
confdirpath = os.homedir() + '/.config/w3proof-dispatch'
//}

// try to read ~/.config/w3proof-dispatch/config.json --> create if doesn't exist
if (fs.existsSync(path)) {
    //file exists
    //let configFile = fs.readFileSync(path)
    //config = JSON.parse(configFile)
}
//console.error(err)
// file doesn't exist -> create it
else if (!fs.existsSync(path)) {
    fs.mkdirSync(confdirpath, { recursive: true }) // it creates any directory in the specified path if it does not exist
    let configObj = { "my-gateway": "http://dweb.link", "my-web3.storage-api-token": "**insert your token here**" }
    fs.writeFileSync(path, JSON.stringify(configObj))
}

program
    .command('keygen')
    .description('generate a public-private key pair. These will be added to your configuration file. You can just check them with the \'list-config\' command. BE CAREFUL ABOUT KEEPING YOUR PRIVATE KEY PRIVATE !')
    .action(keygen)
program
    .command('publish <mainAssetName> <mainAssetType> <directoryPath> <target>')
    .description('publish a file object with all dependencies to ipfs. <mainAssetName> takes the name of the file without its extension. <mainAssetType> takes either `abella-script` or `abella-specification`. <directoryPath> takes the path of the directory containing the file starting from the directory of execution .<target> takes either `local` to store the constructed objects only locally, or `web3storage` to publish through the web3.storage api')
    .action(mainInterface)
program
    .command('publish-signed <mainAssetName> <mainAssetType> <directoryPath> <target>')
    .description('Like the normal publish, but with an additional level. First the usual asset object is constructed and published, and then the signature object is published and its cid is returned')
    .action(publishSigned)

program
    .command('set-web3token <token>')
    .description('set your own web3.storage api token to be able to publish through web3.storage api')
    .action(setweb3token)

program
    .command('set-gateway <gateway>')
    .description('set the gateway through which files are retreived. The default is set to http://dweb.link')
    .action(setgateway)

program
    .command('list-config')
    .description('list the configuration parameters - ex: gateway, web3.storage api token')
    .action(listconfig)

//program
//   .command('get <ipfsPath> <directory> <ipfsStation>')
//  .description('get the dag object referred to by the specified path, and construct the files referred to in this dag. ipfsStation could be either `local` referring to the local ipfs daemon which should be running in this case, or `gateway` which retreives the files through a remote gateway.')
//  .action(mainget)

program
    .command('inspect-shallow <ipfsPath>')
    .description('displays the details of the root object referred to by the given ipfs address.')
    .action(inspect_shallow)

program
    .command('inspect-in-depth <ipfsPath>')
    .description('displays details and trust information of the whole dag referred to by the given ipfs address')
    .action(inspect_in_depth)

program
    .command('who-to-trust <ipfsPath>')
    .description('displays the list of the principals you should trust if you want to trust what\'s referred to by the provided cid/address')
    .action(who_to_trust)

program
    .command('import-full-dag <ipfsPath>')
    .description('ensures that the full dag exists in the local ipfs cache starting from the given cid. If it does not exist locally and the ipfs daemon is not activated, it retrieves it from the gateway.')
    .action(ensureFullDAG)

program
    .command('get-execution <ipfsPath>')
    .description('constructs the file presenting the full execution starting from the given cid considering the existing assertions.')
    .action(get_execution)

program
    .command('get-specification <ipfsPath>')
    .description('constructs the final .sig and .mod abella specification files starting from an ipfs cid')
    .action(get_specification)

program.parse()
