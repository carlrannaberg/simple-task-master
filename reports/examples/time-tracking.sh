#!/bin/bash
# Time Tracking Integration for Simple Task Master
#
# This shell script demonstrates how to integrate time tracking functionality
# with STM using unknown fields. It provides simple commands to log time,
# generate reports, and track productivity.

# Configuration
STM_WORKSPACE="${STM_WORKSPACE:-.}"
TIME_FIELD_PREFIX="time"
USER_EMAIL="${USER_EMAIL:-$(git config user.email 2>/dev/null || echo 'unknown@user')}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Helper function to get current timestamp
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Helper function to get current date
get_date() {
    date +"%Y-%m-%d"
}

# Function to log time for a task
log_time() {
    local task_id=$1
    local hours=$2
    local description=$3
    
    if [[ -z "$task_id" || -z "$hours" ]]; then
        print_color "$RED" "Usage: log_time <task_id> <hours> [description]"
        return 1
    fi
    
    # Validate hours is a number
    if ! [[ "$hours" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        print_color "$RED" "Error: Hours must be a number"
        return 1
    fi
    
    # Get current time entries
    local current_entries=$(stm show "$task_id" --json 2>/dev/null | jq -r ".${TIME_FIELD_PREFIX}_entries // \"[]\"")
    
    if [[ $? -ne 0 ]]; then
        print_color "$RED" "Error: Task $task_id not found"
        return 1
    fi
    
    # Create new entry
    local new_entry=$(jq -n \
        --arg date "$(get_date)" \
        --arg hours "$hours" \
        --arg desc "${description:-No description}" \
        --arg user "$USER_EMAIL" \
        --arg timestamp "$(get_timestamp)" \
        '{
            date: $date,
            hours: ($hours | tonumber),
            description: $desc,
            user: $user,
            logged_at: $timestamp
        }')
    
    # Parse current entries safely
    local parsed_entries="[]"
    if [[ "$current_entries" != "[]" ]]; then
        # Try to parse as JSON array
        if echo "$current_entries" | jq -e . >/dev/null 2>&1; then
            parsed_entries="$current_entries"
        else
            # If it's a string, try to parse the string as JSON
            parsed_entries=$(echo "$current_entries" | jq -r . 2>/dev/null || echo "[]")
        fi
    fi
    
    # Add new entry to array
    local updated_entries=$(echo "$parsed_entries" | jq ". + [$new_entry]")
    
    # Calculate totals
    local total_hours=$(echo "$updated_entries" | jq '[.[].hours] | add')
    local entry_count=$(echo "$updated_entries" | jq 'length')
    local today_hours=$(echo "$updated_entries" | jq --arg today "$(get_date)" '[.[] | select(.date == $today) | .hours] | add // 0')
    
    # Update task with time tracking data
    stm update "$task_id" \
        "${TIME_FIELD_PREFIX}_entries=$updated_entries" \
        "${TIME_FIELD_PREFIX}_total_hours=$total_hours" \
        "${TIME_FIELD_PREFIX}_entry_count=$entry_count" \
        "${TIME_FIELD_PREFIX}_last_entry=$(get_timestamp)" \
        "${TIME_FIELD_PREFIX}_today_hours=$today_hours"
    
    if [[ $? -eq 0 ]]; then
        print_color "$GREEN" "✓ Logged ${hours} hours for task #${task_id}"
        print_color "$BLUE" "  Total hours: ${total_hours}"
        print_color "$BLUE" "  Today's hours: ${today_hours}"
        if [[ -n "$description" ]]; then
            print_color "$BLUE" "  Description: ${description}"
        fi
    else
        print_color "$RED" "Error: Failed to update task"
        return 1
    fi
}

# Function to show time report for a task
show_time_report() {
    local task_id=$1
    
    if [[ -z "$task_id" ]]; then
        print_color "$RED" "Usage: show_time_report <task_id>"
        return 1
    fi
    
    local task_json=$(stm show "$task_id" --json 2>/dev/null)
    
    if [[ $? -ne 0 ]]; then
        print_color "$RED" "Error: Task $task_id not found"
        return 1
    fi
    
    local title=$(echo "$task_json" | jq -r '.title')
    local total_hours=$(echo "$task_json" | jq -r ".${TIME_FIELD_PREFIX}_total_hours // 0")
    local entries=$(echo "$task_json" | jq -r ".${TIME_FIELD_PREFIX}_entries // \"[]\"")
    
    print_color "$YELLOW" "\n=== Time Report for Task #${task_id} ==="
    print_color "$BLUE" "Title: ${title}"
    print_color "$GREEN" "Total Hours: ${total_hours}"
    
    # Parse and display entries
    if [[ "$entries" != "[]" ]]; then
        # Handle both JSON array and JSON string containing array
        local parsed_entries
        if echo "$entries" | jq -e . >/dev/null 2>&1; then
            parsed_entries="$entries"
        else
            parsed_entries=$(echo "$entries" | jq -r . 2>/dev/null || echo "[]")
        fi
        
        print_color "$YELLOW" "\nTime Entries:"
        echo "$parsed_entries" | jq -r '.[] | "  \(.date) - \(.hours)h - \(.description) (\(.user))"'
        
        # Show daily breakdown
        print_color "$YELLOW" "\nDaily Breakdown:"
        echo "$parsed_entries" | jq -r 'group_by(.date) | .[] | {date: .[0].date, hours: ([.[].hours] | add)} | "  \(.date): \(.hours)h"'
    else
        print_color "$YELLOW" "\nNo time entries logged yet."
    fi
}

# Function to generate weekly time report
weekly_report() {
    local week_start=$(date -d "last monday" +"%Y-%m-%d" 2>/dev/null || date +"%Y-%m-%d")
    local week_end=$(date -d "next sunday" +"%Y-%m-%d" 2>/dev/null || date +"%Y-%m-%d")
    
    print_color "$YELLOW" "\n=== Weekly Time Report ==="
    print_color "$BLUE" "Period: ${week_start} to ${week_end}"
    
    # Get all tasks with time entries
    local tasks=$(stm list --json | jq -r ".[] | select(.${TIME_FIELD_PREFIX}_entries != null)")
    
    if [[ -z "$tasks" ]]; then
        print_color "$YELLOW" "\nNo time entries found for this week."
        return
    fi
    
    local total_week_hours=0
    local task_count=0
    
    print_color "$YELLOW" "\nTasks with time logged:"
    
    echo "$tasks" | jq -c '.' | while read -r task; do
        local task_id=$(echo "$task" | jq -r '.id')
        local task_title=$(echo "$task" | jq -r '.title')
        local entries=$(echo "$task" | jq -r ".${TIME_FIELD_PREFIX}_entries")
        
        # Parse entries
        local parsed_entries
        if echo "$entries" | jq -e . >/dev/null 2>&1; then
            parsed_entries="$entries"
        else
            parsed_entries=$(echo "$entries" | jq -r . 2>/dev/null || echo "[]")
        fi
        
        # Calculate week hours
        local week_hours=$(echo "$parsed_entries" | jq --arg start "$week_start" --arg end "$week_end" \
            '[.[] | select(.date >= $start and .date <= $end) | .hours] | add // 0')
        
        if (( $(echo "$week_hours > 0" | bc -l) )); then
            print_color "$GREEN" "  Task #${task_id}: ${task_title}"
            print_color "$BLUE" "    This week: ${week_hours}h"
            total_week_hours=$(echo "$total_week_hours + $week_hours" | bc)
            ((task_count++))
        fi
    done
    
    print_color "$YELLOW" "\nWeekly Summary:"
    print_color "$GREEN" "  Total tasks worked on: ${task_count}"
    print_color "$GREEN" "  Total hours logged: ${total_week_hours}h"
}

# Function to start/stop timer
timer_start() {
    local task_id=$1
    
    if [[ -z "$task_id" ]]; then
        print_color "$RED" "Usage: timer_start <task_id>"
        return 1
    fi
    
    # Check if task exists
    if ! stm show "$task_id" --json >/dev/null 2>&1; then
        print_color "$RED" "Error: Task $task_id not found"
        return 1
    fi
    
    # Save timer info
    local timer_file="/tmp/stm_timer_${task_id}.txt"
    echo "$(date +%s)" > "$timer_file"
    
    stm update "$task_id" \
        "${TIME_FIELD_PREFIX}_timer_active=true" \
        "${TIME_FIELD_PREFIX}_timer_started=$(get_timestamp)"
    
    print_color "$GREEN" "⏱️  Timer started for task #${task_id}"
    print_color "$BLUE" "   Stop with: timer_stop ${task_id} [description]"
}

timer_stop() {
    local task_id=$1
    local description=$2
    
    if [[ -z "$task_id" ]]; then
        print_color "$RED" "Usage: timer_stop <task_id> [description]"
        return 1
    fi
    
    local timer_file="/tmp/stm_timer_${task_id}.txt"
    
    if [[ ! -f "$timer_file" ]]; then
        print_color "$RED" "Error: No timer running for task $task_id"
        return 1
    fi
    
    # Calculate elapsed time
    local start_time=$(cat "$timer_file")
    local end_time=$(date +%s)
    local elapsed_seconds=$((end_time - start_time))
    local elapsed_hours=$(echo "scale=2; $elapsed_seconds / 3600" | bc)
    
    # Remove timer file
    rm -f "$timer_file"
    
    # Update task to clear timer
    stm update "$task_id" \
        "${TIME_FIELD_PREFIX}_timer_active=false" \
        "${TIME_FIELD_PREFIX}_timer_stopped=$(get_timestamp)"
    
    # Log the time
    log_time "$task_id" "$elapsed_hours" "${description:-Timer session}"
    
    print_color "$GREEN" "⏹️  Timer stopped. Logged ${elapsed_hours} hours."
}

# Function to show active timers
show_timers() {
    print_color "$YELLOW" "\n=== Active Timers ==="
    
    local active_found=false
    
    # Check all timer files
    for timer_file in /tmp/stm_timer_*.txt; do
        if [[ -f "$timer_file" ]]; then
            active_found=true
            local task_id=$(basename "$timer_file" | sed 's/stm_timer_//;s/.txt//')
            local start_time=$(cat "$timer_file")
            local current_time=$(date +%s)
            local elapsed_seconds=$((current_time - start_time))
            local elapsed_hours=$(echo "scale=2; $elapsed_seconds / 3600" | bc)
            
            # Get task title
            local title=$(stm show "$task_id" --json 2>/dev/null | jq -r '.title // "Unknown"')
            
            print_color "$GREEN" "  Task #${task_id}: ${title}"
            print_color "$BLUE" "    Running for: ${elapsed_hours} hours"
        fi
    done
    
    if [[ "$active_found" == "false" ]]; then
        print_color "$BLUE" "  No active timers"
    fi
}

# Function to export time data to CSV
export_time_csv() {
    local output_file="${1:-time_report_$(date +%Y%m%d).csv}"
    
    print_color "$YELLOW" "Exporting time data to ${output_file}..."
    
    # CSV header
    echo "Task ID,Task Title,Date,Hours,Description,User,Logged At" > "$output_file"
    
    # Get all tasks with time entries
    stm list --json | jq -r ".[] | select(.${TIME_FIELD_PREFIX}_entries != null)" | jq -c '.' | while read -r task; do
        local task_id=$(echo "$task" | jq -r '.id')
        local task_title=$(echo "$task" | jq -r '.title' | sed 's/,/;/g') # Replace commas in title
        local entries=$(echo "$task" | jq -r ".${TIME_FIELD_PREFIX}_entries")
        
        # Parse entries
        local parsed_entries
        if echo "$entries" | jq -e . >/dev/null 2>&1; then
            parsed_entries="$entries"
        else
            parsed_entries=$(echo "$entries" | jq -r . 2>/dev/null || echo "[]")
        fi
        
        # Add each entry to CSV
        echo "$parsed_entries" | jq -r ".[] | [${task_id}, \"${task_title}\", .date, .hours, (.description | gsub(\",\"; \";\")), .user, .logged_at] | @csv" >> "$output_file"
    done
    
    print_color "$GREEN" "✓ Exported time data to ${output_file}"
}

# Main command handler
case "${1:-help}" in
    log)
        shift
        log_time "$@"
        ;;
    report)
        shift
        show_time_report "$@"
        ;;
    weekly)
        weekly_report
        ;;
    start)
        shift
        timer_start "$@"
        ;;
    stop)
        shift
        timer_stop "$@"
        ;;
    timers)
        show_timers
        ;;
    export)
        shift
        export_time_csv "$@"
        ;;
    help|*)
        print_color "$YELLOW" "STM Time Tracking Integration"
        echo ""
        print_color "$BLUE" "Usage:"
        echo "  $0 log <task_id> <hours> [description]    - Log time for a task"
        echo "  $0 report <task_id>                        - Show time report for a task"
        echo "  $0 weekly                                  - Show weekly time report"
        echo "  $0 start <task_id>                         - Start timer for a task"
        echo "  $0 stop <task_id> [description]            - Stop timer and log time"
        echo "  $0 timers                                  - Show active timers"
        echo "  $0 export [filename]                       - Export time data to CSV"
        echo ""
        print_color "$BLUE" "Examples:"
        echo "  $0 log 123 2.5 \"Implemented feature X\""
        echo "  $0 start 123"
        echo "  $0 stop 123 \"Completed code review\""
        echo "  $0 weekly"
        echo ""
        print_color "$YELLOW" "Environment Variables:"
        echo "  STM_WORKSPACE    - STM workspace directory (default: current directory)"
        echo "  USER_EMAIL       - User email for time entries (default: git config user.email)"
        ;;
esac