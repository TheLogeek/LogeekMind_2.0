from typing import List, Dict, Any
import random
from supabase import Client

from app.services.usage_service import log_usage # For logging usage

async def generate_schedule_service(
    supabase: Client,
    user_id: str,
    username: str,
    subjects: List[Dict[str, Any]]
) -> Dict[str, Any]:
    
    valid_subjects = [s for s in subjects if s.get('name', '').strip() != '']

    if not valid_subjects:
        return {"success": False, "message": "Please add at least one subject to generate a study schedule."}

    total_time_needed = sum(s['time_hr'] for s in valid_subjects)

    DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    study_blocks = [] # Each block represents 30 minutes

    for subject in valid_subjects:
        # Convert hours to 30-minute blocks
        block_count = int(subject['time_hr'] * 2) 
        
        # Weight by priority
        weighted_count = block_count * subject['priority']
        study_blocks.extend([subject['name']] * weighted_count)

    random.shuffle(study_blocks)

    schedule = {day: [] for day in DAYS}
    day_index = 0

    for block in study_blocks:
        day = DAYS[day_index % 7]
        schedule[day].append(block)
        day_index += 1

    schedule_data = []

    for day, subjects_list in schedule.items():
        daily_subjects = {}
        for subject_name in subjects_list:
            daily_subjects[subject_name] = daily_subjects.get(subject_name, 0) + 1

        plan_summary = []
        for subject, block_count in daily_subjects.items():
            total_minutes = block_count * 30
            hours = total_minutes // 60
            minutes = total_minutes % 60

            time_str = ""
            if hours > 0:
                time_str += f"{hours}h "
            if minutes > 0:
                time_str += f"{minutes}m"

            if not time_str:
                continue

            plan_summary.append(f"{subject} ({time_str.strip()})")

        schedule_data.append({
            'day': day,
            'study_plan': ', '.join(plan_summary) if plan_summary else "No scheduled study"
        })
    
    # Log usage
    await log_usage(
        supabase=supabase,
        user_id=user_id,
        user_name=username, # Corrected keyword
        feature_name="Study Scheduler",
        action="generated",
        metadata={"num_subjects": len(valid_subjects), "total_study_time_hr": total_time_needed}
    )

    return {"success": True, "schedule": schedule_data, "total_time_allocated_hr": round(total_time_needed, 1)}
