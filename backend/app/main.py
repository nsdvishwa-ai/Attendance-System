import csv
import json
from io import StringIO
import cv2
import face_recognition
import numpy as np
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
# Make sure Attendance is imported alongside Student, User, and get_db
  # Adjust import path if using database.py or similar

from .database import engine, Base, get_db
from .models import Student, AttendanceLog, User
from .auth import verify_password, get_password_hash, create_access_token, get_current_user

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Face Recognition Attendance API")

# Define Indian Standard Timezone (IST: UTC + 5:30)
IST = timezone(timedelta(hours=5, minutes=30))

# Configure CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "API is online"}

@app.post("/register-admin")
def register_admin(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(username=username, hashed_password=get_password_hash(password), role="admin")
    db.add(user)
    db.commit()
    return {"message": "Admin user created successfully"}

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}



@app.post("/mark-attendance")
async def mark_attendance(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    unknown_encodings = face_recognition.face_encodings(rgb_image)
    if not unknown_encodings:
        return {"status": "No face detected"}

    students = db.query(Student).all()
    known_encodings = [np.array(json.loads(s.face_encoding)) for s in students]
    known_ids = [s.student_id for s in students]

    today_utc_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    matched_students = []
    already_marked = []

    for unknown_encoding in unknown_encodings:
        if known_encodings:
            matches = face_recognition.compare_faces(known_encodings, unknown_encoding, tolerance=0.6)
            if True in matches:
                first_match_idx = matches.index(True)
                student_id = known_ids[first_match_idx]
                
                existing_log = db.query(AttendanceLog).filter(
                    AttendanceLog.student_id == student_id,
                    AttendanceLog.timestamp >= today_utc_start
                ).first()

                if not existing_log:
                    log = AttendanceLog(student_id=student_id)
                    db.add(log)
                    matched_students.append(student_id)
                else:
                    already_marked.append(student_id)

    db.commit()

    # Dynamic status message for frontend status label
    if matched_students:
        status_msg = f"Marked: {', '.join(matched_students)}"
    elif already_marked:
        status_msg = "Already marked for today"
    else:
        status_msg = "No match found"

    return {
        "status": status_msg,
        "marked_students": matched_students,
        "already_marked_today": already_marked
    }

@app.get("/admin/logs")
def get_attendance_logs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = db.query(AttendanceLog, Student.name).join(Student, AttendanceLog.student_id == Student.student_id).order_by(AttendanceLog.timestamp.desc()).all()
    
    result = []
    for log in logs:
        # Convert stored naive UTC timestamp to IST (+5:30)
        utc_dt = log.AttendanceLog.timestamp.replace(tzinfo=timezone.utc)
        ist_dt = utc_dt.astimezone(IST)
        
        result.append({
            "id": log.AttendanceLog.id,
            "student_id": log.AttendanceLog.student_id,
            "name": log.name,
            "timestamp": ist_dt.isoformat()
        })
        
    return result

@app.get("/admin/export-csv")
def export_attendance_csv(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    logs = db.query(AttendanceLog, Student.name).join(Student, AttendanceLog.student_id == Student.student_id).order_by(AttendanceLog.timestamp.desc()).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Log ID", "Student ID", "Student Name", "Timestamp (IST)"])

    for log in logs:
        # Convert UTC timestamp to IST (+5:30) for CSV output
        utc_dt = log.AttendanceLog.timestamp.replace(tzinfo=timezone.utc)
        ist_dt = utc_dt.astimezone(IST)
        
        writer.writerow([
            log.AttendanceLog.id,
            log.AttendanceLog.student_id,
            log.name,
            ist_dt.strftime("%Y-%m-%d %H:%M:%S")
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"}
    )

# Add this endpoint in backend/main.py
@app.post("/verify-admin-password")
def verify_admin_password(
    password: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid admin password")
    return {"status": "authenticated"}

# Update /register endpoint to protect it with current_user
@app.post("/register")
async def register_student(
    name: str = Form(...),
    student_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Check if Student ID already exists
    existing_id = db.query(Student).filter(Student.student_id == student_id).first()
    if existing_id:
        raise HTTPException(
            status_code=400,
            detail=f"Student ID '{student_id}' is already registered to {existing_id.name}."
        )

    # 2. Process image upload
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image data captured.")

    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Detect face in frame
    face_locations = face_recognition.face_locations(rgb_image, number_of_times_to_upsample=1)
    if not face_locations:
        raise HTTPException(
            status_code=400, 
            detail="No face detected. Please face the camera directly in good lighting."
        )

    encodings = face_recognition.face_encodings(rgb_image, known_face_locations=face_locations)
    if not encodings:
        raise HTTPException(status_code=400, detail="Could not read facial features. Try again.")

    new_encoding = encodings[0]

    # 3. Check if Face is already registered under another student
    all_students = db.query(Student).all()
    if all_students:
        known_encodings = [np.array(json.loads(s.face_encoding)) for s in all_students]
        matches = face_recognition.compare_faces(known_encodings, new_encoding, tolerance=0.5)
        
        if True in matches:
            matched_student = all_students[matches.index(True)]
            raise HTTPException(
                status_code=400,
                detail=f"This face is already registered under Student ID '{matched_student.student_id}' ({matched_student.name})."
            )

    # 4. Save new student entry
    encoding_json = json.dumps(new_encoding.tolist())
    student = Student(student_id=student_id, name=name, face_encoding=encoding_json)
    db.add(student)
    db.commit()

    return {"message": f"Student {name} registered successfully."}


from fastapi.responses import StreamingResponse
import io
import csv
from datetime import datetime

# 1. Endpoint: Filtered Attendance Logs & Percentage Metrics
import pytz
from datetime import datetime

from datetime import datetime
import pytz

@app.get("/reports/attendance")
def get_attendance_report(
    start_date: str = None,
    end_date: str = None,
    student_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        total_students = db.query(Student).count()
        query = db.query(AttendanceLog)

        if student_id and student_id.strip():
            query = query.filter(AttendanceLog.student_id == student_id.strip())
            
        if start_date and start_date.strip():
            start_dt = datetime.strptime(start_date.strip(), "%Y-%m-%d")
            query = query.filter(AttendanceLog.timestamp >= start_dt)

        if end_date and end_date.strip():
            end_dt = datetime.strptime(end_date.strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(AttendanceLog.timestamp <= end_dt)

        raw_attendance = query.order_by(AttendanceLog.timestamp.desc()).all()
        all_students = db.query(Student).all()
        
        student_map = {str(s.student_id): s.name for s in all_students}
        student_map.update({str(s.id): s.name for s in all_students})

        logs = []
        unique_present = set()
        ist_tz = pytz.timezone('Asia/Kolkata')

        for att in raw_attendance:
            stu_key = str(att.student_id)
            student_name = student_map.get(stu_key, "Unknown Student")
            
            ts = att.timestamp
            if ts.tzinfo is None:
                ts = pytz.utc.localize(ts)
            ist_time = ts.astimezone(ist_tz).strftime("%Y-%m-%d %H:%M:%S")

            logs.append({
                "id": att.id,
                "student_id": att.student_id,
                "name": student_name,
                "date_time": ist_time,
                "status": "Present"
            })
            unique_present.add(att.student_id)

        attendance_percentage = round((len(unique_present) / total_students * 100), 2) if total_students > 0 else 0.0

        return {
            "metrics": {
                "total_records": len(logs),
                "total_registered_students": total_students,
                "overall_attendance_percentage": f"{attendance_percentage}%"
            },
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# 2. Endpoint: Export Filtered Report to CSV File
@app.get("/reports/export-csv")
def export_attendance_csv(
    start_date: str = None,
    end_date: str = None,
    student_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report_data = get_attendance_report(start_date, end_date, student_id, db, current_user)
    logs = report_data["logs"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Log ID", "Student ID", "Student Name", "Date & Time (IST)", "Status"])

    for log in logs:
        writer.writerow([log["id"], log["student_id"], log["name"], log["date_time"], log["status"]])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"}
    )