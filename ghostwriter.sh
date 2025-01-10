sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "bookworm") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

git clone https://github.com/GhostManager/Ghostwriter.git
cd Ghostwriter
sudo ./ghostwriter-cli-linux install | tee install.txt
sudo ./ghostwriter-cli-linux config set date_format "F j, Y"
sudo ./ghostwriter-cli-linux config allowhost "*"
sudo ./ghostwriter-cli-linux containers down
sudo ./ghostwriter-cli-linux containers up
