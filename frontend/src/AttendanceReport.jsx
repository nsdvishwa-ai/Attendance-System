import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "./config";

export default function AttendanceReport({ token }) {
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState({ total_records: 0, total_registered_students: 0, overall_attendance_percentage: "0%" });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchReports = async () => {
    setLoading(true);
    setErrorMsg("");
    let url = `${API_BASE_URL}/reports/attendance?`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    if (studentId) url += `student_id=${studentId}&`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setMetrics(data.metrics || {});
      } else {
        setErrorMsg(data.detail || "Failed to fetch reports.");
      }
    } catch (err) {
      setErrorMsg("Network error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchReports();
  }, [token]);

  const handleDownloadCSV = () => {
    let url = `${API_BASE_URL}/reports/export-csv?`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    if (studentId) url += `student_id=${studentId}&`;
    window.open(url, "_blank");
  };

  return (
    <div style={{ padding: "1.5rem", border: "1px solid #444", borderRadius: "8px" }}>
      <h2>Attendance Analytics & Reports</h2>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ padding: "1rem", background: "#1e1e1e", borderRadius: "6px", flex: 1, border: "1px solid #333" }}>
          <h4>Total Records</h4>
          <p style={{ fontSize: "1.5rem", margin: "5px 0" }}>{metrics.total_records || 0}</p>
        </div>
        <div style={{ padding: "1rem", background: "#1e1e1e", borderRadius: "6px", flex: 1, border: "1px solid #333" }}>
          <h4>Registered Students</h4>
          <p style={{ fontSize: "1.5rem", margin: "5px 0" }}>{metrics.total_registered_students || 0}</p>
        </div>
        <div style={{ padding: "1rem", background: "#1e1e1e", borderRadius: "6px", flex: 1, border: "1px solid #333" }}>
          <h4>Attendance Rate</h4>
          <p style={{ fontSize: "1.5rem", margin: "5px 0", color: "#28a745" }}>{metrics.overall_attendance_percentage || "0%"}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "1rem" }}>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: "8px" }} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: "8px" }} />
        <input type="text" placeholder="Filter by Student ID" value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ padding: "8px" }} />
        <button onClick={fetchReports} style={{ padding: "8px 16px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          Filter Logs
        </button>
        <button onClick={handleDownloadCSV} style={{ padding: "8px 16px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          Export CSV
        </button>
      </div>

      {errorMsg && <p style={{ color: "#ff4d4d" }}>{errorMsg}</p>}

      {loading ? (
        <p>Loading reports...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
          <thead>
            <tr style={{ background: "#333", color: "#fff", textAlign: "left" }}>
              <th style={{ padding: "8px" }}>Student ID</th>
              <th style={{ padding: "8px" }}>Name</th>
              <th style={{ padding: "8px" }}>Date & Time (IST)</th>
              <th style={{ padding: "8px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: "10px", textAlign: "center" }}>No logs found.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid #444" }}>
                  <td style={{ padding: "8px" }}>{log.student_id}</td>
                  <td style={{ padding: "8px" }}>{log.name}</td>
                  <td style={{ padding: "8px" }}>{log.date_time}</td>
                  <td style={{ padding: "8px", color: "#28a745" }}>{log.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}