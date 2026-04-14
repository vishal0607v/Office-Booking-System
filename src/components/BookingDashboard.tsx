import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { format, addDays, isAfter, setHours, setMinutes, startOfToday, parseISO } from 'date-fns';
import { Calendar, LogOut, User as UserIcon, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { UserProfile, Booking, Holiday, Seat } from '../types';
import { isWorkingDayForBatch } from '../constants';
import SeatMap from './SeatMap';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const errObj = JSON.parse(this.state.error.message);
        if (errObj.error) message = `Firestore Error: ${errObj.error}`;
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-900 mb-2">Application Error</h1>
          <p className="text-red-700 max-w-md mb-6">{message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function BookingDashboard() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        fetchProfile(u.uid);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const path = 'bookings';
    const q = query(collection(db, path), where('date', '==', selectedDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setBookings(bks);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  }, [selectedDate, user]);

  useEffect(() => {
    if (!user) return;

    const path = 'holidays';
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const hols = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Holiday));
      setHolidays(hols);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsubscribe;
  }, [user]);

  const fetchProfile = async (uid: string) => {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => auth.signOut();

  const handleProfileSetup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const newProfile: UserProfile = {
      uid: user.uid,
      name: user.displayName || 'Anonymous',
      email: user.email || '',
      batch: parseInt(formData.get('batch') as string) as 1 | 2,
      squad: parseInt(formData.get('squad') as string),
      role: 'user'
    };
    const path = `users/${user.uid}`;
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const checkEligibility = (dateStr: string) => {
    if (!profile) return { eligible: false, reason: 'No profile' };
    
    const date = parseISO(dateStr);
    const isHoliday = holidays.some(h => h.date === dateStr);
    if (isHoliday) return { eligible: false, reason: 'Office Holiday' };

    const isMyWorkingDay = isWorkingDayForBatch(date, profile.batch);
    if (!isMyWorkingDay) return { eligible: false, reason: 'Not your batch day' };

    // 3 PM Rule for next day booking
    const now = new Date();
    const bookingDate = parseISO(dateStr);
    const tomorrow = addDays(startOfToday(), 1);
    
    if (format(bookingDate, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')) {
      const threePM = setMinutes(setHours(startOfToday(), 15), 0);
      if (isAfter(threePM, now)) {
        return { eligible: false, reason: 'Booking opens after 3:00 PM' };
      }
    }

    // Already booked?
    const alreadyBooked = bookings.some(b => b.userId === profile.uid && b.status === 'active');
    if (alreadyBooked) return { eligible: false, reason: 'Already booked for this day' };

    return { eligible: true };
  };

  const handleBook = async () => {
    if (!profile || !selectedSeat) return;

    const { eligible, reason } = checkEligibility(selectedDate);
    if (!eligible) {
      setMessage({ type: 'error', text: reason || 'Ineligible' });
      return;
    }

    try {
      const path = 'bookings';
      await addDoc(collection(db, path), {
        userId: profile.uid,
        userName: profile.name,
        seatId: selectedSeat.id,
        seatLabel: selectedSeat.label,
        date: selectedDate,
        status: 'active',
        createdAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: `Seat ${selectedSeat.label} booked successfully!` });
      setSelectedSeat(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
    }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      const path = `bookings/${bookingId}`;
      await updateDoc(doc(db, 'bookings', bookingId), { status: 'cancelled' });
      setMessage({ type: 'success', text: 'Booking cancelled.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center"
      >
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">SeatSync</h1>
        <p className="text-slate-500 mb-8">Secure your spot in the hybrid office. Log in to manage your bookings.</p>
        <button 
          onClick={handleLogin}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
      </motion.div>
    </div>
  );

  if (!profile) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200"
      >
        <h2 className="text-xl font-bold text-slate-900 mb-6">Complete Your Profile</h2>
        <form onSubmit={handleProfileSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Batch</label>
            <select name="batch" className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="1">Batch 1 (M-W Week 1)</option>
              <option value="2">Batch 2 (Th-F Week 1)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Squad Number</label>
            <input type="number" name="squad" min="1" max="5" required className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="1-5" />
          </div>
          <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
            Save & Continue
          </button>
        </form>
      </motion.div>
    </div>
  );

  const myBooking = bookings.find(b => b.userId === profile.uid && b.status === 'active');
  const eligibility = checkEligibility(selectedDate);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 pb-12">
        {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">SeatSync</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-slate-900">{profile.name}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Batch {profile.batch} • Squad {profile.squad}</span>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Controls & Info */}
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Select Date
              </h3>
              <input 
                type="date" 
                value={selectedDate}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
              />
              
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-start gap-3">
                  {eligibility.eligible ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {eligibility.eligible ? 'Eligible to book' : 'Booking Restricted'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {eligibility.eligible ? 'Select a seat from the map to reserve your spot.' : eligibility.reason}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {myBooking && (
              <motion.section 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-white"
              >
                <h3 className="text-sm font-bold opacity-80 mb-4 uppercase tracking-widest">Your Reservation</h3>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-3xl font-bold">Seat {myBooking.seatLabel}</p>
                    <p className="text-sm opacity-80">{format(parseISO(myBooking.date), 'EEEE, MMMM do')}</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-xl">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                </div>
                <button 
                  onClick={() => handleCancel(myBooking.id)}
                  className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/30 rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancel Booking
                </button>
              </motion.section>
            )}

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Booking Rules
              </h3>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1" />
                  <span>Bookings open daily at <b>3:00 PM</b> for the next day.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1" />
                  <span>Only <b>1 seat</b> per user per day.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1" />
                  <span>Fixed seats for your squad; Floaters for everyone.</span>
                </li>
              </ul>
            </section>
          </div>

          {/* Right Column: Seat Map */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Office Floor Map</h2>
                  <p className="text-sm text-slate-500">Viewing availability for {format(parseISO(selectedDate), 'MMM do, yyyy')}</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-600 uppercase">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Updates
                </div>
              </div>

              <SeatMap 
                selectedDate={selectedDate}
                bookings={bookings}
                onSeatSelect={setSelectedSeat}
                selectedSeatId={selectedSeat?.id}
              />

              <div className="mt-8 flex items-center justify-between gap-4">
                <div className="flex-1">
                  {selectedSeat ? (
                    <p className="text-sm font-medium text-slate-900">
                      Selected: <span className="text-indigo-600 font-bold">Seat {selectedSeat.label}</span> ({selectedSeat.type})
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Select a seat to see details</p>
                  )}
                </div>
                <button
                  disabled={!selectedSeat || !eligibility.eligible}
                  onClick={handleBook}
                  className={cn(
                    "px-8 py-3 rounded-xl font-bold transition-all shadow-md",
                    selectedSeat && eligibility.eligible
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg active:scale-95"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}
                >
                  Confirm Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Notifications */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={cn(
              "px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[300px]",
              message.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
            )}>
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-semibold">{message.text}</span>
              <button onClick={() => setMessage(null)} className="ml-auto text-current opacity-50 hover:opacity-100">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
