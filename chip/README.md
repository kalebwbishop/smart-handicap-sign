# Send Files to pi via ssh
`rsync -av --exclude 'venv' ./ kaleb@192.168.4.255:~/Documents/chip`

# Run file on pi
`./venv/bin/python main.py`