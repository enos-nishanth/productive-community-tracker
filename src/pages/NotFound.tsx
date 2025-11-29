import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, MoveLeft, AlertCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* --- Background Effects --- */}
      {/* Radiant Gradient Blob 1 */}
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-500/30 blur-[100px]" />
      {/* Radiant Gradient Blob 2 */}
      <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 h-96 w-96 rounded-full bg-violet-500/30 blur-[100px]" />
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

      {/* --- Main Card --- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl"
      >
        {/* Animated Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/20 shadow-inner ring-1 ring-white/20"
        >
          <AlertCircle className="h-10 w-10 text-indigo-400" />
        </motion.div>

        {/* Typography */}
        <h1 className="mb-2 text-5xl font-extrabold tracking-tight text-white drop-shadow-sm">
          404
        </h1>
        <p className="mb-6 text-lg text-slate-300">
          Page not found
        </p>
        
        {/* Helpful Context (Optional: shows the user where they tried to go) */}
        <div className="mb-8 rounded-lg border border-white/5 bg-black/20 p-3 font-mono text-sm text-slate-400">
          path: <span className="text-indigo-400">{location.pathname}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => navigate(-1)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/10 focus:ring-2 focus:ring-indigo-500/50"
          >
            <MoveLeft className="h-4 w-4" />
            Go Back
          </button>
          
          <Link
            to="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40 focus:ring-2 focus:ring-indigo-500/50"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </motion.div>
      
      {/* Footer / Copyright */}
      <div className="absolute bottom-6 text-xs text-slate-500">
        Error Code: 404_NOT_FOUND
      </div>
    </div>
  );
};

export default NotFound;