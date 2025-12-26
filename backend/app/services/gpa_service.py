from typing import List, Dict, Any

GRADE_POINTS = {
    "A": 5.0, "B": 4.0, "C": 3.0, "D": 2.0, "E": 1.0, "F": 0.0
}

class CourseInput:
    def __init__(self, name: str, grade: str, units: int):
        self.name = name
        self.grade = grade
        self.units = units

async def calculate_gpa_service(courses: List[Dict[str, Any]]) -> float:
    total_units = 0
    total_grade_points = 0
    
    for course_data in courses:
        # Validate and extract data
        name = course_data.get('name', '')
        grade = course_data.get('grade', 'A')
        units = course_data.get('units', 0)

        # Ensure grade and units are valid
        if grade not in GRADE_POINTS:
            raise ValueError(f"Invalid grade provided: {grade}")
        if not isinstance(units, int) or units <= 0:
            raise ValueError(f"Invalid units provided for course {name}: {units}")

        points = GRADE_POINTS[grade]
        total_units += units
        total_grade_points += (points * units)

    if total_units > 0:
        gpa = total_grade_points / total_units
        return round(gpa, 2)
    return 0.0
