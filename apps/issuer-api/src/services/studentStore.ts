import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";

export interface Student {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  studentNumber: string;
  connectionId?: string;
  createdAt: string;
  // Server-side wallet backup — enables device-independent access.
  // walletSeed: the HD seed bytes used to derive all DID keys.
  // walletBackup: serialised Pluto database (credentials + DIDComm state).
  walletSeed?: number[];
  walletBackup?: unknown;
  walletDid?: string;
}

const DATA_DIR = resolve(__dirname, "../../data");
const STORE_PATH = resolve(DATA_DIR, "students.json");

function loadStudents(): Student[] {
  if (!existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf-8")) as Student[];
  } catch {
    return [];
  }
}

function saveStudents(students: Student[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(students, null, 2), "utf-8");
}

export function findByEmail(email: string): Student | undefined {
  return loadStudents().find((s) => s.email === email.toLowerCase());
}

export function findById(id: string): Student | undefined {
  return loadStudents().find((s) => s.id === id);
}

export async function createStudent(
  email: string,
  password: string,
  name: string,
  studentNumber: string
): Promise<Student> {
  const students = loadStudents();
  if (students.find((s) => s.email === email.toLowerCase())) {
    throw new Error("Email already registered");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const student: Student = {
    id: randomUUID(),
    email: email.toLowerCase(),
    passwordHash,
    name,
    studentNumber,
    createdAt: new Date().toISOString(),
  };
  students.push(student);
  saveStudents(students);
  return student;
}

export async function verifyPassword(
  student: Student,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, student.passwordHash);
}

export function updateConnection(id: string, connectionId: string): void {
  const students = loadStudents();
  const student = students.find((s) => s.id === id);
  if (!student) throw new Error("Student not found");
  student.connectionId = connectionId;
  saveStudents(students);
}

export function clearConnection(id: string): void {
  const students = loadStudents();
  const student = students.find((s) => s.id === id);
  if (!student) throw new Error("Student not found");
  delete student.connectionId;
  saveStudents(students);
}

export function listStudents(): Omit<Student, "passwordHash" | "walletSeed" | "walletBackup">[] {
  return loadStudents().map(({ passwordHash: _pw, walletSeed: _s, walletBackup: _b, ...rest }) => rest);
}

export function getWalletData(id: string): { seed: number[] | null; backup: unknown | null } {
  const student = findById(id);
  if (!student) return { seed: null, backup: null };
  return { seed: student.walletSeed ?? null, backup: student.walletBackup ?? null };
}

export function updateWalletData(id: string, seed: number[], backup: unknown): void {
  const students = loadStudents();
  const student = students.find((s) => s.id === id);
  if (!student) throw new Error("Student not found");
  student.walletSeed = seed;
  student.walletBackup = backup;
  saveStudents(students);
}

export function updateWalletSeed(id: string, seed: number[]): void {
  const students = loadStudents();
  const student = students.find((s) => s.id === id);
  if (!student) throw new Error("Student not found");
  student.walletSeed = seed;
  saveStudents(students);
}

export function updateWalletDid(id: string, walletDid: string): void {
  const students = loadStudents();
  const student = students.find((s) => s.id === id);
  if (!student) throw new Error("Student not found");
  student.walletDid = walletDid;
  saveStudents(students);
}

// ── Pending Diplomas ──────────────────────────────────────────────────────────
// Diplomas queued by the issuer for students who haven't connected yet.
// Auto-issued by students.ts when the student saves their connectionId.

export interface PendingDiploma {
  id: string;
  studentId: string;
  studentName: string;
  studentIdField: string;
  degree: string;
  graduationDate: string;
  gpa?: number;
  issuingDid: string;
  schemaId: string;
  universityName: string;
  createdAt: string;
}

const PENDING_PATH = resolve(DATA_DIR, "pending-diplomas.json");

function loadPending(): PendingDiploma[] {
  if (!existsSync(PENDING_PATH)) return [];
  try {
    return JSON.parse(readFileSync(PENDING_PATH, "utf-8")) as PendingDiploma[];
  } catch {
    return [];
  }
}

function savePending(items: PendingDiploma[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PENDING_PATH, JSON.stringify(items, null, 2), "utf-8");
}

export function addPendingDiploma(diploma: Omit<PendingDiploma, "id" | "createdAt">): PendingDiploma {
  const items = loadPending();
  const entry: PendingDiploma = { ...diploma, id: randomUUID(), createdAt: new Date().toISOString() };
  items.push(entry);
  savePending(items);
  return entry;
}

export function getPendingDiplomas(studentId: string): PendingDiploma[] {
  return loadPending().filter((d) => d.studentId === studentId);
}

export function removePendingDiploma(id: string): void {
  savePending(loadPending().filter((d) => d.id !== id));
}
