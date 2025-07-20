#!/usr/bin/env python3
"""
Python Integration Example for Simple Task Master

This module demonstrates how to integrate external tools with STM using Python.
It includes examples of reading/writing unknown fields, syncing with external
systems, and building reusable integration classes.
"""

import json
import subprocess
import yaml
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum


class TaskStatus(Enum):
    """STM task status values"""
    PENDING = "pending"
    IN_PROGRESS = "in-progress"
    DONE = "done"


@dataclass
class ExternalTaskData:
    """Data class for external system task representation"""
    external_id: str
    external_status: str
    external_url: str
    external_data: Dict[str, Any]
    last_synced: Optional[str] = None
    sync_errors: List[str] = None

    def __post_init__(self):
        if self.sync_errors is None:
            self.sync_errors = []
        if self.last_synced is None:
            self.last_synced = datetime.now(timezone.utc).isoformat()


class STMIntegration:
    """Base class for STM integrations"""
    
    def __init__(self, workspace_path: Path = Path("."), field_prefix: str = "integration"):
        self.workspace_path = workspace_path
        self.field_prefix = field_prefix
        self.tasks_dir = workspace_path / ".stm" / "tasks"
        
    def run_stm_command(self, args: List[str]) -> str:
        """Execute STM CLI command and return output"""
        cmd = ["stm"] + args
        try:
            result = subprocess.run(
                cmd,
                cwd=str(self.workspace_path),
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"STM command failed: {e.stderr}")
    
    def get_task(self, task_id: int) -> Dict[str, Any]:
        """Get task data as dictionary"""
        output = self.run_stm_command(["show", str(task_id), "--json"])
        return json.loads(output)
    
    def list_tasks(self, status: Optional[str] = None, tags: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """List tasks with optional filters"""
        args = ["list", "--json"]
        if status:
            args.extend(["--status", status])
        if tags:
            args.extend(["--tags", ",".join(tags)])
        
        output = self.run_stm_command(args)
        return json.loads(output)
    
    def update_task_fields(self, task_id: int, fields: Dict[str, Any]) -> None:
        """Update task with prefixed fields"""
        args = ["update", str(task_id)]
        
        for key, value in fields.items():
            field_name = f"{self.field_prefix}_{key}"
            if isinstance(value, (dict, list)):
                field_value = json.dumps(value)
            elif isinstance(value, bool):
                field_value = str(value).lower()
            else:
                field_value = str(value)
            
            args.append(f"{field_name}={field_value}")
        
        self.run_stm_command(args)
    
    def get_integration_fields(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Extract integration-specific fields from task"""
        prefix = f"{self.field_prefix}_"
        fields = {}
        
        for key, value in task.items():
            if key.startswith(prefix):
                field_name = key[len(prefix):]
                # Try to parse JSON strings back to objects
                if isinstance(value, str) and value.startswith(("{", "[")):
                    try:
                        value = json.loads(value)
                    except json.JSONDecodeError:
                        pass
                fields[field_name] = value
        
        return fields
    
    def read_task_file(self, task_id: int) -> tuple[Dict[str, Any], str]:
        """Read task file directly and return frontmatter and content"""
        # Find task file
        task_files = list(self.tasks_dir.glob(f"{task_id}-*.md"))
        if not task_files:
            raise FileNotFoundError(f"Task file for ID {task_id} not found")
        
        task_file = task_files[0]
        content = task_file.read_text()
        
        # Parse frontmatter
        if content.startswith("---\n"):
            parts = content.split("---\n", 2)
            if len(parts) >= 3:
                frontmatter = yaml.safe_load(parts[1])
                body = parts[2]
                return frontmatter, body
        
        raise ValueError(f"Invalid task file format for {task_file}")
    
    def write_task_file(self, task_id: int, frontmatter: Dict[str, Any], content: str) -> None:
        """Write task file directly with updated frontmatter"""
        # Find existing task file
        task_files = list(self.tasks_dir.glob(f"{task_id}-*.md"))
        if not task_files:
            raise FileNotFoundError(f"Task file for ID {task_id} not found")
        
        task_file = task_files[0]
        
        # Combine frontmatter and content
        yaml_content = yaml.dump(frontmatter, default_flow_style=False, sort_keys=False)
        full_content = f"---\n{yaml_content}---\n{content}"
        
        task_file.write_text(full_content)


class ProjectManagementSystem(STMIntegration):
    """Example integration with a project management system"""
    
    def __init__(self, workspace_path: Path = Path("."), api_key: Optional[str] = None):
        super().__init__(workspace_path, field_prefix="pms")
        self.api_key = api_key
        
    def sync_with_external_task(self, task_id: int, external_data: ExternalTaskData) -> None:
        """Sync STM task with external project management system"""
        # Update STM task with external data
        fields = {
            "external_id": external_data.external_id,
            "external_status": external_data.external_status,
            "external_url": external_data.external_url,
            "external_data": external_data.external_data,
            "last_synced": external_data.last_synced,
            "sync_errors": external_data.sync_errors
        }
        
        self.update_task_fields(task_id, fields)
        
        # Add sync event to history
        self.add_sync_event(task_id, {
            "action": "sync",
            "external_id": external_data.external_id,
            "status": "success" if not external_data.sync_errors else "partial",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def add_sync_event(self, task_id: int, event: Dict[str, Any]) -> None:
        """Add event to sync history"""
        task = self.get_task(task_id)
        fields = self.get_integration_fields(task)
        
        # Get or create history
        history = fields.get("sync_history", [])
        if isinstance(history, str):
            try:
                history = json.loads(history)
            except:
                history = []
        
        # Add event and limit history size
        history.append(event)
        if len(history) > 100:
            history = history[-100:]  # Keep last 100 events
        
        self.update_task_fields(task_id, {"sync_history": history})
    
    def assign_to_team_member(self, task_id: int, email: str, role: str = "developer") -> None:
        """Assign task to team member"""
        fields = {
            "assignee": email,
            "assignee_role": role,
            "assigned_at": datetime.now(timezone.utc).isoformat()
        }
        
        self.update_task_fields(task_id, fields)
        
        # Add assignment event
        self.add_sync_event(task_id, {
            "action": "assigned",
            "assignee": email,
            "role": role,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def update_priority(self, task_id: int, priority: int, reason: str) -> None:
        """Update task priority (1-5, where 1 is highest)"""
        if not 1 <= priority <= 5:
            raise ValueError("Priority must be between 1 and 5")
        
        fields = {
            "priority": priority,
            "priority_reason": reason,
            "priority_updated": datetime.now(timezone.utc).isoformat()
        }
        
        self.update_task_fields(task_id, fields)
    
    def add_external_comment(self, task_id: int, author: str, comment: str) -> None:
        """Add comment from external system"""
        task = self.get_task(task_id)
        fields = self.get_integration_fields(task)
        
        # Get or create comments
        comments = fields.get("external_comments", [])
        if isinstance(comments, str):
            try:
                comments = json.loads(comments)
            except:
                comments = []
        
        # Add new comment
        comments.append({
            "author": author,
            "comment": comment,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        self.update_task_fields(task_id, {"external_comments": comments})
    
    def get_team_dashboard_data(self) -> Dict[str, Any]:
        """Generate dashboard data for team view"""
        tasks = self.list_tasks()
        
        dashboard = {
            "total_tasks": len(tasks),
            "by_status": {"pending": 0, "in-progress": 0, "done": 0},
            "by_priority": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            "by_assignee": {},
            "unassigned": 0,
            "overdue": 0,
            "updated_today": 0
        }
        
        today = datetime.now(timezone.utc).date()
        
        for task in tasks:
            # Status breakdown
            status = task.get("status", "pending")
            dashboard["by_status"][status] = dashboard["by_status"].get(status, 0) + 1
            
            # Get integration fields
            fields = self.get_integration_fields(task)
            
            # Priority breakdown
            priority = fields.get("priority")
            if priority and isinstance(priority, (int, str)):
                try:
                    priority = int(priority)
                    if 1 <= priority <= 5:
                        dashboard["by_priority"][priority] += 1
                except:
                    pass
            
            # Assignee breakdown
            assignee = fields.get("assignee")
            if assignee:
                dashboard["by_assignee"][assignee] = dashboard["by_assignee"].get(assignee, 0) + 1
            else:
                dashboard["unassigned"] += 1
            
            # Check for overdue tasks (example: tasks in progress > 14 days)
            if task.get("updated"):
                updated_date = datetime.fromisoformat(task["updated"].replace("Z", "+00:00")).date()
                if (today - updated_date).days > 14 and status == "in-progress":
                    dashboard["overdue"] += 1
                if updated_date == today:
                    dashboard["updated_today"] += 1
        
        return dashboard


class BidirectionalSync(STMIntegration):
    """Example of bidirectional synchronization with external system"""
    
    def __init__(self, workspace_path: Path = Path(".")):
        super().__init__(workspace_path, field_prefix="sync")
        
    def compute_sync_hash(self, data: Dict[str, Any]) -> str:
        """Compute hash of data for change detection"""
        import hashlib
        # Sort keys for consistent hashing
        json_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(json_str.encode()).hexdigest()[:16]
    
    def sync_task_bidirectional(self, task_id: int, external_system_data: Dict[str, Any]) -> Dict[str, str]:
        """Perform bidirectional sync between STM and external system"""
        # Get current STM task
        stm_task = self.get_task(task_id)
        sync_fields = self.get_integration_fields(stm_task)
        
        # Get last sync state
        last_stm_hash = sync_fields.get("last_stm_hash", "")
        last_external_hash = sync_fields.get("last_external_hash", "")
        
        # Compute current hashes
        stm_data = {
            "title": stm_task.get("title"),
            "status": stm_task.get("status"),
            "tags": stm_task.get("tags", [])
        }
        current_stm_hash = self.compute_sync_hash(stm_data)
        
        external_data = {
            "title": external_system_data.get("title"),
            "status": external_system_data.get("status"),
            "labels": external_system_data.get("labels", [])
        }
        current_external_hash = self.compute_sync_hash(external_data)
        
        sync_result = {
            "stm_updated": False,
            "external_updated": False,
            "conflicts": []
        }
        
        # Determine what changed
        stm_changed = current_stm_hash != last_stm_hash
        external_changed = current_external_hash != last_external_hash
        
        if stm_changed and external_changed:
            # Conflict - both sides changed
            sync_result["conflicts"] = ["Both STM and external system have changes"]
            # Could implement conflict resolution strategy here
            
        elif external_changed and not stm_changed:
            # Update STM from external
            updates = {}
            
            if external_data["title"] != stm_data["title"]:
                # Would need to update via STM command for core fields
                sync_result["conflicts"].append("Title update requires manual intervention")
            
            if external_data["status"] != stm_data["status"]:
                # Would need to update via STM command for core fields
                sync_result["conflicts"].append("Status update requires manual intervention")
            
            # Map external labels to STM tags (example)
            if set(external_data["labels"]) != set(stm_data["tags"]):
                # Would need to update via STM command for core fields
                sync_result["conflicts"].append("Tags update requires manual intervention")
            
            # Update sync metadata
            updates.update({
                "last_external_hash": current_external_hash,
                "last_external_sync": datetime.now(timezone.utc).isoformat(),
                "external_data": external_system_data
            })
            
            self.update_task_fields(task_id, updates)
            sync_result["stm_updated"] = True
            
        elif stm_changed and not external_changed:
            # Update external from STM
            # This would involve calling external system API
            sync_result["external_updated"] = True
            
            # Update sync metadata
            self.update_task_fields(task_id, {
                "last_stm_hash": current_stm_hash,
                "last_external_sync": datetime.now(timezone.utc).isoformat()
            })
        
        else:
            # No changes on either side
            pass
        
        return sync_result


def example_usage():
    """Demonstrate integration usage"""
    
    # Initialize project management integration
    pms = ProjectManagementSystem()
    
    # Example 1: Sync with external task
    print("Example 1: Syncing with external system")
    external_task = ExternalTaskData(
        external_id="EXT-12345",
        external_status="In Review",
        external_url="https://external-system.com/tasks/12345",
        external_data={
            "category": "Feature",
            "components": ["API", "Frontend"],
            "estimated_hours": 16,
            "business_value": "High"
        }
    )
    
    # Assuming task ID 1 exists
    try:
        pms.sync_with_external_task(1, external_task)
        print("✓ Task synced with external system")
    except Exception as e:
        print(f"✗ Sync failed: {e}")
    
    # Example 2: Assign task to team member
    print("\nExample 2: Assigning task to team member")
    try:
        pms.assign_to_team_member(1, "developer@company.com", "lead-developer")
        print("✓ Task assigned")
    except Exception as e:
        print(f"✗ Assignment failed: {e}")
    
    # Example 3: Update priority
    print("\nExample 3: Updating task priority")
    try:
        pms.update_priority(1, 2, "Elevated due to customer request")
        print("✓ Priority updated")
    except Exception as e:
        print(f"✗ Priority update failed: {e}")
    
    # Example 4: Add external comment
    print("\nExample 4: Adding external comment")
    try:
        pms.add_external_comment(
            1,
            "external-user@client.com",
            "Please prioritize this feature for our Q1 release"
        )
        print("✓ Comment added")
    except Exception as e:
        print(f"✗ Comment addition failed: {e}")
    
    # Example 5: Generate dashboard
    print("\nExample 5: Generating team dashboard")
    try:
        dashboard = pms.get_team_dashboard_data()
        print("✓ Dashboard data:")
        print(f"  Total tasks: {dashboard['total_tasks']}")
        print(f"  By status: {dashboard['by_status']}")
        print(f"  By priority: {dashboard['by_priority']}")
        print(f"  Unassigned: {dashboard['unassigned']}")
        print(f"  Overdue: {dashboard['overdue']}")
    except Exception as e:
        print(f"✗ Dashboard generation failed: {e}")
    
    # Example 6: Bidirectional sync
    print("\nExample 6: Bidirectional synchronization")
    sync = BidirectionalSync()
    
    external_data = {
        "id": "EXT-12345",
        "title": "Implement user authentication",
        "status": "in_review",
        "labels": ["security", "backend"],
        "assignee": "john.doe@external.com",
        "updated_at": "2025-01-19T15:00:00Z"
    }
    
    try:
        result = sync.sync_task_bidirectional(1, external_data)
        print("✓ Bidirectional sync completed")
        print(f"  STM updated: {result['stm_updated']}")
        print(f"  External updated: {result['external_updated']}")
        if result['conflicts']:
            print(f"  Conflicts: {result['conflicts']}")
    except Exception as e:
        print(f"✗ Bidirectional sync failed: {e}")


if __name__ == "__main__":
    example_usage()