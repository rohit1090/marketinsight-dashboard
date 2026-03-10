import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

interface SignupPageProps {
  onSignupSuccess: () => void;
  onBackToLogin: () => void;
  onBackToLanding: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onSignupSuccess, onBackToLogin, onBackToLanding }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    try {
      setIsLoading(true); setError("");
      await createUserWithEmailAndPassword(auth, email, password);
      onSignupSuccess();
    } catch (err: any) {
      setError(err.message || "Signup failed");
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setIsLoading(true); setError("");
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") setError(err.message || "Google signup failed");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white shadow-xl rounded-3xl p-8 relative"
      >
        {/* Close button */}
        <button
          onClick={onBackToLanding}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all"
        >
          <X size={15} />
        </button>

        <h1 className="text-3xl font-bold text-center mb-2">Create Account</h1>
        <p className="text-center text-gray-500 mb-6">Start your MarketInsight journey</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4 flex gap-2 items-center">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
          />
          <input
            type="password"
            placeholder="Confirm Password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-60 text-sm"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><span>Create Account</span><ArrowRight size={15} /></>}
          </button>
        </form>

        <button
          onClick={handleGoogleSignup}
          disabled={isLoading}
          className="w-full py-3 border border-slate-200 hover:bg-slate-50 mt-3 rounded-xl flex justify-center items-center gap-3 text-sm font-semibold text-slate-700 transition-all active:scale-95 disabled:opacity-60"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" />
          Sign up with Google
        </button>

        <p className="text-center text-sm mt-5 text-slate-500">
          Already have an account?{" "}
          <button onClick={onBackToLogin} className="text-indigo-600 font-semibold hover:text-indigo-700">
            Login
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default SignupPage;
