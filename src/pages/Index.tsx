import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, Users, Zap, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    // Updated background to a light, calm green/rose gradient (Mint and Peach)
    <div className="min-h-screen bg-gradient-to-br from-green-50/50 via-rose-50/50 to-white font-sans text-gray-800">
      
      {/* Background Gradients (Subtle movement for ambiance) - Emphasizing calm, love, and peace */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Soft Rose for Love/Care - reduced opacity */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-200/20 rounded-full blur-3xl opacity-50 mix-blend-multiply animate-blob"></div>
        {/* Soft Green for Calm/Renewal - updated color */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-green-200/20 rounded-full blur-3xl opacity-50 mix-blend-multiply animate-blob animation-delay-2000"></div>
        {/* Soft Yellow/Amber for Warmth/Optimism - updated color */}
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl opacity-50 mix-blend-multiply animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        {/* Navbar-like Header (Minimalist) */}
        <header className="flex justify-center md:justify-start items-center mb-16">
            <div className="items-center gap-3 hidden sm:flex">
              <img src={logo} alt="Peacutoria Logo" className="w-10 h-auto rounded-lg shadow-sm" />
              {/* Header text gradient remains rose/indigo for contrast */}
              <span className="text-xl font-bold bg-gradient-to-r from-rose-500 to-indigo-500 bg-clip-text text-transparent">
                Peacutoria
              </span>
            </div>
        </header>

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          
          <div className="flex flex-col items-center gap-6 mb-4">
            <img 
              src={logo} 
              alt="Peacutoria Logo" 
              className="w-24 h-auto rounded-xl shadow-lg transition-transform duration-500 hover:scale-105" 
            />
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-gray-900 max-w-4xl">
              Peacutoria
            </h1>
          </div>
          
          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl leading-relaxed">
            Your private community hub for tracking goals, sharing wins, and growing together
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full justify-center">
            {/* Primary CTA - Gradient updated to rose/indigo for calming effect */}
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="h-12 px-8 text-lg bg-gradient-to-r from-rose-500 to-indigo-500 hover:from-rose-600 hover:to-indigo-600 text-white shadow-xl shadow-rose-300/50 rounded-xl transition-all hover:scale-105"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            {/* Secondary CTA */}
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="h-12 px-8 text-lg border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 rounded-xl bg-white/50 backdrop-blur-sm"
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-24 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          
          {/* Feature 1: Track Tasks (Indigo/Calm) */}
          <Card className="group relative overflow-hidden border-gray-100 bg-white/70 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Target className="h-7 w-7 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Track Tasks</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Manage your daily goals with smart task tracking and progress monitoring
              </p>
            </CardContent>
          </Card>

          {/* Feature 2: Daily Logs (Rose/Care) */}
          <Card className="group relative overflow-hidden border-gray-100 bg-white/70 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-7 w-7 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Daily Logs</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Document your journey with daily logs and track your consistency
              </p>
            </CardContent>
          </Card>

          {/* Feature 3: Community (Cyan/Peace) */}
          <Card className="group relative overflow-hidden border-gray-100 bg-white/70 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-7 w-7 text-cyan-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Community</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Share your wins, get inspired, and connect with fellow achievers
              </p>
            </CardContent>
          </Card>

          {/* Feature 4: Gamification (Amber/Warmth) */}
          <Card className="group relative overflow-hidden border-gray-100 bg-white/70 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="h-7 w-7 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Gamification</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Earn points, build streaks, and level up your productivity game
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-24 space-y-6">
          <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 max-w-3xl mx-auto">
            Ready to level up your <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-indigo-500">productivity</span>?
          </h2>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Join our community and start building better habits today. It's free and takes less than a minute.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            // CTA Button gradient updated to rose/indigo
            className="h-14 px-10 text-xl mt-4 bg-gradient-to-r from-rose-500 to-indigo-500 hover:from-rose-600 hover:to-indigo-600 text-white shadow-2xl shadow-rose-300/50 rounded-full transition-all hover:scale-[1.02]"
          >
            Join Now - It's Free!
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-gray-200 mt-20">
        <div className="text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Peacutoria. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;