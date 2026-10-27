#!/bin/bash

sudo apt install -y python3 python3-pip wget unzip
python3 -m pip install uploadserver --break-system-packages
wget https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh -O /opt/linpeas.sh && chmod +x /opt/linpeas.sh
wget https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEASany.exe -O /opt/winPEAS.exe
wget https://raw.githubusercontent.com/peass-ng/PEASS-ng/refs/heads/master/winPEAS/winPEASps1/winPEAS.ps1 -O /opt/winPEAS.ps1
wget https://raw.githubusercontent.com/PowerShellMafia/PowerSploit/refs/heads/master/Privesc/PowerUp.ps1 -O /opt/PowerUp.ps1
wget https://raw.githubusercontent.com/61106960/adPEAS/refs/heads/main/adPEAS.ps1 -O /opt/adPEAS.ps1
wget https://github.com/nicocha30/ligolo-ng/releases/download/v0.9.2/ligolo-ng_agent_0.9.2_linux_amd64.tar.gz -O /opt/ligolo-agent-linux.tar.gz && tar -xzf /opt/ligolo-agent-linux.tar.gz -C /opt
wget https://github.com/nicocha30/ligolo-ng/releases/download/v0.9.2/ligolo-ng_agent_0.9.2_windows_amd64.zip -O /opt/ligolo-agent-windows.zip && unzip -o /opt/ligolo-agent-windows.zip -d /opt
wget https://raw.githubusercontent.com/besimorhino/powercat/refs/heads/master/powercat.ps1 -O /opt/powercat.ps1
wget https://raw.githubusercontent.com/PowershellMafia/Powersploit/refs/heads/master/Exfiltration/Invoke-Mimikatz.ps1 -O /opt/Invoke-Mimikatz.ps1
wget https://github.com/ParrotSec/mimikatz/raw/refs/heads/master/x64/mimikatz.exe -O /opt/mimikatz.exe
wget https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/raw/refs/heads/master/Seatbelt.exe -O /opt/Seatbelt.exe
wget https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/raw/refs/heads/master/Certify.exe -O /opt/Certify.exe
wget https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/raw/refs/heads/master/Rubeus.exe -O /opt/Rubeus.exe
wget https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/raw/refs/heads/master/SharpUp.exe -O /opt/SharpUp.exe
wget https://raw.githubusercontent.com/juliourena/plaintext/master/Powershell/PSUpload.ps1 -O /opt/PSUpload.ps1

# --- RustHound-CE (AD collector for BloodHound) ---
# Pull the precompiled release; if that fails, compile from source.
RH_URL="https://github.com/g0h4n/RustHound-CE/releases/latest/download"
if wget -q "$RH_URL/rusthound-ce-Linux-gnu-x86_64.tar.gz" -O /opt/rusthound-ce-linux.tar.gz; then
    tar -xzf /opt/rusthound-ce-linux.tar.gz -C /opt && chmod +x /opt/rusthound-ce
else
    echo "[!] Precompiled RustHound-CE download failed - compiling from source"
    sudo apt install -y build-essential libssl-dev libclang-dev clang pkg-config
    if ! command -v cargo >/dev/null 2>&1; then
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
    fi
    cargo install --git https://github.com/g0h4n/RustHound-CE rusthound-ce
    cp "$HOME/.cargo/bin/rusthound-ce" /opt/rusthound-ce
fi
# Windows build, ready to pull down to a target
wget "$RH_URL/rusthound-ce-Windows-msvc-x86_64.zip" -O /opt/rusthound-ce-windows.zip && unzip -o /opt/rusthound-ce-windows.zip -d /opt

cd /opt
python3 -m uploadserver 8000 --theme dark
