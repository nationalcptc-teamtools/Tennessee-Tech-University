#!/bin/bash
# ty stanford !

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <target_range>"
    exit 1
fi

target_range="$1"

# Clear the livehosts.txt file before starting
> hosts.txt

# ICMP Ping Sweep
nmap -sn $target_range -oG - | awk '/Up$/{print $2}' >> hosts.txt &

# TCP SYN Ping
nmap -sn -PS22,80,443,3389 $target_range -oG - | awk '/Up$/{print $2}' >> hosts.txt &

# TCP ACK Ping
nmap -sn -PA22,80,443,3389 $target_range -oG - | awk '/Up$/{print $2}' >> hosts.txt &

# Wait for all background processes to finish
wait

# Consolidate and Deduplicate
sort hosts.txt | uniq > temp_hosts.txt && mv temp_hosts.txt hosts.txt

# Display the results
cat hosts.txt

nmap -p22,80,443,3389 -iL hosts.txt -oA organized_hosts
