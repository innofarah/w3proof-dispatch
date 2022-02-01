## Description
- An external tool to use with the Abella theorem prover to publish and import files to the ipfs network in a structured format.
- The [Web3.storage service](https://web3.storage/) is used to provide persistence and availability of data in the ipfs network without requiring the user to serve the data himself. You can read more about Web3.storage [here](https://web3.storage/)
- The 'publish' command publishes to ipfs an object with name, imports, and text attributes. The imports attribute contains links to other objects. The text attribute contains a link to the corresponding file's text.
- The 'get' command takes as an argument the ipfs path to an object published by this tool (or manually - the important thing is for this object to be of the correct format), and constructs the files referred to by the downloaded dag locally to be used by Abella.
## Usage
### Setup
- A configuration file could be customized. The default gateway is set to `"https://dweb.link"`. However, the user should provide his own `Web3.storage API token` for publishing. A token could be easily created with a  [Web3.storage account](https://web3.storage/).
### Two commands:
##### 'publish'
`node publish.mjs "filename" "directory"`
- The "filename" is the name without the .thm extension
- Expected to be used explicitly by an Abella user to publish a file existing in the specified directory. The file to be published is expected to be previously compiled properly in Abella, i.e. according to Abella's current model, all the local utilised files in import statements need to exist in the specified "directory".
- The "directory" argument is a path starting from the directory of execution of the command.
- An Abella file can contain the statement: `Import "ipfs://'ipfspath'`. Here the imported object will be added to the new object's imports (as published previously on ipfs).
##### 'get'
`node get.mjs "ipfspath" "directory"`
- The "ipfspath" means an ipfs path of an object with the correct format. This might be a mere cid or a path starting with a cid like `cid/imports/nats`.
- The "directory" argument means the directory path where the new (imported) files will be constructed. It is a path starting from the directory of execution of the command.
- Expected to be used by Abella at compilation. When a statement of the form `Import "ipfs://ipfspath` is detected, the "ipfspath" should be passed as an argument to the get command which should return the name of the main imported file to be used in further steps.
## Prerequisites
- npm to download the package using `npm i dag-export-tool`
- Tested with node v17.2.0
- ipfs needs to be installed, ipfs daemon *does not* necessarily need to be running as [Web3.storage API](https://web3.storage) is used for publishing, and a gateway is used for getting the data. Tested with IPFS CLI commands.