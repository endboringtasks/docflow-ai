#!/bin/bash
# ===========================================
# Production Database Backup Script
# ===========================================
# Usage: ./backup.sh [full|incremental]
# Cron: 0 */6 * * * /path/to/environments/prod/backup.sh full >> /var/log/backup.log 2>&1

set -euo pipefail

# Configuration
BACKUP_TYPE="${1:-full}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
CONTAINER_NAME="prod-supabase-db"
DB_NAME="${POSTGRES_DB:-postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Perform backup
perform_backup() {
    local backup_file="${BACKUP_DIR}/${DB_NAME}_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
    
    log_info "Starting ${BACKUP_TYPE} backup..."
    
    if [[ "${BACKUP_TYPE}" == "full" ]]; then
        # Full backup with all data
        podman exec "${CONTAINER_NAME}" pg_dump \
            -U postgres \
            -d "${DB_NAME}" \
            --format=custom \
            --compress=9 \
            --verbose \
            2>&1 | gzip > "${backup_file}"
    else
        # Incremental backup (schema only + recent data)
        podman exec "${CONTAINER_NAME}" pg_dump \
            -U postgres \
            -d "${DB_NAME}" \
            --schema-only \
            --format=custom \
            2>&1 | gzip > "${backup_file}"
    fi
    
    # Verify backup
    if [[ -f "${backup_file}" ]] && [[ -s "${backup_file}" ]]; then
        local size=$(du -h "${backup_file}" | cut -f1)
        log_info "Backup completed: ${backup_file} (${size})"
        
        # Create latest symlink
        ln -sf "${backup_file}" "${BACKUP_DIR}/${DB_NAME}_latest.sql.gz"
        
        return 0
    else
        log_error "Backup failed or file is empty"
        return 1
    fi
}

# Upload to S3 (if configured)
upload_to_s3() {
    if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
        local backup_file="${BACKUP_DIR}/${DB_NAME}_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
        
        log_info "Uploading backup to S3..."
        
        if command -v aws &> /dev/null; then
            aws s3 cp "${backup_file}" \
                "s3://${BACKUP_S3_BUCKET}/backups/${DB_NAME}/" \
                --region "${BACKUP_S3_REGION:-us-east-1}"
            
            log_info "Upload completed to s3://${BACKUP_S3_BUCKET}/backups/${DB_NAME}/"
        else
            log_warn "AWS CLI not installed, skipping S3 upload"
        fi
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    # Local cleanup
    find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
    
    # S3 cleanup (if configured)
    if [[ -n "${BACKUP_S3_BUCKET:-}" ]] && command -v aws &> /dev/null; then
        aws s3 ls "s3://${BACKUP_S3_BUCKET}/backups/${DB_NAME}/" \
            --region "${BACKUP_S3_REGION:-us-east-1}" | \
        while read -r line; do
            file_date=$(echo "$line" | awk '{print $1}')
            file_name=$(echo "$line" | awk '{print $4}')
            
            if [[ -n "${file_date}" ]] && [[ -n "${file_name}" ]]; then
                file_age=$(( ($(date +%s) - $(date -d "${file_date}" +%s)) / 86400 ))
                
                if [[ ${file_age} -gt ${RETENTION_DAYS} ]]; then
                    aws s3 rm "s3://${BACKUP_S3_BUCKET}/backups/${DB_NAME}/${file_name}" \
                        --region "${BACKUP_S3_REGION:-us-east-1}"
                    log_info "Deleted old backup: ${file_name}"
                fi
            fi
        done
    fi
}

# Send notification (if webhook configured)
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -s -X POST "${SLACK_WEBHOOK_URL}" \
            -H 'Content-type: application/json' \
            -d "{\"text\": \"[${status}] Database Backup: ${message}\"}" \
            > /dev/null 2>&1 || true
    fi
}

# Main execution
main() {
    log_info "=== Database Backup Started ==="
    log_info "Type: ${BACKUP_TYPE}"
    log_info "Database: ${DB_NAME}"
    
    # Check if container is running
    if ! podman ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        log_error "Container ${CONTAINER_NAME} is not running"
        send_notification "ERROR" "Container ${CONTAINER_NAME} is not running"
        exit 1
    fi
    
    # Perform backup
    if perform_backup; then
        upload_to_s3
        cleanup_old_backups
        
        log_info "=== Backup Completed Successfully ==="
        send_notification "SUCCESS" "Backup completed successfully"
    else
        log_error "=== Backup Failed ==="
        send_notification "ERROR" "Backup failed"
        exit 1
    fi
}

# Run main function
main
