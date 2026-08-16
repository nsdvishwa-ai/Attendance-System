import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "./config";
import Login from "./Login";
import RegisterStudent from "./RegisterStudent";
import AttendanceReport from "./AttendanceReport";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("Idle");
  const [autoScan, setAutoScan] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [activeTab, setActiveTab] = useState("scanner"); // Default to public scanner

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const autoScanInterval = useRef(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  // Handle auto scanning timer
  useEffect(() => {
    if (autoScan && isCameraOn) {
      autoScanInterval.current = setInterval(() => {
        captureAndMark();
      }, 3000);
    } else {
      clearInterval(autoScanInterval.current);
    }
    return () => clearInterval(autoScanInterval.current);
  }, [autoScan, isCameraOn]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/logs`);
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error("Failed to load logs", err);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/export-csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    } catch (err) {
      alert("Failed to export CSV report");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setActiveTab("scanner");
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsCameraOn(true);
      setStatus("Camera started");
    } catch (err) {
      setStatus("Camera access denied or unmounted.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setAutoScan(false);
    setStatus("Camera stopped");
  };

  const captureAndMark = async () => {
    if (!videoRef.current || !canvasRef.current || !isCameraOn) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (video.readyState !== 4) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      try {
        const response = await fetch(`${API_BASE_URL}/mark-attendance`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();

        if (data.status === "No face detected") {
          setStatus("Searching for face...");
        } else {
          setStatus(data.status);
        }

        if (data.marked_students && data.marked_students.length > 0) {
          fetchLogs();
        }
      } catch (err) {
        setStatus("Network / Server error.");
      }
    }, "image/jpeg");
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #eee", paddingBottom: "1rem" }}>
        <h2>Attendance System</h2>
        <div>
          <button 
            onClick={() => setActiveTab("scanner")} 
            style={{ marginRight: "10px", fontWeight: activeTab === "scanner" ? "bold" : "normal", padding: "6px 12px", cursor: "pointer" }}
          >
            Mark Attendance
          </button>
          <button 
            onClick={() => setActiveTab("logs")} 
            style={{ marginRight: "10px", fontWeight: activeTab === "logs" ? "bold" : "normal", padding: "6px 12px", cursor: "pointer" }}
          >
            Dashboard Logs
          </button>
          <button 
            onClick={() => setActiveTab("reports")} 
            style={{ marginRight: "10px", fontWeight: activeTab === "reports" ? "bold" : "normal", padding: "6px 12px", cursor: "pointer" }}
          >
            Reports
          </button>
          <button 
            onClick={() => setActiveTab("register")} 
            style={{ marginRight: "20px", fontWeight: activeTab === "register" ? "bold" : "normal", padding: "6px 12px", cursor: "pointer" }}
          >
            Register Student {token ? "(Admin)" : "(🔒)"}
          </button>

          {token ? (
            <button onClick={handleLogout} style={{ background: "#ff4d4d", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
              Logout
            </button>
          ) : (
            <button onClick={() => setActiveTab("register")} style={{ background: "#007bff", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
              Admin Login
            </button>
          )}
        </div>
      </header>

      {/* Main Content Sections */}
      <div style={{ marginTop: "1.5rem" }}>
        {activeTab === "scanner" && (
          <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
            <h3>Face Scanner Kiosk</h3>
            <p>Position your face in front of the camera to mark your attendance.</p>
            
            <div style={{ margin: "1rem 0" }}>
              {!isCameraOn ? (
                <button onClick={startCamera} style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}>Start Camera</button>
              ) : (
                <button onClick={stopCamera} style={{ background: "#dc3545", color: "#fff", border: "none", padding: "10px 20px", fontSize: "16px", borderRadius: "4px", cursor: "pointer" }}>
                  Stop Camera
                </button>
              )}
            </div>

            <div style={{ margin: "1rem 0" }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: "500px", height: "350px", background: "#000", borderRadius: "8px" }} />
            </div>

            <div style={{ margin: "1rem 0" }}>
              <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", fontSize: "16px" }}>
                <input
                  type="checkbox"
                  checked={autoScan}
                  disabled={!isCameraOn}
                  onChange={(e) => setAutoScan(e.target.checked)}
                  style={{ transform: "scale(1.2)", marginRight: "8px" }}
                />
                Auto-scan every 3 seconds
              </label>
            </div>

            <canvas ref={canvasRef} style={{ display: "none" }} />
            <p style={{ fontSize: "18px", marginTop: "1rem" }}><strong>Status:</strong> {status}</p>
          </div>
        )}

        {activeTab === "logs" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3>Attendance Logs</h3>
              <button onClick={handleExportCSV} style={{ background: "#28a745", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer" }}>
                Export CSV
              </button>
            </div>
            <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: "center" }}>No logs recorded yet.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.student_id}</td>
                      <td>{log.name}</td>
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "reports" && (
          <AttendanceReport token={token} />
        )}

        {activeTab === "register" && (
          <div>
            {!token ? (
              <div style={{ maxWidth: "400px", margin: "2rem auto", textAlign: "center" }}>
                <h3>Admin Authentication Required</h3>
                <p>Please log in with admin credentials to register new students.</p>
                <Login onLoginSuccess={(newToken) => { setToken(newToken); }} />
              </div>
            ) : (
              <RegisterStudent token={token} onStudentRegistered={fetchLogs} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}