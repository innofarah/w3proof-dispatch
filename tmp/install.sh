# to install the latest stable node version through nvm, first install nvm:
sudo apt-get install curl

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
source ~/.bashrc
#source ~/.zshrc
source ~/.nvm/nvm.sh
# install node latest stable version:
nvm install 16.14.0
nvm use 16.14.0
# install ipfs (according to the ipfs website instructionS):
cd ..
sudo apt-get install wget
wget https://dist.ipfs.io/go-ipfs/v0.11.0/go-ipfs_v0.11.0_linux-amd64.tar.gz
tar -xvzf go-ipfs_v0.11.0_linux-amd64.tar.gz
cd go-ipfs
sudo bash install.sh
ipfs init
# to install w3proof-dispatch
sudo apt-get install npm
#cleaning
sudo npm uninstall w3proof-dispatch -g
nvm use system
npm uninstall -g a_module
nvm use 16.14.0
source ~/.bashrc
source ~/.nvm/nvm.sh
## installing 
cd ..
cd w3proof-dispatch
npm install -g
npm ci

echo "
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------
**Installed successfully -- restart or open a new terminal to see changes - or execute 'source ~/.bashrc'**
**type 'w3proof-dispatch' to see the list of possible commands'**
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------"
