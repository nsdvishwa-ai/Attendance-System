import React, { useState, useRef, useEffect } from "react";
import { API_BASE_URL } from "./config";

export default function RegisterStudent({ token, onStudentRegistered }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Start webcam when unlocked
  useEffect(() => {
    if (isUnlocked) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isUnlocked]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
    } catch (err) {
      setStatus("Error starting registration webcam.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    setStatus("Verifying password...");
    try {
      const formData = new FormData();
      formData.append("password", password);

      const res = await fetch(`${API_BASE_URL}/verify-admin-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        setIsUnlocked(true);
        setPassword("");
        setStatus("Registration mode unlocked.");
      } else {
        setStatus("Incorrect admin password.");
      }
    } catch (err) {
      setStatus("Server connection error.");
    }
  };

  const handleLock = () => {
    stopCamera();
    setIsUnlocked(false);
    setStudentId("");
    setName("");
    setStatus("Registration window locked.");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!studentId || !name) {
      setStatus("Please provide both Student ID and Name.");
      return;
    }

    if (!videoRef.current) return;

    setLoading(true);
    setStatus("Capturing photo...");

    // Capture single snapshot frame from live webcam feed
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus("Failed to capture image.");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("student_id", studentId);
      formData.append("name", name);
      formData.append("file", blob, `${studentId}_photo.jpg`);

      try {
        const res = await fetch(`${API_BASE_URL}/register`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          setStatus(`Success: ${name} registered! Ready for next student.`);
          setStudentId("");
          setName("");
          if (onStudentRegistered) onStudentRegistered();
        } else {
          setStatus(`Failed: ${data.detail || "Error registering student."}`);
        }
      } catch (err) {
        setStatus("Network error during registration.");
      } finally {
        setLoading(false);
      }
    }, "image/jpeg");
  };

  // 1. Password Protection View
  if (!isUnlocked) {
    return (
      <div style={{ padding: "1.5rem", border: "1px solid #444", borderRadius: "8px", maxWidth: "400px" }}>
        <h3>Admin Authorization Required</h3>
        <p style={{ fontSize: "0.9rem", color: "#ccc" }}>
          Enter Admin Password to open the student registration camera.
        </p>
        <form onSubmit={handleUnlock}>
          <input
            type="password"
            placeholder="Enter Admin Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "8px", margin: "10px 0", boxSizing: "border-box" }}
            required
          />
          <button type="submit" style={{ width: "100%", padding: "10px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            Unlock Registration Mode
          </button>
        </form>
        {status && <p style={{ marginTop: "10px", fontWeight: "bold" }}>{status}</p>}
      </div>
    );
  }

  // 2. Unlocked Camera Registration View
  return (
    <div style={{ padding: "1.5rem", border: "1px solid #444", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3>Live Student Registration</h3>
        <button onClick={handleLock} style={{ background: "#dc3545", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
          Lock & Exit Mode
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxHeight: "250px", background: "#000", borderRadius: "6px" }} />
      </div>

      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: "10px" }}>
          <label>Student ID: </label>
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. STU101"
            required
            style={{ width: "100%", padding: "8px", marginTop: "4px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Full Name: </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Doe"
            required
            style={{ width: "100%", padding: "8px", marginTop: "4px", boxSizing: "border-box" }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
          {loading ? "Processing Face..." : "Capture & Register Student"}
        </button>
      </form>

      {status && <p style={{ marginTop: "15px", fontWeight: "bold" }}>{status}</p>}
    </div>
  );
}