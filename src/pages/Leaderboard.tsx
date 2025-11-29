import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Trophy, Medal, Star } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type Row = { id: string; username: string; avatar_url: string | null; points: number | null };

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, [navigate]);

  const load = async () => {
    const res = await supabase
      .from("profiles")
      .select("id, username, avatar_url, points")
      .order("points", { ascending: false, nullsFirst: false });
    if (!res.error && res.data) setRows(res.data as any);
  };

  useEffect(() => {
    load();
    const chan = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, []);

  const ranked = useMemo(() => {
    let rank = 0;
    let prev: number | null = null;
    return rows.map((r, i) => {
      const pts = r.points || 0;
      if (prev === null || pts !== prev) {
        rank = rank + 1;
        prev = pts;
      }
      return { ...r, rank } as Row & { rank: number };
    });
  }, [rows]);

  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const topPoints = ranked.length ? (ranked[0].points || 0) : 0;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 max-w-5xl flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <h1 className="text-xl font-bold">Leaderboard</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* Podium Section */}
        {top.length > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Rank 2 (Silver) */}
            {top[1] && (
               <Card className="order-2 md:order-1 h-fit border-slate-300 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-slate-400" />
                <CardContent className="p-6 flex flex-col items-center text-center">
                   <div className="relative mb-3">
                        <Avatar className="h-20 w-20 border-4 border-slate-100">
                            <AvatarImage src={top[1].avatar_url || undefined} />
                            <AvatarFallback>{top[1].username.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <Badge className="absolute -bottom-2 inset-x-0 mx-auto w-fit bg-slate-500 hover:bg-slate-500">#2</Badge>
                   </div>
                   <div className="font-bold text-lg">{top[1].username}</div>
                   <div className="text-2xl font-mono font-bold text-slate-600 mt-1">{top[1].points || 0}</div>
                   <div className="text-xs text-muted-foreground">points</div>
                </CardContent>
               </Card>
            )}

            {/* Rank 1 (Gold) */}
            {top[0] && (
               <Card className="order-1 md:order-2 h-fit border-yellow-400 shadow-md relative overflow-hidden transform md:-translate-y-4">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-yellow-400" />
                <div className="absolute top-2 right-2">
                    <Crown className="h-6 w-6 text-yellow-500 fill-yellow-500/20" />
                </div>
                <CardContent className="p-8 flex flex-col items-center text-center">
                   <div className="relative mb-4">
                        <Avatar className="h-24 w-24 border-4 border-yellow-100 shadow-inner">
                            <AvatarImage src={top[0].avatar_url || undefined} />
                            <AvatarFallback>{top[0].username.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <Badge className="absolute -bottom-3 inset-x-0 mx-auto w-fit bg-yellow-500 hover:bg-yellow-500 text-base px-3 py-0.5">#1</Badge>
                   </div>
                   <div className="font-bold text-xl">{top[0].username}</div>
                   <div className="text-4xl font-mono font-black text-yellow-600 mt-2">{top[0].points || 0}</div>
                   <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">points</div>
                </CardContent>
               </Card>
            )}

            {/* Rank 3 (Bronze) */}
            {top[2] && (
               <Card className="order-3 md:order-3 h-fit border-orange-300 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-orange-400" />
                <CardContent className="p-6 flex flex-col items-center text-center">
                   <div className="relative mb-3">
                        <Avatar className="h-20 w-20 border-4 border-orange-50">
                            <AvatarImage src={top[2].avatar_url || undefined} />
                            <AvatarFallback>{top[2].username.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <Badge className="absolute -bottom-2 inset-x-0 mx-auto w-fit bg-orange-500 hover:bg-orange-500">#3</Badge>
                   </div>
                   <div className="font-bold text-lg">{top[2].username}</div>
                   <div className="text-2xl font-mono font-bold text-orange-600 mt-1">{top[2].points || 0}</div>
                   <div className="text-xs text-muted-foreground">points</div>
                </CardContent>
               </Card>
            )}
          </section>
        )}

        {/* List Section */}
        <Card>
          <CardHeader>
            <CardTitle>Rankings</CardTitle>
            <CardDescription>All participants ordered by points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Show remaining players or full list if you prefer. 
                  Currently showing 'rest' to avoid duplicating top 3. */}
              {rest.length === 0 && top.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No data available</div>
              )}
              
              {rest.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-8 text-center font-mono text-muted-foreground font-medium">#{r.rank}</div>
                    <Avatar className="h-9 w-9 border">
                      <AvatarImage src={r.avatar_url || undefined} />
                      <AvatarFallback>{r.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 max-w-[200px] sm:max-w-md">
                      <span className="font-medium truncate">{r.username}</span>
                      {/* Relative Progress Bar */}
                      <div className="h-1.5 w-full bg-muted rounded-full mt-1.5 overflow-hidden">
                        <div 
                            className="h-full bg-primary/60 rounded-full group-hover:bg-primary transition-colors" 
                            style={{ width: `${topPoints ? Math.min(100, Math.round(((r.points||0)/topPoints)*100)) : 0}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="font-mono font-bold ml-4">{r.points || 0}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LeaderboardPage;

export const LeaderboardEmbedded = () => {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const res = await supabase
      .from("profiles")
      .select("id, username, avatar_url, points")
      .order("points", { ascending: false, nullsFirst: false });
    if (!res.error && res.data) setRows(res.data as any);
  };

  useEffect(() => {
    load();
    const chan = supabase
      .channel("leaderboard-embedded")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, []);

  const ranked = useMemo(() => {
    let rank = 0;
    let prev: number | null = null;
    return rows.map((r) => {
      const pts = r.points || 0;
      if (prev === null || pts !== prev) {
        rank = rank + 1;
        prev = pts;
      }
      return { ...r, rank } as Row & { rank: number };
    });
  }, [rows]);
  
  const topPoints = ranked.length ? (ranked[0].points || 0) : 1;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Leaderboard
            </CardTitle>
            <Badge variant="outline">{ranked.length} Players</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto max-h-[400px]">
        <div className="divide-y">
          {ranked.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                <div className={`
                    flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0
                    ${r.rank === 1 ? 'bg-yellow-100 text-yellow-700' : 
                      r.rank === 2 ? 'bg-slate-100 text-slate-700' : 
                      r.rank === 3 ? 'bg-orange-100 text-orange-800' : 'text-muted-foreground'}
                `}>
                    {r.rank <= 3 ? (
                         r.rank === 1 ? <Crown className="h-3.5 w-3.5" /> : r.rank 
                    ) : r.rank}
                </div>
                
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={r.avatar_url || undefined} />
                  <AvatarFallback>{r.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{r.username}</span>
                  </div>
                  <div className="h-1 w-24 bg-muted rounded-full mt-1">
                    <div 
                        className="h-full bg-primary rounded-full opacity-70" 
                        style={{ width: `${Math.min(100, Math.round(((r.points||0)/topPoints)*100))}%` }} 
                    />
                  </div>
                </div>
              </div>
              <div className="font-mono text-sm font-semibold ml-2 text-right">{r.points || 0}</div>
            </div>
          ))}
          {!ranked.length && (
            <div className="p-4 text-center text-sm text-muted-foreground">No ranked players</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};