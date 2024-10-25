#!/bin/bash

sudo apt install python3 python3-pip wget
python3 -m pip install uploadserver --break-system-packages
wget https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh -O /opt/linpeas.sh && chmod +x /opt/linpeas.sh
wget https://github.com/peass-ng/PEASS-ng/releases/download/20241001-329fed76/winPEASany.exe -O /opt/winPEAS.exe
wget https://raw.githubusercontent.com/peass-ng/PEASS-ng/refs/heads/master/winPEAS/winPEASps1/winPEAS.ps1 -O /opt/winPEAS.ps1
wget https://raw.githubusercontent.com/PowerShellMafia/PowerSploit/refs/heads/master/Privesc/PowerUp.ps1 -O /opt/PowerUp.ps1
wget https://raw.githubusercontent.com/61106960/adPEAS/refs/heads/main/adPEAS.ps1 -O /opt/adPEAS.ps1
wget https://github.com/nicocha30/ligolo-ng/releases/download/v0.7.2-alpha/ligolo-ng_agent_0.7.2-alpha_linux_amd64.tar.gz -O /opt/ligolo-agent-linux.tar.gz && tar -xvf /opt/ligolo-agent-linux.tar.gz -C /opt
wget https://github.com/nicocha30/ligolo-ng/releases/download/v0.7.2-alpha/ligolo-ng_agent_0.7.2-alpha_windows_amd64.zip -O /opt/ligolo-agent-windows.zip && unzip /opt/ligolo-agent-windows.zip -d /opt
wget https://raw.githubusercontent.com/besimorhino/powercat/refs/heads/master/powercat.ps1 -O /opt/powercat.ps1
wget https://raw.githubusercontent.com/PowershellMafia/Powersploit/refs/heads/master/Exfiltration/Invoke-Mimikatz.ps1 -O /opt/Invoke-Mimikatz.ps1
wget https://github.com/ParrotSec/mimikatz/raw/refs/heads/master/x64/mimikatz.exe -O /opt/mimikatz.exe
wget https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/raw/refs/heads/master/Seatbelt.exe -O /opt/Seatbelt.exe
wget https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/raw/refs/heads/master/Certify.exe -O /opt/Certify.exe
wget https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/raw/refs/heads/master/Rubeus.exe -O /opt/Rubeus.exe
wget https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/blob/master/SharpUp.exe -O /opt/SharpUp.exe
wget https://raw.githubusercontent.com/juliourena/plaintext/master/Powershell/PSUpload.ps1 -O /opt/PSUpload.ps1

cd /opt
python3 -m uploadserver 8000 --theme dark
