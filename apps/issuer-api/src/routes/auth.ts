import { Router } from "express";
import jwt from "jsonwebtoken";
import {
  createStudent,
  findByEmail,
  verifyPassword,
} from "../services/studentStore.js";

export const authRouter = Router();

const JWT_SECRET =
  process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-prod-please";

function makeToken(studentId: string): string {
  return jwt.sign({ sub: studentId }, JWT_SECRET, { expiresIn: "7d" });
}

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  const { email, password, name, studentNumber } = req.body ?? {};

  if (!email || !password || !name) {
    return res
      .status(400)
      .json({ error: "email, password and name are required" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  try {
    const student = await createStudent(
      email,
      password,
      name,
      studentNumber ?? ""
    );
    const token = makeToken(student.id);
    return res.status(201).json({
      token,
      student: {
        id: student.id,
        email: student.email,
        name: student.name,
        studentNumber: student.studentNumber,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Email already registered") {
      return res.status(409).json({ error: msg });
    }
    console.error("[auth/register]", e);
    return res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const student = findByEmail(email);
  if (!student || !(await verifyPassword(student, password))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = makeToken(student.id);
  return res.json({
    token,
    student: {
      id: student.id,
      email: student.email,
      name: student.name,
      studentNumber: student.studentNumber,
      connectionId: student.connectionId,
    },
  });
});
