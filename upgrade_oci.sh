#!/bin/bash

INSTANCE_ID="ocid1.instance.oc1.ap-chuncheon-1.an4w4ljrfmf4g2ackyz7lll6jqnl4qsk74zw23o5wpxkqqhi4k5cb7b6jk4q"
LOG_FILE="/home/opc/oci_upgrade.log"
MARKER_2OCPU_DONE="/home/opc/.oci_upgrade_2ocpu_done"

log() {
    TS=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$TS] $1" | tee -a "$LOG_FILE"
}

if [ -f "$MARKER_2OCPU_DONE" ]; then
    log "2 OCPU complete marker found. Starting 4 OCPU phase..."
    while true; do
        log "Attempting 4 OCPU upgrade..."
        RESULT=$(oci compute instance update --instance-id "$INSTANCE_ID" --shape VM.Standard.A1.Flex --shape-config '{"ocpus":4,"memory-in-gbs":24}' --force 2>&1)
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 0 ]; then
            log "SUCCESS! Instance upgraded to 4 OCPU / 24GB RAM."
            rm -f "$MARKER_2OCPU_DONE"
            crontab -l 2>/dev/null | grep -v upgrade_oci | crontab -
            exit 0
        else
            if echo "$RESULT" | grep -q "Out of host capacity"; then
                log "Out of capacity - retrying in 50 min..."
            else
                log "Unknown error: $RESULT"
            fi
        fi
        sleep 3000
    done
fi

log "Phase 1: Starting 2 OCPU / 12GB RAM upgrade retry"
while true; do
    log "Attempting 2 OCPU upgrade..."
    RESULT=$(oci compute instance update --instance-id "$INSTANCE_ID" --shape VM.Standard.A1.Flex --shape-config '{"ocpus":2,"memory-in-gbs":12}' --force 2>&1)
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        log "2 OCPU SUCCESS! Will continue with 4 OCPU after reboot."
        touch "$MARKER_2OCPU_DONE"
        log "Registering @reboot cron job..."
        (crontab -l 2>/dev/null | grep -v upgrade_oci; echo "@reboot /bin/bash /home/opc/upgrade_oci.sh >> /home/opc/oci_upgrade.log 2>&1") | crontab -
        log "Rebooting..."
        exit 0
    else
        if echo "$RESULT" | grep -q "Out of host capacity"; then
            log "Out of capacity - retrying in 50 min..."
        else
            log "Unknown error: $RESULT"
        fi
    fi
    sleep 3000
done
