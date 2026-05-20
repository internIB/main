import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { ShiftEntry, ChangeRequest, AppSettings } from '../types';
import { getShiftMonthKey, isOlderThanMonths } from '../lib/utils';

// ---- Config ----

export async function getSettings(): Promise<AppSettings | null> {
  const snap = await getDoc(doc(db, 'config', 'settings'));
  return snap.exists() ? (snap.data() as AppSettings) : null;
}

export async function updateSettings(data: Partial<AppSettings>): Promise<void> {
  await setDoc(doc(db, 'config', 'settings'), data, { merge: true });
}

export async function getMembers(): Promise<string[]> {
  const snap = await getDoc(doc(db, 'config', 'members'));
  if (!snap.exists()) return [];
  return snap.data().list as string[];
}

export async function updateMembers(list: string[]): Promise<void> {
  await setDoc(doc(db, 'config', 'members'), { list });
}

// ---- Shifts ----

export async function addShift(shift: Omit<ShiftEntry, 'id'>): Promise<string> {
  const monthKey = getShiftMonthKey(new Date(shift.date + 'T00:00:00'));
  const ref = collection(db, 'shifts', monthKey, 'entries');
  const docRef = await addDoc(ref, {
    ...shift,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getShiftsForMonth(monthKey: string): Promise<ShiftEntry[]> {
  const ref = collection(db, 'shifts', monthKey, 'entries');
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShiftEntry));
}

export async function getShiftsForUser(name: string, monthKey: string): Promise<ShiftEntry[]> {
  const ref = collection(db, 'shifts', monthKey, 'entries');
  const q = query(ref, where('name', '==', name), orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShiftEntry));
}

export async function getPendingShifts(monthKey: string): Promise<ShiftEntry[]> {
  const ref = collection(db, 'shifts', monthKey, 'entries');
  const q = query(ref, where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShiftEntry));
}

export async function updateShift(monthKey: string, id: string, data: Partial<ShiftEntry>): Promise<void> {
  await updateDoc(doc(db, 'shifts', monthKey, 'entries', id), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteShift(monthKey: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'shifts', monthKey, 'entries', id));
}

// ---- Change Requests ----

export async function addChangeRequest(req: Omit<ChangeRequest, 'id'>): Promise<string> {
  const ref = collection(db, 'changeRequests');
  const docRef = await addDoc(ref, {
    ...req,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export function subscribeChangeRequests(
  statusFilter: string,
  callback: (requests: ChangeRequest[]) => void
): () => void {
  const ref = collection(db, 'changeRequests');
  // orderBy+whereの複合クエリはFirestoreインデックスが必要なため、
  // whereのみでクエリしてクライアント側でソートする
  const q = query(ref, where('status', '==', statusFilter));
  return onSnapshot(q, snap => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChangeRequest));
    data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    callback(data);
  });
}

export async function updateChangeRequest(id: string, data: Partial<ChangeRequest>): Promise<void> {
  await updateDoc(doc(db, 'changeRequests', id), data);
}

// ---- Admin: Delete old data ----

export async function deleteOldShifts(): Promise<number> {
  const now = new Date();
  let deleted = 0;

  for (let i = 4; i <= 24; i++) {
    const past = new Date(now);
    past.setMonth(past.getMonth() - i);
    const year = past.getFullYear();
    const month = past.getMonth() + 1;
    const monthKey = `${year}_${String(month).padStart(2, '0')}`;

    const ref = collection(db, 'shifts', monthKey, 'entries');
    const snap = await getDocs(ref);
    if (snap.empty) continue;

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.docs.length;
  }

  return deleted;
}
