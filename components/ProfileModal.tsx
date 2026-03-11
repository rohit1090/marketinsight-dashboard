
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, CreditCard, Mail, Phone, Edit2, Check, Loader2, LogOut, Camera } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../firebase';

interface ProfileModalProps {
  onClose: () => void;
  onLogout: () => void;
}

type Tab = 'profile' | 'subscription';

const PLAN_FEATURES = [
  'Unlimited AI Strategy Scans',
  'Live Market Intel (Google Search grounding)',
  'SEO Audit — up to 50 domains/month',
  'Social Content Generator',
  'Workflow Kanban Board',
  'Competitor Benchmarking (up to 10)',
  'Priority Support',
];

const CREDIT_HISTORY = [
  { date: 'Mar 1, 2026', description: 'Monthly plan renewal', amount: '+10,000', type: 'credit' },
  { date: 'Mar 8, 2026', description: 'AI Strategy Scan × 3', amount: '-150', type: 'debit' },
  { date: 'Mar 7, 2026', description: 'SEO Audit — example.com', amount: '-50', type: 'debit' },
  { date: 'Mar 5, 2026', description: 'Market Intel Reports × 5', amount: '-250', type: 'debit' },
  { date: 'Feb 1, 2026', description: 'Monthly plan renewal', amount: '+10,000', type: 'credit' },
];

const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, onLogout }) => {
  const user = auth.currentUser;
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB'); return; }
    setIsUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateProfile(user, { photoURL: url });
      showToast('Profile photo updated!');
      // Force re-render by updating state
      setDisplayName(prev => prev);
    } catch {
      showToast('Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveName = async () => {
    if (!user) return;
    setIsSavingName(true);
    try {
      await updateProfile(user, { displayName });
      showToast('Name updated successfully');
      setIsEditingName(false);
    } catch {
      showToast('Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

  const initials = (user?.displayName || user?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
      >
        {/* Toast */}
        {toast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl z-10 shadow-lg">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-8 pt-8 pb-16 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/30 shadow-xl"
                  onError={e => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    (el.nextSibling as HTMLElement)?.style.setProperty('display', 'flex');
                  }}
                />
              ) : null}
              <div
                className="w-20 h-20 rounded-2xl bg-white/20 ring-4 ring-white/30 items-center justify-center text-white text-2xl font-black shadow-xl"
                style={{ display: user?.photoURL ? 'none' : 'flex' }}
              >
                {initials}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-md cursor-pointer hover:scale-110 transition-transform disabled:opacity-50"
              >
                {isUploadingPhoto
                  ? <Loader2 size={13} className="text-indigo-600 animate-spin" />
                  : <Camera size={13} className="text-indigo-600" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            <div>
              <p className="text-white font-black text-xl leading-tight">
                {user?.displayName || 'User'}
              </p>
              <p className="text-indigo-200 text-sm mt-1">{user?.email}</p>
              <span className="mt-2 inline-block bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                Enterprise Pro
              </span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-100 -mt-1 bg-white relative z-10 mx-6 rounded-2xl shadow-lg -translate-y-5 overflow-hidden">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'profile' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <User size={15} />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'subscription' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <CreditCard size={15} />
            Subscription
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-6 -mt-2 max-h-[380px] overflow-y-auto">
          {activeTab === 'profile' ? (
            <div className="space-y-5">

              {/* Display Name */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Display Name
                </label>
                <div className="flex items-center gap-2">
                  {isEditingName ? (
                    <>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="flex-1 bg-slate-50 border border-indigo-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={isSavingName}
                        className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        {isSavingName ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      </button>
                      <button
                        onClick={() => { setIsEditingName(false); setDisplayName(user?.displayName || ''); }}
                        className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"
                      >
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800">
                        {user?.displayName || <span className="text-slate-400 font-normal">Not set</span>}
                      </div>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"
                      >
                        <Edit2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Mail size={10} /> Email Address
                </label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <span className="text-sm text-slate-700 font-medium flex-1">{user?.email || '—'}</span>
                  {user?.emailVerified && (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase">Verified</span>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Phone size={10} /> Phone Number
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
                  {user?.phoneNumber || <span className="italic">Not linked</span>}
                </div>
              </div>

              {/* Provider */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Sign-in Method
                </label>
                <div className="flex gap-2 flex-wrap">
                  {user?.providerData.map((p) => (
                    <span key={p.providerId} className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg capitalize">
                      {p.providerId === 'google.com' ? '🔵 Google' : p.providerId === 'password' ? '🔑 Email / Password' : p.providerId}
                    </span>
                  ))}
                </div>
              </div>

              {/* UID */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  User ID
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 break-all">
                  {user?.uid}
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-6">

              {/* Plan Card */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Current Plan</p>
                    <p className="text-2xl font-black">Enterprise Pro</p>
                    <p className="text-indigo-200 text-sm mt-1">Billed monthly · $299/mo</p>
                  </div>
                  <span className="bg-green-400/20 text-green-300 text-[10px] font-black uppercase px-3 py-1.5 rounded-full border border-green-400/30">
                    Active
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                  <p className="text-indigo-200 text-xs">Renews Apr 1, 2026</p>
                  <button className="text-xs font-black text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-all">
                    Manage Plan
                  </button>
                </div>
              </div>

              {/* API Credits */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-black text-slate-800">API Credits</p>
                  <p className="text-xs font-bold text-slate-500">8,200 / 10,000</p>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: '82%' }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">1,800 credits remaining this month</p>
              </div>

              {/* Plan Features */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Plan Includes</p>
                <ul className="space-y-2">
                  {PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-4 h-4 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Credit History */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Credit History</p>
                <div className="space-y-2">
                  {CREDIT_HISTORY.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{entry.description}</p>
                        <p className="text-[10px] text-slate-400">{entry.date}</p>
                      </div>
                      <span className={`text-sm font-black ${entry.type === 'credit' ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {entry.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-xl transition-all"
          >
            <LogOut size={15} />
            Sign Out
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProfileModal;
