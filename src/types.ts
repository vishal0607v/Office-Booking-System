export type Batch = 1 | 2;
export type SeatType = 'fixed' | 'floater';
export type BookingStatus = 'active' | 'cancelled';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  batch: Batch;
  squad: number;
  role: 'admin' | 'user';
}

export interface Seat {
  id: string;
  label: string;
  type: SeatType;
  x: number;
  y: number;
}

export interface Booking {
  id: string;
  userId: string;
  userName?: string;
  seatId: string;
  seatLabel?: string;
  date: string; // YYYY-MM-DD
  status: BookingStatus;
  createdAt: any; // Firestore Timestamp
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
}
