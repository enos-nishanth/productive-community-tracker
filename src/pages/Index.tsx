import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, Users, Zap } from "lucide-react";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center text-center space-y-8 animate-fade-in">
          <div className="flex flex-col items-center gap-6 mb-4">
            <img src={logo} alt="Valai Veecee Meen Pidipom Logo" className="w-48 h-auto" />
            <h1 className="text-5xl md:text-6xl font-bold text-white">
              Valai Veecee Meen Pidipom
            </h1>
          </div>
          
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl">
            Your private community hub for tracking goals, sharing wins, and growing together
          </p>

          <div className="flex gap-4 mt-8">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-white text-primary hover:bg-white/90 shadow-glow"
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="border-white text-yellow hover:bg-white/10"
            >
              Sign In
            </Button>
            {/* <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/admin")}
              className="bg-white/20 text-white hover:bg-white/30"
            >
              Admin
            </Button> */}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20 animate-slide-up">
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-card">
            <CardContent className="p-6 text-center">
              <Target className="h-12 w-12 text-white mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Track Tasks</h3>
              <p className="text-white/80 text-sm">
                Manage your daily goals with smart task tracking and progress monitoring
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-card">
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-12 w-12 text-white mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Daily Logs</h3>
              <p className="text-white/80 text-sm">
                Document your journey with daily logs and track your consistency
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-card">
            <CardContent className="p-6 text-center">
              <Users className="h-12 w-12 text-white mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Community</h3>
              <p className="text-white/80 text-sm">
                Share your wins, get inspired, and connect with fellow achievers
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-card">
            <CardContent className="p-6 text-center">
              <Zap className="h-12 w-12 text-white mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Gamification</h3>
              <p className="text-white/80 text-sm">
                Earn points, build streaks, and level up your productivity game
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20 space-y-6 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Ready to level up your productivity?
          </h2>
          <p className="text-lg text-white/90 max-w-xl mx-auto">
            Join our community and start building better habits today
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-white text-primary hover:bg-white/90 shadow-glow"
          >
            Join Now - It's Free!
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
